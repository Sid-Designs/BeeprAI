import {
  isCounselorConnectRequest,
  isSchedulingOrBookingRequest,
} from "./conversationPlaybook.service.js";

const cleanText = (value = "", max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const FACTUAL_ACTIVE_REQUEST_RE =
  /\b(fee|fees|price|pricing|cost|eligib|admission|apply|application|process|duration|placement|course|program|tell me|explain|information|how|what|when|where)\b/i;

const DONE_RE =
  /\b(that(?:'s| is) all|thats all|nothing else|no more questions|all good|we are done|i am done|bas itna hi|bas|i will go|i'll go)\b/i;

const BOOKING_DECLINE_IN_UTTERANCE_RE =
  /\b(no thanks|not interested|don't want|do not want|cancel it out|cancel that|cancel the counselor|no counselor)\b/i;

const SOFT_DECLINE_RE =
  /^(no|nope|nah|not now|not yet|maybe later|just (wanted|needed)|only (wanted|needed))\b/i;

export const CLOSURE_STAGES = new Set(["closing", "completed"]);

export const isObjectiveAchieved = (state = {}) => {
  if (state.objectiveAchieved) return true;
  if (CLOSURE_STAGES.has(cleanText(state.stage, 40).toLowerCase())) return true;
  if (state.collectedData?.appointmentConfirmed) return true;
  if (
    state.collectedData?.appointmentSchedule?.preferredDate ||
    state.collectedData?.appointmentSchedule?.preferredTime
  ) {
    return Boolean(state.collectedData?.appointmentConfirmed);
  }
  if (state.collectedData?.callbackRequested && state.collectedData?.callbackSchedule?.preferredTime) {
    return true;
  }
  return false;
};

export const markObjectiveAchieved = (state = {}, reason = "goal_met") => ({
  ...state,
  objectiveAchieved: true,
  objectiveAchievedReason: cleanText(reason, 80) || "goal_met",
  leadStatus: state.leadStatus === "new" ? "qualified" : state.leadStatus,
});

export const detectClosureSignals = ({
  query = "",
  signals = {},
  state = {},
} = {}) => {
  const text = cleanText(query, 300);
  const lower = text.toLowerCase();

  if (isCounselorConnectRequest(text) || isSchedulingOrBookingRequest(text, state.collectedData || {})) {
    return { shouldClose: false, shouldOfferClose: false, reason: "" };
  }

  if (FACTUAL_ACTIVE_REQUEST_RE.test(text) && text.split(/\s+/).filter(Boolean).length >= 3) {
    return { shouldClose: false, shouldOfferClose: false, reason: "" };
  }

  const gratitudeOnly =
    /^(hello\s+|hi\s+)?(thanks?|thank you)[.!,\s]*$/i.test(lower) ||
    /^(hello\s+)?thanks?[.!,\s]*$/i.test(lower);
  if (gratitudeOnly && !DONE_RE.test(lower)) {
    return { shouldClose: false, shouldOfferClose: false, reason: "" };
  }

  if (signals.hardClose) {
    return { shouldClose: true, shouldOfferClose: false, reason: "user_requested_end" };
  }

  if (
    signals.notInterested &&
    state.bookingReadiness !== "probing" &&
    !isSchedulingOrBookingRequest(text, state.collectedData || {}) &&
    !isCounselorConnectRequest(text)
  ) {
    return { shouldClose: true, shouldOfferClose: false, reason: "user_not_interested" };
  }

  if (
    state.closeOffered &&
    !isSchedulingOrBookingRequest(text, state.collectedData || {}) &&
    !isCounselorConnectRequest(text) &&
    !BOOKING_DECLINE_IN_UTTERANCE_RE.test(lower) &&
    (SOFT_DECLINE_RE.test(lower) ||
      DONE_RE.test(lower) ||
      (signals.gratitudeClose && (DONE_RE.test(lower) || signals.closeConsent)))
  ) {
    return { shouldClose: true, shouldOfferClose: false, reason: "user_confirmed_closing" };
  }

  if (
    isObjectiveAchieved(state) &&
    (DONE_RE.test(lower) || (signals.gratitudeClose && /\b(thank|thanks)\b/i.test(lower)))
  ) {
    return { shouldClose: true, shouldOfferClose: false, reason: "objective_complete_goodbye" };
  }

  if (
    state.bookingReadiness === "declined" &&
    state.intentStatus === "resolved" &&
    (DONE_RE.test(lower) || (signals.gratitudeClose && lower.split(" ").length <= 6))
  ) {
    return { shouldClose: true, shouldOfferClose: false, reason: "info_resolved_goodbye" };
  }

  if (
    isObjectiveAchieved(state) &&
    !state.closeOffered &&
    (signals.gratitudeClose || DONE_RE.test(lower))
  ) {
    return { shouldClose: false, shouldOfferClose: true, reason: "offer_close" };
  }

  if (signals.closeConsent || (signals.gratitudeClose && DONE_RE.test(lower))) {
    return { shouldClose: true, shouldOfferClose: false, reason: "user_confirmed_closing" };
  }

  return { shouldClose: false, shouldOfferClose: false, reason: "" };
};

export const buildAnythingElsePrompt = ({ language = "en", turnCount = 0 } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const seed = Math.abs(Number(turnCount) || 0);

  if (lang === "hi") {
    const variants = [
      "क्या call close करने से पहले और कुछ help चाहिए?",
      "बंद करने से पहले admission, fees या appointment में और कुछ?",
    ];
    return variants[seed % variants.length];
  }
  if (lang === "mr") {
    const variants = [
      "कॉल बंद करण्यापूर्वी आणखी काही हवं आहे का?",
      "बंद करण्यापूर्वी admission, fees किंवा appointment मध्ये आणखी काही?",
    ];
    return variants[seed % variants.length];
  }

  const variants = [
    "Is there anything else I can help you with before we close?",
    "Before we wrap up, would you like help with admission steps, fees, or booking a counselor call?",
    "Anything else on eligibility, fees, or scheduling before I close the call?",
  ];
  return variants[seed % variants.length];
};

export const buildGracefulCloseReply = ({
  language = "en",
  reason = "",
  orgName = "our team",
} = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const achieved = String(reason || "").includes("objective") || String(reason || "").includes("appointment");

  if (lang === "hi") {
    return achieved
      ? `धन्यवाद। ${orgName} की ओर से आपकी details note हो गई हैं। अच्छा दिन रहे, goodbye।`
      : "धन्यवाद, आपका समय देने के लिए। अच्छा दिन रहे, goodbye।";
  }
  if (lang === "mr") {
    return achieved
      ? `धन्यवाद. ${orgName} कडून तुमची माहिती नोंदली आहे. छान दिवस, goodbye.`
      : "धन्यवाद, वेळ दिल्याबद्दल. छान दिवस, goodbye.";
  }

  if (String(reason).includes("appointment")) {
    return `Thank you. Your details are noted and our team will follow up. Have a great day, goodbye.`;
  }

  return "Thank you for your time today. Have a great day, goodbye.";
};

export const shouldForceEndCall = ({ stage = "", endCall = false } = {}) =>
  Boolean(endCall) || cleanText(stage, 40).toLowerCase() === "completed";
