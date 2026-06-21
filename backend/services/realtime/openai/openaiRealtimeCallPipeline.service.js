import { EventEmitter } from "events";
import { RealtimeEvents } from "../../../events/realtime.events.js";
import { realtimeSessionStore } from "../../session/realtimeSessionStore.service.js";
import { OpenAIRealtimeWsService } from "./openaiRealtimeWs.service.js";
import { OpenAIRealtimeEventRouter } from "./openaiRealtimeEventRouter.service.js";
import { loadTenantPromptProfile } from "../tenantPromptProfile.service.js";
import { AudioChunkSyncService } from "../../audio/audioChunkSync.service.js";
import { JitterBuffer } from "../../audio/jitterBuffer.service.js";
import { base64ToInt16, int16ToBase64 } from "../../audio/pcm.util.js";
import { persistRealtimeMetrics } from "../../analytics/realtimeMetrics.service.js";
import {
  buildCustomerMemorySnapshot,
  buildRealtimeSessionInstructions,
  buildRealtimeTurnInstruction,
  deriveIntentStatusUpdate,
  detectClosingSignals,
  decideRealtimeTurnStrategy,
} from "../realtimeIntelligence.service.js";
import { shapeVoiceFriendlyText } from "../voiceRealism.service.js";

const DEFAULT_SAMPLE_RATE = Number.parseInt(process.env.OPENAI_REALTIME_PCM_RATE || "24000", 10);
const REALTIME_VAD_THRESHOLD = Number.parseFloat(process.env.OPENAI_REALTIME_VAD_THRESHOLD || "0.45");
const REALTIME_VAD_SILENCE_MS = Number.parseInt(process.env.OPENAI_REALTIME_VAD_SILENCE_MS || "320", 10);
const REALTIME_MAX_OUTPUT_TOKENS = Number.parseInt(process.env.OPENAI_REALTIME_MAX_OUTPUT_TOKENS || "90", 10);

export class OpenAIRealtimeCallPipeline extends EventEmitter {
  constructor({
    callId,
    tenantId,
    agentId,
    roomId,
    callerNumber = "",
    sampleRate = DEFAULT_SAMPLE_RATE,
  }) {
    super();
    this.callId = callId;
    this.tenantId = tenantId;
    this.agentId = agentId;
    this.roomId = roomId;
    this.callerNumber = callerNumber;
    this.sampleRate = sampleRate;

    this.ws = new OpenAIRealtimeWsService();
    this.router = new OpenAIRealtimeEventRouter();
    this.chunkSync = new AudioChunkSyncService({ sampleRate });
    this.jitterBuffer = new JitterBuffer({ frameSamples: Math.floor(sampleRate / 50), maxFrames: 500 });
    this.ready = false;
    this.responseOpen = false;
    this.latestAssistantText = "";
    this.latestUserTranscript = "";
    this.lastResponseStartAt = 0;
    this.profile = null;
    this.memorySnapshot = null;
  }

  async start() {
    await realtimeSessionStore.connect();
    const base = realtimeSessionStore.createSession({
      callId: this.callId,
      tenantId: this.tenantId,
      agentId: this.agentId,
      roomId: this.roomId,
      callerNumber: this.callerNumber,
    });
    await realtimeSessionStore.set(this.callId, base);

    const profile = await loadTenantPromptProfile({ tenantId: this.tenantId, agentId: this.agentId });
    const memorySnapshot = await buildCustomerMemorySnapshot({
      tenantId: this.tenantId,
      agentId: this.agentId,
      callerNumber: this.callerNumber,
    });

    this.profile = profile;
    this.memorySnapshot = memorySnapshot;

    this.#bindLocalAudioEvents();
    this.#bindWsEvents();
    this.#bindRouterEvents();

    const primaryIntent = profile.primaryGoal || profile.objective || "assist caller";
    await realtimeSessionStore.upsert(this.callId, {
      memory: {
        ...(base.memory || {}),
        intentState: {
          primaryIntent,
          status: "pending",
          closeConfirmAsked: false,
        },
      },
    });

    const instruction = buildRealtimeSessionInstructions({
      baseInstruction: profile.instruction,
      memorySummary: memorySnapshot.summary,
      compactSummary: "",
      intentState: {
        primaryIntent,
        status: "pending",
      },
    });

    await this.ws.connect();
    this.ws.updateSession({
      instructions: instruction,
      voice: profile.voice,
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      },
      turn_detection: {
        type: "server_vad",
        threshold: Number.isFinite(REALTIME_VAD_THRESHOLD) ? REALTIME_VAD_THRESHOLD : 0.45,
        silence_duration_ms: Number.isFinite(REALTIME_VAD_SILENCE_MS) ? REALTIME_VAD_SILENCE_MS : 320,
      },
      // Realtime voice controls are limited; detailed speaking behavior is enforced via instructions.
    });

    this.ready = true;
    this.emit(RealtimeEvents.CALL_STARTED, { callId: this.callId, roomId: this.roomId });
  }

  async stop(reason = "normal") {
    this.ready = false;
    await this.ws.disconnect();
    const session = await realtimeSessionStore.close(this.callId);
    if (session) await persistRealtimeMetrics(session);
    this.emit(RealtimeEvents.CALL_ENDED, { callId: this.callId, reason });
  }

  async ingestCallerAudioPcm16(samples) {
    if (!this.ready) return;
    const decision = this.chunkSync.ingest(samples);
    this.jitterBuffer.push(samples);

    if (decision.speaking && this.responseOpen) {
      await this.handleBargeIn();
    }

    const buffered = this.jitterBuffer.drainAtLeast(Math.floor(this.sampleRate / 20));
    if (!buffered.length) return;

    this.ws.appendInputAudio(int16ToBase64(buffered));
    this.emit(RealtimeEvents.AUDIO_INCOMING, { callId: this.callId, samples: buffered.length });
  }

  async commitCallerTurn({ userText = "" } = {}) {
    if (!this.ready) return;
    const session = await realtimeSessionStore.get(this.callId);
    const finalUserText = String(userText || this.latestUserTranscript || "").trim();
    const intentState = session?.memory?.intentState || {};
    const nextIntentStatus = deriveIntentStatusUpdate({
      userText: finalUserText,
      previousStatus: intentState.status || "pending",
      primaryIntent: intentState.primaryIntent || this.profile?.primaryGoal || this.profile?.objective,
    });
    const closeSignals = detectClosingSignals({
      userText: finalUserText,
      closeConfirmAsked: Boolean(intentState.closeConfirmAsked),
    });
    const closeConfirmAsked =
      Boolean(intentState.closeConfirmAsked) ||
      nextIntentStatus === "completed" ||
      closeSignals.closeConsent;

    const cachedAnswer = this.#findCachedAssistantAnswer(session, finalUserText);
    const strategy = decideRealtimeTurnStrategy({
      userText: finalUserText,
      cachedAnswer,
      memorySummary: this.memorySnapshot?.summary || "",
    });

    if (session && finalUserText) {
      const userTranscript = session.transcript?.user || [];
      userTranscript.push(finalUserText.slice(0, 500));
      await realtimeSessionStore.upsert(this.callId, {
        transcript: {
          ...(session.transcript || {}),
          user: userTranscript.slice(-50),
        },
        memory: {
          ...(session.memory || {}),
          intentState: {
            ...(intentState || {}),
            primaryIntent:
              intentState.primaryIntent || this.profile?.primaryGoal || this.profile?.objective || "assist caller",
            status: closeSignals.shouldClose ? "closing_confirmed" : nextIntentStatus,
            closeConfirmAsked,
          },
        },
      });
    }

    this.emit(RealtimeEvents.GATE_DECISION, {
      callId: this.callId,
      strategy: strategy.mode,
      reason: strategy.reason,
    });
    await this.#trackGateDecision(session, strategy.mode);

    if (strategy.mode === "skip") {
      return;
    }

    if (strategy.mode === "cache" || strategy.mode === "template") {
      await this.#emitLocalResponse(strategy.localResponse);
      return;
    }

    this.ws.commitInputAudio();
    this.ws.requestResponse({
      modalities: ["text", "audio"],
      instructions: buildRealtimeTurnInstruction({
        primaryIntent:
          intentState.primaryIntent || this.profile?.primaryGoal || this.profile?.objective || "assist caller",
        intentStatus: closeSignals.shouldClose ? "closing_confirmed" : nextIntentStatus,
      }),
      max_output_tokens: REALTIME_MAX_OUTPUT_TOKENS,
    });
    this.lastResponseStartAt = Date.now();
    this.responseOpen = true;

    this.emit(RealtimeEvents.AUDIO_BUFFER_COMMITTED, { callId: this.callId });
  }

  async handleBargeIn() {
    this.ws.cancelResponse();
    this.responseOpen = false;
    const session = await realtimeSessionStore.get(this.callId);
    if (!session) return;

    await realtimeSessionStore.upsert(this.callId, {
      interruptionState: {
        interrupted: true,
        count: Number(session?.interruptionState?.count || 0) + 1,
      },
      metrics: {
        ...(session.metrics || {}),
        interruptions: Number(session?.metrics?.interruptions || 0) + 1,
      },
    });
    this.emit(RealtimeEvents.INTERRUPT_DETECTED, { callId: this.callId });
  }

  #bindLocalAudioEvents() {
    this.chunkSync.on("speech.start", async () => {
      const session = await realtimeSessionStore.get(this.callId);
      if (!session) return;
      await realtimeSessionStore.upsert(this.callId, {
        speakingState: {
          ...(session.speakingState || {}),
          userSpeaking: true,
          assistantSpeaking: false,
        },
      });
      this.emit(RealtimeEvents.USER_SPEECH_START, { callId: this.callId });
    });

    this.chunkSync.on("speech.end", async ({ activeMs }) => {
      const session = await realtimeSessionStore.get(this.callId);
      if (!session) return;
      await realtimeSessionStore.upsert(this.callId, {
        speakingState: {
          ...(session.speakingState || {}),
          userSpeaking: false,
        },
        silence: {
          ...(session.silence || {}),
          activeMs: 0,
          lastSpeechAt: Date.now(),
        },
        metrics: {
          ...(session.metrics || {}),
          silenceDurationMs: Number(session?.metrics?.silenceDurationMs || 0) + Math.max(0, activeMs || 0),
        },
      });
      this.emit(RealtimeEvents.USER_SPEECH_END, { callId: this.callId, activeMs });
    });
  }

  #bindWsEvents() {
    this.ws.on("event", (evt) => this.router.route(evt));
    this.ws.on("reconnect_attempt", (payload) => this.emit("reconnect_attempt", payload));
    this.ws.on("error", async (error) => {
      const session = await realtimeSessionStore.get(this.callId);
      if (session) {
        await realtimeSessionStore.upsert(this.callId, {
          metrics: {
            ...(session.metrics || {}),
            errors: Number(session?.metrics?.errors || 0) + 1,
          },
        });
      }
      this.emit(RealtimeEvents.ERROR, { callId: this.callId, error: error.message });
    });
    this.ws.on("fatal", (error) => this.emit(RealtimeEvents.CALL_FAILED, { callId: this.callId, error }));
  }

  #bindRouterEvents() {
    this.router.on(RealtimeEvents.USER_TRANSCRIPT_FINAL, async (event) => {
      const text = String(event?.transcript || event?.text || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      this.latestUserTranscript = text;
      this.emit(RealtimeEvents.USER_TRANSCRIPT_FINAL, { callId: this.callId, transcript: text });
    });

    this.router.on(RealtimeEvents.USER_TRANSCRIPT_FAILED, async () => {
      await this.#emitLocalResponse("Sorry, I did not catch that clearly. Could you repeat that in one short line?");
    });

    this.router.on(RealtimeEvents.RESPONSE_TEXT_DELTA, async (event) => {
      const delta = String(event?.delta || "");
      this.latestAssistantText += delta;
      this.emit(RealtimeEvents.RESPONSE_TEXT_DELTA, { callId: this.callId, delta });
    });

    this.router.on(RealtimeEvents.RESPONSE_AUDIO_DELTA, (event) => {
      const raw = String(event?.delta || "");
      if (!raw) return;
      const samples = base64ToInt16(raw);
      this.emit(RealtimeEvents.AUDIO_OUTGOING, { callId: this.callId, samples });
      this.emit(RealtimeEvents.RESPONSE_AUDIO_DELTA, { callId: this.callId, delta: raw });
    });

    this.router.on(RealtimeEvents.RESPONSE_DONE, async (event) => {
      const session = await realtimeSessionStore.get(this.callId);
      if (!session) return;
      const assistantTranscript = session.transcript?.assistant || [];
      const firstTokenMs = this.lastResponseStartAt ? Date.now() - this.lastResponseStartAt : 0;
      const usage = event?.response?.usage || {};
      const nextSummary = this.#buildCompactSummary(session, this.latestUserTranscript, this.latestAssistantText);

      await realtimeSessionStore.upsert(this.callId, {
        transcript: {
          ...(session.transcript || {}),
          assistant: [...assistantTranscript, this.latestAssistantText].slice(-50),
        },
        memory: {
          ...(session.memory || {}),
          summary: nextSummary,
        },
        metrics: {
          ...(session.metrics || {}),
          latencies: {
            ...(session.metrics?.latencies || {}),
            modelFirstTokenMs: [
              ...((session.metrics?.latencies?.modelFirstTokenMs || []).slice(-29)),
              firstTokenMs,
            ],
          },
          tokenUsage: {
            input: Number(session.metrics?.tokenUsage?.input || 0) + Number(usage?.input_tokens || 0),
            output: Number(session.metrics?.tokenUsage?.output || 0) + Number(usage?.output_tokens || 0),
            total: Number(session.metrics?.tokenUsage?.total || 0) + Number(usage?.total_tokens || 0),
          },
        },
        speakingState: {
          ...(session.speakingState || {}),
          assistantSpeaking: false,
        },
      });

      this.responseOpen = false;
      this.latestAssistantText = "";
      await this.#refreshSessionInstruction(nextSummary);
      this.latestUserTranscript = "";
      this.emit(RealtimeEvents.RESPONSE_DONE, { callId: this.callId });
    });

    this.router.on(RealtimeEvents.ERROR, (event) => {
      this.emit(RealtimeEvents.ERROR, { callId: this.callId, error: event?.error || event });
    });
  }

  #buildCompactSummary(session, userText, assistantText) {
    const prev = String(session?.memory?.summary || "").trim();
    const user = String(userText || "").replace(/\s+/g, " ").trim();
    const assistant = String(assistantText || "").replace(/\s+/g, " ").trim();
    const parts = [prev];
    if (user) parts.push(`User: ${user}`);
    if (assistant) parts.push(`Assistant: ${assistant}`);
    return parts
      .join("\n")
      .slice(-900)
      .trim();
  }

  #findCachedAssistantAnswer(session, userText) {
    const text = String(userText || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text || !session?.transcript?.user || !session?.transcript?.assistant) return "";

    const users = session.transcript.user;
    const assistants = session.transcript.assistant;
    const pairs = Math.min(users.length, assistants.length);
    for (let i = pairs - 1; i >= 0; i -= 1) {
      const u = String(users[i] || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (u === text) {
        return String(assistants[i] || "").trim();
      }
    }
    return "";
  }

  async #emitLocalResponse(text) {
    const value = shapeVoiceFriendlyText(String(text || "").replace(/\s+/g, " ").trim());
    if (!value) return;

    this.emit(RealtimeEvents.LOCAL_RESPONSE_USED, { callId: this.callId, text: value });
    this.ws.createConversationItem({
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: value }],
    });

    this.ws.requestResponse({
      modalities: ["audio"],
      instructions: "Speak the assistant's last text message exactly, naturally for a phone call.",
    });
    this.responseOpen = true;
    this.lastResponseStartAt = Date.now();
  }

  async #trackGateDecision(session, mode) {
    if (!session) return;
    const current = session.metrics?.gating || {};
    const next = {
      totalTurns: Number(current.totalTurns || 0) + 1,
      modelTurns: Number(current.modelTurns || 0),
      cachedTurns: Number(current.cachedTurns || 0),
      templateTurns: Number(current.templateTurns || 0),
      skippedTurns: Number(current.skippedTurns || 0),
    };

    if (mode === "model" || mode === "hybrid") next.modelTurns += 1;
    if (mode === "cache") next.cachedTurns += 1;
    if (mode === "template") next.templateTurns += 1;
    if (mode === "skip") next.skippedTurns += 1;

    await realtimeSessionStore.upsert(this.callId, {
      metrics: {
        ...(session.metrics || {}),
        gating: next,
      },
    });
  }

  async #refreshSessionInstruction(compactSummary) {
    const session = await realtimeSessionStore.get(this.callId);
    const instruction = buildRealtimeSessionInstructions({
      baseInstruction: this.profile?.instruction || "",
      memorySummary: this.memorySnapshot?.summary || "",
      compactSummary,
      intentState: session?.memory?.intentState || {},
    });

    this.ws.updateSession({
      instructions: instruction,
    });
  }
}
