import { extractIndicDateTime, BOOKING_INDIC_RE } from "./indicDateTime.service.js";
import { INTENT_CONFIDENCE_THRESHOLD } from "./userIntent.service.js";
import { isBookingStage, isBookingAffirmation, evaluateBookingProgress, isOrdinalOnlyDate, hasAppointmentTime } from "./bookingFlow.service.js";
import { detectClosureSignals } from "./callClosure.service.js";
import { updateConversationProgress } from "./conversationStage.service.js";
import {
  detectConversationPlaybook,
  FACTUAL_QUESTION_RE,
  isExplicitBookingRequest,
  isSchedulingOrBookingRequest,
  isCounselorConnectRequest,
  hasScheduledAppointment,
  COUNSELOR_REQUEST_RE,
  buildPlaybookSteerLine,
} from "./conversationPlaybook.service.js";
import { buildInterruptionResumeMeta } from "./interruptionResume.service.js";

const AFFIRMATION_RE =
  /^(yes|yeah|yep|yup|correct|right|sure|okay|ok|haan|ho|hoy|ho na|ठीक आहे|हो|हा|होय|ओके)[.!,\s]*/i;

const BOOKING_ARRANGE_RE =
  /\b(अरेंज|arrange|बुक|book)\b/i;

const OFF_TOPIC_NOISE_RE =
  /\b(house rent|rent payment|landlord|electricity bill|water bill)\b/i;

const BOOKING_DECLINE_RE =
  /^(no|nope|nah|not now|not yet|maybe later|not interested)\b/i;

const BOOKING_DECLINE_ANYWHERE_RE =
  /\b(no thanks|not interested|don't want|do not want|cancel it out|cancel that|cancel the counselor|no counselor)\b/i;

const FACTUAL_QUERY_RE = FACTUAL_QUESTION_RE;

const GREETING_ONLY_RE =
  /^(hi|hello|hey|good (morning|afternoon|evening)|namaste|namaskar)[!,. ]*$/i;

const ACTIVE_CONVERSATION_RE =
  /\b(admission|eligib|counsel|course|fee|book|appointment|ghyaycha|ghyaychi|mahiti|help|guide|process|counseling|counselling|visit|college|campus)\b/i;

const TOPIC_DISCUSSION_RE =
  /\b(talking about|talking to you about|about|regarding)\b/i;

const COUNSELOR_VISIT_REQUEST_RE =
  /\b(counselou?r\s+form|counseling|counselling|looking for counselou?r|in[- ]?person counselou?r)\b/i;

const ANSWER_BEFORE_BOOK_RE =
  /\b(tell me|detail|information|explain|about|some)\b.*\b(admission|eligibility|fees|process)\b/i;

const APPOINTMENT_REQUEST_RE =
  /\b(book(?:ing)?|schedul(?:e|ing|ed)|fix|arrange)\b.*\b(a+p+ointments?|appointments?|meeting|counselling|counseling|counselou?r(?:\s+call)?|slot|call)\b|\bbook\s+(?:an?\s+)?a+p+ointment\b|\bscheduling\b.*\b(request|counselou?r|call)\b/i;

const DONE_RE =
  /\b(that(?:'s| is) all|thats all|nothing else|no more questions|enough|we are done|i am done|bas itna hi|bas)\b/i;

const POST_GREETING_ACK_RE =
  /^(yes|yeah|yep|sure|ok|okay|alright|haan|ho|go ahead)[.!,\s]*$/i;
const POST_GREETING_READY_RE =
  /^(yes|yeah|yep|sure|ok|okay|alright)[,.!\s]+(we can|i can|that works|sounds good|go ahead|continue)/i;

const INTAKE_QUESTION_RE =
  /\b(this year's intake|looking at this year|planning to start|targeting for admission|या वर्षी|इस साल)\b/i;

const INTAKE_ANSWER_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|correct|right|haan|ho|this year|current year)([.!,\s]|$)/i;

const isIntakeFollowUp = (state = {}, text = "") => {
  const last = cleanText(state.lastAssistantPrompt, 300);
  if (!last || !INTAKE_QUESTION_RE.test(last)) return false;
  const value = cleanText(text, 80);
  return INTAKE_ANSWER_RE.test(value) || /^this year$/i.test(value);
};

const cleanText = (value = "", max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const getCourseLabel = (collectedData = {}, userIntent = {}) => {
  const course =
    collectedData.course ||
    userIntent.subTopics?.find((t) => !["fees", "admission", "eligibility"].includes(t)) ||
    "";
  return cleanText(course, 40);
};

export const buildIntentDiscoveryReply = ({
  userIntent = {},
  collectedData = {},
  policy = {},
  language = "en",
} = {}) => {
  const intent = userIntent.intent || "unknown";
  const course = getCourseLabel(collectedData, userIntent);
  const lang = cleanText(language, 10).toLowerCase();

  if (intent === "admission_inquiry") {
    if (lang === "hi") {
      return course
        ? `जी बिल्कुल। क्या आप इस साल ${course} admission के लिए देख रहे हैं?`
        : "जी बिल्कुल। क्या आप इस साल admission के लिए देख रहे हैं?";
    }
    if (lang === "mr") {
      return course
        ? `नक्की. तुम्ही या वर्षी ${course} admission साठी बघत आहात का?`
        : "नक्की. तुम्ही या वर्षी admission साठी बघत आहात का?";
    }
    return course
      ? `Sure. Are you looking for ${course} admission this year?`
      : "Sure. Are you looking for admission this year?";
  }

  if (intent === "fee_inquiry") {
    if (course) {
      return `I can help with ${course} fees. Would you like the fee breakdown now?`;
    }
    return "I can help with fees. Which course are you asking about?";
  }

  if (intent === "appointment_booking") {
    return "Sure, I can help schedule that. What date and time works best for you?";
  }

  if (intent === "callback_request") {
    return "Sure. What time works best for a callback?";
  }

  if (intent === "support_request") {
    return "I can help with that. What issue should we handle first?";
  }

  if (intent === "information_request") {
    return course
      ? `Sure. What would you like to know about ${course} first?`
      : "Sure. What information would you like first: eligibility, fees, or admission steps?";
  }

  return "";
};

export const buildIntentMenuReply = ({ collectedData = {}, userIntent = {}, language = "en" } = {}) => {
  const course = getCourseLabel(collectedData, userIntent);
  const lang = cleanText(language, 10).toLowerCase();

  if (lang === "hi") {
    return course
      ? `बढ़िया। मैं ${course} के eligibility, fees और admission steps में मदद कर सकता हूँ। आप पहले क्या जानना चाहेंगे?`
      : "बढ़िया। मैं eligibility, fees और admission steps में मदद कर सकता हूँ। आप पहले क्या जानना चाहेंगे?";
  }
  if (lang === "mr") {
    return course
      ? `छान. मी ${course} साठी eligibility, fees आणि admission steps सांगू शकतो. तुला आधी काय हवं?`
      : "छान. मी eligibility, fees आणि admission steps सांगू शकतो. तुला आधी काय हवं?";
  }
  return course
    ? `Great. I can help with ${course} eligibility, fees, and admission steps. What would you like to know first?`
    : "Great. I can help with eligibility, fees, and admission steps. What would you like to know first?";
};

export const buildIntakeConfirmedReply = ({
  collectedData = {},
  userIntent = {},
  language = "en",
} = {}) => {
  const course = getCourseLabel(collectedData, userIntent);
  const lang = cleanText(language, 10).toLowerCase();

  if (lang === "hi") {
    return course
      ? `बढ़िया। इस साल ${course} intake के लिए मैं eligibility, fees या admission steps बता सकता हूँ। पहले क्या चाहिए?`
      : "बढ़िया। इस साल की intake के लिए मैं eligibility, fees या admission steps बता सकता हूँ। पहले क्या चाहिए?";
  }
  if (lang === "mr") {
    return course
      ? `छान. या वर्षी ${course} intake साठी eligibility, fees किंवा admission steps सांगू शकतो. आधी काय हवं?`
      : "छान. या वर्षी intake साठी eligibility, fees किंवा admission steps सांगू शकतो. आधी काय हवं?";
  }
  return course
    ? `Great, for this year's ${course} intake I can walk you through eligibility, fees, or admission steps. What would you like first?`
    : "Great, for this year's intake I can explain eligibility, fees, or the admission process. What would you like first?";
};

export const buildClarifyIntentReply = ({ policy = {}, language = "en" } = {}) => {
  const objective = cleanText(policy.objective, 80).toLowerCase();
  const lang = cleanText(language, 10).toLowerCase();

  if (objective === "appointment_booking") {
    return lang === "hi"
      ? "मैं campus visit schedule कर सकता हूँ। क्या आप college visit बुक करना चाहेंगे?"
      : "I can schedule a campus visit at the college. Would you like to book a visit?";
  }

  return lang === "hi"
    ? "मैं admission, fees या campus visit में मदद कर सकता हूँ। आपको किसमें मदद चाहिए?"
    : "I can help with admission, fees, or booking a campus visit. What are you looking for?";
};

const resolveRequiredSlots = (intent, policy = {}) => {
  const objective = cleanText(policy.objective, 80).toLowerCase();
  if (intent === "appointment_booking" || objective === "appointment_booking") {
    return policy.qualificationFields?.length
      ? policy.qualificationFields
      : ["preferred_date", "preferred_time", "name"];
  }
  if (intent === "admission_inquiry" || intent === "fee_inquiry") {
    return ["course"];
  }
  return [];
};

const getFilledSlots = (collectedData = {}) => {
  const filled = [];
  if (collectedData.name) filled.push("name");
  if (collectedData.course || collectedData.interest) filled.push("course");
  if (collectedData.timeline || collectedData.preferred_date) filled.push("timeline");
  if (collectedData.preferred_date) filled.push("preferred_date");
  if (collectedData.preferred_time) filled.push("preferred_time");
  return filled;
};

const getNextMissingSlot = (required = [], filled = []) => {
  for (const slot of required) {
    if (!filled.includes(slot)) return slot;
  }
  return "";
};

const slotQuestion = (slot) => {
  if (slot === "course") return "Which course are you interested in?";
  if (slot === "timeline") return "When are you planning to start?";
  if (slot === "name") return "Could you share your name, please?";
  if (slot === "preferred_date") return "What date works best for you?";
  if (slot === "preferred_time") return "What time works best for you?";
  return "Could you share one more detail so I can help you better?";
};

export const buildConversationDirective = ({
  policy = {},
  state = {},
  userIntent = {},
  signals = {},
  query = "",
  extractedData = {},
  intentProfile = {},
} = {}) => {
  const intent = userIntent.intent || "unknown";
  const confidence = Number(userIntent.confidence || 0);
  const intentConfirmed = state.intentStatus === "resolved";
  const stage = cleanText(state.stage, 60).toLowerCase() || "intent_discovery";
  const text = cleanText(query, 500);
  const collectedData = { ...(state.collectedData || {}), ...extractedData };
  const requiredSlots = resolveRequiredSlots(intent, policy);
  const filledSlots = getFilledSlots(collectedData);
  const nextSlot = getNextMissingSlot(requiredSlots, filledSlots);
  const progress = updateConversationProgress({
    previousState: state,
    nextStage: stage,
    collectedData,
    userIntent,
  });
  const playbook = detectConversationPlaybook({
    query: text,
    userIntent,
    signals,
    collectedData,
    state,
    intentProfile,
  });
  const explicitBook = isExplicitBookingRequest(text, collectedData);
  const schedulingIntent = explicitBook || isSchedulingOrBookingRequest(text, collectedData);
  const inActiveBooking = isBookingStage(stage);

  const base = {
    stage,
    intent,
    confidence,
    requiredSlots,
    filledSlots,
    nextSlot,
    maxWords: 22,
    skipLLM: false,
    steerCTA: playbook.steerStyle || "",
    returnStage: state.returnStage || null,
    playbook: playbook.id,
    expectedOutcome: playbook.outcome,
    interruptionResume: buildInterruptionResumeMeta(state),
  };

  const closure = detectClosureSignals({ query: text, signals, state });
  if (closure.shouldClose) {
    return {
      ...base,
      action: "graceful_close",
      stage: "closing",
      endCall: true,
      endReason: closure.reason || "conversation_closed",
      skipLLM: true,
    };
  }

  if (isIntakeFollowUp(state, text)) {
    return {
      ...base,
      action: "intake_confirmed",
      stage: "qualification",
      steerCTA: "optional_followup",
      bookingReadiness: state.bookingReadiness || "not_asked",
      skipLLM: true,
      intakeConfirmed: true,
    };
  }

  if (stage === "confirmation" && hasScheduledAppointment(collectedData, state)) {
    if (isBookingAffirmation(text)) {
      return { ...base, action: "complete_booking", stage: "completed", skipLLM: true };
    }
    if (BOOKING_DECLINE_RE.test(text) || BOOKING_DECLINE_ANYWHERE_RE.test(text)) {
      return {
        ...base,
        action: "booking_declined",
        stage: "qualification",
        bookingReadiness: "declined",
        skipLLM: true,
      };
    }
  }

  if (
    BOOKING_DECLINE_ANYWHERE_RE.test(text) &&
    (inActiveBooking ||
      state.bookingReadiness === "ready" ||
      state.bookingReadiness === "probing" ||
      Boolean(collectedData?.appointmentRequested))
  ) {
    return {
      ...base,
      action: "booking_declined",
      stage: state.returnStage || "qualification",
      bookingReadiness: "declined",
      skipLLM: true,
    };
  }

  if (progress.shouldAbortStalledCall &&
    !state.closeOffered &&
    !ACTIVE_CONVERSATION_RE.test(text) &&
    !isSchedulingOrBookingRequest(text, collectedData) &&
    !explicitBook &&
    !BOOKING_ARRANGE_RE.test(text)
  ) {
    return {
      ...base,
      action: "offer_close",
      stage: stage || "qualification",
      closeOffered: true,
      skipLLM: true,
    };
  }

  if (state.closeOffered) {
    const hasSchedulingIntent =
      isCounselorConnectRequest(text) ||
      isSchedulingOrBookingRequest(text, collectedData) ||
      explicitBook ||
      APPOINTMENT_REQUEST_RE.test(text);

    if (
      BOOKING_DECLINE_ANYWHERE_RE.test(text) &&
      (hasSchedulingIntent ||
        state.bookingReadiness === "probing" ||
        Boolean(collectedData?.appointmentRequested))
    ) {
      return {
        ...base,
        action: "booking_declined",
        stage: state.returnStage || "qualification",
        bookingReadiness: "declined",
        closeOffered: false,
        skipLLM: true,
      };
    }

    if (
      AFFIRMATION_RE.test(text) ||
      (ACTIVE_CONVERSATION_RE.test(text) && !hasSchedulingIntent)
    ) {
      return {
        ...base,
        action: "intent_menu",
        stage: "qualification",
        closeOffered: false,
        bookingReadiness: "not_asked",
        skipLLM: true,
      };
    }

    if (hasSchedulingIntent) {
      return {
        ...base,
        action: "appointment_booking",
        stage: inActiveBooking ? stage : "appointment_booking",
        bookingReadiness: "ready",
        closeOffered: false,
        skipLLM: true,
      };
    }

    if (DONE_RE.test(text) || BOOKING_DECLINE_RE.test(text)) {
      return {
        ...base,
        action: "graceful_close",
        stage: "closing",
        endCall: true,
        endReason: "user_confirmed_closing",
        skipLLM: true,
      };
    }
  }

  if (
    progress.shouldEscalateBooking &&
    !hasScheduledAppointment(collectedData, state) &&
    !state.closeOffered &&
    !inActiveBooking &&
    !FACTUAL_QUERY_RE.test(text) &&
    !TOPIC_DISCUSSION_RE.test(text) &&
    !AFFIRMATION_RE.test(text) &&
    !isIntakeFollowUp(state, text)
  ) {
    return {
      ...base,
      action: "probe_booking_readiness",
      stage: "booking_readiness",
      steerCTA: "offer_counselor_soft",
      bookingReadiness: "probing",
      skipLLM: true,
    };
  }

  if (
    isBookingStage(stage) &&
    (/\bmy name is\b/i.test(text) ||
      collectedData.name ||
      extractedData.name ||
      (inActiveBooking && evaluateBookingProgress({ collectedData, extractedData, query: text, policy }).nextSlot === "name"))
  ) {
    return {
      ...base,
      action: "appointment_booking",
      stage: inActiveBooking ? stage : "appointment_booking",
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  const MONTH_TIME_FRAGMENT_RE =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

  if (
    (inActiveBooking ||
      isOrdinalOnlyDate(collectedData.preferred_date) ||
      state.bookingReadiness === "ready") &&
    (MONTH_TIME_FRAGMENT_RE.test(text) || hasAppointmentTime(text, extractedData))
  ) {
    return {
      ...base,
      action: "appointment_booking",
      stage: inActiveBooking ? stage : "appointment_booking",
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  if (
    inActiveBooking &&
    /^(what|huh|sorry|pardon|come again|repeat that|didn'?t get|did not get)[?.!,\s]*$/i.test(text)
  ) {
    return {
      ...base,
      action: "appointment_booking",
      stage,
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  if ((closure.shouldOfferClose || progress.shouldOfferClose) && !state.closeOffered) {
    const inBooking = isBookingStage(stage);
    const bookingInProgress =
      inBooking ||
      Boolean(collectedData?.appointmentRequested) ||
      hasScheduledAppointment(collectedData, state);
    const activeRequest =
      isCounselorConnectRequest(text) ||
      isSchedulingOrBookingRequest(text, collectedData) ||
      ACTIVE_CONVERSATION_RE.test(text) ||
      FACTUAL_QUERY_RE.test(text);
    if (!activeRequest && !bookingInProgress) {
      return {
        ...base,
        action: "offer_close",
        stage: stage || "qualification",
        closeOffered: true,
        skipLLM: true,
      };
    }
  }

  if (
    state.greeted &&
    (POST_GREETING_ACK_RE.test(text) || POST_GREETING_READY_RE.test(text)) &&
    !intentConfirmed &&
    (state.turnCount || 0) <= 1 &&
    !state.intentMenuOffered
  ) {
    return {
      ...base,
      action: "intent_menu",
      stage: "qualification",
      skipLLM: true,
      bookingReadiness: "not_asked",
      intentMenuOffered: true,
    };
  }

  if (playbook.id === "existing_appointment_confirm") {
    return {
      ...base,
      action: "confirm_appointment",
      stage: "confirmation",
      skipLLM: true,
    };
  }

  if (playbook.id === "appointment_not_found") {
    return {
      ...base,
      action: "appointment_not_found",
      stage: "qualification",
      skipLLM: true,
      bookingReadiness: "not_asked",
    };
  }

  if (playbook.id === "objection_handling") {
    return {
      ...base,
      action: "handle_objection",
      stage: "objection_handling",
      returnStage: state.returnStage || stage,
      skipLLM: true,
    };
  }

  if (
    COUNSELOR_VISIT_REQUEST_RE.test(text) &&
    !inActiveBooking &&
    !hasScheduledAppointment(collectedData, state)
  ) {
    return {
      ...base,
      action: "appointment_booking",
      stage: "appointment_booking",
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  if (explicitBook || schedulingIntent || BOOKING_ARRANGE_RE.test(text)) {
    const wantsInfoFirst =
      ANSWER_BEFORE_BOOK_RE.test(text) &&
      /\b(book|appointment|counselor|counselling|counseling)\b/i.test(text) &&
      !inActiveBooking;

    if (wantsInfoFirst) {
      return {
        ...base,
        action: "answer_then_steer",
        stage: "query_resolution",
        steerCTA: "offer_counselor_soft",
        returnStage: "qualification",
        bookingReadiness: "not_asked",
        skipLLM: true,
      };
    }

    return {
      ...base,
      action: "appointment_booking",
      stage: inActiveBooking ? stage : "appointment_booking",
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  if (state.bookingReadiness === "probing" && BOOKING_DECLINE_RE.test(text)) {
    return {
      ...base,
      action: "booking_declined",
      stage: state.returnStage || "qualification",
      bookingReadiness: "declined",
      skipLLM: true,
    };
  }

  if (state.bookingReadiness === "probing") {
    const indicBooking = extractIndicDateTime(text);
    const wantsBooking =
      AFFIRMATION_RE.test(text) ||
      isSchedulingOrBookingRequest(text, collectedData) ||
      BOOKING_INDIC_RE.test(text) ||
      Boolean(indicBooking.preferred_date) ||
      (BOOKING_ARRANGE_RE.test(text) && (Boolean(indicBooking.preferred_date) || AFFIRMATION_RE.test(text)));
    if (wantsBooking) {
      return {
        ...base,
        action: "appointment_booking",
        stage: "appointment_booking",
        bookingReadiness: "ready",
        skipLLM: true,
      };
    }
  }

  if (OFF_TOPIC_NOISE_RE.test(text) && !/\b(hostel|accommodation|stay|room)\b/i.test(text)) {
    return {
      ...base,
      action: "clarify_intent",
      stage: "intent_discovery",
      skipLLM: true,
    };
  }

  if (playbook.id === "callback_request" || intent === "callback_request" || signals.callbackIntent) {
    return { ...base, action: "callback", stage: "callback", skipLLM: true };
  }

  const shouldAnswerFromKb =
    FACTUAL_QUERY_RE.test(text) &&
    text.split(" ").filter(Boolean).length >= 3 &&
    !explicitBook &&
    !BOOKING_DECLINE_RE.test(text) &&
    !GREETING_ONLY_RE.test(text);

  if (shouldAnswerFromKb) {
    return {
      ...base,
      action: "answer_then_steer",
      stage: "query_resolution",
      steerCTA: playbook.steerStyle || "optional_followup",
      returnStage: inActiveBooking ? "appointment_booking" : "qualification",
      bookingReadiness: state.bookingReadiness || "not_asked",
      skipLLM: true,
    };
  }

  if (signals.hardClose || (signals.notInterested && state.bookingReadiness !== "probing")) {
    return { ...base, action: "close", stage: "closing", skipLLM: true };
  }

  if (isBookingStage(stage) && FACTUAL_QUERY_RE.test(text) && text.split(" ").length >= 3) {
    return {
      ...base,
      action: "answer_then_steer",
      stage: "query_resolution",
      steerCTA: "resume_booking",
      returnStage: "appointment_booking",
      bookingReadiness: state.bookingReadiness || "ready",
    };
  }

  if (!intentConfirmed && !GREETING_ONLY_RE.test(text)) {
    if (
      confidence >= INTENT_CONFIDENCE_THRESHOLD &&
      intent !== "unknown" &&
      !FACTUAL_QUERY_RE.test(text)
    ) {
      return {
        ...base,
        action: "intent_discovery_reply",
        stage: "intent_discovery",
        skipLLM: true,
      };
    }
    if ((state.turnCount || 0) <= 2) {
      if (schedulingIntent) {
        return {
          ...base,
          action: "appointment_booking",
          stage: inActiveBooking ? stage : "appointment_booking",
          bookingReadiness: "ready",
          skipLLM: true,
        };
      }
      return {
        ...base,
        action: "clarify_intent",
        stage: "intent_discovery",
        skipLLM: true,
      };
    }
  }

  if (
    intentConfirmed &&
    stage === "intent_discovery" &&
    AFFIRMATION_RE.test(text) &&
    ["admission_inquiry", "information_request", "fee_inquiry"].includes(intent)
  ) {
    return {
      ...base,
      action: "intent_menu",
      stage: "qualification",
      skipLLM: true,
      bookingReadiness: "not_asked",
    };
  }

  if (
    intentConfirmed &&
    ["fee_inquiry", "admission_inquiry", "information_request"].includes(intent) &&
    FACTUAL_QUERY_RE.test(text) &&
    text.split(" ").length >= 3
  ) {
    return {
      ...base,
      action: "answer_then_steer",
      stage: "query_resolution",
      steerCTA: playbook.steerStyle || "optional_followup",
      returnStage: "qualification",
      bookingReadiness: state.bookingReadiness || "not_asked",
      skipLLM: true,
    };
  }

  if (intentConfirmed && nextSlot && ["admission_inquiry", "fee_inquiry"].includes(intent)) {
    const missingCourse = nextSlot === "course" && !collectedData.course;
    if (missingCourse && !FACTUAL_QUERY_RE.test(text)) {
      return {
        ...base,
        action: "collect_slot",
        stage: "information_collection",
        nextSlot,
        skipLLM: true,
      };
    }
  }

  if (
    intentConfirmed &&
    intent === "admission_inquiry" &&
    stage === "qualification" &&
    Number(intentProfile.commitmentScore || 0) >= 75 &&
    (state.turnCount || 0) >= 4 &&
    state.bookingReadiness === "not_asked" &&
    !FACTUAL_QUERY_RE.test(text) &&
    COUNSELOR_REQUEST_RE.test(text)
  ) {
    return {
      ...base,
      action: "probe_booking_readiness",
      stage: "booking_readiness",
      steerCTA: "offer_counselor_soft",
      skipLLM: true,
    };
  }

  if (AFFIRMATION_RE.test(text) && state.bookingReadiness === "ready" && explicitBook) {
    return {
      ...base,
      action: "appointment_booking",
      stage: "appointment_booking",
      bookingReadiness: "ready",
      skipLLM: true,
    };
  }

  return {
    ...base,
    action: base.interruptionResume ? "recover_after_interruption" : "llm_turn",
    stage: intentConfirmed ? stage : "intent_discovery",
  };
};

export const buildSlotCollectionReply = (slot) => slotQuestion(slot);

export const buildBookingDeclinedReply = ({ language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "hi") {
    return "कोई बात नहीं। admission, fees या process में से आप आगे क्या जानना चाहेंगे?";
  }
  if (lang === "mr") {
    return "काही हरकत नाही. admission, fees किंवा process पैकी पुढे काय हवं?";
  }
  return "No problem. What else would you like to know about admission?";
};

export const buildBookingReadinessProbe = ({ language = "en", variantSeed = 0 } = {}) =>
  buildPlaybookSteerLine({
    steerStyle: "offer_counselor_soft",
    language,
    variantSeed,
  });
