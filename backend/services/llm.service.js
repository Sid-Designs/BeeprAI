import axios from "axios";
import { buildConversationContextBlock } from "./conversation/responsePolish.service.js";
import { buildInterruptionResumePromptBlock } from "./conversation/interruptionResume.service.js";
import { callOpenAIRealtimeWS } from "./realtime/openaiRealtimeTextWs.service.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = "https://api.openai.com/v1/responses";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PRIMARY_LLM_PROVIDER = String(process.env.PRIMARY_LLM_PROVIDER || "groq").toLowerCase();
const FALLBACK_LLM_PROVIDER = String(process.env.FALLBACK_LLM_PROVIDER || "").toLowerCase();

const VOICE_FAST_MODE =
  String(process.env.VOICE_FAST_MODE || "true").toLowerCase() === "true";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-realtime";
const OPENAI_TIMEOUT_MS = positiveInt(process.env.OPENAI_TIMEOUT_MS, VOICE_FAST_MODE ? 12000 : 18000);
const OPENAI_MAX_TOKENS = positiveInt(process.env.OPENAI_MAX_TOKENS, VOICE_FAST_MODE ? 120 : 250);
const LLM_HISTORY_TURNS = positiveInt(process.env.LLM_HISTORY_TURNS, VOICE_FAST_MODE ? 8 : 15);
const LLM_KNOWLEDGE_MAX_CHARS = positiveInt(
  process.env.LLM_KNOWLEDGE_MAX_CHARS,
  VOICE_FAST_MODE ? 1400 : 2200,
);
const LLM_QUERY_MAX_CHARS = positiveInt(process.env.LLM_QUERY_MAX_CHARS, 420);
const LLM_VERBOSE_LOGS = String(process.env.LLM_VERBOSE_LOGS || "false").toLowerCase() === "true";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  (VOICE_FAST_MODE ? process.env.GROQ_VOICE_MODEL || "llama-3.1-8b-instant" : "llama-3.3-70b-versatile");
const GROQ_TIMEOUT_MS = positiveInt(process.env.GROQ_TIMEOUT_MS, VOICE_FAST_MODE ? 12000 : 22000);
const GROQ_MAX_TOKENS = positiveInt(process.env.GROQ_MAX_TOKENS, 280);
const VOICE_FAST_MAX_TOKENS = positiveInt(process.env.VOICE_FAST_MAX_TOKENS, 200);
const KB_ANSWER_MAX_TOKENS = positiveInt(process.env.KB_ANSWER_MAX_TOKENS, 80);
const INTENT_LLM_MAX_TOKENS = positiveInt(process.env.INTENT_LLM_MAX_TOKENS, 80);
const COMPLIANCE_RETRY_MAX_TOKENS = positiveInt(process.env.COMPLIANCE_RETRY_MAX_TOKENS, 100);

export const MODE_LLM_MAX_TOKENS = Object.freeze({
  concise: 100,
  factual: 150,
  balanced: 200,
  explain: 280,
  default: 200,
});

export const resolveLlmMaxTokens = (
  responseStyleProfile = {},
  { voiceFastMode = VOICE_FAST_MODE, absoluteCeiling = GROQ_MAX_TOKENS, voiceFastCeiling = VOICE_FAST_MAX_TOKENS } = {},
) => {
  const mode = String(responseStyleProfile?.mode || "balanced").toLowerCase();
  const modeTokens = MODE_LLM_MAX_TOKENS[mode] || MODE_LLM_MAX_TOKENS.balanced;
  const ceiling = voiceFastMode ? voiceFastCeiling : absoluteCeiling;
  return Math.min(modeTokens, ceiling);
};

const VOICE_INTENT_LABELS = Object.freeze([
  "appointment_booking",
  "information_request",
  "fee_inquiry",
  "admission_inquiry",
  "support_request",
  "callback_request",
  "objection",
  "unknown",
]);

const inferPersonaRole = (policy = {}) => {
  const objective = cleanText(policy.objective, 80).toLowerCase();
  const industry = cleanText(policy.industry, 80).toLowerCase();

  if (objective.includes("support")) return "support specialist";
  if (objective.includes("appointment")) return "appointment guide";
  if (objective.includes("sales")) return "business growth advisor";
  if (industry.includes("education") || industry.includes("college")) return "customer advisor";
  return "business advisor";
};

const cleanText = (value, max = 5000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const normalizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter((message) => message?.role && message?.content)
    .map((message) => ({
      role: message.role,
      content: cleanText(message.content, 800),
    }))
    .slice(-Math.max(2, LLM_HISTORY_TURNS * 2));
};

const extractJsonObject = (raw = "") => {
  const text = cleanText(raw, 12000);
  if (!text) return null;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first < 0 || last < first) return null;

  const maybeJson = text.slice(first, last + 1);
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
};

const isHardCloseMessage = (query = "") => {
  const text = cleanText(query, 500).toLowerCase();
  return /\b(bye|goodbye|end call|disconnect|hang up|stop calling|do not call)\b/.test(text);
};

const isNotInterestedMessage = (query = "") => {
  const text = cleanText(query, 500).toLowerCase();
  return /\b(not interested|no thanks|no thank you|remove me|do not call)\b/.test(text);
};

const getImmediateCloseResponse = (query = "") => {
  const text = cleanText(query, 500).toLowerCase();

  if (/\b(end call|disconnect|hang up|close)\b/.test(text)) {
    return "Understood. Thanks for your time. Goodbye, take care.";
  }
  if (/\b(bye|goodbye|see you)\b/.test(text)) {
    return "Goodbye. Take care.";
  }
  return "Understood. Thanks for your time. Goodbye, take care.";
};

const toLeadStatus = (value = "", fallback = "unsure") => {
  const normalized = cleanText(value, 80).toLowerCase();
  const allowed = new Set([
    "new",
    "interested",
    "qualified",
    "unsure",
    "not_interested",
    "closed",
  ]);

  if (allowed.has(normalized)) return normalized;
  return fallback;
};

const CALLBACK_EXACT_TIME_RE =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|morning|afternoon|evening|tonight)\b/i;
const CALLBACK_INCOMPLETE_TIME_RE =
  /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\b/i;

const hasConcreteCallbackTime = (callState = {}) => {
  const preferredTime = cleanText(callState?.collectedData?.preferred_time, 40);
  if (preferredTime) return true;

  const scheduleText = cleanText(callState?.collectedData?.callbackSchedule?.text, 180).toLowerCase();
  if (!scheduleText) return false;
  if (CALLBACK_INCOMPLETE_TIME_RE.test(scheduleText)) return false;
  return CALLBACK_EXACT_TIME_RE.test(scheduleText);
};

const buildSystemPrompt = ({
  agentPrompt,
  policy,
  callState,
  conversationState,
  analyticsSnapshot,
  languageInstruction,
  nextBestAction,
  objectionGuidance,
  responseStyleProfile,
  experimentProfile,
  turnDirective = null,
  history = [],
}) => {
  const businessPrompt = cleanText(agentPrompt, 4000);
  const personaRole = inferPersonaRole(policy);
  const wordBudget = Number(responseStyleProfile?.wordBudget || 24);
  const contextBlock = buildConversationContextBlock({ callState, history, turnDirective });
  const interruptionBlock = turnDirective?.interruptionResume
    ? buildInterruptionResumePromptBlock({
        interruptedUtterance: turnDirective.interruptionResume.interruptedUtterance,
        activeTopic: turnDirective.interruptionResume.activeTopic,
        userQuery: cleanText(callState?.lastUserQuery || "", 200),
      })
    : "";
  return `
You are ${cleanText(policy.agentName, 80) || "a counselor"} from ${cleanText(policy.orgName, 120) || "the organization"}.
You are on a live phone call. Sound like a professional counselor or call-center executive — warm, clear, and human.
You are NOT a chatbot, email writer, or textbook.

VOICE RESPONSE STYLE (critical):
- Answer the user's question FIRST in the opening sentence.
- Priority order: Answer → Help → Qualify → Guide → Book. Never push booking before answering.
- Then add ONE short guiding line (eligibility, dates, qualification, or soft counselor offer) only if useful.
- Simple questions: 1-2 short sentences (about ${Math.max(14, wordBudget - 6)}-${wordBudget} words).
- Complex or comparison questions: up to 3-5 short sentences (max ${Math.min(42, wordBudget + 14)} words).
- Use natural spoken English. Prefer "Sure." or "Right." over "Certainly" or "I would be happy to."
- One acknowledgement max per turn ("I understand", "Good question", "Got it") — skip if the answer is already direct.
- Never open two turns in a row with the same word (Sure, Great, Perfect, Certainly).
- Never use bullet-style lists or "first, second, third" speech patterns.
- Avoid formal definitions like "X is a postgraduate degree program designed for..."

BAD (robotic):
"The MCA program is a postgraduate degree program designed for students interested in advanced computer applications."

GOOD (counselor):
"Sure. MCA is a postgraduate program focused on software development and advanced computer applications."

BAD (chatbot):
"I can help you with that. Could you elaborate on your requirements?"

GOOD (answer first):
"The annual MCA fee is around ₹X. I can also explain eligibility or admission dates if that helps."

${contextBlock}

BUSINESS PROFILE:
- organization: ${cleanText(policy.orgName, 120) || "the business"}
- industry: ${cleanText(policy.industry, 80) || "general"}
- agent name: ${cleanText(policy.agentName, 80) || "assistant"}
- objective: ${cleanText(policy.objective, 80) || "custom"}
- reason for calling: ${cleanText(policy.reasonForCalling, 280) || "assist the caller"}
- primary goal: ${cleanText(policy.primaryGoal, 280) || "help the caller and move to next step"}
- tone: ${cleanText(policy.tone, 40) || "neutral"}
- qualification fields: ${(policy.qualificationFields || []).join(", ") || "name, need"}
- handoff enabled: ${policy.allowHandoff ? "yes" : "no"}
- appointment booking enabled: ${policy.allowAppointmentBooking ? "yes" : "no"}
- persona proactiveness: ${cleanText(policy.personaConfig?.proactiveness, 40) || "high"}
- persona empathy level: ${cleanText(policy.personaConfig?.empathyLevel, 40) || "adaptive"}
- persona closing style: ${cleanText(policy.personaConfig?.closingStyle, 40) || "soft"}

BUSINESS CONTEXT:
${cleanText(policy.businessContext, 1200) || "No extra business context provided."}

AGENT STYLE NOTES:
${businessPrompt || "No extra agent style notes provided."}

CURRENT CALL STATE:
- stage: ${cleanText(callState.stage, 40) || "discovery"}
- lead status: ${cleanText(callState.leadStatus, 40) || "new"}
- turn count: ${Number(callState.turnCount || 0)}
- collected data: ${JSON.stringify(callState.collectedData || {})}
- slot state: ${JSON.stringify(callState.slotState || {})}
- intent profile: ${JSON.stringify(callState.intentProfile || {})}

CONVERSATION STATE:
- user emotion: ${cleanText(conversationState.userEmotion, 40) || "neutral"}
- ai tone target: ${cleanText(conversationState.aiTone, 40) || "calm"}
- frustration level (0-100): ${Number(conversationState.frustrationLevel || 0)}
- engagement level (0-100): ${Number(conversationState.engagementLevel || 50)}
- interruptions so far: ${Number(analyticsSnapshot.interruptions || 0)}
- fallback count so far: ${Number(analyticsSnapshot.fallbackCount || 0)}

GUIDANCE ENGINE:
- next best action: ${cleanText(nextBestAction.action, 40) || "qualify"}
- objection type: ${cleanText(nextBestAction.objection, 40) || "none"}
- objection guidance: ${cleanText(objectionGuidance, 240) || "none"}
- response style mode: ${cleanText(responseStyleProfile?.mode, 30) || "balanced"}
- response word budget: ${Number(responseStyleProfile?.wordBudget || 25)}
- experiment variant: ${cleanText(experimentProfile?.variant, 30) || "control"}

TURN DIRECTIVE (follow strictly this turn):
- action: ${cleanText(turnDirective?.action, 40) || "llm_turn"}
- stage: ${cleanText(turnDirective?.stage, 40) || cleanText(callState.stage, 40) || "discovery"}
- user intent: ${cleanText(turnDirective?.intent || callState?.userIntent?.intent, 40) || "unknown"}
- intent confidence: ${Number(turnDirective?.confidence || callState?.userIntent?.confidence || 0)}
- next slot to collect: ${cleanText(turnDirective?.nextSlot, 40) || "none"}
- steering goal: ${cleanText(turnDirective?.steerCTA, 60) || "move toward business outcome"}
- booking readiness: ${cleanText(callState?.bookingReadiness, 40) || "not_asked"}
- ask only one question; avoid small talk once intent is known
- after answering a factual question, offer ONE optional follow-up topic — book only if the caller asks or is clearly ready

${interruptionBlock ? `${interruptionBlock}\n` : ""}
${cleanText(languageInstruction.promptBlock, 1800)}

BEHAVIOR RULES:
1) Live voice call counselor — concise, natural, goal-oriented.
2) Answer first, help second, qualify third, guide fourth, book last. Never ask to book before answering a direct question.
3) One question maximum per turn.
4) Do not repeat information from your previous reply or opening greeting.
5) Do not re-ask for details already in collected data.
6) If knowledge is missing, say so briefly and offer the next best step.
7) Stay on the business objective; do not become a general chatbot.
8) Course abbreviations BCA, BBA, B.Com, MBA, MCA are courses only.
9) Never claim you captured name/email unless in collected data.
10) Do not ask for phone numbers.
11) If user is frustrated or confused: one short empathy line, then a clear answer.
12) If user is not interested: close politely.
13) Never say "As an AI" or "I will connect you to support."
14) Vary openings across turns.
15) No repeated "Sure" / "Certainly" / "I can help with that" every turn.
16) Keep under ${wordBudget} words unless the question truly needs a longer explanation.
17) Never start with "Hello" or re-introduce after turn 1.
18) For factual answers, use knowledge only — do not invent fees, dates, or policies.
19) After answering, offer ONE relevant next topic — not appointment booking unless the caller requested it or is clearly ready.
20) End call only when user clearly wants to end; do not end just because they said thanks once.

BANNED PHRASES:
- "Let us take the next step"
- "How may I assist you"
- "Could you elaborate"
- "Thank you for your patience"
- "I would be happy to"
- "designed for students"
- "postgraduate degree program designed"

KNOWLEDGE RULE:
Use only provided knowledge for factual business details.
If missing, do not invent.

OUTPUT FORMAT:
Return ONLY valid JSON with keys:
{
  "reply": "string",
  "end_call": boolean,
  "end_reason": "string",
  "lead_status": "new|interested|qualified|unsure|not_interested|closed",
  "next_stage": "opening|discovery|qualification|objection|closing",
  "summary": "string"
}
`;
};

const buildMessages = ({ systemPrompt, normalizedHistory, knowledge, userQuery }) => [
  { role: "system", content: systemPrompt },
  ...normalizedHistory,
  {
    role: "user",
    content: `
KNOWLEDGE:
${knowledge || "No relevant business knowledge found for this query."}

USER MESSAGE:
${userQuery}
`,
  },
];

const parseStructuredResult = ({ raw = "", callState = {} }) => {
  const parsed = extractJsonObject(raw);
  if (!parsed) {
    return {
      answer:
        cleanText(raw, 300) ||
        "I may not have that exact detail yet, but I can still guide you clearly. Which part should we solve first?",
      endCall: false,
      endReason: "",
      leadStatus: toLeadStatus(callState?.leadStatus, "unsure"),
      nextStage: cleanText(callState?.stage, 40) || "discovery",
      summary: "",
    };
  }

  return {
    answer: cleanText(parsed.reply, 360),
    endCall: Boolean(parsed.end_call),
    endReason: cleanText(parsed.end_reason, 120),
    leadStatus: toLeadStatus(parsed.lead_status, callState?.leadStatus || "unsure"),
    nextStage: cleanText(parsed.next_stage, 40) || "discovery",
    summary: cleanText(parsed.summary, 300),
  };
};

const callGroq = async ({ messages, maxTokens = GROQ_MAX_TOKENS }) => {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature: VOICE_FAST_MODE ? 0.35 : 0.45,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      timeout: GROQ_TIMEOUT_MS,
    },
  );
  return response.data?.choices?.[0]?.message?.content || "";
};


const callOpenAI = async ({ messages, maxTokens = OPENAI_MAX_TOKENS }) => {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const instructions = String(messages?.[0]?.content || "").trim();
  const conversationTurns = Array.isArray(messages) ? messages.slice(1) : [];
  const input = conversationTurns
    .map((message) => {
      const role = message.role === "assistant" ? "assistant" : "user";
      const text = String(message.content || "").trim();
      if (!text) return "";
      return `${role.toUpperCase()}: ${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (LLM_VERBOSE_LOGS) {
    console.log("[llm] provider=openai model=", OPENAI_MODEL);
  }

  // Always use WebSocket for gpt-realtime-2
  if (OPENAI_MODEL === "gpt-realtime-2") {
    if (LLM_VERBOSE_LOGS) {
      console.log("[llm] transport=realtime_ws");
    }
    const wsResult = await callOpenAIRealtimeWS({
      instructions,
      userMessage: input || "",
      timeoutMs: OPENAI_TIMEOUT_MS,
      maxOutputTokens: maxTokens,
    });
    return wsResult;
  }

  // Use REST for all other models
  if (LLM_VERBOSE_LOGS) {
    console.log("[llm] transport=responses_api");
  }
  const response = await axios.post(
    OPENAI_URL,
    {
      model: OPENAI_MODEL,
      instructions,
      input,
      max_output_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      timeout: OPENAI_TIMEOUT_MS,
    },
  );
  return String(response.data?.output_text || "").trim();
};

const callProvider = async ({ provider, messages, maxTokens = GROQ_MAX_TOKENS }) => {
  if (
    provider === "openai_responses" ||
    provider === "openai_realtime" ||
    provider === "openai" ||
    provider === "openai_realtime_ws"
  ) {
    return callOpenAI({ messages, maxTokens });
  }
  if (provider === "groq") {
    return callGroq({ messages, maxTokens });
  }
  throw new Error(`Unsupported LLM provider: ${provider}`);
};

const resolveProviderOrder = () => {
  const primary = PRIMARY_LLM_PROVIDER || "groq";
  const fallback = FALLBACK_LLM_PROVIDER || "";
  if (!fallback || fallback === primary) return [primary];
  return [primary, fallback];
};

export const generateKbVoiceAnswer = async ({
  query = "",
  kbContext = "",
  language = "en",
} = {}) => {
  const knowledge = cleanText(kbContext, 1400);
  const question = cleanText(query, 320);
  if (!knowledge || !question) return "";

  const messages = [
    {
      role: "system",
      content: [
        "You answer live phone calls for a business.",
        "Use ONLY the provided knowledge.",
        "Reply in 1-2 short spoken sentences.",
        "Give concrete facts from the knowledge — steps, eligibility, fees, or dates.",
        "Never say visit the portal, contact admissions office, or check with the office unless that is literally the only fact available.",
        "Do not greet the caller.",
        "Do not ask a follow-up question.",
        `Respond in ${cleanText(language, 10) || "en"}.`,
      ].join(" "),
    },
    {
      role: "user",
      content: `KNOWLEDGE:\n${knowledge}\n\nCALLER QUESTION:\n${question}`,
    },
  ];

  try {
    const text = await callGroq({ messages, maxTokens: KB_ANSWER_MAX_TOKENS });
    return cleanText(text, 420);
  } catch {
    return "";
  }
};

const parseIntentClassification = (raw = "") => {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return null;

  const intent = cleanText(parsed.intent, 40).toLowerCase();
  if (!VOICE_INTENT_LABELS.includes(intent)) return null;

  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
  const subTopics = Array.isArray(parsed.subTopics)
    ? [...new Set(parsed.subTopics.map((topic) => cleanText(topic, 40)).filter(Boolean))]
    : [];

  return {
    intent,
    confidence: Number(confidence.toFixed(2)),
    subTopics,
  };
};

export const classifyUserIntentWithLlm = async ({
  query = "",
  previousIntent = null,
} = {}) => {
  const text = cleanText(query, LLM_QUERY_MAX_CHARS);
  if (!text) return null;

  const priorIntent = cleanText(previousIntent?.intent, 40);
  const priorTopics = Array.isArray(previousIntent?.subTopics)
    ? previousIntent.subTopics.map((topic) => cleanText(topic, 40)).filter(Boolean).join(", ")
    : "";

  const messages = [
    {
      role: "system",
      content: [
        "Classify the caller's intent for a live business phone call.",
        `Allowed intents: ${VOICE_INTENT_LABELS.join(", ")}.`,
        "Return ONLY valid JSON:",
        '{"intent":"...","confidence":0.0,"subTopics":["..."]}',
        "confidence is 0-1. subTopics may include course names (MCA, MBA), fees, admission, eligibility.",
        "Use unknown only when the message is too vague.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        priorIntent && priorIntent !== "unknown" ? `PRIOR INTENT: ${priorIntent}` : "",
        priorTopics ? `PRIOR TOPICS: ${priorTopics}` : "",
        `CALLER MESSAGE:\n${text}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  try {
    const raw = await callGroq({ messages, maxTokens: INTENT_LLM_MAX_TOKENS });
    return parseIntentClassification(raw);
  } catch {
    return null;
  }
};

export const regenerateCompliantVoiceAnswer = async ({
  query = "",
  knowledge = "",
  blockedAnswer = "",
  reason = "",
} = {}) => {
  const context = cleanText(knowledge, 1400);
  const question = cleanText(query, 320);
  const draft = cleanText(blockedAnswer, 400);
  if (!question) return "";

  const messages = [
    {
      role: "system",
      content: [
        "Rewrite the assistant reply for a live business phone call.",
        "Use ONLY the provided knowledge for factual details.",
        "Do not invent fees, dates, policies, scholarships, or numbers unless they appear in the knowledge.",
        "Reply in 1-2 short spoken sentences.",
        "Do not greet the caller.",
        "Do not ask more than one question.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `KNOWLEDGE:\n${context || "No verified business knowledge provided."}`,
        `CALLER QUESTION:\n${question}`,
        reason ? `COMPLIANCE ISSUE: ${cleanText(reason, 80)}` : "",
        draft ? `BLOCKED DRAFT:\n${draft}` : "",
        "Return only the rewritten spoken reply.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  try {
    const text = await callGroq({ messages, maxTokens: COMPLIANCE_RETRY_MAX_TOKENS });
    return cleanText(text, 420);
  } catch {
    return "";
  }
};

const buildRateLimitCallbackFallback = (callState = {}, providerName = "") => {
  const currentStage = cleanText(callState?.stage, 60).toLowerCase();
  const hasCallbackTime = hasConcreteCallbackTime(callState);
  if (currentStage !== "callback") return null;

  if (!hasCallbackTime) {
    return {
      answer: "I can call you back. What exact time should I call you?",
      endCall: false,
      endReason: "",
      leadStatus: toLeadStatus(callState?.leadStatus, "interested"),
      nextStage: "callback",
      summary: `${providerName}_rate_limit_callback_time_requested`,
    };
  }

  return {
    answer: "Perfect! I noted your preferred time. I will call you back then.",
    endCall: true,
    endReason: "user_requested_callback",
    leadStatus: toLeadStatus(callState?.leadStatus, "interested"),
    nextStage: "closing",
    summary: `${providerName}_rate_limit_callback_confirmed`,
  };
};

const isOpenAIQuotaOrRateLimitError = (error) => {
  const statusCode = Number(error?.response?.status || 0);
  const apiCode = String(error?.response?.data?.error?.code || "").toLowerCase();
  const apiType = String(error?.response?.data?.error?.type || "").toLowerCase();
  const apiMessage = String(error?.response?.data?.error?.message || "").toLowerCase();

  if (statusCode !== 429) return false;
  if (apiCode.includes("insufficient_quota")) return true;
  if (apiCode.includes("rate_limit")) return true;
  if (apiType.includes("insufficient_quota")) return true;
  if (apiType.includes("rate_limit")) return true;
  if (apiMessage.includes("insufficient_quota")) return true;
  if (apiMessage.includes("rate limit")) return true;
  if (apiMessage.includes("quota")) return true;
  if (apiMessage.includes("credits")) return true;
  return true;
};

export const generateAIResponse = async ({
  agentPrompt,
  context,
  query,
  history = [],
  policy = {},
  callState = {},
  conversationState = {},
  analyticsSnapshot = {},
  languageInstruction = {},
  nextBestAction = {},
  objectionGuidance = "",
  responseStyleProfile = {},
  experimentProfile = {},
  turnDirective = null,
}) => {
  const userQuery = cleanText(query, 1000);
  const compactQuery = cleanText(userQuery, LLM_QUERY_MAX_CHARS);
  const normalizedHistory = normalizeHistory(history);
  const knowledge = cleanText(context, LLM_KNOWLEDGE_MAX_CHARS);

  if (isHardCloseMessage(compactQuery) || isNotInterestedMessage(compactQuery)) {
    return {
      answer: getImmediateCloseResponse(compactQuery),
      endCall: true,
      endReason: isHardCloseMessage(compactQuery)
        ? "user_requested_end"
        : "user_not_interested",
      leadStatus: isNotInterestedMessage(compactQuery) ? "not_interested" : "closed",
      nextStage: "closing",
    };
  }

  const systemPrompt = buildSystemPrompt({
    agentPrompt,
    policy,
    callState,
    conversationState,
    analyticsSnapshot,
    languageInstruction,
    nextBestAction,
    objectionGuidance,
    responseStyleProfile,
    experimentProfile,
    turnDirective,
    history: normalizedHistory,
  });
  const messages = buildMessages({
    systemPrompt,
    normalizedHistory,
    knowledge,
    userQuery: compactQuery,
  });
  const providers = resolveProviderOrder();
  const maxTokens = resolveLlmMaxTokens(responseStyleProfile);
  let lastError = null;

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    try {
      const raw = await callProvider({ provider, messages, maxTokens });
      const parsed = parseStructuredResult({ raw, callState });
      return {
        ...parsed,
        providerUsed: provider,
        usedFallback: i > 0,
        maxTokensUsed: maxTokens,
      };
    } catch (error) {
      lastError = error;
      const apiErrorCode = String(error?.response?.data?.error?.code || "").toLowerCase();
      const statusCode = Number(error?.response?.status || 0);
      console.error(`[LLM:${provider}] Error:`, error.response?.data || error.message);

      // Policy: do not fallback to secondary provider when OpenAI is quota/rate-limited.
      if (
        (provider === "openai_responses" || provider === "openai_realtime" || provider === "openai")
        && isOpenAIQuotaOrRateLimitError(error)
      ) {
        const callbackSafe = buildRateLimitCallbackFallback(callState, "openai");
        if (callbackSafe) return callbackSafe;
        return {
          answer:
            "I am temporarily unable to continue right now due to capacity limits. Please try again shortly.",
          endCall: false,
          endReason: "openai_quota_or_rate_limited",
          leadStatus: toLeadStatus(callState?.leadStatus, "unsure"),
          nextStage: cleanText(callState?.stage, 40) || "discovery",
          summary: "openai_quota_or_rate_limited_no_fallback",
          providerUsed: provider,
          usedFallback: false,
        };
      }

      if (apiErrorCode === "rate_limit_exceeded" || statusCode === 429) {
        const rateLimitFallback = buildRateLimitCallbackFallback(callState, provider);
        if (rateLimitFallback) return rateLimitFallback;
      }
    }
  }

  return {
    answer:
      "I may not have the exact detail right now, but I can still help with the next step. What would you like to clarify first?",
    endCall: false,
    endReason: "",
    leadStatus: "unsure",
    nextStage: "discovery",
    summary: cleanText(lastError?.message || "", 160),
  };
};
