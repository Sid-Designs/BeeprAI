import "../config/env.js";
import {
  AudioFrame,
  AudioSource,
  AudioResampler,
  AudioResamplerQuality,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import fs from "node:fs";
import { logInfo, logWarn, logError } from "../utils/logging.util.js";
import { createSTTSession } from "./stt.service.js";
import { queryAI, finalizeCall } from "./ai.service.js";
import {
  ENABLE_TTS_STREAMING,
  generateSpeech,
  abandonSpeechStream,
  openSpeechStream,
  warmupTtsConnection,
  warmupTtsWavConnection,
  TTS_STREAM_SAMPLE_RATE,
} from "./tts.service.js";
import { createStreamingTTSPlayback } from "./streamingTtsPlayback.service.js";
import {
  LIVEKIT_AUDIO_RATE,
  STT_SAMPLE_RATE,
  TTS_OUTPUT_RATE,
} from "../config/audioQuality.config.js";
import {
  convertToMono,
  normalizePcmForPlayback,
  createFramePusher,
} from "./audio/pcmPlayback.util.js";
import { splitSemanticChunksWithFastStart } from "./conversation/streamingResponseController.service.js";
import { deriveConversationState, getInitialConversationState } from "./emotion.service.js";
import { getInitialLanguageState, resolveLanguageConfig, detectLanguageProfile } from "./language.service.js";
import {
  closeCallAnalytics,
  ensureCallAnalytics,
  getCallAnalyticsSnapshot,
  trackEmotion,
  trackFallback,
  trackInterruption,
  trackLatencyMetric,
  trackSuccessfulAnswer,
} from "./callAnalytics.service.js";
import { CircuitBreaker, withCircuitBreaker } from "./resilience/circuitBreaker.service.js";
import {
  buildTurnPolicy,
  detectIntentLabel,
  enforcePolicyOnAnswer,
} from "./policy/dialoguePolicyEngine.service.js";
import { TurnPipelineOrchestrator } from "./realtime/orchestrators/turnPipelineOrchestrator.js";
import { isBookingAffirmation } from "./conversation/bookingFlow.service.js";
import { extractPhoneFromIdentity } from "./postCall/transcriptAggregator.service.js";
import {
  shouldApplyWorkerAnswerRecovery,
  syncWorkerStateFromApi,
} from "./conversation/callStateSync.service.js";
import { deriveActiveTopic } from "./conversation/interruptionResume.service.js";
import {
  buildSilenceGoodbye,
  buildSilencePresencePrompt,
} from "./conversation/silencePresence.service.js";
import { isSchedulingOrBookingRequest } from "./conversation/conversationPlaybook.service.js";
import { normalizeSpokenTimeText } from "./conversation/indicDateTime.service.js";

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

const BOT_IDENTITY = "ai-worker";

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const TTS_TARGET_CHUNK_CHARS = positiveInt(
  process.env.TTS_TARGET_CHUNK_CHARS || process.env.TTS_FIRST_CHUNK_CHARS,
  140,
);
const TTS_FIRST_CHUNK_CHARS = positiveInt(process.env.TTS_FIRST_CHUNK_CHARS, 90);
const TTS_HARD_MAX_CHUNK_CHARS = positiveInt(process.env.TTS_HARD_MAX_CHUNK_CHARS, 280);
const TTS_MIN_TAIL_CHUNK_CHARS = positiveInt(process.env.TTS_MIN_TAIL_CHUNK_CHARS, 80);
const TTS_INTER_CHUNK_PAUSE_MS = positiveInt(process.env.TTS_INTER_CHUNK_PAUSE_MS, 40);

const DUPLICATE_FINAL_DEBOUNCE_MS = positiveInt(
  process.env.DUPLICATE_FINAL_DEBOUNCE_MS,
  900,
);
const END_SPEECH_COMMIT_DELAY_MS = positiveInt(
  process.env.END_SPEECH_COMMIT_DELAY_MS,
  120,
);
const NEW_TURN_PAUSE_MS = positiveInt(process.env.NEW_TURN_PAUSE_MS, 120);
const TURN_MERGE_WINDOW_MS = positiveInt(process.env.TURN_MERGE_WINDOW_MS, 1400);
const REALTIME_HISTORY_MESSAGES = positiveInt(process.env.REALTIME_HISTORY_MESSAGES, 30);
const STT_WATCHDOG_COOLDOWN_MS = positiveInt(process.env.STT_WATCHDOG_COOLDOWN_MS, 4000);
const FAST_INTENT_COOLDOWN_MS = positiveInt(process.env.FAST_INTENT_COOLDOWN_MS, 2500);
const BARGE_FRAGMENT_SUPPRESS_MS = positiveInt(process.env.BARGE_FRAGMENT_SUPPRESS_MS, 1200);
const CALLBACK_AGGREGATE_MS = positiveInt(process.env.CALLBACK_AGGREGATE_MS, 650);
const PARTIAL_CARRY_MS = positiveInt(process.env.PARTIAL_CARRY_MS, 850);
const BOOKING_PARTIAL_CARRY_MS = positiveInt(process.env.BOOKING_PARTIAL_CARRY_MS, 1200);
const PENDING_SPEECH_SILENCE_MS = positiveInt(process.env.PENDING_SPEECH_SILENCE_MS, 700);
const ENABLE_STREAMING_TURN_PIPELINE =
  String(process.env.ENABLE_STREAMING_TURN_PIPELINE || "true").toLowerCase() === "true";
const ENABLE_TTS_FILLERS = false; // DISABLED: Corrupts Sarvam output with repetitive fillers
const ENABLE_TTS_PUNCT_SOFTEN = false; // DISABLED: Removes punctuation that Sarvam needs for natural pausing
const ROOM_IDLE_DISCONNECT_MS = positiveInt(process.env.ROOM_IDLE_DISCONNECT_MS, 1500);
const CALL_ANSWER_TIMEOUT_MS = positiveInt(process.env.CALL_ANSWER_TIMEOUT_MS, 45000);
const INTERRUPTION_MIN_MS = positiveInt(process.env.INTERRUPTION_MIN_MS, 300);
const SILENCE_PRESENCE_MS = positiveInt(
  process.env.SILENCE_PRESENCE_MS || process.env.SILENCE_CHECK_MS,
  22000,
);
const SILENCE_PROMPT_WAIT_MS = positiveInt(process.env.SILENCE_PROMPT_WAIT_MS, 18000);
const SILENCE_MAX_PROMPTS = positiveInt(process.env.SILENCE_MAX_PROMPTS, 2);
const INITIAL_RESPONSE_GRACE_MS = positiveInt(process.env.INITIAL_RESPONSE_GRACE_MS, 9000);
const POST_GREETING_LISTEN_DELAY_MS = positiveInt(process.env.POST_GREETING_LISTEN_DELAY_MS, 700);
const ECHO_SIMILARITY_THRESHOLD = Number.parseFloat(
  String(process.env.ECHO_SIMILARITY_THRESHOLD || "0.62"),
);
const MIN_INTERRUPT_TRANSCRIPT_CHARS = positiveInt(process.env.MIN_INTERRUPT_TRANSCRIPT_CHARS, 8);
const MIN_INTERRUPT_TRANSCRIPT_WORDS = positiveInt(process.env.MIN_INTERRUPT_TRANSCRIPT_WORDS, 2);
const SHORT_USER_TURN_ALLOW_RE =
  /^(yes|yeah|yep|no|nope|ok|okay|sure|thanks|thank you|hello|hi|bye|goodbye)$/i;
const TURN_NOISE_TAIL_RE = /\b(ok(?:ay)?|hmm|uh|hello|hi)\b$/i;
const QUICK_CLOSE_RE =
  /\b(bye|goodbye|end call|end the call|close the call|hang up|cut the call|thank you bye|thanks bye)\b/i;
const QUICK_THANKS_RE = /^(thanks|thank you|ok thanks|okay thanks|great thanks)\b/i;
const QUICK_ACK_RE = /^(ok|okay|yes|yeah|yep|sure|alright)\s*$/i;
const QUICK_START_RE = /^(ok|okay|yes|yeah|yep|sure|alright)[,\s]+(let'?s|lets)\s+start\b/i;
const APPOINTMENT_HINT_RE =
  /\b(book(?:ing)?|schedul(?:e|ing|ed)|fix|arrange)\b.*\b(a+p+ointments?|appointments?|meeting|counsell?(?:ing|or)?|counselou?r(?:\s+call)?|slot|call)\b|\bbook\s+(?:an?\s+)?a+p+ointment\b|\bscheduling\b.*\b(request|counselou?r|call)\b/i;
const CALLBACK_HINT_RE =
  /\b(call back|callback|call me later|call me again|talk later|busy now|i am busy|i'm busy)\b/i;
const ADMISSION_INTENT_RE = /\b(admission|apply|application|process|form|eligibility|fees|course|program)\b/i;
const HELP_INTENT_RE = /\b(help|assist|guide|support)\b/i;
const CLOSING_INTENT_RE =
  /\b(bye|goodbye|end call|end the call|close the call|hang up|cut the call|not interested|stop)\b/i;
const NON_ACTIONABLE_FRAGMENT_RE =
  /^(about|and|you|can|okay and you can|ok and you can|hmm|uh|ha|huh|verified|process)$/i;
const WEAK_CALLING_REPLY_RE =
  /^(thanks for sharing that\.?|i'?ll keep this quick and help you complete\.?|not backwards[—-]?\s*just a bit out of flow\.?)$/i;
const DANGLING_END_RE =
  /\b(for|about|with|and|or|to|of|the|a|an|your|are|is|open|offer|checking|when|where|what|which|how|who)\s*\.?$/i;
const INCOMPLETE_TAIL_CLAUSE_RE =
  /\b(when are|for your|isn't open for your|i can offer|checking appointment availability for you)\s*\.?$/i;
const TRAILING_CONNECTOR_RE = /\b(and|or|but|so|then)\s*$/i;
const INCOMPLETE_SCHEDULING_RE =
  /\b(?:on|for)\s+\d{1,2}(?:st|nd|rd|th)?\s*$|\b\d{1,2}(?:st|nd|rd|th)\s*$|\b(?:tomorrow|today|around|at|call me|book|schedule|arrange|visit)\s*\??$/i;
const MONTH_NAME_FRAGMENT_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const INCOMPLETE_QUESTION_RE =
  /^(can you|could you|will you|tell me|what about|how about|i want to|i was)\b/i;
const LOW_VALUE_MERGE_FRAGMENT_RE =
  /^(okay|ok|are you|yeah|yes|correct|right|hmm|uh|so|and|i was|okay are you)\b/i;
const SUBSTANTIVE_MERGE_DELTA_RE =
  /\b(eligib|fee|fees|schedule|appointment|visit|college|campus|book|tomorrow|counselou?r|counsell\w*|admission|process|name)\b/i;
const TIME_SELECTION_RE =
  /\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b|\b\d{3,4}\b/i;
const BOOKING_STAGE_RE = /^(appointment_booking|confirmation|appointment|callback)$/;

const isSubstantiveUserQuery = (text = "") => {
  const value = normalizeText(text).toLowerCase();
  if (!value) return false;
  if (ADMISSION_INTENT_RE.test(value) || APPOINTMENT_HINT_RE.test(value) || CALLBACK_HINT_RE.test(value)) {
    return true;
  }
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 3 && /\b(admission|process|eligib|fee|schedule|appointment|visit|college|campus|mca|mba|pgdm)\b/i.test(value);
};

const extractMergeDelta = (previous = "", merged = "") => {
  const prev = normalizeText(previous).toLowerCase();
  const full = normalizeText(merged).toLowerCase();
  if (!full) return "";
  if (!prev) return normalizeText(merged);
  if (full === prev) return "";
  if (full.startsWith(`${prev} `)) return normalizeText(merged.slice(prev.length));
  return normalizeText(merged);
};

const isLowValueMergeDelta = (delta = "") => {
  const text = normalizeText(delta).toLowerCase();
  if (!text) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (/^(go ahead|please go ahead|you can go ahead|continue|sure go ahead)$/i.test(text)) return true;
  if (words.length <= 4 && LOW_VALUE_MERGE_FRAGMENT_RE.test(text)) return true;
  if (words.length <= 2 && NON_ACTIONABLE_FRAGMENT_RE.test(text)) return true;
  if (TRAILING_CONNECTOR_RE.test(text) || DANGLING_END_RE.test(text)) return true;
  return false;
};

const shouldSuppressTurnMerge = (previousQueued, mergedText, lastCompletedUserText, answeringUserText) => {
  const delta = extractMergeDelta(previousQueued, mergedText);
  if (SUBSTANTIVE_MERGE_DELTA_RE.test(delta)) return false;
  if (isLowValueMergeDelta(delta)) return true;
  const referenceTexts = [lastCompletedUserText, answeringUserText].filter(Boolean);
  for (const reference of referenceTexts) {
    const completed = normalizeText(reference).toLowerCase();
    const merged = normalizeText(mergedText).toLowerCase();
    if (!completed || !merged.startsWith(completed)) continue;
    if (isLowValueMergeDelta(delta)) return true;
  }
  if (!lastCompletedUserText && !answeringUserText) return false;
  const completed = normalizeText(lastCompletedUserText || answeringUserText).toLowerCase();
  const merged = normalizeText(mergedText).toLowerCase();
  if (!completed || !merged.startsWith(completed)) return false;
  return isLowValueMergeDelta(delta);
};

const SESSION_STATE_ACTIVE = "active";
const SESSION_STATE_CLOSING = "closing";
const SESSION_STATE_ENDED = "ended";

const FILLERS_BY_STYLE = Object.freeze({
  calm: ["Sure,", "Okay,", "Alright,"],
  warm: ["Absolutely,", "Great question,", "Of course,"],
  closing: ["Understood,", "Thanks for sharing,", "Got it,"],
});

const SIP_CONNECTED_STATUSES = new Set([
  "active",
  "active_talking",
  "answered",
  "automation",
  "connected",
  "in-progress",
  "in_progress",
  "in-call",
  "in_call",
  "bridged",
]);

const SIP_TERMINAL_STATUSES = new Set([
  "busy",
  "cancelled",
  "canceled",
  "declined",
  "disconnected",
  "ended",
  "failed",
  "hangup",
  "hungup",
  "no-answer",
  "no_answer",
  "rejected",
  "unavailable",
]);

const getLiveKitHost = () =>
  String(LIVEKIT_URL || "")
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");

const generateToken = async (roomName, identity = BOT_IDENTITY) => {
  const at = new AccessToken(API_KEY, API_SECRET, { identity });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canSubscribe: true,
    canPublish: true,
  });

  return at.toJwt();
};

const isAudioKind = (kind) => {
  const value = String(kind).toLowerCase();
  return value === "audio" || value === "1";
};

const isSipParticipant = (participant) => {
  const kind = String(participant?.kind ?? "").toLowerCase();
  return kind === "sip" || kind === "3";
};

const safeClose = async (fn) => {
  try {
    await fn?.();
  } catch {}
};

const normalizeText = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

const getSipCallStatus = (participant) =>
  normalizeText(participant?.attributes?.["sip.callStatus"]).toLowerCase();

const isSipCallConnectedStatus = (status) => {
  const normalized = normalizeText(status).toLowerCase();
  if (!normalized) return false;
  if (SIP_CONNECTED_STATUSES.has(normalized)) return true;
  if (normalized.startsWith("active")) return true;
  return false;
};

const isSipCallTerminalStatus = (status) => {
  const normalized = normalizeText(status).toLowerCase();
  if (!normalized) return false;
  if (SIP_TERMINAL_STATUSES.has(normalized)) return true;
  if (
    normalized.includes("hangup") ||
    normalized.includes("disconnect") ||
    normalized.includes("declin") ||
    normalized.includes("cancel") ||
    normalized.includes("reject")
  ) {
    return true;
  }
  return false;
};

const splitIntoSentences = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [];
  return sentences
    .map((sentence) => normalizeText(sentence))
    .filter(Boolean);
};

const splitLongChunk = (chunk, maxChars = TTS_HARD_MAX_CHUNK_CHARS) => {
  const text = normalizeText(chunk);
  if (!text) return [];
  if (text.length <= maxChars) return [text];

  const words = text.split(" ").filter(Boolean);
  const parts = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
      current = word;
      continue;
    }

    // Fallback for very long token without spaces.
    parts.push(word.slice(0, maxChars));
    current = word.slice(maxChars);
  }

  if (current) {
    parts.push(current);
  }

  return parts.filter(Boolean);
};

const splitAnswerForTts = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (normalized.length <= TTS_FIRST_CHUNK_CHARS) return [normalized];

  const sentences = splitIntoSentences(normalized);
  if (sentences.length <= 1) {
    const parts = splitLongChunk(normalized);
    if (parts.length <= 1) return parts;
    const [first, ...rest] = parts;
    if (first.length <= TTS_FIRST_CHUNK_CHARS) return [first, ...rest].filter(Boolean);
    return [
      first.slice(0, TTS_FIRST_CHUNK_CHARS).trim(),
      `${first.slice(TTS_FIRST_CHUNK_CHARS).trim()} ${rest.join(" ")}`.trim(),
    ].filter(Boolean);
  }

  const chunks = [];
  let current = "";
  let usingFirstLimit = true;

  for (const sentence of sentences) {
    const limit = usingFirstLimit ? TTS_FIRST_CHUNK_CHARS : TTS_TARGET_CHUNK_CHARS;
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      usingFirstLimit = false;
      current = sentence;
      continue;
    }

    for (const part of splitLongChunk(sentence, limit)) {
      chunks.push(part);
      usingFirstLimit = false;
    }
    current = "";
  }

  if (current) chunks.push(current);

  if (chunks.length >= 2) {
    const tail = chunks[chunks.length - 1];
    const head = chunks[chunks.length - 2];
    if (
      tail.length < TTS_MIN_TAIL_CHUNK_CHARS &&
      head.length + 1 + tail.length <= TTS_HARD_MAX_CHUNK_CHARS
    ) {
      chunks[chunks.length - 2] = `${head} ${tail}`;
      chunks.pop();
    }
  }

  return chunks.filter(Boolean);
};

const shouldUseSingleTtsChunk = (answer, options = {}) => {
  const normalized = normalizeText(answer);
  return (
    Boolean(options.singleChunk) ||
    String(options.stage || "").toLowerCase() === "opening" ||
    normalized.length <= 320
  );
};

const looksLikeCompleteThought = (text) => {
  const value = normalizeText(text);
  if (!value) return false;

  const words = value.split(" ").filter(Boolean);

  if (/[?.!]$/.test(value)) return true;
  if (words.length >= 5) return true;

  return /^(who|what|when|where|why|how|can|could|would|should|is|are|do|does|did|tell|explain|help)\b/i.test(
    value,
  );
};

const mergeTranscript = (previous, next) => {
  const oldText = normalizeText(previous);
  const newText = normalizeText(next);

  if (!newText) return oldText;
  if (!oldText) return newText;

  const oldLower = oldText.toLowerCase();
  const newLower = newText.toLowerCase();

  if (newLower.startsWith(oldLower)) {
    return newText;
  }

  if (oldLower.includes(newLower)) {
    return oldText;
  }

  const oldWords = oldText.split(" ");
  const newWords = newText.split(" ");
  const maxOverlap = Math.min(oldWords.length, newWords.length, 12);
  let overlap = 0;

  for (let size = maxOverlap; size >= 2; size -= 1) {
    const oldTail = oldWords.slice(-size).join(" ").toLowerCase();
    const newHead = newWords.slice(0, size).join(" ").toLowerCase();
    if (oldTail === newHead) {
      overlap = size;
      break;
    }
  }

  if (overlap > 0) {
    return `${oldText} ${newWords.slice(overlap).join(" ")}`.trim();
  }

  return `${oldText} ${newText}`.trim();
};

const tokenizeForSimilarity = (text) =>
  normalizeText(text)
    .toLowerCase()
    .split(" ")
    .filter((token) => token && token.length > 2);

const jaccardSimilarity = (left, right) => {
  const a = new Set(tokenizeForSimilarity(left));
  const b = new Set(tokenizeForSimilarity(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = new Set([...a, ...b]).size || 1;
  return overlap / union;
};

const compactTurnText = (text = "") => {
  let value = normalizeText(text);
  if (!value) return "";

  // Trim noisy tails that often leak from STT during barge-in transitions.
  for (let i = 0; i < 3; i += 1) {
    if (!TURN_NOISE_TAIL_RE.test(value)) break;
    value = normalizeText(value.replace(TURN_NOISE_TAIL_RE, ""));
  }

  const words = value.split(" ").filter(Boolean);
  if (words.length <= 2) return value;

  // Collapse immediate duplicate token runs: "about about" -> "about".
  const compact = [];
  for (let i = 0; i < words.length; i += 1) {
    const current = words[i];
    const prev = compact[compact.length - 1];
    if (prev && prev.toLowerCase() === current.toLowerCase()) continue;
    compact.push(current);
  }

  return normalizeText(compact.join(" "));
};

const normalizeSttUtterance = (text = "") => {
  let value = normalizeText(text);
  if (!value) return "";

  value = value.replace(/\b(gas|guess|gus|yes)\s+go\s+ahead\b/gi, "yes go ahead");
  value = value.replace(/\b(go|got)\s+ahead\b/gi, "go ahead");

  if (
    TIME_SELECTION_RE.test(value) ||
    APPOINTMENT_HINT_RE.test(value) ||
    /\b(tomorrow|today|appointment|schedule|book)\b/i.test(value)
  ) {
    value = normalizeText(normalizeSpokenTimeText(value));
  }

  return value;
};

const mergeTurnTexts = (previous = "", next = "") =>
  compactTurnText(mergeTranscript(previous, next));
const compactLogText = (text = "", max = 220) => {
  const value = normalizeText(text);
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
};

const resolveFastIntentReply = (text = "") => {
  const value = normalizeText(text).toLowerCase();
  if (!value) return null;

  if (QUICK_CLOSE_RE.test(value)) {
    return { answer: "Thanks for your time. Goodbye.", endCall: true, endReason: "user_requested_end" };
  }
  if (QUICK_START_RE.test(value)) {
    return {
      answer: "Great. Which course are you interested in?",
      endCall: false,
      endReason: "",
    };
  }
  if (QUICK_THANKS_RE.test(value)) {
    return { answer: "You are welcome. Anything else before we close?", endCall: false, endReason: "" };
  }
  return null;
};

const recoverWeakAnswer = ({ answer = "", turnIntent = "", objective = "custom", userText = "" } = {}) => {
  const value = normalizeText(answer);
  const words = value.split(" ").filter(Boolean);
  const weakOneLiner =
    words.length <= 2 || /^(perfect|great|okay|sure|alright|noted)[!,. ]*$/i.test(value);
  const hasCourseMention =
    /\b(b\s*c\s*a|b\.?\s*com|b\.?\s*ca|m\.?\s*com|m\.?\s*ca|bachelor|master|commerce|computer application)\b/i
      .test(normalizeText(userText));

  if (!weakOneLiner) return value;
  if (turnIntent === "closing") return value || "Thanks for your time. Goodbye.";
  if (turnIntent === "appointment_booking") {
    return "Sure. What date and time should I book the appointment for?";
  }
  if (turnIntent === "callback") return "Sure. What exact time should I call you back?";
  if (hasCourseMention) return "Great, noted. When are you planning to start?";
  if (String(objective).toLowerCase() === "appointment_booking") {
    return "Great. What date works best for your appointment?";
  }
  return "Great. Which course are you interested in?";
};

const enforceCallingFlowAnswer = ({
  answer = "",
  userText = "",
  turnIntent = "",
  language = "en",
  objective = "custom",
} = {}) => {
  const value = normalizeText(answer);
  const query = normalizeText(userText).toLowerCase();
  const lang = normalizeText(language).toLowerCase();
  const wantsMarathi = /speak in marathi|marathi madhye|मराठीत|मराठीत|marathit/i.test(query);
  const wantsEnglishOnly = /english only|in english|english madhye|only english/i.test(query);

  if (wantsMarathi) {
    return "हो, नक्की. आपण मराठीत बोलूया. तुला कोणत्या course बद्दल माहिती हवी आहे?";
  }
  if (wantsEnglishOnly) {
    return "Sure, we will continue in English only. Would you like course details, eligibility, or admission steps first?";
  }

  if (WEAK_CALLING_REPLY_RE.test(value)) {
    if (lang.startsWith("mr")) {
      return "नक्की. अॅडमिशनसाठी course निवडणे, eligibility आणि documents हे मुख्य टप्पे आहेत. तुला आधी कोणता भाग समजावू?";
    }
    return "Sure. Admissions usually have course selection, eligibility check, and document submission. Which part should I explain first?";
  }

  if ((turnIntent === "admission_query" || /\b(admission|process|course|fees|eligibility)\b/.test(query))
      && !/\?/.test(value)) {
    if (lang.startsWith("mr") && wantsMarathi) {
      return `${value} तुला course, eligibility, की process यापैकी काय आधी हवं?`;
    }
    return `${value} Would you like course options, eligibility, or process first?`;
  }

  return value;
};

const cleanOutgoingAnswer = (answer = "") => {
  let value = normalizeText(answer);
  if (!value) return "";

  const sentences = value.match(/[^.!?]+[.!?]+/g) || [value];
  while (sentences.length > 1) {
    const tail = normalizeText(sentences[sentences.length - 1]).replace(/[.!?]+$/, "");
    if (INCOMPLETE_TAIL_CLAUSE_RE.test(tail) || DANGLING_END_RE.test(tail)) {
      sentences.pop();
      continue;
    }
    break;
  }
  value = sentences.join(" ").trim() || value;

  value = value
    .replace(/\b(B|M)\.\s*$/i, "")
    .replace(/\bfor\s+(B|M)\.\s*$/i, "")
    .replace(/\s+[—-]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (DANGLING_END_RE.test(value)) {
    value = value.replace(DANGLING_END_RE, "").trim();
  }
  if (!value) return "";
  if (!/[.!?]$/.test(value)) value = `${value}.`;
  return value;
};

const shouldAggregateUtterance = (text = "") => {
  const value = normalizeText(text).toLowerCase();
  if (!value) return false;
  if (APPOINTMENT_HINT_RE.test(value)) return true;
  if (CALLBACK_HINT_RE.test(value)) return true;
  if (
    MONTH_NAME_FRAGMENT_RE.test(value) &&
    /\b(around|at|\d{1,2}\s*(?:am|pm)|morning|afternoon|evening)\b/i.test(value)
  ) {
    return true;
  }
  return /\b(tomorrow|today|\d{1,2}\s?(?:am|pm)|morning|afternoon|evening)\b/i.test(value);
};

const BOOKING_CONFIRM_RE =
  /\b(confirm|कन्फर्म|conform|book it|yes confirm|yeah confirm|haan confirm|कर दो|कर दें)\b/i;

const detectTurnIntent = (text = "", runtimeState = null) => {
  const value = normalizeText(text).toLowerCase();
  if (!value) return "unknown";
  if (CLOSING_INTENT_RE.test(value)) return "closing";
  if (isSchedulingOrBookingRequest(value)) return "appointment_booking";
  if (APPOINTMENT_HINT_RE.test(value)) return "appointment_booking";
  if (CALLBACK_HINT_RE.test(value)) return "callback";
  const stage = String(
    runtimeState?.conversationState?.stage || runtimeState?.callStage || "",
  ).toLowerCase();
  const bookingReadiness = String(
    runtimeState?.bookingReadiness ||
    runtimeState?.conversationState?.bookingReadiness ||
    "",
  ).toLowerCase();
  const inBooking =
    BOOKING_STAGE_RE.test(stage) ||
    bookingReadiness === "ready" ||
    bookingReadiness === "probing";
  if (stage === "confirmation" && BOOKING_CONFIRM_RE.test(value)) {
    return "appointment_booking";
  }
  if (inBooking && (TIME_SELECTION_RE.test(value) || shouldAggregateUtterance(value))) {
    return "appointment_booking";
  }
  if (inBooking && /\bmy name is\b/i.test(value)) {
    return "appointment_booking";
  }
  if (
    (inBooking || bookingReadiness === "ready") &&
    MONTH_NAME_FRAGMENT_RE.test(value) &&
    /\b(around|at|\d{1,2}\s*(?:am|pm)|morning|afternoon|evening)\b/i.test(value)
  ) {
    return "appointment_booking";
  }
  if (ADMISSION_INTENT_RE.test(value)) return "admission_query";
  if (HELP_INTENT_RE.test(value)) return "help_request";
  if (QUICK_THANKS_RE.test(value)) return "gratitude";
  if (QUICK_ACK_RE.test(value)) return "acknowledgement";
  return "general_query";
};

const resolveSttLanguageCode = (language = "en") => {
  const key = normalizeText(language).toLowerCase();
  if (key === "hi" || key === "hindi") return "hi-IN";
  if (key === "mr" || key === "marathi") return "mr-IN";
  return "en-IN";
};

const parseWavBuffer = (wavBuffer) => {
  if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) {
    throw new Error("Invalid WAV buffer");
  }

  if (
    wavBuffer.toString("ascii", 0, 4) !== "RIFF" ||
    wavBuffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Unsupported TTS audio format. Expected WAV.");
  }

  let offset = 12;
  let sampleRate = 16000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      const audioFormat = wavBuffer.readUInt16LE(chunkDataStart);
      numChannels = wavBuffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = wavBuffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = wavBuffer.readUInt16LE(chunkDataStart + 14);

      if (audioFormat !== 1) {
        throw new Error("Only PCM WAV is supported");
      }
    }

    if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0) {
    throw new Error("WAV data chunk not found");
  }

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    pcm: wavBuffer.subarray(dataStart, dataStart + dataSize),
  };
};

const createTTSPlayback = async (room, wavBuffer) => {
  let stopped = false;
  let closed = false;

  const { sampleRate, numChannels, bitsPerSample, pcm } =
    parseWavBuffer(wavBuffer);

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
  }

  const source = new AudioSource(TTS_OUTPUT_RATE, 1);
  const needsResample = sampleRate !== TTS_OUTPUT_RATE;
  const resampler = needsResample
    ? new AudioResampler(sampleRate, TTS_OUTPUT_RATE, 1, AudioResamplerQuality.HIGH)
    : null;
  const framePusher = createFramePusher(source, TTS_OUTPUT_RATE);

  const track = LocalAudioTrack.createAudioTrack("ai-voice", source);

  const options = new TrackPublishOptions();
  options.source = TrackSource.SOURCE_MICROPHONE;

  const close = async () => {
    if (closed) return;
    closed = true;

    await safeClose(() => track.close(false));
    await safeClose(() => source.close());
    if (resampler) await safeClose(() => resampler.close());
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;

    await close();
    console.log("[tts] interrupted");
  };

  const done = (async () => {
    try {
      await room.localParticipant.publishTrack(track, options);

      const samples = normalizePcmForPlayback(convertToMono(pcm, numChannels));
      const inputFrameSize = Math.max(1, Math.floor(sampleRate / 50));

      console.log("[tts] playing", {
        wavRate: sampleRate,
        publishRate: TTS_OUTPUT_RATE,
        resampled: needsResample,
      });

      for (let i = 0; i + inputFrameSize <= samples.length; i += inputFrameSize) {
        if (stopped) break;

        const frameSamples = new Int16Array(samples.slice(i, i + inputFrameSize));
        const inputFrame = new AudioFrame(
          frameSamples,
          sampleRate,
          1,
          frameSamples.length,
        );

        if (!needsResample) {
          await framePusher.pushSamples(frameSamples);
          continue;
        }

        for (const outputFrame of resampler.push(inputFrame)) {
          if (stopped) break;
          await framePusher.pushSamples(outputFrame.data);
        }
      }

      if (!stopped) {
        if (needsResample) {
          for (const outputFrame of resampler.flush()) {
            if (stopped) break;
            await framePusher.pushSamples(outputFrame.data);
          }
        }
        await framePusher.flush();
        await source.waitForPlayout();
        console.log("[tts] finished");
      }
    } finally {
      await close();
    }
  })();

  return {
    stop,
    done,
  };
};

export const startLiveKitWorker = async (roomName, options = {}) => {
  const { tenantId, agentId, callObjective = "", callConfig = null } = options;
  const languageConfig = resolveLanguageConfig(callConfig || {});

  const debugStt = String(process.env.DEBUG_STT || "").toLowerCase() === "true";
  const debugTtsWav =
    String(process.env.DEBUG_TTS_WAV || "").toLowerCase() === "true";
  const debugLatency =
    String(process.env.DEBUG_LATENCY || "").toLowerCase() === "true";
  const verboseCallLogs =
    String(process.env.VERBOSE_CALL_LOGS || "false").toLowerCase() === "true";
  const verboseSttLogs =
    String(process.env.VERBOSE_STT_LOGS || "false").toLowerCase() === "true";
  const verboseTtsLogs =
    String(process.env.VERBOSE_TTS_LOGS || "false").toLowerCase() === "true";
  const speechLifecycleLogs =
    String(process.env.SPEECH_LIFECYCLE_LOGS || "true").toLowerCase() === "true";

  const callLog = (...args) => {
    if (verboseCallLogs) console.log(...args);
  };
  const sttLog = (...args) => {
    if (verboseSttLogs) console.log(...args);
  };
  const ttsLog = (...args) => {
    if (verboseTtsLogs) console.log(...args);
  };
  const lifeLog = (label, meta = {}) => {
    if (!speechLifecycleLogs) return;
    console.log(`[rt] ${label}`, meta);
  };

  const token = await generateToken(roomName);
  const room = new Room();
  console.log("[livekit] worker auth ready", {
    roomName,
    wsUrl: LIVEKIT_URL,
    tokenLength: token?.length || 0,
  });

  const state = {
    activeParticipantSid: null,
    activeParticipantIdentity: null,
    activeSTT: null,
    activeAudioTrack: null,
    activeAudioPublication: null,
    sttStarting: false,
    sttWaitingForAnswer: false,
    sttWaitLogged: false,
    callAnswerTimer: null,

    playback: null,
    playbackToken: 0,
    aiSpeaking: false,
    aiSpeechStartedAt: 0,
    lastPlaybackInterruptedAt: 0,
    recentAiResponses: [],

    aiRunning: false,
    pendingUserText: null,
    activeAiAbort: null,
    lastAiUserText: "",
    lastAiUserAt: 0,
    aiRequestSeq: 0,
    activeAiRequestSeq: 0,
    partialCarryText: "",
    partialCarryTimer: null,
    pendingSpeechTimer: null,
    lastPartialTranscriptAt: 0,
    lastSpokenTurnId: -1,
    lastSpokenText: "",
    lastSpokenAt: 0,
    pendingInterruptionContext: null,

    turnId: 0,

    currentUtteranceText: "",
    currentSpeechText: "",
    finalizeTimer: null,
    lastSpeechEndedAt: 0,

    lastFinalText: "",
    lastFinalAt: 0,
    lastQueuedUserText: "",

    turnMetrics: new Map(),

    userSpeaking: false,
    userSpeechStartedAt: 0,

    sessionId: null,
    analyticsKey: `${roomName}:${tenantId || "unknown"}:${agentId || "unknown"}`,
    conversationHistory: [],
    conversationState: getInitialConversationState(),
    languageState: getInitialLanguageState(languageConfig),
    activeSttLanguageCode: "",
    pendingSttLanguageCode: "",
    silenceTimer: null,
    silencePromptCount: 0,
    hasUserSpoken: false,
    lastSttReadyAt: 0,
    lastFastIntentAt: 0,
    lastFastIntentKey: "",
    callbackAggregateTimer: null,
    callbackAggregateText: "",
    callbackAggregateTurnId: 0,
    lastUserActivityAt: Date.now(),

    callObjective: String(callObjective || ""),
    callConfig: callConfig && typeof callConfig === "object" ? callConfig : null,
    initialGreetingSent: false,
    awaitingFirstUserResponse: true,
    greetingWaitLogged: false,
    sessionState: SESSION_STATE_ACTIVE,
    closingReason: "",
    roomIdleTimer: null,
    assistantTurns: 0,
    fillerState: { index: 0, last: "" },
    turnOrchestrator: null,
    postCallFinalized: false,
    callStartedAt: Date.now(),
    lastCompletedUserText: "",
    answeringUserText: "",
    activeTtsPrefetch: null,
  };

  const isSessionActive = () => state.sessionState === SESSION_STATE_ACTIVE;
  const isSessionClosing = () => state.sessionState === SESSION_STATE_CLOSING;
  const isSessionEnded = () => state.sessionState === SESSION_STATE_ENDED;
  ensureCallAnalytics(state.analyticsKey);
  const aiBreaker = new CircuitBreaker({ name: "ai", failureThreshold: 4, resetTimeoutMs: 12000 });
  const ttsBreaker = new CircuitBreaker({ name: "tts", failureThreshold: 4, resetTimeoutMs: 10000 });

  const markSessionClosing = (reason = "conversation_closing") => {
    if (isSessionEnded()) return false;
    if (isSessionClosing()) return true;

    state.sessionState = SESSION_STATE_CLOSING;
    state.closingReason = normalizeText(reason) || "conversation_closing";
    state.pendingUserText = null;
    return true;
  };

  const markSessionActive = () => {
    if (isSessionEnded()) return false;
    state.sessionState = SESSION_STATE_ACTIVE;
    state.closingReason = "";
    return true;
  };

  const markSessionEnded = (reason = "conversation_closed") => {
    if (isSessionEnded()) return false;
    state.sessionState = SESSION_STATE_ENDED;
    state.closingReason = normalizeText(reason) || state.closingReason || "conversation_closed";
    state.pendingUserText = null;
    return true;
  };

  const hasRemoteParticipants = () => {
    if (!room.remoteParticipants || room.remoteParticipants.size === 0) return false;

    for (const [, participant] of room.remoteParticipants) {
      if (participant?.identity !== BOT_IDENTITY) {
        return true;
      }
    }

    return false;
  };

  const clearRoomIdleTimer = () => {
    if (!state.roomIdleTimer) return;
    clearTimeout(state.roomIdleTimer);
    state.roomIdleTimer = null;
  };

  const clearCallAnswerTimer = () => {
    if (!state.callAnswerTimer) return;
    clearTimeout(state.callAnswerTimer);
    state.callAnswerTimer = null;
  };

  const clearSilenceTimer = () => {
    if (!state.silenceTimer) return;
    clearTimeout(state.silenceTimer);
    state.silenceTimer = null;
  };
  const clearCallbackAggregateTimer = () => {
    if (!state.callbackAggregateTimer) return;
    clearTimeout(state.callbackAggregateTimer);
    state.callbackAggregateTimer = null;
  };

  let handleSilenceWatchdog = async () => {};

  const scheduleSilenceFollowUp = () => {
    clearSilenceTimer();
    if (!isSessionActive() || isSessionEnded()) return;
    state.silenceTimer = setTimeout(() => {
      handleSilenceWatchdog().catch((error) => {
        logWarn("[livekit] silence follow-up failed", { error: error?.message || error });
        endSessionNow("silence_timeout").catch(() => {});
      });
    }, SILENCE_PROMPT_WAIT_MS);
  };

  const bumpUserActivity = (silenceDelayMs = SILENCE_PRESENCE_MS) => {
    state.lastUserActivityAt = Date.now();
    clearSilenceTimer();
    if (!isSessionActive() || isSessionEnded()) return;
    const stageKey = String(
      state.conversationState?.stage || state.callStage || "",
    ).toLowerCase();
    const postAnswerStage = ["query_resolution", "qualification"].includes(stageKey);
    const delay =
      state.awaitingFirstUserResponse && !state.hasUserSpoken
        ? Math.max(silenceDelayMs, INITIAL_RESPONSE_GRACE_MS)
        : postAnswerStage
          ? Math.max(silenceDelayMs, SILENCE_PRESENCE_MS + 6000)
          : silenceDelayMs;
    state.silenceTimer = setTimeout(() => {
      handleSilenceWatchdog().catch((error) => {
        logWarn("[livekit] silence watchdog failed", { error: error?.message || error });
        endSessionNow("silence_timeout").catch(() => {});
      });
    }, delay);
  };

  const rememberAiResponse = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return;
    state.recentAiResponses.push(normalized);
    state.recentAiResponses = state.recentAiResponses.slice(-6);
  };

  const capturePlaybackInterruption = () => {
    const utterance = normalizeText(state.lastSpokenText);
    if (!utterance) return;

    state.pendingInterruptionContext = {
      interruptedUtterance: utterance.slice(0, 480),
      activeTopic: deriveActiveTopic({
        userIntent: state.userIntent || state.conversationState?.userIntent || {},
        directiveAction: state.lastDirectiveAction || "",
      }),
      interruptedAt: Date.now(),
    };
    lifeLog("interruption_captured", {
      topic: state.pendingInterruptionContext.activeTopic,
      chars: state.pendingInterruptionContext.interruptedUtterance.length,
    });
  };

  const shouldSuppressEchoTranscript = (text) => {
    const transcript = normalizeText(text);
    if (!transcript) return true;
    if (!state.aiSpeaking) {
      // Allow real user speech soon after greeting finishes (avoid TTS tail echo).
      if (state.awaitingFirstUserResponse && !state.hasUserSpoken) {
        const sinceGreeting = Date.now() - Number(state.postGreetingOpenedAt || 0);
        if (sinceGreeting > 0 && sinceGreeting < POST_GREETING_LISTEN_DELAY_MS) {
          return true;
        }
      }
      return false;
    }

    const echoThreshold =
      state.awaitingFirstUserResponse && !state.hasUserSpoken
        ? Math.min(0.9, ECHO_SIMILARITY_THRESHOLD + 0.15)
        : ECHO_SIMILARITY_THRESHOLD;

    const similarity = state.recentAiResponses.reduce(
      (max, item) => Math.max(max, jaccardSimilarity(item, transcript)),
      0,
    );

    if (similarity >= echoThreshold) {
      console.log("[stt] suppressed probable TTS echo", { similarity: similarity.toFixed(2) });
      return true;
    }

    return false;
  };

  const resolveActiveParticipant = () => {
    if (!state.activeParticipantSid || !room.remoteParticipants) return null;

    for (const [, participant] of room.remoteParticipants) {
      if (
        participant.sid === state.activeParticipantSid &&
        participant.identity === state.activeParticipantIdentity
      ) {
        return participant;
      }
    }

    return null;
  };

  const canStartSttForParticipant = (participant) => {
    if (!participant) return false;
    if (!isSipParticipant(participant)) return true;

    const status = getSipCallStatus(participant);
    return isSipCallConnectedStatus(status);
  };

  const scheduleRoomIdleDisconnect = (reason = "all_participants_left", options = {}) => {
    const { force = false } = options;
    clearRoomIdleTimer();
    if (isSessionEnded()) return;

    state.roomIdleTimer = setTimeout(async () => {
      state.roomIdleTimer = null;

      if (isSessionEnded()) return;
      if (!force && hasRemoteParticipants()) return;

      markSessionEnded(reason);
      resetUtterance();
      await closeActiveSTT();
      await stopPlayback("room idle cleanup");
      await triggerPostCallFinalize(reason);
      await safeClose(() => room.disconnect());
      logInfo("[livekit] session ended", { reason });
    }, ROOM_IDLE_DISCONNECT_MS);
  };

  const disconnectActiveCaller = async (reason = "call_closed") => {
    if (!state.activeParticipantIdentity) return;

    try {
      const roomService = new RoomServiceClient(
        getLiveKitHost(),
        API_KEY,
        API_SECRET,
      );
      await roomService.removeParticipant(roomName, state.activeParticipantIdentity);
      // logInfo("[livekit] participant disconnected", { roomName, identity: state.activeParticipantIdentity, reason });
    } catch (error) {
      logWarn("[livekit] failed to disconnect participant", { error: error?.message || error });
    }
  };

  const triggerPostCallFinalize = async (reason = "conversation_closed") => {
    if (state.postCallFinalized) return;
    if (!state.sessionId) return;

    state.postCallFinalized = true;
    const analytics = getCallAnalyticsSnapshot(state.analyticsKey);
    const endTime = new Date();
    const startTime = new Date(state.callStartedAt || analytics.startedAt || endTime.getTime());

    try {
      await finalizeCall({
        sessionId: state.sessionId,
        callId: state.sessionId,
        roomName,
        tenantId,
        agentId,
        phoneNumber: extractPhoneFromIdentity(state.activeParticipantIdentity),
        endReason: normalizeText(reason) || state.closingReason || "conversation_closed",
        triggerSource: "livekit_worker",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: Math.max(
          0,
          Math.round((endTime.getTime() - startTime.getTime()) / 1000),
        ),
        callObjective: state.callObjective || state.callConfig?.objective || "",
        conversationHistory: state.conversationHistory.slice(-REALTIME_HISTORY_MESSAGES),
        callState: {
          stage: state.returnStage || state.conversationState?.stage || "",
          leadStatus: state.conversationState?.leadStatus || "",
          turnCount: state.turnId,
          bookingStatus: state.bookingReadiness || "",
          bookingReadiness: state.bookingReadiness || "",
          objectiveAchieved: Boolean(state.objectiveAchieved),
          userIntent: state.userIntent || null,
          intentStatus: state.intentStatus || "",
          collectedData: state.conversationState?.collectedData || {},
          endReason: normalizeText(reason) || state.closingReason || "conversation_closed",
        },
        analyticsSnapshot: analytics,
      });
      logInfo("[post-call] analysis triggered", { sessionId: state.sessionId, reason });
    } catch (error) {
      logWarn("[post-call] finalize failed", { error: error?.message || error });
    }
  };

  const endSessionNow = async (reason = "conversation_closed") => {
    if (isSessionEnded()) return;

    clearCallAnswerTimer();
    clearRoomIdleTimer();
    clearSilenceTimer();
    clearCallbackAggregateTimer();

    markSessionEnded(reason);
    try {
      state.activeAiAbort?.abort?.();
    } catch {}
    state.turnId += 1;
    state.userSpeaking = false;
    state.sttWaitingForAnswer = false;
    state.sttWaitLogged = false;
    state.lastQueuedUserText = "";
    state.answeringUserText = "";
    state.activeAudioTrack = null;
    state.activeAudioPublication = null;
    resetUtterance();
    await closeActiveSTT();
    await stopPlayback(reason);

    await triggerPostCallFinalize(reason);
    await disconnectActiveCaller(reason);
    await safeClose(() => room.disconnect());
    closeCallAnalytics(state.analyticsKey);
    // logInfo("[livekit] analytics summary", analytics); // Uncomment if needed for debugging
  };

  const handleSipTerminalStatus = async (status, source = "sip_status") => {
    const normalizedStatus = normalizeText(status).toLowerCase();
    if (!isSipCallTerminalStatus(normalizedStatus)) return false;

    // logInfo("[livekit] SIP terminal status", { status: normalizedStatus || "unknown", source }); // Uncomment if needed

    await endSessionNow(`sip_${normalizedStatus || "ended"}`);
    return true;
  };

  const ensureCallAnswerTimer = (participant, source = "status") => {
    if (!participant || !isSipParticipant(participant)) {
      clearCallAnswerTimer();
      state.sttWaitingForAnswer = false;
      return;
    }

    const status = getSipCallStatus(participant);

    if (isSipCallConnectedStatus(status) || isSipCallTerminalStatus(status)) {
      clearCallAnswerTimer();
      state.sttWaitingForAnswer = false;
      return;
    }

    state.sttWaitingForAnswer = true;
    if (state.callAnswerTimer) return;

    state.callAnswerTimer = setTimeout(async () => {
      state.callAnswerTimer = null;

      if (isSessionEnded()) return;

      const activeParticipant = resolveActiveParticipant();
      const activeStatus = getSipCallStatus(activeParticipant);
      if (isSipCallConnectedStatus(activeStatus) || isSipCallTerminalStatus(activeStatus)) {
        return;
      }

      logWarn("[livekit] answer timeout reached", { timeoutMs: CALL_ANSWER_TIMEOUT_MS, source, status: activeStatus || "unknown" });

      await endSessionNow("no_answer_timeout");
    }, CALL_ANSWER_TIMEOUT_MS);
  };

  const logLatency = (turnId, label, extra = "") => {
    if (!debugLatency) return;
    const suffix = extra ? ` ${extra}` : "";
    console.log(`[latency][turn ${turnId}] ${label}${suffix}`);
  };

  const ensureMetrics = (turnId) => {
    if (!state.turnMetrics.has(turnId)) {
      state.turnMetrics.set(turnId, {});
    }
    return state.turnMetrics.get(turnId);
  };

  const logTurnBreakdown = (turnId) => {
    if (!debugLatency) return;
    const metrics = ensureMetrics(turnId);
    if (!metrics.finalAt) return;
    const sttFinalMs =
      metrics.sttStartAt && metrics.finalAt ? metrics.finalAt - metrics.sttStartAt : null;
    const retrievalMs =
      metrics.aiRequestContext?.retrievalMs || metrics.retrievalMs || null;
    const llmMs = metrics.aiStartAt && metrics.aiEndAt ? metrics.aiEndAt - metrics.aiStartAt : null;
    const ttsMs =
      metrics.ttsStartAt && metrics.ttsEndAt ? metrics.ttsEndAt - metrics.ttsStartAt : null;
    const playbackMs =
      metrics.ttsEndAt && metrics.playbackStartAt ? metrics.playbackStartAt - metrics.ttsEndAt : null;
    const totalMs = Date.now() - metrics.finalAt;
    console.log("[latency]");
    if (sttFinalMs != null) console.log(`STT final: ${sttFinalMs}ms`);
    if (retrievalMs != null) console.log(`Retrieval: ${retrievalMs}ms`);
    if (llmMs != null) console.log(`LLM: ${llmMs}ms`);
    if (ttsMs != null) console.log(`TTS: ${ttsMs}ms`);
    if (playbackMs != null) console.log(`Playback: ${playbackMs}ms`);
    console.log(`Total: ${totalMs}ms`);
  };

  const clearFinalizeTimer = () => {
    if (!state.finalizeTimer) return;

    clearTimeout(state.finalizeTimer);
    state.finalizeTimer = null;
  };

  const clearPartialCarryTimer = () => {
    if (!state.partialCarryTimer) return;
    clearTimeout(state.partialCarryTimer);
    state.partialCarryTimer = null;
  };

  const clearPendingSpeechTimer = () => {
    if (!state.pendingSpeechTimer) return;
    clearTimeout(state.pendingSpeechTimer);
    state.pendingSpeechTimer = null;
  };

  const schedulePendingSpeechCommit = () => {
    clearPendingSpeechTimer();
    state.lastPartialTranscriptAt = Date.now();
    state.pendingSpeechTimer = setTimeout(() => {
      state.pendingSpeechTimer = null;
      if (!isSessionActive()) return;

      const buffered = normalizeText(
        mergeTranscript(state.currentUtteranceText, state.currentSpeechText),
      );
      if (!buffered) return;

      if (isRecentDuplicateFinal(buffered)) {
        clearSpeechBuffers();
        return;
      }

      if (state.aiRunning) {
        const answering = normalizeText(
          state.answeringUserText || state.lastQueuedUserText,
        ).toLowerCase();
        const bufferedLower = buffered.toLowerCase();
        if (answering && (bufferedLower === answering || answering.includes(bufferedLower))) {
          clearSpeechBuffers();
          return;
        }
      }

      const idleMs = Date.now() - Number(state.lastPartialTranscriptAt || 0);
      if (idleMs < PENDING_SPEECH_SILENCE_MS - 40) {
        schedulePendingSpeechCommit();
        return;
      }

      clearPartialCarryTimer();
      state.partialCarryText = "";
      clearFinalizeTimer();
      state.userSpeaking = false;
      state.lastSpeechEndedAt = Date.now();
      state.userSpeechStartedAt = 0;
      lifeLog("pending_speech_commit", { text: compactLogText(buffered) });
      state.currentUtteranceText = buffered;
      state.currentSpeechText = "";
      commitCurrentUtteranceNow("silence_fallback");
    }, PENDING_SPEECH_SILENCE_MS);
  };

  const resetUtterance = () => {
    clearFinalizeTimer();
    clearPartialCarryTimer();
    clearPendingSpeechTimer();
    state.currentUtteranceText = "";
    state.currentSpeechText = "";
    state.lastSpeechEndedAt = 0;
    state.partialCarryText = "";
    state.lastPartialTranscriptAt = 0;
  };

  const clearSpeechBuffers = () => {
    state.currentUtteranceText = "";
    state.currentSpeechText = "";
    state.lastPartialTranscriptAt = 0;
  };

  const isRecentDuplicateFinal = (text) => {
    const normalized = normalizeText(text).toLowerCase();
    if (!normalized) return true;
    const now = Date.now();
    const recentAt = Number(state.lastFinalAt || 0);
    const candidates = [
      state.lastFinalText,
      state.lastQueuedUserText,
      state.lastCompletedUserText,
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean);
    return candidates.some(
      (candidate) => candidate === normalized && now - recentAt < 20000,
    );
  };

  const isTurnStillValid = (turnId, userText) => {
    if (turnId !== state.turnId) return false;
    const latest = normalizeText(state.lastQueuedUserText).toLowerCase();
    const processed = normalizeText(userText).toLowerCase();
    if (latest && processed && latest !== processed) return false;
    return true;
  };

  const invalidateInFlightResponse = async (reason = "superseded") => {
    state.playbackToken += 1;
    if (state.activeTtsPrefetch) {
      void abandonSpeechStream(state.activeTtsPrefetch);
      state.activeTtsPrefetch = null;
    }
    state.turnOrchestrator?.cancelActive();
    try {
      state.activeAiAbort?.abort?.();
    } catch {}
    await stopPlayback(reason);
  };

  const beginTtsHeadPrefetch = (answer, options = {}) => {
    if (!ENABLE_TTS_STREAMING || !ENABLE_STREAMING_TURN_PIPELINE) return null;

    const normalized = normalizeText(answer);
    if (!normalized) return null;

    const language = options.responseLanguage || options.language || "en";
    const useSingleChunk = shouldUseSingleTtsChunk(answer, options);
    const firstChunk = useSingleChunk
      ? normalized
      : splitSemanticChunksWithFastStart(
          answer,
          TTS_FIRST_CHUNK_CHARS,
          TTS_TARGET_CHUNK_CHARS,
        )[0];

    if (!firstChunk) return null;

    if (state.activeTtsPrefetch) {
      void abandonSpeechStream(state.activeTtsPrefetch);
    }

    const prefetch = openSpeechStream(firstChunk, { language });
    state.activeTtsPrefetch = prefetch;
    void prefetch.finally(() => {
      if (state.activeTtsPrefetch === prefetch) {
        state.activeTtsPrefetch = null;
      }
    });
    return prefetch;
  };

  const stopPlayback = async (reason) => {
    if (!state.playback) return;

    const playback = state.playback;
    state.playback = null;

    callLog(`[call] stopping TTS: ${reason}`);
    state.turnOrchestrator?.cancelActive();
    await playback.stop();
    if (String(reason || "").toLowerCase().includes("user started speaking")) {
      state.lastPlaybackInterruptedAt = Date.now();
      capturePlaybackInterruption();
    }
    state.aiSpeaking = false;
    state.aiSpeechStartedAt = 0;
  };

  const interruptForUserSpeech = async (force = false) => {
    if (!state.playback) return;
    if (!force && state.userSpeechStartedAt) {
      const activeMs = Date.now() - state.userSpeechStartedAt;
      if (activeMs < INTERRUPTION_MIN_MS) {
        callLog("[barge-in] ignored, speech too short", { activeMs, minMs: INTERRUPTION_MIN_MS });
        return;
      }
    }
    await stopPlayback("user started speaking");
  };

  const rememberTranscript = (text) => {
    const transcript = normalizeText(text);
    if (!transcript) return;

    state.currentSpeechText = mergeTranscript(state.currentSpeechText, transcript);
  };

  const commitSpeechSegment = () => {
    const speechText = normalizeText(state.currentSpeechText);
    state.currentSpeechText = "";

    if (!speechText) return;

    state.currentUtteranceText = mergeTranscript(state.currentUtteranceText, speechText);
  };

  const commitMergedTurn = async (previousText, mergedText) => {
    const text = mergeTurnTexts(previousText, mergedText);
    if (!text) return;
    const baseline = compactTurnText(previousText || "");
    if (
      shouldSuppressTurnMerge(
        baseline,
        text,
        state.lastCompletedUserText,
        state.answeringUserText,
      )
    ) {
      const mergedDelta = extractMergeDelta(baseline, text);
      if (isLowValueMergeDelta(mergedDelta)) {
        lifeLog("turn_merge_suppressed", { text });
        state.pendingUserText = null;
        return;
      }
      lifeLog("turn_merge_released", { text, delta: mergedDelta });
    }

    const now = Date.now();
    await invalidateInFlightResponse("turn merged");

    state.turnId += 1;
    state.lastFinalText = text;
    state.lastFinalAt = now;
    state.lastQueuedUserText = text;
    state.answeringUserText = text;
    state.pendingUserText = text;
    state.silencePromptCount = 0;
    state.hasUserSpoken = true;
    state.awaitingFirstUserResponse = false;

    const metrics = ensureMetrics(state.turnId);
    metrics.finalAt = now;

    const lastEntry = state.conversationHistory[state.conversationHistory.length - 1];
    if (
      lastEntry?.role === "user" &&
      baseline &&
      text.toLowerCase().includes(baseline.toLowerCase())
    ) {
      lastEntry.content = text;
    } else {
      state.conversationHistory.push({ role: "user", content: text });
      state.conversationHistory = state.conversationHistory.slice(-REALTIME_HISTORY_MESSAGES);
    }

    lifeLog("turn_merged", { turnId: state.turnId, text });
    lifeLog("final_text", {
      turnId: state.turnId,
      intent: detectTurnIntent(text, state),
      text,
    });

    clearSpeechBuffers();

    if (!state.aiRunning) {
      runAI().catch((error) => {
        console.error("[ai] loop failed:", error?.message || error);
      });
    }
  };

  const queueUserText = (text, options = {}) => {
    const { bypassAggregate = false } = options;
    let finalText = compactTurnText(normalizeSttUtterance(text));
    if (!finalText) return;
    clearPendingSpeechTimer();
    if (state.partialCarryText) {
      finalText = compactTurnText(`${state.partialCarryText} ${finalText}`);
      state.partialCarryText = "";
      clearPartialCarryTimer();
    }
    if (!isSessionActive()) {
      sttLog(`[stt] ignoring final transcript while session is ${state.sessionState}`);
      return;
    }

    const finalLower = finalText.toLowerCase();
    const wordCount = finalLower.split(" ").filter(Boolean).length;
    const previousLower = normalizeText(state.lastQueuedUserText).toLowerCase();

    // STT providers may return cumulative text across turns; trim repeated prefix.
    if (previousLower && finalLower.startsWith(`${previousLower} `)) {
      finalText = normalizeText(finalText.slice(previousLower.length));
    }
    if (!finalText) return;

    if (
      wordCount <= 2 &&
      NON_ACTIONABLE_FRAGMENT_RE.test(finalText) &&
      !SHORT_USER_TURN_ALLOW_RE.test(finalText)
    ) {
      sttLog("[stt] non-actionable fragment ignored");
      return;
    }

    if (
      wordCount <= 2 &&
      !SHORT_USER_TURN_ALLOW_RE.test(finalText) &&
      previousLower &&
      previousLower.includes(finalLower)
    ) {
      sttLog("[stt] short fragment ignored");
      return;
    }

    if (
      !bypassAggregate &&
      wordCount <= 12 &&
      (TRAILING_CONNECTOR_RE.test(finalText) ||
        INCOMPLETE_SCHEDULING_RE.test(finalText) ||
        (INCOMPLETE_QUESTION_RE.test(finalText) && wordCount <= 4))
    ) {
      state.partialCarryText = compactTurnText(
        state.partialCarryText ? `${state.partialCarryText} ${finalText}` : finalText,
      );
      clearPartialCarryTimer();
      const partialWaitMs =
        INCOMPLETE_SCHEDULING_RE.test(finalText) || /\b\d{1,2}(?:st|nd|rd|th)\s*$/i.test(finalText)
          ? BOOKING_PARTIAL_CARRY_MS
          : PARTIAL_CARRY_MS;
      state.partialCarryTimer = setTimeout(() => {
        const carry = compactTurnText(state.partialCarryText);
        state.partialCarryText = "";
        state.partialCarryTimer = null;
        if (carry) queueUserText(carry, { bypassAggregate: true });
      }, partialWaitMs);
      lifeLog("partial_carry_wait", { text: state.partialCarryText });
      return;
    }

    const now = Date.now();
    const bookingStage = String(state.conversationState?.stage || state.callStage || "").toLowerCase();
    const awaitingBookingConfirm =
      bookingStage === "confirmation" ||
      /\b(shall i confirm|confirm this booking)\b/i.test(String(state.lastAssistantPrompt || ""));
    const allowBookingConfirmRetry = awaitingBookingConfirm && isBookingAffirmation(finalText);
    const completedLower = normalizeText(state.lastCompletedUserText).toLowerCase();
    if (
      !allowBookingConfirmRetry &&
      completedLower &&
      finalLower === completedLower &&
      now - Number(state.lastFinalAt || 0) < 20000
    ) {
      lifeLog("duplicate_user_turn_ignored", { text: finalText });
      clearSpeechBuffers();
      return;
    }
    if (
      state.lastPlaybackInterruptedAt > 0 &&
      now - state.lastPlaybackInterruptedAt <= BARGE_FRAGMENT_SUPPRESS_MS &&
      wordCount < 4 &&
      !TIME_SELECTION_RE.test(finalText) &&
      !SHORT_USER_TURN_ALLOW_RE.test(finalText) &&
      !QUICK_ACK_RE.test(finalText) &&
      !isSubstantiveUserQuery(finalText)
    ) {
      lifeLog("barge_fragment_ignored", { text: finalText });
      clearSpeechBuffers();
      return;
    }

    if (
      !allowBookingConfirmRetry &&
      finalText === state.lastFinalText &&
      now - state.lastFinalAt < 30000
    ) {
      lifeLog("duplicate_user_turn_ignored", { text: finalText, reason: "same_as_last_final" });
      clearSpeechBuffers();
      return;
    }

    if (
      finalText === state.lastFinalText &&
      now - state.lastFinalAt < DUPLICATE_FINAL_DEBOUNCE_MS
    ) {
      sttLog("[stt] duplicate final ignored");
      clearSpeechBuffers();
      return;
    }

    const previousQueuedAt = Number(state.lastFinalAt || 0);
    const previousQueued = normalizeText(state.lastQueuedUserText);
    const withinMergeWindow = previousQueuedAt > 0 && now - previousQueuedAt <= TURN_MERGE_WINDOW_MS;

    if (
      withinMergeWindow &&
      previousQueued &&
      (finalText.toLowerCase().includes(previousQueued.toLowerCase())
        || previousQueued.toLowerCase().includes(finalText.toLowerCase()))
    ) {
      const mergedText = mergeTurnTexts(
        previousQueued,
        finalText.length >= previousQueued.length ? finalText : previousQueued,
      );
      void commitMergedTurn(previousQueued, mergedText);
      return;
    }
    if (withinMergeWindow && previousQueued && wordCount <= 6) {
      const merged = mergeTurnTexts(previousQueued, finalText);
      if (merged && merged !== previousQueued) {
        void commitMergedTurn(previousQueued, merged);
        return;
      }
    }

    if (!bypassAggregate && shouldAggregateUtterance(finalText)) {
      state.callbackAggregateText = compactTurnText(
        state.callbackAggregateText
          ? `${state.callbackAggregateText} ${finalText}`
          : finalText,
      );
      state.callbackAggregateTurnId += 1;
      const localAggTurn = state.callbackAggregateTurnId;
      clearCallbackAggregateTimer();
      state.callbackAggregateTimer = setTimeout(() => {
        if (localAggTurn !== state.callbackAggregateTurnId) return;
        const textToQueue = compactTurnText(state.callbackAggregateText);
        state.callbackAggregateText = "";
        state.callbackAggregateTimer = null;
        if (textToQueue) {
          queueUserText(textToQueue, { bypassAggregate: true });
        }
      }, CALLBACK_AGGREGATE_MS);
      lifeLog("utterance_aggregate_wait", { text: state.callbackAggregateText });
      return;
    } else {
      state.callbackAggregateText = "";
      clearCallbackAggregateTimer();
    }

    state.lastFinalText = finalText;
    state.lastFinalAt = now;
    state.lastQueuedUserText = finalText;
    state.answeringUserText = finalText;
    state.silencePromptCount = 0;
    state.hasUserSpoken = true;
    state.awaitingFirstUserResponse = false;

    const prevDominant = state.languageState?.dominantLanguage || languageConfig.startLanguage;
    state.languageState = detectLanguageProfile({
      query: finalText,
      previousState: state.languageState,
      languageConfig,
    });
    if (state.languageState.dominantLanguage !== prevDominant) {
      lifeLog("language_switch", {
        from: prevDominant,
        to: state.languageState.dominantLanguage,
      });
    }

    bumpUserActivity();

    if (state.aiRunning || state.playback || state.aiSpeaking) {
      void invalidateInFlightResponse("new user turn");
    }

    state.turnId += 1;
    const metrics = ensureMetrics(state.turnId);
    metrics.finalAt = now;
    if (state.userSpeechStartedAt > 0) {
      trackLatencyMetric(state.analyticsKey, "sttFinalMs", now - state.userSpeechStartedAt);
    }
    logLatency(state.turnId, "final transcript committed");
    state.conversationHistory.push({ role: "user", content: finalText });
    state.conversationHistory = state.conversationHistory.slice(-REALTIME_HISTORY_MESSAGES);
    state.conversationState = deriveConversationState({
      query: finalText,
      previousState: state.conversationState,
      interruptionCount: getCallAnalyticsSnapshot(state.analyticsKey).interruptions,
      silencePromptCount: state.silencePromptCount,
    });
    trackEmotion(state.analyticsKey, state.conversationState);
    state.pendingUserText = finalText;
    lifeLog("final_text", {
      turnId: state.turnId,
      intent: detectTurnIntent(finalText, state),
      text: finalText,
    });

    if (wordCount >= 3) {
      state.pendingInterruptionContext = null;
    }

    clearSpeechBuffers();

    if (state.languageState.dominantLanguage !== prevDominant) {
      void requestSttLanguageRestart();
    }

    runAI().catch((error) => {
      console.error("[ai] loop failed:", error?.message || error);
    });
  };

  const commitCurrentUtteranceNow = (reason) => {
    clearFinalizeTimer();
    commitSpeechSegment();

    const finalText = normalizeText(state.currentUtteranceText);
    state.currentUtteranceText = "";

    if (!finalText) return;

    sttLog(`[stt] final ${reason}: ${finalText}`);
    queueUserText(finalText);
  };

  const scheduleUtteranceCommit = () => {
    clearFinalizeTimer();
    clearPendingSpeechTimer();

    state.finalizeTimer = setTimeout(() => {
      state.finalizeTimer = null;
      commitSpeechSegment();

      const finalText = normalizeText(state.currentUtteranceText);
      state.currentUtteranceText = "";

      if (!finalText) return;

      sttLog(`[stt] final after silence: ${finalText}`);
      queueUserText(finalText);
    }, END_SPEECH_COMMIT_DELAY_MS);
  };

  const handleSpeechStart = async () => {
    if (!isSessionActive()) return;

    state.userSpeaking = true;
    state.userSpeechStartedAt = Date.now();
    state.silencePromptCount = 0;
    clearSilenceTimer();
    lifeLog("speech_start", { turnId: state.turnId + 1 });
    const metrics = ensureMetrics(state.turnId + 1);
    metrics.sttStartAt = state.userSpeechStartedAt;
    const danglingPartial = normalizeText(state.currentSpeechText);
    if (danglingPartial) {
      state.currentUtteranceText = mergeTranscript(state.currentUtteranceText, danglingPartial);
    }
    state.currentSpeechText = "";
    const gapAfterEnd = Date.now() - state.lastSpeechEndedAt;

    if (
      state.finalizeTimer &&
      state.currentUtteranceText &&
      gapAfterEnd >= NEW_TURN_PAUSE_MS &&
      looksLikeCompleteThought(state.currentUtteranceText)
    ) {
      commitCurrentUtteranceNow("before new speech");
    } else {
      clearFinalizeTimer();
      clearPendingSpeechTimer();
      if (gapAfterEnd >= NEW_TURN_PAUSE_MS && !state.currentUtteranceText) {
        state.currentUtteranceText = "";
      }
    }

    await interruptForUserSpeech(false);
  };

  const playAnswer = async (answer, answerTurnId, options = {}) => {
    if (!answer) return;
    if (isSessionEnded()) return;

    if (answerTurnId !== state.turnId) {
      callLog("[ai] stale response ignored");
      return;
    }
    const normalizedAnswer = normalizeText(answer);
    const now = Date.now();
    const useSingleChunk = shouldUseSingleTtsChunk(answer, options);
    if (
      state.lastSpokenTurnId === answerTurnId &&
      state.lastSpokenText === normalizedAnswer &&
      now - Number(state.lastSpokenAt || 0) < 3000
    ) {
      lifeLog("tts_dedup_skipped", { turnId: answerTurnId, text: compactLogText(answer) });
      return;
    }
    const myPlaybackToken = ++state.playbackToken;

    // Send directly to Sarvam - no text manipulation (disabled due to speech corruption)
    state.lastSpokenTurnId = answerTurnId;
    state.lastSpokenText = normalizedAnswer;
    state.lastSpokenAt = Date.now();
    const parts = useSingleChunk ? [normalizedAnswer] : splitAnswerForTts(answer);
    ttsLog(`[tts] chunks=${parts.length}`);
    state.assistantTurns += 1;
    rememberAiResponse(answer);
    state.conversationHistory.push({ role: "assistant", content: answer });
    state.conversationHistory = state.conversationHistory.slice(-REALTIME_HISTORY_MESSAGES);
    trackEmotion(state.analyticsKey, state.conversationState);

    if (ENABLE_STREAMING_TURN_PIPELINE && state.turnOrchestrator) {
      const responseLanguage =
        options.responseLanguage || state.languageState?.dominantLanguage || languageConfig.startLanguage;
      if (options.ttsHeadStart) {
        state.activeTtsPrefetch = null;
      }
      await state.turnOrchestrator.runTurn({
        turnId: answerTurnId,
        fullText: answer,
        chunkChars: TTS_TARGET_CHUNK_CHARS,
        firstChunkChars: useSingleChunk ? normalizedAnswer.length : TTS_FIRST_CHUNK_CHARS,
        singleChunk: useSingleChunk,
        language: responseLanguage,
        ttsHeadStart: options.ttsHeadStart || null,
      });
      return;
    }

    const synthChunk = async (chunk) =>
      generateSpeech(chunk, {
        language: options.responseLanguage || state.languageState?.dominantLanguage || languageConfig.startLanguage,
        mixLevel: state.languageState?.mixLevel || "low",
      });

    let prefetch = parts[0] ? synthChunk(parts[0]) : null;

    for (let i = 0; i < parts.length; i += 1) {
      if (answerTurnId !== state.turnId || isSessionEnded()) {
        ttsLog("[tts] stale speech ignored");
        return;
      }
      if (myPlaybackToken !== state.playbackToken) {
        ttsLog("[tts] stale playback token, skip chunk");
        return;
      }

      if (state.userSpeaking) {
        ttsLog("[tts] user speaking, skip remaining chunks");
        trackInterruption(state.analyticsKey);
        capturePlaybackInterruption();
        return;
      }

      if (i > 0 && TTS_INTER_CHUNK_PAUSE_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, TTS_INTER_CHUNK_PAUSE_MS));
        if (answerTurnId !== state.turnId || isSessionEnded() || myPlaybackToken !== state.playbackToken) {
          ttsLog("[tts] stale speech ignored during chunk pause");
          return;
        }
      }

      const chunk = parts[i];
      if (!chunk) continue;
      if (i === 0) {
        lifeLog("tts_start", { turnId: answerTurnId, chunks: parts.length });
      }

      const metrics = ensureMetrics(answerTurnId);
      metrics.ttsStartAt = Date.now();
      logLatency(answerTurnId, "tts request start");

      let wavBuffer = null;
      try {
        wavBuffer = prefetch ? await prefetch : null;
        if (i + 1 < parts.length && parts[i + 1]) {
          prefetch = synthChunk(parts[i + 1]);
        } else {
          prefetch = null;
        }
      } catch (error) {
        console.error("[tts] chunk generation failed:", error?.message || error);
        prefetch = i + 1 < parts.length && parts[i + 1] ? synthChunk(parts[i + 1]) : null;
        continue;
      }

      metrics.ttsEndAt = Date.now();
      if (metrics.finalAt) {
        const ttsMs = metrics.ttsEndAt - metrics.ttsStartAt;
        const sinceFinal = metrics.ttsEndAt - metrics.finalAt;
        trackLatencyMetric(state.analyticsKey, "ttsMs", ttsMs);
        logLatency(
          answerTurnId,
          "tts ready",
          `ttsMs=${ttsMs} totalSinceFinalMs=${sinceFinal}`,
        );
      }

      if (answerTurnId !== state.turnId || isSessionEnded()) {
        ttsLog("[tts] stale speech ignored");
        return;
      }
      if (myPlaybackToken !== state.playbackToken) {
        ttsLog("[tts] stale playback token before play");
        return;
      }

      if (!wavBuffer || wavBuffer.length < 1000) {
        console.warn("[tts] empty or invalid audio");
        continue;
      }

      if (debugTtsWav) {
        fs.writeFileSync("debug.wav", wavBuffer);
      }

      await stopPlayback("new answer");

      const playback = await createTTSPlayback(room, wavBuffer);
      metrics.playbackStartAt = Date.now();
      state.aiSpeaking = true;
      state.aiSpeechStartedAt = metrics.playbackStartAt;
      if (metrics.finalAt) {
        trackLatencyMetric(
          state.analyticsKey,
          "playbackMs",
          metrics.playbackStartAt - metrics.ttsEndAt,
        );
        logLatency(
          answerTurnId,
          "playback started",
          `totalSinceFinalMs=${metrics.playbackStartAt - metrics.finalAt}`,
        );
      }
      state.playback = playback;

      try {
        await playback.done;
        if (myPlaybackToken !== state.playbackToken) {
          return;
        }
        if (i === parts.length - 1) {
          lifeLog("tts_done", { turnId: answerTurnId });
        }
      } catch (error) {
        console.error("[tts] playback failed:", error?.message || error);
      } finally {
        state.aiSpeaking = false;
        state.aiSpeechStartedAt = 0;
        bumpUserActivity();
        if (state.playback === playback) {
          state.playback = null;
        }
      }
    }
  };

  handleSilenceWatchdog = async () => {
    if (!isSessionActive() || isSessionEnded()) return;
    if (state.userSpeaking || state.aiSpeaking || state.aiRunning || state.pendingUserText) {
      bumpUserActivity();
      return;
    }
    if (!state.initialGreetingSent) {
      bumpUserActivity();
      return;
    }
    if (state.awaitingFirstUserResponse && !state.hasUserSpoken) {
      bumpUserActivity(INITIAL_RESPONSE_GRACE_MS);
      return;
    }

    const lang = state.languageState?.dominantLanguage || languageConfig.startLanguage;
    const stage = state.conversationState?.stage || state.callStage || "";
    const stageKey = String(stage).toLowerCase();
    const inBooking = ["appointment_booking", "confirmation", "callback"].includes(stageKey);
    const maxPrompts =
      ["query_resolution", "qualification", "intent_discovery"].includes(stageKey)
        ? Math.max(SILENCE_MAX_PROMPTS, 2)
        : SILENCE_MAX_PROMPTS;

    if (state.silencePromptCount < maxPrompts) {
      state.silencePromptCount += 1;
      lifeLog("silence_prompt", { count: state.silencePromptCount, stage: stageKey });
      const prompt = buildSilencePresencePrompt({
        language: lang,
        stage,
        closeOffered: Boolean(state.conversationState?.closeOffered),
        inBooking,
        hasUserSpoken: state.hasUserSpoken,
      });
      state.turnId += 1;
      try {
        await playAnswer(prompt, state.turnId, {
          responseLanguage: lang,
          stage: "presence_check",
        });
      } catch (error) {
        logWarn("[livekit] silence prompt playback failed", { error: error?.message || error });
      }
      if (isSessionEnded()) return;
      scheduleSilenceFollowUp();
      return;
    }

    lifeLog("silence_end_call", { reason: "silence_timeout" });
    const goodbye = buildSilenceGoodbye({ language: lang });
    state.turnId += 1;
    try {
      await playAnswer(goodbye, state.turnId, {
        responseLanguage: lang,
        stage: "closing",
      });
    } catch (error) {
      logWarn("[livekit] silence goodbye playback failed", { error: error?.message || error });
    }
    await endSessionNow("silence_timeout");
  };

  const runAI = async () => {
    if (state.aiRunning) return;

    state.aiRunning = true;

    try {
      while (state.pendingUserText && !isSessionEnded()) {
        if (isSessionClosing()) {
          state.pendingUserText = null;
          break;
        }

        const userText = state.pendingUserText;
        state.pendingUserText = null;
        const normalizedUserText = normalizeText(userText).toLowerCase();
        if (
          normalizedUserText &&
          normalizeText(state.lastAiUserText).toLowerCase() === normalizedUserText &&
          Date.now() - Number(state.lastAiUserAt || 0) < 1800
        ) {
          lifeLog("ai_dedup_skipped", { turnId: state.turnId, text: compactLogText(userText) });
          continue;
        }
        state.lastAiUserText = userText;
        state.lastAiUserAt = Date.now();
        try {
          state.activeAiAbort?.abort?.();
        } catch {}
        const aiAbort = new AbortController();
        state.activeAiAbort = aiAbort;
        const requestSeq = ++state.aiRequestSeq;
        state.activeAiRequestSeq = requestSeq;

        const myTurnId = state.turnId;
        const metrics = ensureMetrics(myTurnId);

        callLog(`[user] ${userText}`);

        const fastIntent = resolveFastIntentReply(userText);
        if (fastIntent) {
          const fastKey = `${fastIntent.answer}|${String(fastIntent.endCall)}`;
          const now = Date.now();
          if (
            state.lastFastIntentKey === fastKey &&
            now - Number(state.lastFastIntentAt || 0) < FAST_INTENT_COOLDOWN_MS
          ) {
            lifeLog("ai_fast_path_skipped", { turnId: myTurnId, reason: "cooldown" });
            continue;
          }
          state.lastFastIntentKey = fastKey;
          state.lastFastIntentAt = now;
          lifeLog("ai_fast_path", { turnId: myTurnId, reason: "intent_template" });
          lifeLog("ai_reply", {
            turnId: myTurnId,
            source: "fast_path",
            text: compactLogText(fastIntent.answer),
          });
          if (!isTurnStillValid(myTurnId, userText)) {
            lifeLog("ai_stale_user_text", {
              turnId: myTurnId,
              processed: compactLogText(userText),
              latest: compactLogText(state.lastQueuedUserText),
            });
            if (state.lastQueuedUserText) {
              state.pendingUserText = state.lastQueuedUserText;
            }
            continue;
          }
          try {
            const fastLanguage =
              state.languageState?.dominantLanguage || languageConfig.startLanguage;
            const fastTtsHeadStart = beginTtsHeadPrefetch(fastIntent.answer, {
              responseLanguage: fastLanguage,
              stage: fastIntent.endCall ? "closing" : "discovery",
            });
            if (fastTtsHeadStart) {
              lifeLog("tts_prefetch_start", {
                turnId: myTurnId,
                text: compactLogText(fastIntent.answer),
                source: "fast_path",
              });
            }
            await playAnswer(fastIntent.answer, myTurnId, {
              shouldEndCall: fastIntent.endCall,
              endReason: fastIntent.endReason,
              stage: fastIntent.endCall ? "closing" : "discovery",
              responseLanguage: fastLanguage,
              ttsHeadStart: fastTtsHeadStart,
            });
          } catch (error) {
            console.error("[tts] fast-path playback failed:", error?.message || error);
          }

          if (fastIntent.endCall && myTurnId === state.turnId && !isSessionEnded()) {
            await endSessionNow(fastIntent.endReason || "user_requested_end");
            break;
          }
          continue;
        }

        let result;
        const turnIntent = detectIntentLabel(userText);
        const turnPolicy = buildTurnPolicy({
          objective: state.callConfig?.objective || state.callObjective || "custom",
          intent: turnIntent,
        });

        try {
          metrics.aiStartAt = Date.now();
          lifeLog("ai_start", {
            turnId: myTurnId,
            intent: detectTurnIntent(userText, state),
          });
          if (metrics.finalAt) {
            logLatency(myTurnId, "ai request start", `sinceFinalMs=${metrics.aiStartAt - metrics.finalAt}`);
          }
          result = await withCircuitBreaker(aiBreaker, () => queryAI({
            tenantId,
            agentId,
            query: userText,
            sessionId: state.sessionId || undefined,
            roomName,
            callObjective: state.callObjective || undefined,
            callConfig: state.callConfig || undefined,
            conversationHistory: state.conversationHistory.slice(-REALTIME_HISTORY_MESSAGES),
            conversationState: state.conversationState,
            analyticsSnapshot: getCallAnalyticsSnapshot(state.analyticsKey),
            interruptionContext: state.pendingInterruptionContext || undefined,
            debug: debugLatency,
            languageState: state.languageState,
            signal: aiAbort.signal,
          }));
          if (state.pendingInterruptionContext) {
            state.pendingInterruptionContext = null;
          }
          if (result?.languageState && typeof result.languageState === "object") {
            state.languageState = result.languageState;
            void requestSttLanguageRestart();
          }
          if (result?.sessionId) {
            state.sessionId = result.sessionId;
          }
          if (result?.bookingReadiness) {
            state.bookingReadiness = result.bookingReadiness;
          }
          if (result?.returnStage) {
            state.returnStage = result.returnStage;
          }
          if (result?.intentStatus) {
            state.intentStatus = result.intentStatus;
          }
          if (result?.userIntent && typeof result.userIntent === "object") {
            state.userIntent = result.userIntent;
          }
          if (Number.isFinite(result?.intentResolutionMs)) {
            state.intentResolutionMs = result.intentResolutionMs;
          }
          if (typeof result?.objectiveAchieved !== "undefined") {
            state.objectiveAchieved = Boolean(result.objectiveAchieved);
          }
          if (result?.endCall) {
            state.callEnded = true;
            state.endReason = result.endReason || state.endReason || "conversation_closed";
          }
          syncWorkerStateFromApi(state, result);
          metrics.aiEndAt = Date.now();
          lifeLog("ai_done", {
            turnId: myTurnId,
            latencyMs: metrics.aiEndAt - metrics.aiStartAt,
          });
          metrics.retrievalMs = Number(result?.debug?.latencyMs?.retrievalMs || 0);
          if (metrics.retrievalMs > 0) {
            trackLatencyMetric(state.analyticsKey, "retrievalMs", metrics.retrievalMs);
          }
          if (metrics.finalAt) {
            const aiMs = metrics.aiEndAt - metrics.aiStartAt;
            trackLatencyMetric(state.analyticsKey, "llmMs", aiMs);
            logLatency(
              myTurnId,
              "ai response received",
              `aiMs=${aiMs} totalSinceFinalMs=${metrics.aiEndAt - metrics.finalAt}`,
            );
          }
          logTurnBreakdown(myTurnId);
        } catch (error) {
          console.error("[ai] query failed:", error?.message || error);
          if (String(error?.code || "").toLowerCase() === "err_canceled") {
            lifeLog("ai_cancelled", { turnId: myTurnId });
            continue;
          }
          continue;
        }

        if (requestSeq !== state.activeAiRequestSeq) {
          lifeLog("ai_stale_seq_skipped", { turnId: myTurnId, requestSeq });
          continue;
        }

        if (!isTurnStillValid(myTurnId, userText)) {
          lifeLog("ai_stale_user_text", {
            turnId: myTurnId,
            processed: compactLogText(userText),
            latest: compactLogText(state.lastQueuedUserText),
          });
          if (state.lastQueuedUserText) {
            state.pendingUserText = state.lastQueuedUserText;
          }
          continue;
        }

        const rawAnswer = normalizeText(result?.answer || result?.response || "");
        const applyWorkerRecovery = shouldApplyWorkerAnswerRecovery(result);
        // API finalizes director, template, memory, and KB answers — recovery is llm_turn only.
        let outboundAnswer = rawAnswer;
        if (applyWorkerRecovery) {
          outboundAnswer = enforcePolicyOnAnswer(rawAnswer, turnPolicy);
          outboundAnswer = recoverWeakAnswer({
            answer: outboundAnswer,
            turnIntent: result?.directiveAction === "appointment_booking"
              ? "appointment_booking"
              : turnIntent,
            objective: state.callConfig?.objective || state.callObjective || "custom",
            userText,
          });
          outboundAnswer = enforceCallingFlowAnswer({
            answer: outboundAnswer,
            userText,
            turnIntent: result?.directiveAction || turnIntent,
            language: normalizeText(result?.responseLanguage || state.languageState?.dominantLanguage || "en"),
            objective: state.callConfig?.objective || state.callObjective || "custom",
          });
        }
        const answer = cleanOutgoingAnswer(outboundAnswer);
        lifeLog("ai_reply", {
          turnId: myTurnId,
          source: String(result?.fromMemory ? "memory" : result?.answerSource || "llm"),
          confidence: Number(result?.answerConfidence || 0),
          workerRecovery: applyWorkerRecovery,
          text: compactLogText(answer),
        });
        const shouldEndCall = Boolean(result?.endCall);
        const endReasonRaw = normalizeText(result?.endReason || "");
        const endReason = endReasonRaw || (shouldEndCall ? "conversation_closed" : "");
        const stage = normalizeText(result?.stage || "");
        const responseLanguage = normalizeText(
          result?.responseLanguage ||
          state.languageState?.dominantLanguage ||
          languageConfig.startLanguage,
        );

        if (!answer) {
          console.warn("[ai] empty answer");
          trackFallback(state.analyticsKey);
          continue;
        }

        callLog(`[ai] ${answer}`);
        trackSuccessfulAnswer(state.analyticsKey);

        if (shouldEndCall) {
          markSessionClosing(endReason || "conversation_closed");
        }

        if (!isTurnStillValid(myTurnId, userText)) {
          lifeLog("ai_stale_before_playback", {
            turnId: myTurnId,
            processed: compactLogText(userText),
            latest: compactLogText(state.lastQueuedUserText),
          });
          if (state.lastQueuedUserText) {
            state.pendingUserText = state.lastQueuedUserText;
          }
          continue;
        }

        const ttsHeadStart = beginTtsHeadPrefetch(answer, { responseLanguage, stage });
        if (ttsHeadStart) {
          lifeLog("tts_prefetch_start", {
            turnId: myTurnId,
            text: compactLogText(
              splitSemanticChunksWithFastStart(
                answer,
                TTS_FIRST_CHUNK_CHARS,
                TTS_TARGET_CHUNK_CHARS,
              )[0] || answer,
            ),
          });
        }

        try {
          await withCircuitBreaker(ttsBreaker, () => playAnswer(answer, myTurnId, {
            shouldEndCall,
            endReason,
            stage,
            responseLanguage,
            ttsHeadStart,
          }));
          state.lastCompletedUserText = userText;
          state.answeringUserText = "";
          if (metrics.finalAt) {
            trackLatencyMetric(state.analyticsKey, "totalMs", Date.now() - metrics.finalAt);
          }
        } catch (error) {
          console.error("[tts] failed:", error?.message || error);
        }

        if (shouldEndCall && myTurnId === state.turnId && !isSessionEnded()) {
          const finalReason = endReason || "conversation_closed";
          await endSessionNow(finalReason);
          console.log("[call] ended by conversation policy", { reason: finalReason });
          break;
        }
      }
    } finally {
      state.aiRunning = false;

      if (state.pendingUserText && !isSessionEnded()) {
        runAI().catch((error) => {
          console.error("[ai] loop failed:", error?.message || error);
        });
      }
    }
  };

  const closeActiveSTT = async () => {
    const activeSTT = state.activeSTT;
    state.activeSTT = null;

    if (activeSTT) {
      activeSTT.closed = true;
      await safeClose(() => activeSTT.close?.());
    }
  };

  const startSttForActiveTrack = async (source = "track_subscribed", participantHint = null) => {
    if (!isSessionActive()) return false;
    if (state.activeSTT || state.sttStarting) return false;

    const participant = participantHint || resolveActiveParticipant();
    if (!participant) return false;
    if (
      participant.sid !== state.activeParticipantSid ||
      participant.identity !== state.activeParticipantIdentity
    ) {
      return false;
    }

    if (!canStartSttForParticipant(participant)) {
      ensureCallAnswerTimer(participant, source);
      if (!state.sttWaitLogged) {
        state.sttWaitLogged = true;
        const callStatus = getSipCallStatus(participant) || "unknown";
        console.log(`[stt] waiting for answered state (sip.callStatus=${callStatus})`);
      }
      return false;
    }

    clearCallAnswerTimer();
    state.sttWaitingForAnswer = false;
    state.sttWaitLogged = false;

    const track = state.activeAudioTrack;
    if (!track) return false;

    if (state.activeSTT) {
      console.log("[call] closing previous STT session");
      await closeActiveSTT();
    }

    state.sttStarting = true;
      sttLog("[stt] creating session...");
    let sttSession = null;

    try {
      const { send, close, events, ready } = await createSTTSession({
        languageCode: resolveSttLanguageCode(
          state.languageState?.dominantLanguage || languageConfig.startLanguage,
        ),
        sampleRate: STT_SAMPLE_RATE,
        inputAudioCodec: "pcm_s16le",
        encoding: "audio/wav",
        vadSignals: "true",
      });
      try {
        await ready;
      } catch (error) {
        console.warn("[stt] socket open failed:", error?.message || error);
        return false;
      }

      sttSession = {
        closed: false,
        close,
      };

      state.activeSTT = sttSession;
      state.activeSttLanguageCode = resolveSttLanguageCode(
        state.languageState?.dominantLanguage || languageConfig.startLanguage,
      );
      state.lastSttReadyAt = Date.now();
      lifeLog("stt_ready", { source });

      let lastTranscript = "";

      events.on("open", () => {
        sttLog("[stt] socket open");
      });

      events.on("message", async (message) => {
        if (sttSession.closed || state.activeSTT !== sttSession) return;
        if (!message || typeof message !== "object") return;
        if (!isSessionActive()) return;

        const type = message.type;
        const data = message.data;

        if (type === "data") {
          const transcript = normalizeText(data?.transcript);

          if (transcript) {
            if (shouldSuppressEchoTranscript(transcript)) return;
            if (transcript.length < 3) return;
            lastTranscript = transcript;
            rememberTranscript(transcript);
            bumpUserActivity();
            schedulePendingSpeechCommit();

            sttLog(`[stt] partial: ${transcript}`);
            const forceInterrupt =
              transcript.split(" ").length >= MIN_INTERRUPT_TRANSCRIPT_WORDS ||
              transcript.length >= MIN_INTERRUPT_TRANSCRIPT_CHARS;
            const hadPlayback = Boolean(state.playback);
            await interruptForUserSpeech(forceInterrupt);
            if (hadPlayback && !state.playback) {
              trackInterruption(state.analyticsKey);
            }
          }

          return;
        }

        if (type === "events") {
          const eventType = data?.event_type || data?.signal_type;

          if (eventType) {
            sttLog(`[stt] event: ${eventType}`);
          }

          if (eventType === "START_SPEECH") {
            await handleSpeechStart();
            return;
          }

          if (eventType === "END_SPEECH") {
            state.userSpeaking = false;
            state.lastSpeechEndedAt = Date.now();
            state.userSpeechStartedAt = 0;
            lifeLog("speech_end", {});
            clearPendingSpeechTimer();

            if (lastTranscript) {
              rememberTranscript(lastTranscript);
            }
            lastTranscript = "";
            scheduleUtteranceCommit();
          }

          return;
        }

        if (type === "error") {
          console.error("[stt] provider error:", data?.message || data);
        }
      });

      events.on("error", (error) => {
        console.error("[stt] stream error:", error?.message || error);
      });

      events.on("close", (event) => {
        const code = event?.code;
        const reasonRaw = event?.reason;
        const reason =
          typeof reasonRaw === "string"
            ? reasonRaw
            : Buffer.isBuffer(reasonRaw)
              ? reasonRaw.toString("utf8")
              : reasonRaw;

        sttLog(
          "[stt] stream closed",
          code ? `code=${code}` : "",
          reason ? `reason=${reason}` : "",
        );

        sttSession.closed = true;
      });

      const lkAudio = new AudioStream(track, {
        sampleRate: STT_SAMPLE_RATE,
        numChannels: 1,
      });
      lifeLog("stt_loop_start", { source });

      sttLog("[stt] audio stream created");

      const bytesPerSecond = STT_SAMPLE_RATE * 2;
      const targetBytes = Math.floor(bytesPerSecond / 20);

      let buffer = Buffer.alloc(0);
      let loggedFrames = false;
      let sentChunks = 0;
      let sentBytes = 0;
      let levelPeak = 0;
      let levelSince = Date.now();

      sttLog("[stt] starting audio frame loop...");
      for await (const frame of lkAudio) {
        if (sttSession.closed || state.activeSTT !== sttSession) {
          sttLog("[stt] session closed or replaced, exiting frame loop");
          break;
        }

        if (!loggedFrames) {
          loggedFrames = true;
          sttLog("[livekit] audio frames incoming");
        }

        const view = frame.data;
        if (!view || !view.length) {
          console.warn("[livekit] empty frame received");
          continue;
        }

        if (debugStt) {
          let localPeak = 0;

          for (let i = 0; i < view.length; i += 1) {
            const value = Math.abs(view[i]);
            if (value > localPeak) localPeak = value;
          }

          if (localPeak > levelPeak) levelPeak = localPeak;

          const now = Date.now();

          if (now - levelSince >= 1000) {
            sttLog(`[stt] audio peak 1s: ${levelPeak}`);
            levelPeak = 0;
            levelSince = now;
          }
        }

        const chunk = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
        buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);

        if (buffer.length >= targetBytes) {
          send(buffer);

          sentChunks += 1;
          sentBytes += buffer.length;

          if (debugStt && (sentChunks === 1 || sentChunks % 50 === 0)) {
            sttLog(`[stt] sent chunks=${sentChunks}, bytes=${sentBytes}`);
          }

          buffer = Buffer.alloc(0);
        }
      }
      sttLog("[stt] audio frame loop ended");
      return true;
    } catch (error) {
      console.error("[livekit] audio loop error:", error?.message || error);
      return false;
    } finally {
      state.sttStarting = false;
      const pendingLanguage = state.pendingSttLanguageCode || "";
      state.pendingSttLanguageCode = "";
      if (sttSession && state.activeSTT === sttSession) {
        resetUtterance();
        await closeActiveSTT();
      }
      if (pendingLanguage && isSessionActive() && state.activeAudioTrack) {
        state.activeSttLanguageCode = "";
        void startSttForActiveTrack("language_switch").catch((error) => {
          console.warn("[stt] language-switch restart failed:", error?.message || error);
        });
      }
    }
  };

  const requestSttLanguageRestart = async () => {
    const desired = resolveSttLanguageCode(
      state.languageState?.dominantLanguage || languageConfig.startLanguage,
    );
    if (!state.activeSTT || desired === state.activeSttLanguageCode) return;
    state.pendingSttLanguageCode = desired;
    console.log("[stt] scheduling language switch", { languageCode: desired });
    const session = state.activeSTT;
    session.closed = true;
    state.activeSTT = null;
    await safeClose(() => session.close?.());
  };

  const subscribeToParticipantAudio = (participant) => {
    if (!participant || participant.identity === BOT_IDENTITY) return;

    const publications = participant.trackPublications || new Map();

    for (const [, publication] of publications) {
      if (!publication) continue;
      if (!isAudioKind(publication.kind)) continue;

      if (
        state.activeParticipantSid &&
        state.activeParticipantSid !== participant.sid
      ) {
        console.log(
          `[call] ignoring ${participant.identity}; active caller is ${state.activeParticipantIdentity}`,
        );
        publication.setSubscribed?.(false);
        continue;
      }

      if (publication.subscribed) continue;

      console.log(`[livekit] subscribing to existing ${participant.identity} audio track`);
      publication.setSubscribed?.(true);
    }
  };

  const subscribeToExistingAudio = () => {
    if (!room.remoteParticipants || room.remoteParticipants.size === 0) return;

    for (const [, participant] of room.remoteParticipants) {
      subscribeToParticipantAudio(participant);
    }
  };

  const resolveParticipantForGreeting = (participantHint = null) => {
    if (
      participantHint &&
      participantHint.sid === state.activeParticipantSid &&
      participantHint.identity === state.activeParticipantIdentity
    ) {
      return participantHint;
    }

    if (!state.activeParticipantSid || !room.remoteParticipants) return null;

    for (const [, participant] of room.remoteParticipants) {
      if (participant.sid === state.activeParticipantSid) {
        return participant;
      }
    }

    return null;
  };

  const canStartInitialGreeting = (participant) => {
    if (!participant) return false;
    if (participant.identity === BOT_IDENTITY) return false;

    if (
      participant.sid !== state.activeParticipantSid ||
      participant.identity !== state.activeParticipantIdentity
    ) {
      return false;
    }

    if (!isSipParticipant(participant)) return true;

    const callStatus = getSipCallStatus(participant);
    if (!callStatus) return false;

    return isSipCallConnectedStatus(callStatus);
  };

  const triggerInitialGreeting = async (source, participantHint = null) => {
    if (state.initialGreetingSent || !isSessionActive()) return false;

    const participant = resolveParticipantForGreeting(participantHint);
    if (!participant) return false;

    if (!canStartInitialGreeting(participant)) return false;

    state.initialGreetingSent = true;
    state.greetingWaitLogged = false;

    try {
      const result = await queryAI({
        tenantId,
        agentId,
        query: "",
        sessionId: state.sessionId || undefined,
        roomName,
        callObjective: state.callObjective || undefined,
        callConfig: state.callConfig || undefined,
        eventType: "call_connected",
        languageState: state.languageState,
      });
      if (result?.languageState && typeof result.languageState === "object") {
        state.languageState = result.languageState;
      }

      if (result?.sessionId) {
        state.sessionId = result.sessionId;
      }

      const greetingText = normalizeText(result?.answer || "");
      if (!greetingText) return true;

      console.log(`[call] initial greeting (${source})`);
      console.log(`[ai] ${greetingText}`);
      const greetingLanguage = normalizeText(result?.responseLanguage || languageConfig.startLanguage);
      const greetingTtsHeadStart = beginTtsHeadPrefetch(greetingText, {
        responseLanguage: greetingLanguage,
        stage: "opening",
        singleChunk: true,
      });
      if (greetingTtsHeadStart) {
        lifeLog("tts_prefetch_start", {
          turnId: state.turnId,
          text: compactLogText(greetingText),
          source: "greeting",
        });
      }
      await playAnswer(greetingText, state.turnId, {
        stage: "opening",
        singleChunk: true,
        responseLanguage: greetingLanguage,
        ttsHeadStart: greetingTtsHeadStart,
      });
      state.postGreetingOpenedAt = Date.now();

      if (result?.endCall && !isSessionEnded()) {
        await endSessionNow(result?.endReason || "conversation_closed");
        console.log("[call] ended during greeting");
      }

      bumpUserActivity(INITIAL_RESPONSE_GRACE_MS);
      return true;
    } catch (error) {
      state.initialGreetingSent = false;
      console.warn("[call] initial greeting failed:", error?.message || error);
      return false;
    }
  };

  console.log("[livekit] connecting...");
  await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
  console.log(`[livekit] connected to room: ${roomName}`);
  bumpUserActivity();

  // Log all participants already in room (if any)
  if (room.remoteParticipants && room.remoteParticipants.size > 0) {
    console.log(`[livekit] participants in room: ${room.remoteParticipants.size}`);
    for (const [, participant] of room.remoteParticipants) {
      const audioTrackCount = [...participant.trackPublications.values()].filter((publication) =>
        isAudioKind(publication.kind),
      ).length;
      console.log(
        `  - ${participant.identity} (${participant.kind}) with ${audioTrackCount} audio tracks`,
      );
    }
  } else {
    console.log("[livekit] no participants in room yet");
  }

  subscribeToExistingAudio();

  if (ENABLE_TTS_STREAMING) {
    void warmupTtsConnection(languageConfig.startLanguage);
    console.log("[tts] mode=stream (linear16)");
  } else {
    void warmupTtsWavConnection(languageConfig.startLanguage);
    console.log("[tts] mode=wav (full-buffer Sarvam playback)", {
      wavRate: TTS_OUTPUT_RATE,
      livekitRate: LIVEKIT_AUDIO_RATE,
    });
  }

  const turnOrchestratorConfig = {
    log: (label, meta) => {
      if (label === "latency") lifeLog("stream_latency", meta || {});
    },
    synthesize: async (text, language) => {
      try {
        const wav = await generateSpeech(text, {
          language: language || state.languageState?.dominantLanguage || languageConfig.startLanguage,
          mixLevel: state.languageState?.mixLevel || "low",
        });
        return wav && wav.length >= 1000 ? wav : null;
      } catch (error) {
        console.error("[tts] synth failed:", error?.message || error);
        return null;
      }
    },
    play: async (wavBuffer, { turnId, token }) => {
      if (turnId !== state.turnId || isSessionEnded()) return;
      if (!state.turnOrchestrator?.playbackQueue?.isActiveToken(token)) return;
      await stopPlayback("new answer");
      const playback = await createTTSPlayback(room, wavBuffer);
      state.playback = playback;
      state.aiSpeaking = true;
      state.aiSpeechStartedAt = Date.now();
      try {
        await playback.done;
      } finally {
        state.aiSpeaking = false;
        state.aiSpeechStartedAt = 0;
        bumpUserActivity();
        if (state.playback === playback) {
          state.playback = null;
        }
      }
    },
    isTurnActive: (turnId) => turnId === state.turnId && !isSessionEnded(),
    onChunkStart: ({ turnId, total }) => lifeLog("tts_start", { turnId, chunks: total || 1 }),
    onChunkDone: ({ turnId, index, total }) => {
      if (index === (total || 1) - 1) {
        lifeLog("tts_done", { turnId });
      }
    },
  };

  if (ENABLE_TTS_STREAMING) {
    turnOrchestratorConfig.openStream = (text, language) =>
      openSpeechStream(text, {
        language: language || state.languageState?.dominantLanguage || languageConfig.startLanguage,
      });
    turnOrchestratorConfig.playStream = async ({ stream, turnId, token, onFirstFrame }) => {
      if (turnId !== state.turnId || isSessionEnded()) return;
      if (!state.turnOrchestrator?.playbackQueue?.isActiveToken(token)) return;
      if (state.userSpeaking) return;

      await stopPlayback("new answer");

      let playback = null;
      try {
        playback = await createStreamingTTSPlayback(room, stream, {
          inputSampleRate: TTS_STREAM_SAMPLE_RATE,
          onFirstFrame,
        });
        if (!state.turnOrchestrator?.playbackQueue?.isActiveToken(token)) {
          await playback.stop();
          return;
        }
        state.playback = playback;
        state.aiSpeaking = true;
        state.aiSpeechStartedAt = Date.now();
        lifeLog("tts_stream_play", { turnId });
        await playback.done;
      } catch (error) {
        console.error("[tts] stream playback failed:", error?.message || error);
      } finally {
        state.aiSpeaking = false;
        state.aiSpeechStartedAt = 0;
        bumpUserActivity();
        if (playback && state.playback === playback) {
          state.playback = null;
        }
      }
    };
  }

  state.turnOrchestrator = new TurnPipelineOrchestrator(turnOrchestratorConfig);

  let catchupAttempts = 0;
  const catchupTimer = setInterval(() => {
    if (isSessionEnded()) {
      clearInterval(catchupTimer);
      return;
    }

    catchupAttempts += 1;
    subscribeToExistingAudio();

    if (state.activeSTT || catchupAttempts >= 40) {
      clearInterval(catchupTimer);
    }
  }, 500);

  const sttWatchdog = setInterval(() => {
    if (isSessionEnded() || !isSessionActive()) return;
    if (!state.activeParticipantSid || !state.activeAudioTrack) return;
    if (state.activeSTT || state.sttStarting) return;
    const sinceLastReady = Date.now() - Number(state.lastSttReadyAt || 0);
    if (sinceLastReady >= 0 && sinceLastReady < STT_WATCHDOG_COOLDOWN_MS) return;

    const participant = resolveActiveParticipant();
    startSttForActiveTrack("watchdog_retry", participant).catch((error) => {
      console.warn("[stt] watchdog retry failed:", error?.message || error);
    });
  }, 1200);

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    bumpUserActivity();
    clearRoomIdleTimer();
    if (isSessionClosing()) {
      markSessionActive();
    }

    console.log(
      `[livekit] participant joined: ${participant.identity} (kind=${participant.kind})`,
    );
    const audioTrackCount = [...participant.trackPublications.values()].filter((publication) =>
      isAudioKind(publication.kind),
    ).length;
    console.log(
      `  - audio tracks: ${audioTrackCount}`,
    );

    subscribeToParticipantAudio(participant);
  });

  room.on(RoomEvent.ParticipantDisconnected, async (participant) => {
    console.log(`[livekit] participant left: ${participant.identity}`);

    if (participant.sid === state.activeParticipantSid) {
      clearCallAnswerTimer();
      state.turnId += 1;
      state.userSpeaking = false;
      resetUtterance();
      await closeActiveSTT();
      await stopPlayback("active participant disconnected");

      const hangupReason = state.hasUserSpoken ? "user_hangup" : "user_left_before_speaking";
      await triggerPostCallFinalize(hangupReason);

      state.activeParticipantSid = null;
      state.activeParticipantIdentity = null;
      state.activeAudioTrack = null;
      state.activeAudioPublication = null;
      state.pendingUserText = null;
      state.lastQueuedUserText = "";
      state.answeringUserText = "";
      state.hasUserSpoken = false;
      clearCallbackAggregateTimer();
      state.callbackAggregateText = "";
      state.initialGreetingSent = false;
      state.greetingWaitLogged = false;
      state.sttWaitingForAnswer = false;
      state.sttWaitLogged = false;
      markSessionClosing("participant_left");
      scheduleRoomIdleDisconnect("active_participant_left", { force: true });
      return;
    }

    scheduleRoomIdleDisconnect("participant_left");
  });

  room.on(RoomEvent.ParticipantAttributesChanged, (changedAttributes, participant) => {
    if (!isSessionActive()) return;
    if (!participant || participant.identity === BOT_IDENTITY) return;
    if (participant.sid !== state.activeParticipantSid) return;

    const changedStatus = normalizeText(changedAttributes?.["sip.callStatus"]).toLowerCase();
    if (changedStatus) {
      console.log(`[livekit] sip.callStatus changed: ${changedStatus}`);
    }

    if (isSipCallTerminalStatus(changedStatus)) {
      handleSipTerminalStatus(changedStatus, "participant_attributes_changed").catch((error) => {
        console.warn("[call] terminal status cleanup failed:", error?.message || error);
      });
      return;
    }

    ensureCallAnswerTimer(participant, "participant_attributes_changed");

    startSttForActiveTrack("participant_attributes_changed", participant).catch((error) => {
      console.warn("[stt] deferred start failed:", error?.message || error);
    });

    triggerInitialGreeting("participant_attributes_changed", participant).catch((error) => {
      console.warn("[call] initial greeting failed:", error?.message || error);
    });
  });

  room.on(RoomEvent.Disconnected, async () => {
    markSessionEnded("room_disconnected");
    clearRoomIdleTimer();
    clearCallAnswerTimer();
    clearSilenceTimer();
    clearInterval(catchupTimer);
    clearInterval(sttWatchdog);

    state.activeAudioTrack = null;
    state.activeAudioPublication = null;
    resetUtterance();
    await closeActiveSTT();
    await stopPlayback("room disconnected");
  });

  room.on(RoomEvent.TrackPublished, (publication, participant) => {
    console.log(
      `[livekit] track published: ${String(publication.kind)} by ${participant.identity}`,
    );

    if (!isAudioKind(publication.kind)) {
      console.log(`[livekit] ignoring non-audio track`);
      return;
    }
    if (participant.identity === BOT_IDENTITY) {
      console.log(`[livekit] ignoring own bot track`);
      return;
    }

    if (
      state.activeParticipantSid &&
      state.activeParticipantSid !== participant.sid
    ) {
      console.log(
        `[call] ignoring ${participant.identity}; active caller is ${state.activeParticipantIdentity}`,
      );
      publication.setSubscribed(false);
      return;
    }

    console.log(`[livekit] subscribing to ${participant.identity} audio track`);
    publication.setSubscribed(true);
  });

  room.on(RoomEvent.TrackSubscribed, async (track, publication, participant) => {
    bumpUserActivity();
    if (isSessionEnded()) {
      console.log("[call] room closed, ignoring track subscription");
      return;
    }
    if (isSessionClosing()) {
      markSessionActive();
      clearRoomIdleTimer();
    }
    if (!isAudioKind(track.kind)) {
      console.log("[call] ignoring non-audio track subscription");
      return;
    }
    if (participant.identity === BOT_IDENTITY) {
      console.log("[call] ignoring own bot track subscription");
      return;
    }

    if (
      state.activeParticipantSid &&
      state.activeParticipantSid !== participant.sid
    ) {
      console.log(
        `[call] ignoring ${participant.identity}; active caller is ${state.activeParticipantIdentity}`,
      );
      publication.setSubscribed(false);
      return;
    }

    state.activeParticipantSid = participant.sid;
    state.activeParticipantIdentity = participant.identity;
    state.activeAudioTrack = track;
    state.activeAudioPublication = publication;
    if (!state.initialGreetingSent) {
      state.sessionId = null;
    }
    state.greetingWaitLogged = false;
    state.sttWaitLogged = false;

    console.log(`[call] active caller: ${participant.identity}`);
    console.log(`[call] track details - kind: ${track.kind}, source: ${publication.source}`);

    const initialSipStatus = getSipCallStatus(participant);
    if (isSipCallTerminalStatus(initialSipStatus)) {
      await handleSipTerminalStatus(initialSipStatus, "track_subscribed");
      return;
    }

    startSttForActiveTrack("track_subscribed", participant).catch((error) => {
      console.warn("[stt] deferred start failed:", error?.message || error);
    });

    triggerInitialGreeting("track_subscribed", participant)
      .then((greeted) => {
        if (greeted) return;
        if (state.initialGreetingSent || !isSessionActive()) return;
        if (!isSipParticipant(participant)) return;
        if (state.greetingWaitLogged) return;

        state.greetingWaitLogged = true;
        const callStatus = getSipCallStatus(participant) || "unknown";
        console.log(
          `[call] greeting waiting for answered state (sip.callStatus=${callStatus})`,
        );
      })
      .catch((error) => {
        console.warn("[call] initial greeting failed:", error?.message || error);
      });

    ensureCallAnswerTimer(participant, "track_subscribed");
  });

  return room;
};
