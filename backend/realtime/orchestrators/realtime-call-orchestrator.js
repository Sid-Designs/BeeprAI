import { CALL_EVENTS, ConversationStates } from "../constants/events.js";
import { websocketEventBus } from "../events/websocket-event-bus.js";
import { realtimeSessionManager } from "../managers/realtime-session-manager.js";
import { conversationStateEngine } from "../engines/conversation-state-engine.js";
import { memoryContextEngine } from "../engines/memory-context-engine.js";
import { dialoguePolicyEngine } from "../engines/dialogue-policy-engine.js";
import { responseValidator } from "../engines/response-validator.js";
import { hallucinationGuard } from "../engines/hallucination-guard.js";
import { promptOrchestrator } from "../engines/prompt-orchestrator.js";
import { realtimeLlmEngine } from "../engines/realtime-llm-engine.js";
import { emotionEngine } from "../engines/emotion-engine.js";
import { handoffManager } from "../managers/handoff-manager.js";
import { interruptionManager } from "../managers/interruption-manager.js";
import { endpointingManager } from "../managers/endpointing-manager.js";
import { silenceDetector } from "../managers/silence-detector.js";
import { LatencyOptimizer } from "../managers/latency-optimizer.js";
import { analyticsEngine } from "../engines/analytics-engine.js";
import { conversationCompressionEngine } from "../engines/conversation-compression-engine.js";
import { outcomeManager } from "../engines/outcome-manager.js";
import { getHandoffQueue } from "../queues/queue-manager.js";
import { multiTenantAgentEngine } from "../engines/multi-tenant-agent-engine.js";

class RealtimeCallOrchestrator {
  constructor() {
    this.latencyOptimizer = new LatencyOptimizer(websocketEventBus);
  }

  async startSession({ callId, tenantId, agentId }) {
    const session = realtimeSessionManager.create(callId, tenantId, agentId);
    websocketEventBus.publish(CALL_EVENTS.CALL_STARTED, { callId, tenantId, agentId });
    await analyticsEngine.track(CALL_EVENTS.CALL_STARTED, { callId, tenantId, agentId });
    return session;
  }

  async onUserSpeechStarted(callId) {
    const session = realtimeSessionManager.get(callId);
    if (!session) return null;

    silenceDetector.markSpeech(callId);
    websocketEventBus.publish(CALL_EVENTS.USER_SPEECH_STARTED, { callId });

    if (session.activeTurnOwner === "assistant") {
      const interrupt = interruptionManager.handleUserSpeechDuringTts(session);
      realtimeSessionManager.update(callId, {
        activeTurnOwner: interrupt.activeTurnOwner,
        metrics: { ...session.metrics, ...interrupt.metrics },
      });
      websocketEventBus.publish(CALL_EVENTS.AI_RESPONSE_INTERRUPTED, { callId, reason: interrupt.reason });
      await analyticsEngine.track(CALL_EVENTS.AI_RESPONSE_INTERRUPTED, { callId, reason: interrupt.reason });
    }

    return realtimeSessionManager.get(callId);
  }

  async onUserSpeechEnded(callId, payload = {}) {
    const turnStart = Date.now();
    const session = realtimeSessionManager.get(callId);
    if (!session) return null;

    websocketEventBus.publish(CALL_EVENTS.USER_SPEECH_ENDED, { callId });

    const silenceMs = silenceDetector.getSilenceMs(callId);
    const endpointDecision = endpointingManager.decide({
      speechDurationMs: Number(payload.speechDurationMs || 600),
      silenceMs,
    });

    if (!endpointDecision.finalize) return session;

    const userText = String(payload.transcript || "").trim();
    const mood = emotionEngine.infer(userText);
    const memory = memoryContextEngine.merge(session.memory, {
      userMood: mood,
      conversationStage: session.currentState,
      collectedEntities: payload.entities || {},
    });
    memory.unresolvedFields = memoryContextEngine.unresolved(memory);

    const mt = await multiTenantAgentEngine.resolve(session.tenantId, session.agentId);
    const handoff = handoffManager.evaluate(userText, Number(payload.clarificationFailures || 0));

    if (handoff.shouldHandoff) {
      websocketEventBus.publish(CALL_EVENTS.HANDOFF_TRIGGERED, { callId, ...handoff });
      const handoffQueue = await getHandoffQueue();
      await handoffQueue.add("handoff", { callId, handoffType: handoff.type, reason: handoff.reason });
      return this.#transferSession(session, handoff.reason);
    }

    const objectiveOutcome = outcomeManager.detectTerminalOutcome(userText, session.currentState);

    let nextState = session.currentState;
    if (session.currentState === ConversationStates.INIT) nextState = ConversationStates.GREETING;
    else if (objectiveOutcome.terminate) nextState = ConversationStates.CLOSING;
    else nextState = ConversationStates.QUALIFICATION;

    const transitioned = conversationStateEngine.transition(session, nextState);
    websocketEventBus.publish(CALL_EVENTS.STATE_CHANGED, { callId, state: transitioned.currentState });

    const prompt = promptOrchestrator.build({
      tenant: mt.tenant,
      agent: mt.agent,
      state: transitioned,
      memory,
      userText,
    });

    websocketEventBus.publish(CALL_EVENTS.AI_RESPONSE_STARTED, { callId });
    let aiText = await realtimeLlmEngine.reply({
      prompt,
      history: session.transcript.slice(-10),
      context: conversationCompressionEngine.compress(session.transcript),
      policy: { orgName: mt.tenant?.name || "", objective: mt.agent?.objective || "qualification" },
      callState: { stage: transitioned.currentState.toLowerCase(), collectedData: memory.collectedEntities },
      conversationState: { userEmotion: mood },
    });

    aiText = dialoguePolicyEngine.enforce(aiText, transitioned, memory);

    const hall = hallucinationGuard.validate({ response: aiText, knownContext: conversationCompressionEngine.compress(session.transcript) });
    const validation = responseValidator.validate({ response: aiText, state: transitioned, memory, objective: session.terminalObjective });

    if (!hall.ok || !validation.ok) {
      websocketEventBus.publish(CALL_EVENTS.FALLBACK_TRIGGERED, { callId, reason: hall.ok ? validation.reason : hall.reason });
      aiText = dialoguePolicyEngine.enforce("I want to keep this quick. What is your main goal on this call?", transitioned, memory);
    }

    const mergedTranscript = [...session.transcript, { role: "user", text: userText }, { role: "assistant", text: aiText }];

    const endState = objectiveOutcome.terminate
      ? conversationStateEngine.transition(transitioned, ConversationStates.TERMINATED)
      : transitioned;

    const latencyMs = this.latencyOptimizer.computeTurnLatency(turnStart);
    const updated = realtimeSessionManager.update(callId, {
      ...endState,
      activeTurnOwner: "assistant",
      memory: {
        ...memory,
        lastQuestion: aiText.includes("?") ? aiText : memory.lastQuestion,
        transferRequired: handoff.shouldHandoff,
      },
      transcript: mergedTranscript,
      metrics: {
        ...session.metrics,
        turnLatencyMs: [...(session.metrics.turnLatencyMs || []), latencyMs],
      },
    });

    websocketEventBus.publish(CALL_EVENTS.AI_RESPONSE_COMPLETED, { callId, text: aiText, latencyMs });
    await analyticsEngine.track(CALL_EVENTS.AI_RESPONSE_COMPLETED, { callId, latencyMs, state: updated.currentState });

    if (updated.currentState === ConversationStates.TERMINATED) {
      websocketEventBus.publish(CALL_EVENTS.CALL_TERMINATED, { callId, reason: objectiveOutcome.outcome });
    }

    return updated;
  }

  async #transferSession(session, reason) {
    const transitioned = conversationStateEngine.transition(session, ConversationStates.TRANSFER);
    const terminated = conversationStateEngine.transition(transitioned, ConversationStates.TERMINATED);
    realtimeSessionManager.update(session.callId, terminated);
    return terminated;
  }
}

export const realtimeCallOrchestrator = new RealtimeCallOrchestrator();
