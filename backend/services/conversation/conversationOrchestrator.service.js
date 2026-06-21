import { conversationManager } from "./conversationManager.service.js";
import { buildModeConstraints, decideDialogueAction } from "./dialogPolicy.service.js";
import { adaptByEmotion, detectEmotion } from "./emotionEngine.service.js";
import { buildMasterSystemPrompt } from "./masterSystemPrompt.service.js";
import { validateResponse } from "./responseValidator.service.js";
import { splitSemanticChunks } from "./streamingResponseController.service.js";
import { callMemoryStore } from "../memory/callMemoryStore.service.js";

const limitWords = (text = "", maxWords = 20) => {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}.`;
};

export const orchestrateConversationTurn = async ({
  sessionId,
  userText,
  llmCall,
  objective = "custom",
  orgName = "the institute",
} = {}) => {
  const state = conversationManager.get(sessionId);
  const memory = callMemoryStore.get(sessionId);
  const emotion = detectEmotion(userText);
  const action = decideDialogueAction({ userText, state });
  const constraints = adaptByEmotion({
    emotion,
    constraints: buildModeConstraints(action.stage),
  });

  const nextState = conversationManager.update(sessionId, {
    stage: action.stage,
    lastIntent: action.reason,
    activeTopic: action.topic || state.activeTopic,
    currentlyExplaining: action.action === "answer_topic" || action.action === "continue",
    unfinishedThought: action.action === "continue",
    expectedNextAction: action.action,
    previousQuestion: userText,
  });

  if (action.action === "close") {
    return {
      answer: "Understood. Thanks for your time. Goodbye.",
      chunks: ["Understood. Thanks for your time. Goodbye."],
      endCall: true,
      stage: nextState.stage,
      state: nextState,
      score: 1,
      source: "policy",
    };
  }

  const masterPrompt = buildMasterSystemPrompt({
    orgName,
    stage: nextState.stage,
    activeTopic: nextState.activeTopic,
    callGoal: nextState.callGoal,
    emotion,
    memorySummary: memory.summary,
  });

  const llmRaw = await llmCall({
    userText,
    masterPrompt,
    constraints,
    state: nextState,
    memory,
    objective,
    action,
  });

  const bounded = limitWords(llmRaw, constraints.maxWords || 20);
  const validated = validateResponse({
    answer: bounded,
    stage: nextState.stage,
    isOpeningTurn: nextState.stage === "greeting",
    previousAiMessage: nextState.lastAIMessage,
  });

  const finalText = validated.answer || "Sure. Let me help with that clearly.";
  const chunks = splitSemanticChunks(finalText);

  conversationManager.update(sessionId, {
    lastAIMessage: finalText,
    unfinishedThought: false,
    currentlyExplaining: false,
  });
  callMemoryStore.pushTurn(sessionId, "user", userText);
  callMemoryStore.pushTurn(sessionId, "assistant", finalText);

  return {
    answer: finalText,
    chunks,
    endCall: action.action === "close",
    stage: nextState.stage,
    state: nextState,
    score: validated.score,
    source: "orchestrated",
  };
};

