import {
  extractIndicDateTime,
  normalizeSpokenTimeText,
  CALLBACK_INDIC_RE,
} from "./indicDateTime.service.js";
import { sanitizePersonName } from "./dataExtraction.service.js";
import { resolveAppointmentVisitConfig } from "./appointmentVisit.service.js";
import { resolveDateString, formatSlotLabel } from "../calendar/voiceBookingCalendar.helpers.js";
import { zonedDateTimeToUtc } from "../calendar/calendarTime.service.js";

const ORDINAL_ONLY_DATE_RE = /^\d{1,2}(?:st|nd|rd|th)?$/i;
const MONTH_NAME_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const BOOKING_CLARIFY_RE =
  /^(what|huh|sorry|pardon|come again|repeat that|didn'?t get|did not get)[?.!,\s]*$/i;

export const isOrdinalOnlyDate = (value = "") => ORDINAL_ONLY_DATE_RE.test(String(value || "").trim());

export const mergeSplitBookingDate = (collected = {}, query = "", extracted = {}) => {
  const merged = { ...collected };
  const normalized = normalizeSpokenTimeText(String(query || ""));
  const prevDate = String(merged.preferred_date || "").trim();
  const monthMatch = normalized.match(MONTH_NAME_RE);
  if (isOrdinalOnlyDate(prevDate) && monthMatch?.[1]) {
    merged.preferred_date = `${prevDate} ${monthMatch[1]}`;
  }
  const indic = extractIndicDateTime(normalized);
  const nextDate = String(indic.preferred_date || extracted.preferred_date || "").trim();
  if (isOrdinalOnlyDate(prevDate) && nextDate && !isOrdinalOnlyDate(nextDate) && !monthMatch) {
    merged.preferred_date = `${prevDate} ${nextDate}`.replace(/\s+/g, " ").trim();
  }
  return merged;
};

export const formatBookingScheduleLabel = (collectedData = {}, timeZone = "UTC") => {
  const dateSource = String(collectedData.preferred_date || "").trim();
  let timeLabel = String(collectedData.preferred_time || "").trim();
  if (collectedData.appointmentSlotStart) {
    timeLabel = formatSlotLabel({ startAt: collectedData.appointmentSlotStart }, timeZone);
  }
  const resolved = resolveDateString(dateSource, timeZone);
  let dateLabel = dateSource;
  if (resolved) {
    const anchor = zonedDateTimeToUtc(resolved, "12:00", timeZone);
    dateLabel = new Intl.DateTimeFormat("en-IN", {
      timeZone,
      day: "numeric",
      month: "long",
    }).format(anchor);
  } else if (MONTH_NAME_RE.test(dateSource)) {
    dateLabel = dateSource.replace(
      MONTH_NAME_RE,
      (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase(),
    );
  }
  return [dateLabel, timeLabel].filter(Boolean).join(" at ");
};

export const buildBookingClarifyReply = ({
  progress = {},
  scheduleLabel = "",
  language = "en",
} = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (progress?.nextSlot === "name") {
    return lang === "hi"
      ? "माफ़ कीजिए — campus visit confirm करने के लिए आपका नाम बता दीजिए।"
      : "Sorry — could you share your name to confirm the campus visit?";
  }
  if (progress?.hasDate && !progress?.hasTime) {
    const when = scheduleLabel || "that day";
    return lang === "hi"
      ? `माफ़ कीजिए — ${when} के लिए कौन सा समय सही रहेगा?`
      : `Sorry — what time works for ${when}?`;
  }
  if (scheduleLabel) {
    return lang === "hi"
      ? `माफ़ कीजिए — मैं ${scheduleLabel} के लिए campus visit schedule कर रहा हूँ। क्या यह सही है?`
      : `Sorry — I am scheduling your campus visit for ${scheduleLabel}. Does that work?`;
  }
  return lang === "hi"
    ? "माफ़ कीजिए — campus visit के लिए तारीख और समय बता दीजिए।"
    : "Sorry — what date and time would you like for the campus visit?";
};

const cleanText = (value = "", max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const CALLBACK_EXACT_TIME_RE =
  /\b(?:around\s+|at\s+)?(\d{1,2}(?::\d{2})?\s?(?:am|pm)|morning|afternoon|evening|tonight)\b/i;

const INDIC_DATE_RE =
  /\b(उद्या|आज|परवा|udya|aaj|tom+or+ow|today|day after tomorrow|after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(जून|जानेवारी|फेब्रुवारी|मार्च|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर))/i;

const VAGUE_TIMELINE_RE =
  /\b(this year|next year|this month|next month|this week|next week|soon|later|asap|from this year|sometime|within a month)\b/i;

const BOOKABLE_DATE_QUERY_RE =
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)\b|day after tomorrow|after tomorrow|tom+or+ow|tomor+ow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const DATE_CORRECTION_RE =
  /\b(not tomorrow|no tomorrow|not today|different date|another date|change(?: the)? date|move(?: the)? date)\b/i;

export const isVagueTimeline = (value = "") => VAGUE_TIMELINE_RE.test(String(value || "").trim());

export const hasExplicitAppointmentDate = (query = "", extractedData = {}, collectedData = {}) => {
  const indic = extractIndicDateTime(query);
  const merged = { ...collectedData, ...extractedData, ...indic };
  const preferredDate = String(merged?.preferred_date || "").trim();
  if (preferredDate && !isVagueTimeline(preferredDate)) return true;

  const timeline = String(merged?.timeline || "").trim();
  if (timeline && !isVagueTimeline(timeline) && BOOKABLE_DATE_QUERY_RE.test(timeline)) return true;

  return (
    INDIC_DATE_RE.test(String(query || "")) ||
    BOOKABLE_DATE_QUERY_RE.test(String(query || ""))
  );
};

export const detectBookingDateChange = (query = "", collectedData = {}, incoming = {}) => {
  const text = cleanText(query, 300).toLowerCase();
  if (DATE_CORRECTION_RE.test(text)) {
    return { changed: true, clearSlots: true };
  }
  const indic = extractIndicDateTime(query);
  const nextDate = String(indic.preferred_date || incoming.preferred_date || "").trim();
  const prevDate = String(collectedData.preferred_date || "").trim();
  if (nextDate && nextDate !== prevDate && !isVagueTimeline(nextDate)) {
    return { changed: true, clearSlots: true };
  }
  if (
    hasExplicitAppointmentDate(query, incoming, {}) &&
    !/^(yes|yeah|yep|yup|ok|okay|sure|correct|right)[.!,\s]*$/i.test(text.trim())
  ) {
    return { changed: true, clearSlots: true };
  }
  return { changed: false, clearSlots: false };
};

export const clearBookingSlotState = (collected = {}) => {
  const next = { ...collected };
  delete next.appointmentSlotStart;
  delete next.appointmentSlotEnd;
  delete next.resolvedDate;
  next.alternativesOffered = false;
  next.offeredSlots = [];
  return next;
};

export const isScheduleReadyForConfirm = (collectedData = {}, timeZone = "UTC") => {
  const dateSource = String(collectedData.preferred_date || "").trim();
  if (!dateSource || isVagueTimeline(dateSource)) return false;
  if (!resolveDateString(dateSource, timeZone)) return false;
  if (!String(collectedData.preferred_time || "").trim() && !collectedData.appointmentSlotStart) {
    return false;
  }
  return Boolean(sanitizePersonName(collectedData.name));
};

const INDIC_TIME_RE =
  /\b(\d{1,2}\s*(?:am|pm)|\d{1,2}\s*वाजता|दोन\s*वाजता|तीन\s*वाजता|morning|afternoon|evening|सकाळ|दुपार|संध्याकाळ)\b/i;

export const getBookingMandatoryFields = (policy = {}) => {
  const objective = cleanText(policy.objective, 80).toLowerCase();
  const appointmentSlots = ["preferred_date", "preferred_time", "name"];
  if (objective === "appointment_booking" || objective.includes("appointment")) {
    return appointmentSlots;
  }
  const fields = Array.isArray(policy.qualificationFields) ? policy.qualificationFields : [];
  const filtered = fields.filter((slot) => appointmentSlots.includes(slot));
  if (filtered.length >= 2) return filtered;
  return appointmentSlots;
};
export const hasAppointmentDate = (query = "", extractedData = {}) =>
  hasExplicitAppointmentDate(query, extractedData, extractedData);

export const hasAppointmentTime = (query = "", extractedData = {}) => {
  const merged = { ...extractedData, ...extractIndicDateTime(query) };
  return (
    Boolean(String(merged?.preferred_time || "").trim()) ||
    INDIC_TIME_RE.test(String(query || "")) ||
    CALLBACK_EXACT_TIME_RE.test(String(query || ""))
  );
};

export const buildAppointmentSchedule = (extractedData = {}, rawQuery = "") => {
  const preferredDate = String(extractedData?.preferred_date || "").trim();
  const preferredTime = String(extractedData?.preferred_time || "").trim();
  const timeline = String(extractedData?.timeline || "").trim();
  const dateForSchedule = preferredDate || (isVagueTimeline(timeline) ? "" : timeline);
  const text = [dateForSchedule, preferredTime].filter(Boolean).join(" ").trim()
    || String(rawQuery || "").trim();
  return {
    preferredDate: dateForSchedule,
    preferredTime,
    timeline,
    text: text.slice(0, 120),
  };
};

const slotFilled = (slot, collectedData = {}, query = "", extractedData = {}) => {
  const merged = { ...collectedData, ...extractedData };
  if (slot === "name") return Boolean(String(merged.name || "").trim());
  if (slot === "preferred_date") return hasAppointmentDate(query, merged);
  if (slot === "preferred_time") return hasAppointmentTime(query, merged);
  if (slot === "course") return Boolean(String(merged.course || merged.interest || "").trim());
  return Boolean(String(merged[slot] || "").trim());
};

export const evaluateBookingProgress = ({
  collectedData = {},
  extractedData = {},
  query = "",
  policy = {},
} = {}) => {
  const mandatoryFields = getBookingMandatoryFields(policy);
  const schedule = buildAppointmentSchedule(
    { ...collectedData, ...extractedData },
    query,
  );
  const filled = mandatoryFields.filter((slot) =>
    slotFilled(slot, collectedData, query, extractedData),
  );
  const nextSlot = mandatoryFields.find(
    (slot) => !slotFilled(slot, collectedData, query, extractedData),
  );

  return {
    mandatoryFields,
    filledSlots: filled,
    nextSlot: nextSlot || "",
    hasDate: hasAppointmentDate(query, { ...collectedData, ...extractedData }),
    hasTime: hasAppointmentTime(query, { ...collectedData, ...extractedData }),
    hasName: Boolean(String(collectedData?.name || extractedData?.name || "").trim()),
    schedule,
    allRequiredFilled: !nextSlot,
  };
};

export const buildBookingStepReply = ({ progress, language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const slot = progress?.nextSlot || "";

  if (!slot && progress?.allRequiredFilled) {
    return "";
  }

  if (slot === "preferred_date" && progress?.hasTime) {
    if (lang === "mr") {
      return "ठीक आहे, वेळ नोंदली. कोणती तारीख सोयीची राहील?";
    }
    if (lang === "hi") {
      return "ठीक है, समय नोट कर लिया। कौन सी तारीख चाहिए?";
    }
    return "Sure, I noted the time. Which date should I request for the appointment?";
  }
  if (slot === "preferred_time" && progress?.hasDate) {
    if (lang === "mr") {
      return "ठीक आहे, तारीख नोंदली. कोणता वेळ सोयीचा राहील?";
    }
    if (lang === "hi") {
      return "ठीक है, तारीख नोट कर ली। कौन सा समय सही रहेगा?";
    }
    return "Sure, I noted the date. What time works best for the appointment?";
  }
  if (slot === "name") {
    if (lang === "mr") {
      return "छान. appointment confirm करण्यासाठी कृपया नाव सांगा.";
    }
    if (lang === "hi") {
      return "बढ़िया। appointment confirm करने के लिए आपका नाम बता दीजिए।";
    }
    return "Great. Could you share your name to confirm the appointment?";
  }
  if (slot === "preferred_date" || slot === "preferred_time") {
    if (lang === "mr") {
      return "नक्की, मी appointment schedule करण्यात मदत करू शकतो. कोणती तारीख आणि वेळ सोयीची राहील?";
    }
    if (lang === "hi") {
      return "ठीक है, मैं appointment schedule करने में मदद कर सकता हूँ। कौन सी तारीख और समय सही रहेगा?";
    }
    return "Sure, I can help schedule an appointment. What date and time work best for you?";
  }

  if (progress?.hasDate && progress?.hasTime && !progress?.hasName) {
    if (lang === "mr") {
      return "छान. appointment confirm करण्यासाठी कृपया नाव सांगा.";
    }
    if (lang === "hi") {
      return "बढ़िया। appointment confirm करने के लिए आपका नाम बता दीजिए।";
    }
    return "Great. Could you share your name to confirm the appointment?";
  }

  if (progress?.allRequiredFilled || (progress?.hasDate && progress?.hasTime)) {
    return "";
  }

  return lang === "hi"
    ? "appointment के लिए तारीख और समय बता दीजिए।"
    : "What date and time should I book the appointment for?";
};

export const buildBookingConfirmationReply = ({
  schedule = {},
  name = "",
  language = "en",
  policy = {},
  whenLabel = "",
} = {}) => {
  const when = cleanText(whenLabel || schedule.text || "", 120);
  const who = sanitizePersonName(name);
  const lang = cleanText(language, 10).toLowerCase();
  const visit = resolveAppointmentVisitConfig(policy);
  const visitLabel = visit.bookingNoun || visit.shortLabel || "visit";

  if (!when) {
    return lang === "hi"
      ? "ठीक है। campus visit के लिए कौन सी तारीख और समय सही रहेगा?"
      : "Sure. What date and time would you like for the campus visit?";
  }

  if (lang === "hi") {
    return who
      ? `Perfect, ${who}. मैंने ${when} के लिए ${visitLabel} note कर ली है। क्या मैं इसे confirm कर दूँ?`
      : `Perfect. मैंने ${when} के लिए ${visitLabel} note कर ली है। क्या मैं इसे confirm कर दूँ?`;
  }

  return who
    ? `Perfect, ${who}. I noted your ${visitLabel} for ${when}. Shall I confirm this booking?`
    : `Perfect. I noted your ${visitLabel} for ${when}. Shall I confirm this booking?`;
};

export const buildBookingConfirmedReply = ({
  schedule = {},
  language = "en",
  orgName = "our team",
  whenLabel = "",
} = {}) => {
  const when = cleanText(whenLabel || schedule.text || "", 120);
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "hi") {
    return `बढ़िया, ${when} के लिए appointment confirm हो गई है। ${orgName} की team जल्द follow up करेगी। धन्यवाद, goodbye।`;
  }
  if (lang === "mr") {
    return `छान, ${when} साठी appointment confirm झाली आहे. ${orgName} ची team लवकर follow up करेल. धन्यवाद, goodbye.`;
  }
  return `Perfect, your appointment for ${when} is confirmed. Our team will follow up shortly. Thank you, goodbye.`;
};

const CAMPUS_VISIT_RE =
  /\b(visit (the )?college|campus visit|visit in college|come to (the )?college|meet at (the )?college|book.*visit)\b/i;

export const buildCounselorVisitIntro = ({ language = "en", policy = {} } = {}) => {
  const visit = resolveAppointmentVisitConfig(policy);
  const lang = cleanText(language, 10).toLowerCase();
  if (visit.type === "counselor_call") {
    if (lang === "hi") {
      return "मैं आपके लिए counselor call arrange कर सकता हूँ।";
    }
    if (lang === "mr") {
      return "मी तुमच्यासाठी counselor call arrange करू शकतो.";
    }
    return visit.scheduleEn;
  }
  if (lang === "hi") return visit.scheduleHi;
  if (lang === "mr") return visit.scheduleMr;
  return visit.scheduleEn;
};

export const buildBookingProgressAck = ({ language = "en", phase = "collecting" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (phase === "checking") {
    if (lang === "hi") return "एक पल — मैं appointment की availability check कर रहा हूँ।";
    if (lang === "mr") return "एक क्षण — मी appointment availability तपासतो.";
    return "One moment — I'm checking appointment availability for you.";
  }
  if (lang === "hi") {
    return "ठीक है — मैं अभी आपका appointment बुक करता हूँ।";
  }
  if (lang === "mr") {
    return "ठीक आहे — मी आत्ता तुमचा appointment बुक करतो.";
  }
  return "Sure — give me a moment while I book that appointment for you.";
};

const prefixBookingAnswer = (prefix, answer) => {
  const lead = cleanText(prefix, 200);
  const body = cleanText(answer, 300);
  if (!lead) return body;
  if (!body) return lead;
  if (body.toLowerCase().includes(lead.toLowerCase())) return body;
  return `${lead} ${body}`;
};

const buildMissingScheduleReply = ({ language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "hi") {
    return "ठीक है। campus visit के लिए exact तारीख और समय बता दीजिए, जैसे 25 July सुबह 10 बजे।";
  }
  return "Sure. What exact date and time would you like for the campus visit, for example 25th July around 10 AM?";
};

export const buildResumeBookingReply = ({ progress, language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const slot = progress?.nextSlot || "preferred_time";
  if (slot === "preferred_date") {
    return lang === "hi"
      ? "scheduling पर वापस आते हैं — कौन सी तारीख सही रहेगी?"
      : "Coming back to scheduling — what date works best for your appointment?";
  }
  return lang === "hi"
    ? "scheduling पर वापस आते हैं — कौन सा समय सही रहेगा?"
    : "Coming back to scheduling — what time works best for your appointment?";
};

export const isBookingStage = (stage = "") => {
  const value = cleanText(stage, 60).toLowerCase();
  return value === "appointment" || value === "appointment_booking" || value === "confirmation";
};

const AFFIRMATION_RE =
  /^(yes|yeah|yep|yup|correct|right|sure|okay|ok|haan|ho|hoy|ho na|ठीक आहे|हो|हा|होय|ओके)[.!,\s]*/i;

export const isBookingAffirmation = (text = "") => {
  const value = cleanText(text, 200);
  if (!value) return false;
  if (/\b(confirm(?:ed| it| that)?|go ahead|that works|sounds good|please (?:do|book|confirm)|book it|yes please|help kar de|kar de)\b/i.test(
    value,
  )) {
    return true;
  }
  if (AFFIRMATION_RE.test(value)) {
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length > 1 && /\b(visit|book|appointment|schedule|college|tomorrow|move|want)\b/i.test(value)) {
      return false;
    }
    return words.length <= 2;
  }
  return false;
};

export const resolveBookingTurn = ({
  state = {},
  extractedData = {},
  query = "",
  policy = {},
  language = "en",
  intentProfile = {},
  mergeCollectedDataFn = (current, incoming) => ({ ...(current || {}), ...(incoming || {}) }),
} = {}) => {
  const normalizedQuery = normalizeSpokenTimeText(cleanText(query, 300));
  const indic = extractIndicDateTime(normalizedQuery);
  const dateChange = detectBookingDateChange(normalizedQuery, state.collectedData || {}, {
    ...extractedData,
    ...indic,
  });

  if (indic.callbackRequested || CALLBACK_INDIC_RE.test(cleanText(query, 300))) {
    const lang = cleanText(language, 10).toLowerCase();
    const answer = lang === "mr"
      ? "नक्की, मी नंतर कॉल करू शकतो. कोणता वेळ सोयीचा राहील?"
      : lang === "hi"
        ? "ठीक है, मैं बाद में कॉल कर सकता हूँ। कौन सा समय सही रहेगा?"
        : "Sure, I can call you back later. What time works best?";
    return {
      answer,
      nextState: {
        ...state,
        turnCount: (state.turnCount || 0) + 1,
        stage: "callback",
        bookingReadiness: "declined",
        collectedData: mergeCollectedDataFn(state.collectedData, {
          ...extractedData,
          ...indic,
          callbackRequested: true,
        }),
      },
      endCall: false,
      endReason: "",
      stage: "callback",
      telemetry: { callbackRequested: true },
    };
  }

  let merged = mergeCollectedDataFn(state.collectedData, {
    ...extractedData,
    ...indic,
    appointmentRequested: true,
  });
  if (dateChange.clearSlots) {
    merged = clearBookingSlotState(merged);
  }
  merged = mergeSplitBookingDate(merged, normalizedQuery, extractedData);
  if (merged.name) {
    const safeName = sanitizePersonName(merged.name);
    if (safeName) merged.name = safeName;
    else delete merged.name;
  }
  const progress = evaluateBookingProgress({
    collectedData: merged,
    extractedData,
    query: normalizedQuery,
    policy,
  });
  if (!merged.name && progress.nextSlot === "name") {
    const bareName = cleanText(normalizedQuery, 80).match(
      /^(?:my name is\s+)?([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)$/,
    );
    const candidate = sanitizePersonName(bareName?.[1] || "");
    if (candidate) merged.name = candidate;
  }
  const schedule = buildAppointmentSchedule(merged, normalizedQuery);
  const whenLabel = formatBookingScheduleLabel(merged);
  const scheduleForReply = { ...schedule, text: whenLabel || schedule.text };
  let stageNow = cleanText(state.stage, 60).toLowerCase();
  if (dateChange.changed && stageNow === "confirmation") {
    stageNow = "appointment_booking";
  }
  const scheduleReady = isScheduleReadyForConfirm(merged);

  if (BOOKING_CLARIFY_RE.test(normalizedQuery) && isBookingStage(stageNow)) {
    const clarifyState = {
      ...state,
      turnCount: (state.turnCount || 0) + 1,
      collectedData: {
        ...merged,
        appointmentSchedule: scheduleForReply,
      },
    };
    return {
      answer: buildBookingClarifyReply({
        progress,
        scheduleLabel: whenLabel,
        language,
      }),
      nextState: {
        ...clarifyState,
        stage: stageNow,
      },
      endCall: false,
      endReason: "",
      stage: stageNow,
      telemetry: { appointmentRequested: true },
    };
  }
  const wantsCounselorVisit = CAMPUS_VISIT_RE.test(normalizedQuery);
  const needsBookingAck = !state.bookingAckSent && stageNow !== "confirmation" && !progress.hasDate;
  const bookingAck = needsBookingAck ? buildBookingProgressAck({ language }) : "";
  const counselorIntro =
    wantsCounselorVisit && stageNow !== "confirmation" && !state.bookingAckSent
      ? buildCounselorVisitIntro({ language, policy })
      : "";
  const baseState = {
    ...state,
    turnCount: (state.turnCount || 0) + 1,
    bookingAckSent: state.bookingAckSent || Boolean(bookingAck),
    collectedData: {
      ...merged,
      appointmentSchedule: scheduleForReply,
    },
    leadStatus: state.leadStatus === "new" ? "interested" : state.leadStatus,
    bookingReadiness: state.bookingReadiness === "not_asked" ? "ready" : state.bookingReadiness,
  };
  const telemetry = {
    appointmentRequested: true,
    intentScore: Number(intentProfile?.commitmentScore || 0),
  };

  const awaitingBookingConfirm =
    stageNow === "confirmation" ||
    (progress.allRequiredFilled &&
      /\b(shall i confirm|confirm this booking)\b/i.test(String(state.lastAssistantPrompt || "")));

  if (awaitingBookingConfirm && isBookingAffirmation(normalizedQuery) && scheduleReady) {
      const confirmedState = {
        ...baseState,
        stage: "completed",
        endCall: true,
        endReason: "appointment_confirmed",
        objectiveAchieved: true,
        objectiveAchievedReason: "appointment_confirmed",
        leadStatus: "qualified",
        collectedData: {
          ...baseState.collectedData,
          appointmentConfirmed: true,
        },
      };
      return {
        answer: buildBookingConfirmedReply({
          schedule: scheduleForReply,
          language,
          orgName: policy.orgName || "our team",
          whenLabel,
        }),
        nextState: confirmedState,
        endCall: true,
        endReason: "appointment_confirmed",
        stage: "completed",
        telemetry: { ...telemetry, appointmentConfirmed: true, objectiveAchieved: true },
      };
  }

  if (progress.allRequiredFilled && scheduleReady && stageNow !== "confirmation" && !awaitingBookingConfirm) {
    return {
      answer: prefixBookingAnswer(
        prefixBookingAnswer(counselorIntro, bookingAck),
        buildBookingConfirmationReply({
          schedule: scheduleForReply,
          name: merged.name,
          language,
          policy,
          whenLabel,
        }),
      ),
      nextState: {
        ...baseState,
        stage: "confirmation",
      },
      endCall: false,
      endReason: "",
      stage: "confirmation",
      telemetry: { ...telemetry, appointmentReady: true },
    };
  }

  if (progress.allRequiredFilled && !scheduleReady) {
    return {
      answer: buildMissingScheduleReply({ language }),
      nextState: {
        ...baseState,
        stage: "appointment_booking",
      },
      endCall: false,
      endReason: "",
      stage: "appointment_booking",
      telemetry: { ...telemetry, appointmentNeedsDate: true },
    };
  }

  const stepAnswer = buildBookingStepReply({ progress, language });
  const composedStep = prefixBookingAnswer(
    prefixBookingAnswer(counselorIntro, bookingAck),
    stepAnswer,
  );
  if (!stepAnswer && progress.hasDate && progress.hasTime && scheduleReady) {
    return {
      answer: prefixBookingAnswer(
        prefixBookingAnswer(counselorIntro, bookingAck),
        buildBookingConfirmationReply({
          schedule: scheduleForReply,
          name: merged.name,
          language,
          policy,
          whenLabel,
        }),
      ),
      nextState: {
        ...baseState,
        stage: "confirmation",
      },
      endCall: false,
      endReason: "",
      stage: "confirmation",
      telemetry: { ...telemetry, appointmentReady: true },
    };
  }

  return {
    answer: composedStep || buildMissingScheduleReply({ language }),
    nextState: {
      ...baseState,
      stage: "appointment_booking",
    },
    endCall: false,
    endReason: "",
    stage: "appointment_booking",
    telemetry,
  };
};
