import { polishVoiceResponse } from "./responsePolish.service.js";
import { buildPlaybookSteerLine } from "./conversationPlaybook.service.js";
import { generateKbVoiceAnswer } from "../llm.service.js";
import {
  extractCourseFromQuery,
  isFeeQuery,
  normalizeSpokenCourseTerms,
} from "../kb/retrieval.service.js";
const KB_CONFIDENCE_MIN = Number.parseFloat(process.env.KB_CONFIDENCE_MIN || "0.55");

const ELIGIBILITY_RE =
  /\b(eligib\w*|criteria|requirement|qualif\w*|paturta|patrata|पात्रता)\b/i;
const PROCESS_RE =
  /\b(process|steps?|procedure|how to apply|application flow|प्रक्रिया)\b/i;
const GENERIC_ADMISSION_FALLBACK_RE =
  /\badmission covers eligibility, application, documents, and counseling\b/i;
const INTAKE_QUESTION_RE =
  /\b(this year's intake|looking at this year|planning to start|targeting for admission)\b/i;

const WEAK_KB_LLM_RE =
  /\b(check with|contact our|admissions office|official portal|visit (the |our )?(website|portal|office)|batch availability)\b/i;

const isWeakKbLlmAnswer = (answer = "", query = "") => {
  const text = cleanText(answer, 420);
  if (!text) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 8) return true;
  const normalizedQuery = normalizeSpokenCourseTerms(query);
  if (
    WEAK_KB_LLM_RE.test(text) &&
    (PROCESS_RE.test(normalizedQuery) || ELIGIBILITY_RE.test(normalizedQuery))
  ) {
    return true;
  }
  if (PROCESS_RE.test(normalizedQuery) && words.length < 10) {
    return true;
  }
  if (ELIGIBILITY_RE.test(normalizedQuery) && words.length < 12) {
    return true;
  }
  return false;
};

const cleanText = (value = "", max = 1200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const sentenceFromContext = (context = "", query = "") => {
  const raw = String(context || "").trim();
  if (!raw) return "";

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12);

  if (!lines.length) return cleanText(raw, 280);

  const queryLower = String(query || "").toLowerCase();
  const course = extractCourseFromQuery(query);
  const feeQuery = isFeeQuery(query);
  const eligibilityQuery = ELIGIBILITY_RE.test(query);
  const processQuery = PROCESS_RE.test(query);
  let best = lines[0];
  let bestScore = -1;

  for (const line of lines) {
    const lower = line.toLowerCase();
    let score = 0;

    if (course && lower.includes(course)) score += 5;
    if (eligibilityQuery && /\b(eligib|criteria|requirement|qualif|paturta|50%|cet|mathematics)\b/i.test(lower)) {
      score += 6;
    }
    if (processQuery && /\b(step|application|document|counsel|interview|gd|pi)\b/i.test(lower)) {
      score += 5;
    }
    if (feeQuery && /\b(tuition fee|fee per year|program cost|per year)\b/i.test(lower)) {
      score += 4;
    }
    if (feeQuery && /\b(fees?|tuition|rs\.?|₹|lakh)\b/i.test(lower)) score += 2;
    if (feeQuery && /\bapplication fee\b/i.test(lower) && !/\btuition\b/i.test(lower)) {
      score -= 3;
    }
    if (feeQuery && /\b(step \d+|group discussion|personal interview)\b/i.test(lower)) {
      score -= 2;
    }

    for (const token of queryLower.split(/\s+/).filter((t) => t.length > 3)) {
      if (lower.includes(token)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  return cleanText(best, 280);
};

const buildEligibilityFallback = ({ course = "", lang = "en", factual = "" } = {}) => {
  if (factual && ELIGIBILITY_RE.test(factual)) return factual;
  if (course === "mca") {
    if (lang === "mr") {
      return "MCA साठी bachelor's degree आणि 10+2 किंवा graduation मध्ये Mathematics आवश्यक आहे, साधारण 50% aggregate. Maharashtra quota साठी MAH-MCA CET score लागतो.";
    }
    if (lang === "hi") {
      return "MCA के लिए bachelor's degree और 10+2 या graduation में Mathematics ज़रूरी है, सामान्यतः 50% aggregate. Maharashtra quota के लिए MAH-MCA CET score चाहिए।";
    }
    return "For MCA, you need a bachelor's degree with Mathematics at 10+2 or graduation level, and minimum 50% aggregate. MAH-MCA CET is required for Maharashtra quota seats.";
  }
  if (lang === "mr") {
    return "पात्रता program वर अवलंबून असते — साधारणतः graduation, minimum marks आणि CET. कोणता course विचारत आहात?";
  }
  if (lang === "hi") {
    return "Eligibility program पर निर्भर करती है — आमतौर पर graduation, minimum marks और CET. कौन सा course पूछ रहे हैं?";
  }
  return "Eligibility depends on the program — typically graduation with minimum marks and sometimes an entrance exam like CET. Which course are you asking about?";
};

const buildProcessFallback = ({ course = "", lang = "en", factual = "" } = {}) => {
  if (factual && PROCESS_RE.test(factual)) return factual;
  if (course === "mca") {
    if (lang === "mr") {
      return "MCA admission: valid CET score, online MET application, document upload, GD/PI किंवा interview, आणि confirmation.";
    }
    if (lang === "hi") {
      return "MCA admission: valid CET score, online MET application, documents upload, GD/PI या interview, फिर confirmation.";
    }
    return "MCA admission steps: valid CET score, online MET application, document upload, GD/PI or interview round, then confirmation.";
  }
  if (lang === "mr") {
    return "प्रवेश साधारणतः eligibility check, application, documents आणि counseling पासून जातो. कोणता भाग सांगू?";
  }
  if (lang === "hi") {
    return "Admission में आमतौर पर eligibility check, application, documents और counseling होते हैं। कौन सा हिस्सा बताऊँ?";
  }
  return "Admission usually covers eligibility check, application, documents, and counseling. Which part should I explain first?";
};

export const buildSteeringCTA = ({
  userIntent = {},
  bookingReadiness = "not_asked",
  policy = {},
  language = "en",
  steerCTA = "",
  turnCount = 0,
} = {}) => {
  const lang = cleanText(language, 10).toLowerCase();

  if (steerCTA === "resume_booking") {
    return lang === "mr"
      ? "scheduling कडे परत या — समुपदेशक कॉलसाठी कोणती तारीख आणि वेळ सोयीची आहे?"
      : lang === "hi"
        ? "scheduling पर वापस आते हैं — appointment के लिए कौन सी तारीख और समय सही रहेगा?"
        : "Coming back to scheduling — what date and time work best for your appointment?";
  }

  if (bookingReadiness === "declined") return "";

  if (
    steerCTA &&
    !["schedule_counselor", "probing"].includes(steerCTA)
  ) {
    return buildPlaybookSteerLine({
      steerStyle: steerCTA,
      language: lang,
      variantSeed: turnCount,
    });
  }

  const intent = userIntent.intent || "unknown";

  if (intent === "fee_inquiry") {
    return buildPlaybookSteerLine({ steerStyle: "optional_followup", language: lang, variantSeed: turnCount });
  }

  if (intent === "admission_inquiry" || intent === "admission_query") {
    return buildPlaybookSteerLine({ steerStyle: "optional_followup", language: lang, variantSeed: turnCount });
  }

  return buildPlaybookSteerLine({ steerStyle: "optional_followup", language: lang, variantSeed: turnCount });
};

export const buildQueryResolutionAnswer = ({
  kbContext = "",
  query = "",
  userIntent = {},
  policy = {},
  language = "en",
  lastAssistantPrompt = "",
} = {}) => {
  const normalizedQuery = normalizeSpokenCourseTerms(query);
  const factual = sentenceFromContext(kbContext, normalizedQuery);
  const lang = cleanText(language, 10).toLowerCase();
  const course = extractCourseFromQuery(normalizedQuery);
  const lastPrompt = cleanText(lastAssistantPrompt, 300);

  if (ELIGIBILITY_RE.test(normalizedQuery)) {
    return buildEligibilityFallback({ course, lang, factual });
  }

  if (PROCESS_RE.test(normalizedQuery)) {
    return buildProcessFallback({ course, lang, factual });
  }

  if (factual) return factual;

  const intent = userIntent.intent || "unknown";
  if (intent === "fee_inquiry") {
    return lang === "mr"
      ? "फीची नेमकी माहिती माझ्याकडे नाही, पण मी समुपदेशकाकडून confirm करवू शकतो."
      : lang === "hi"
        ? "मेरे पास अभी exact fee detail नहीं है, लेकिन मैं सही counselor से confirm करवा सकता हूँ।"
        : "I do not have the exact fee detail right now.";
  }

  if (
    intent === "admission_inquiry" ||
    intent === "admission_query" ||
    /\b(admission|प्रवेश|mahiti|baddal|process)\b/i.test(normalizedQuery)
  ) {
    if (INTAKE_QUESTION_RE.test(lastPrompt) || GENERIC_ADMISSION_FALLBACK_RE.test(lastPrompt)) {
      if (course) {
        return lang === "mr"
          ? `${course} साठी eligibility, fees किंवा admission steps सांगू शकतो. काय पहिले हवं?`
          : lang === "hi"
            ? `${course} के लिए eligibility, fees या admission steps बता सकता हूँ। पहले क्या चाहिए?`
            : `I can walk you through ${course} eligibility, fees, or admission steps. What would you like first?`;
      }
      return lang === "mr"
        ? "Eligibility, fees किंवा admission steps सांगू शकतो. काय पहिले हवं?"
        : lang === "hi"
          ? "Eligibility, fees या admission steps बता सकता हूँ। पहले क्या चाहिए?"
          : "I can walk you through eligibility, fees, or admission steps. What would you like first?";
    }

    if (lang === "mr") {
      return "प्रवेश प्रक्रियेत पात्रता तपासणी, अर्ज, कागदपत्रे आणि समुपदेशन असते. तुम्ही या वर्षी admission साठी बघत आहात का?";
    }
    if (lang === "hi") {
      return "Admission में eligibility, application, documents और counseling शामिल होते। क्या आप इस साल admission देख रहे हैं?";
    }
    return "Admission covers eligibility, application, documents, and counseling. Are you looking at this year's intake?";
  }

  return lang === "mr"
    ? "माझ्याकडे ती नेमकी माहिती नाही, पण मी पुढचा योग्य टप्पा सांगू शकतो."
    : lang === "hi"
      ? "मेरे पास अभी exact detail नहीं है, लेकिन मैं अगला सही step बता सकता हूँ।"
      : "I may not have that exact detail yet.";
};

export const shouldUseKbLlmAnswer = (retrievalConfidence = 0, kbContext = "", query = "") => {
  const context = cleanText(kbContext, 1200);
  if (!context) return false;

  const confidence = Number(retrievalConfidence);
  if (Number.isFinite(confidence) && confidence >= KB_CONFIDENCE_MIN) return true;

  const normalizedQuery = normalizeSpokenCourseTerms(query);
  if (context.length >= 100) return true;
  if (
    context.length >= 40 &&
    (ELIGIBILITY_RE.test(normalizedQuery) ||
      PROCESS_RE.test(normalizedQuery) ||
      isFeeQuery(normalizedQuery))
  ) {
    return true;
  }
  return false;
};

export const mergeAnswerWithSteering = (answer = "", cta = "") => {
  const body = cleanText(answer);
  const steer = cleanText(cta, 280);
  if (steer && body) {
    const answerEndsWithQuestion = /\?\s*$/.test(body);
    return answerEndsWithQuestion ? body : `${body.replace(/[.!]+$/, ".")} ${steer}`;
  }
  return steer || body;
};

export const composeQueryResolutionResponse = ({
  kbContext = "",
  query = "",
  userIntent = {},
  policy = {},
  language = "en",
  bookingReadiness = "probing",
  steerCTA = "",
  lastAssistantPrompt = "",
} = {}) => {
  const answer = buildQueryResolutionAnswer({
    kbContext,
    query,
    userIntent,
    policy,
    language,
    lastAssistantPrompt,
  });
  const cta = buildSteeringCTA({
    userIntent,
    bookingReadiness,
    policy,
    language,
    steerCTA,
    turnCount: 2,
  });

  const composed = mergeAnswerWithSteering(answer, cta);

  return polishVoiceResponse({
    answer: composed,
    query,
    turnCount: 2,
    stage: "query_resolution",
    responseStyleProfile: { wordBudget: 26, mode: "factual" },
  });
};

export const composeQueryResolutionResponseAsync = async ({
  kbContext = "",
  query = "",
  userIntent = {},
  policy = {},
  language = "en",
  bookingReadiness = "probing",
  steerCTA = "",
  turnCount = 2,
  retrievalConfidence = 0,
  lastAssistantPrompt = "",
} = {}) => {
  const normalizedQuery = normalizeSpokenCourseTerms(query);
  const cta = buildSteeringCTA({
    userIntent,
    bookingReadiness,
    policy,
    language,
    steerCTA,
    turnCount,
  });

  let answerBody = "";
  let answerSource = "template";

  if (shouldUseKbLlmAnswer(retrievalConfidence, kbContext, normalizedQuery)) {
    const llmAnswer = await generateKbVoiceAnswer({
      query: normalizedQuery,
      kbContext,
      language,
    });
    if (llmAnswer && !isWeakKbLlmAnswer(llmAnswer, normalizedQuery)) {
      answerBody = llmAnswer;
      answerSource = retrievalConfidence >= KB_CONFIDENCE_MIN ? "llm_kb" : "llm_kb_low_conf";
    }
  }

  if (!answerBody) {
    answerBody = buildQueryResolutionAnswer({
      kbContext,
      query: normalizedQuery,
      userIntent,
      policy,
      language,
      lastAssistantPrompt,
    });
    if (answerSource === "template" && shouldUseKbLlmAnswer(retrievalConfidence, kbContext, normalizedQuery)) {
      answerSource = retrievalConfidence >= KB_CONFIDENCE_MIN ? "llm_kb_fallback" : "template";
    }
  }

  const composed = mergeAnswerWithSteering(answerBody, cta);
  const answer =
    answerSource === "llm_kb" || answerSource === "llm_kb_low_conf"
      ? cleanText(composed, 520)
      : polishVoiceResponse({
          answer: composed,
          query: normalizedQuery,
          turnCount,
          stage: "query_resolution",
          responseStyleProfile: { wordBudget: 26, mode: "factual" },
        });

  return { answer, answerSource };
};
