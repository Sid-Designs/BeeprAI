/**
 * Counselor-first conversation playbook.
 * Priority: Answer → Help → Qualify → Guide → Book (last resort)
 */

import { extractIndicDateTime, BOOKING_INDIC_RE } from "./indicDateTime.service.js";

export const PLAYBOOK_OUTCOMES = Object.freeze({
  information_provided: "information_provided",
  qualified_lead: "qualified_lead",
  appointment_booked: "appointment_booked",
  appointment_confirmed: "appointment_confirmed",
  callback_requested: "callback_requested",
  follow_up_required: "follow_up_required",
  objection_handled: "objection_handled",
  lead_continued: "lead_continued",
  counselor_requested: "counselor_requested",
});

const cleanText = (value = "", max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const FACTUAL_QUESTION_RE =
  /\b(fee|fees|price|pricing|cost|eligib|criteria|requirement|admission|apply|application|process|duration|placement|career|job|syllabus|curriculum|scholarship|deadline|hostel|intake|seats?|cutoff|percentage|documents?|how much|what is|tell me|explain|information about|talking about|talking to you about|about|regarding|mahiti|baddal|ghyaycha|ghyaychi|mala)\b|(माहिती|प्रक्रिया|प्रवेश|बद्दल|काय आहे)/i;

export const COMPARING_COLLEGES_RE =
  /\b(compar(e|ing)|versus|vs|other college|multiple college|which is better|better than)\b/i;

export const PARENT_INQUIRY_RE =
  /\b(my son|my daughter|my child|my ward|for my son|for my daughter|parent|father|mother)\b/i;

export const COUNSELOR_REQUEST_RE =
  /\b(counselou?r|counsell\w*|guide me|someone guide|speak with|speak to|talk with|talk to|talk to someone|advisor|adviser)\b/i;

export const isCounselorConnectRequest = (text = "") => {
  const value = cleanText(text);
  if (!value) return false;
  if (
    /\b(want|need|like|would like)\s+to\s+(talk|speak)\s+(with|to)\s+(a\s+)?(counselou?r|counsell\w*|advisor|adviser)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (/\b(counselou?r|counsell\w*)\s+(call|session|meeting)\b/i.test(value)) return true;
  if (/\bcounsel(?:l)?ing\s+apartment\b/i.test(value)) return true;
  if (COUNSELOR_REQUEST_RE.test(value) && /\b(want|need|talk|speak|connect|meet|schedule|book|go)\b/i.test(value)) {
    return true;
  }
  return false;
};

export const FOLLOW_UP_RE =
  /\b(spoke with|spoke to|called yesterday|called before|follow up|following up|previous call|earlier call)\b/i;

export const NEW_BOOKING_RE =
  /\b(book(?:ing)?|schedul(?:e|ing|ed)|fix|arrange|set\s*up)\b.*\b(a+p+ointments?|appointments?|meeting|slot|counsell?(?:ing|or)?|counselou?r(?:\s+call)?|call)\b|\bbook\s+(?:an?\s+)?a+p+ointment\b|\bscheduling\b.*\b(request|counselou?r|call|appointment)\b/i;

const BOOKING_ARRANGE_RE = /\b(अरेंज|arrange|बुक|book)\b/i;

export const isSchedulingOrBookingRequest = (text = "", collectedData = {}) => {
  const value = cleanText(text);
  if (!value) return Boolean(collectedData?.appointmentRequested);
  if (collectedData?.appointmentRequested) return true;
  if (isCounselorConnectRequest(value)) return true;
  if (NEW_BOOKING_RE.test(value)) return true;
  if (BOOKING_INDIC_RE.test(value)) return true;
  const indic = extractIndicDateTime(value);
  if (indic.appointmentRequested) return true;
  if (indic.preferred_date && BOOKING_ARRANGE_RE.test(value)) return true;
  if (/\bschedul\w*\b/i.test(value) && COUNSELOR_REQUEST_RE.test(value)) return true;
  if (/\bscheduling\b/i.test(value) && /\b(request|call|appointment)\b/i.test(value)) return true;
  if (/\b(visit (the )?college|campus visit|visit in college|come to (the )?college|meet at (the )?college)\b/i.test(value)) {
    return true;
  }
  return false;
};

export const CONFIRM_APPOINTMENT_RE =
  /\b(confirm|conform|prove|check|verify|status of|my appointment|the appointment)\b.*\b(a+p+ointment|appointments?|booking|slot)\b|\b(a+p+ointment|appointments?)\b.*\b(confirm|conform|prove|check|verify)\b/i;

export const OBJECTION_RE =
  /\b(too (?:high|expensive|costly)|not interested|can't afford|cannot afford|fees? (?:are |is )?too|maybe later|think about it)\b/i;

export const hasScheduledAppointment = (collectedData = {}, state = {}) => {
  const data = collectedData || {};
  if (data.appointmentConfirmed) return true;
  if (state?.stage === "confirmation" || state?.stage === "completed") return true;
  if (data.appointmentSchedule?.text) return true;
  if (data.preferred_date && data.preferred_time && data.appointmentRequested) return true;
  return false;
};

export const isExplicitBookingRequest = (text = "", collectedData = {}) =>
  isSchedulingOrBookingRequest(text, collectedData);

export const detectConversationPlaybook = ({
  query = "",
  userIntent = {},
  signals = {},
  collectedData = {},
  state = {},
  intentProfile = {},
} = {}) => {
  const text = cleanText(query);
  const intent = userIntent?.intent || "unknown";
  const hasAppointment = hasScheduledAppointment(collectedData, state);
  const factual = FACTUAL_QUESTION_RE.test(text);
  const comparing = COMPARING_COLLEGES_RE.test(text);
  const parent = PARENT_INQUIRY_RE.test(text) || Boolean(collectedData?.decision_maker);
  const counselor = COUNSELOR_REQUEST_RE.test(text);
  const followUp = FOLLOW_UP_RE.test(text);
  const objection = OBJECTION_RE.test(text) || signals?.notInterested || intent === "objection";
  const confirmAppt = CONFIRM_APPOINTMENT_RE.test(text);
  const explicitBook = isExplicitBookingRequest(text, collectedData);

  if (followUp) {
    return {
      pattern: "H",
      id: "existing_lead_followup",
      outcome: PLAYBOOK_OUTCOMES.lead_continued,
      priority: "answer",
      steerStyle: "continue_context",
    };
  }

  if (confirmAppt && hasAppointment) {
    return {
      pattern: "G",
      id: "existing_appointment_confirm",
      outcome: PLAYBOOK_OUTCOMES.appointment_confirmed,
      priority: "answer",
      steerStyle: "confirm_details",
    };
  }

  if (confirmAppt && !hasAppointment) {
    return {
      pattern: "G",
      id: "appointment_not_found",
      outcome: PLAYBOOK_OUTCOMES.information_provided,
      priority: "answer",
      steerStyle: "offer_schedule_if_wanted",
    };
  }

  if (objection) {
    return {
      pattern: "F",
      id: "objection_handling",
      outcome: PLAYBOOK_OUTCOMES.objection_handled,
      priority: "help",
      steerStyle: "acknowledge_value",
    };
  }

  if (counselor && !explicitBook) {
    return {
      pattern: "B",
      id: "interested_lead_booking",
      outcome: PLAYBOOK_OUTCOMES.counselor_requested,
      priority: "book",
      steerStyle: "collect_booking_slots",
    };
  }

  if (comparing) {
    return {
      pattern: "E",
      id: "comparing_colleges",
      outcome: PLAYBOOK_OUTCOMES.follow_up_required,
      priority: "answer",
      steerStyle: "differentiators",
    };
  }

  if (parent) {
    return {
      pattern: "D",
      id: "parent_inquiry",
      outcome: PLAYBOOK_OUTCOMES.qualified_lead,
      priority: "answer",
      steerStyle: "collect_student_info",
    };
  }

  if (explicitBook && (state?.bookingReadiness === "ready" || intent === "appointment_booking")) {
    return {
      pattern: "B",
      id: "interested_lead_booking",
      outcome: PLAYBOOK_OUTCOMES.appointment_booked,
      priority: "book",
      steerStyle: "collect_booking_slots",
    };
  }

  if (factual || intent === "fee_inquiry" || intent === "information_request") {
    const interested =
      Number(intentProfile?.commitmentScore || 0) >= 55 ||
      intent === "admission_inquiry" ||
      Boolean(collectedData?.course);
    return {
      pattern: interested && !explicitBook ? "B" : "A",
      id: interested ? "interested_lead_inquiry" : "information_seeking",
      outcome: interested ? PLAYBOOK_OUTCOMES.qualified_lead : PLAYBOOK_OUTCOMES.information_provided,
      priority: "answer",
      steerStyle: interested ? "qualify_soft" : "optional_followup",
    };
  }

  if (intent === "admission_inquiry") {
    return {
      pattern: "B",
      id: "interested_lead_inquiry",
      outcome: PLAYBOOK_OUTCOMES.qualified_lead,
      priority: "answer",
      steerStyle: "qualify_soft",
    };
  }

  if (intent === "callback_request" || signals?.callbackIntent) {
    return {
      pattern: "D",
      id: "callback_request",
      outcome: PLAYBOOK_OUTCOMES.callback_requested,
      priority: "guide",
      steerStyle: "collect_callback_time",
    };
  }

  return {
    pattern: "A",
    id: "general_inquiry",
    outcome: PLAYBOOK_OUTCOMES.information_provided,
    priority: "answer",
    steerStyle: "optional_followup",
  };
};

const STEER_VARIANTS = Object.freeze({
  optional_followup: [
    "If you'd like, I can also explain eligibility or admission dates.",
    "I can share more on fees or the admission process if that helps.",
    "Happy to go deeper on eligibility or important dates.",
  ],
  qualify_soft: [
    "When are you planning to start, roughly?",
    "Are you looking at this year's intake?",
    "What year are you targeting for admission?",
  ],
  differentiators: [
    "I can share what sets our program apart. What matters most to you — placements, fees, or curriculum?",
    "Happy to compare on the points that matter to you. Placements, fees, or faculty?",
  ],
  collect_student_info: [
    "I can help with that. Which course is your child interested in?",
    "Sure. What program is your son or daughter looking at?",
  ],
  offer_counselor_soft: [
    "I can help you schedule a campus visit at the college if you'd like.",
    "Would you like to book a visit to the college?",
  ],
  offer_schedule_if_wanted: [
    "I don't see a confirmed slot on this call yet. I can help schedule one if you'd like.",
    "No appointment is confirmed yet. Should I help you book a time?",
  ],
  confirm_details: [
    "Let me confirm the details I have.",
  ],
  acknowledge_value: [
    "I understand. Let me address that directly.",
  ],
});

const STEER_VARIANTS_MR = Object.freeze({
  optional_followup: [
    "तुम्हाला आणखी काय माहिती हवी आहे?",
    "पुढे काय जाणून घ्यायचं आहे?",
  ],
  qualify_soft: [
    "तुम्ही या वर्षीच्या intake साठी बघत आहात का?",
    "कोणत्या वर्षासाठी admission विचारत आहात?",
  ],
  offer_counselor_soft: [
    "तुम्हाला हवं असेल तर मी समुपदेशक कॉल ठेवू शकतो.",
    "अधिक माहितीसाठी समुपदेशकाशी बोलणे उपयुक्त ठरू शकते. चालेल का?",
  ],
  resume_booking: [
    "scheduling कडे परत या — कोणती तारीख आणि वेळ सोयीची आहे?",
  ],
});

const STEER_VARIANTS_HI = Object.freeze({
  optional_followup: [
    "और क्या जानना चाहेंगे?",
    "आगे किस बारे में जानकारी चाहिए?",
  ],
  qualify_soft: [
    "क्या आप इस साल की intake देख रहे हैं?",
    "किस साल के admission के बारे में पूछ रहे हैं?",
  ],
  offer_counselor_soft: [
    "अगर चाहें तो मैं counselor call arrange कर सकता हूँ।",
    "ज़्यादा detail के लिए counselor से बात करना मददगार हो सकता है।",
  ],
  resume_booking: [
    "scheduling पर वापस — कौन सी तारीख और समय सही रहेगा?",
  ],
});

export const buildPlaybookSteerLine = ({
  steerStyle = "optional_followup",
  language = "en",
  variantSeed = 0,
} = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const localizedPool =
    lang === "mr"
      ? STEER_VARIANTS_MR[steerStyle]
      : lang === "hi"
        ? STEER_VARIANTS_HI[steerStyle]
        : null;
  const variants = localizedPool || STEER_VARIANTS[steerStyle] || STEER_VARIANTS.optional_followup;
  const index = Math.abs(Number(variantSeed) || 0) % variants.length;
  return variants[index];
};

export const buildAppointmentConfirmReply = ({
  collectedData = {},
  language = "en",
} = {}) => {
  const schedule = collectedData?.appointmentSchedule?.text
    || [collectedData?.preferred_date, collectedData?.preferred_time].filter(Boolean).join(" at ");
  const who = collectedData?.name ? ` for ${collectedData.name}` : "";
  const lang = cleanText(language, 10).toLowerCase();

  if (!schedule) {
    return lang === "hi"
      ? "मेरे पास अभी confirm appointment detail नहीं है। क्या मैं scheduling में मदद करूँ?"
      : "I don't have a confirmed appointment on file yet. Would you like me to help schedule one?";
  }

  if (lang === "hi") {
    return `हाँ, मेरे पास ${schedule}${who} के लिए appointment note है। क्या यह सही है?`;
  }
  return `Yes, I have your appointment noted for ${schedule}${who}. Does that look correct?`;
};

export const buildAppointmentNotFoundReply = ({ language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "hi") {
    return "इस call पर अभी कोई confirmed appointment नहीं दिख रही। अगर चाहें तो मैं slot book करने में मदद कर सकता हूँ।";
  }
  return "I don't see a confirmed appointment from this call yet. I can help book a slot if you'd like.";
};
