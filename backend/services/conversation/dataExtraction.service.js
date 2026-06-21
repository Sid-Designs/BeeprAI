import { extractIndicDateTime, extractEnglishClockTime, normalizeSpokenTimeText } from "./indicDateTime.service.js";
import { isSchedulingOrBookingRequest, isCounselorConnectRequest } from "./conversationPlaybook.service.js";

const cleanText = (value = "", max = 600) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const INVALID_NAME_PHRASE_RE =
  /\b(not talking|not looking|talking about|looking for|planning to|trying to|going to|interested in)\b/i;
const INVALID_NAME_WORD_RE =
  /^(not|talking|looking|planning|thinking|trying|going|interested|here|from|yes|yeah|ok|okay|sure|no|nope|about|but|am|i|can|you|visit|buddy|book|move|want)$/i;
const INVALID_NAME_SUFFIX_RE =
  /^(can|you|visit|buddy|book|appointment|please|want|move|could|would|will)$/i;

export const sanitizePersonName = (name = "") => {
  let value = cleanText(name, 60);
  if (!value || INVALID_NAME_PHRASE_RE.test(value)) return "";
  value = value.replace(/\s+(yes|yeah|yep|yup|ok|okay|sure|no|nope)\s*$/i, "").trim();
  value = value.replace(/\s+(yes|yeah|yep|yup|ok|okay|sure)\b/gi, " ").replace(/\s+/g, " ").trim();
  let words = value.split(/\s+/).filter(Boolean);
  if (words.length === 2 && INVALID_NAME_SUFFIX_RE.test(words[1])) {
    value = words[0];
    words = [words[0]];
  }
  if (!words.length || words.some((word) => INVALID_NAME_WORD_RE.test(word))) return "";
  if (words.length > 2) value = words.slice(0, 2).join(" ");
  return value;
};

const COURSE_SYNONYMS = [
  { pattern: /\b(b\s*c\s*a|bachelor(?:'?s)?\s+(?:of\s+)?computer applications?)\b/i, normalize: () => "BCA" },
  { pattern: /\b(b\s*b\s*a|bachelor(?:'?s)?\s+(?:of\s+)?business administration)\b/i, normalize: () => "BBA" },
  { pattern: /\b(m\s*b\s*a|master(?:'?s)?\s+(?:of\s+)?business administration)\b/i, normalize: () => "MBA" },
  { pattern: /\b(m\s*c\s*a|master(?:'?s)?\s+(?:of\s+)?computer applications?)\b/i, normalize: () => "MCA" },
  { pattern: /\b(p\s*g\s*d\s*m|post\s+graduate\s+diploma\s+in\s+management)\b/i, normalize: () => "PGDM" },
  { pattern: /\b(m\s*m\s*s|master\s+of\s+management\s+studies)\b/i, normalize: () => "MMS" },
  { pattern: /\b(bca|bba|mba|mca|pgdm|mms|btech|mtech|be|b\.?e\.?|bcom|b\.?com|bsc|b\.?sc)\b/i, normalize: (match) => match.replace(/\./g, "").toUpperCase() },
  { pattern: /\b(master'?s?|masters|post ?grad(?:uate)?)\b/i, normalize: () => "Masters" },
  { pattern: /\b(bachelor'?s?|under ?grad(?:uate)?)\b/i, normalize: () => "Bachelors" },
];

const SPECIALIZATION_PATTERNS = [
  /\b(?:in|for)\s+([a-z][a-z\s]{2,30})(?:\s+(?:next year|this year|soon|later|tomorrow|today))?\b/i,
  /\b(?:speciali[sz]ation|stream)\s+(?:in\s+)?([a-z][a-z\s]{2,30})\b/i,
];

const INTEREST_PATTERNS = [
  { pattern: /\b(admission|apply|application)\b/i, value: "admission" },
  { pattern: /\b(a+p+ointments?|appointments?|booking|schedule|callback)\b/i, value: "appointment" },
  { pattern: /\b(fees|fee|pricing|price)\b/i, value: "fees" },
  { pattern: /\b(course|program|degree)\b/i, value: "course" },
  { pattern: /\b(eligibility|eligible)\b/i, value: "eligibility" },
];

export const extractLeadData = (query = "") => {
  const text = cleanText(query, 600);
  const lower = text.toLowerCase();
  const collected = { ...extractIndicDateTime(text) };

  const nameIntroMatch = text.match(/\b(?:my name is|this is|i'm)\s+([a-z][a-z\s]{0,40})/i);
  const iamMatch = text.match(/\bi am\s+([a-z][a-z\s]{0,40})/i);
  let nameCandidate = nameIntroMatch?.[1] || "";
  if (!nameCandidate && iamMatch?.[1]) {
    const lead = iamMatch[1].trim();
    if (!/^(not|looking|planning|thinking|trying|going|talking|interested|here|from)\b/i.test(lead)) {
      nameCandidate = lead;
    }
  }
  if (nameCandidate && !/\b(interested|looking|planning|thinking)\b/i.test(nameCandidate)) {
    let name = cleanText(nameCandidate, 60);
    name = cleanText(name.split(/\s+my name is\b/i)[0], 60);
    name = cleanText(name.split(/\s+(?:can you|could you|would you|will you)\b/i)[0], 60);
    name = cleanText(name.split(/\s+(?:book|appointment|schedule)\b/i)[0], 60);
    name = cleanText(name.split(/\s+(?:for|and|from|at|on|tomorrow|today)\b/i)[0], 60);
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length > 2) {
      name = words.slice(0, 2).join(" ");
    }
    const sanitized = sanitizePersonName(name);
    if (sanitized && !/^(book|appointment|schedule)$/i.test(sanitized)) {
      collected.name = sanitized;
    }
  }

  const normalizedTimeText = normalizeSpokenTimeText(text);
  const clockTime = extractEnglishClockTime(normalizedTimeText);
  if (clockTime) {
    collected.preferred_time = clockTime;
  } else {
    const timeMatch = lower.match(
      /\b(?:around\s+|at\s+)?(\d{1,2}:\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm)|morning|afternoon|evening|tonight)\b/,
    );
    if (timeMatch?.[1] && !collected.preferred_time) {
      collected.preferred_time = timeMatch[1];
    }
  }

  const emailMatch = text.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
  if (emailMatch?.[1]) {
    collected.email = cleanText(emailMatch[1], 120).toLowerCase();
  }

  const timelineMatch = lower.match(
    /\b(today|tom+or+ow|tomor+ow|this week|next week|this month|next month|asap|soon|later|next year|this year)\b/,
  );
  if (timelineMatch?.[1] && !collected.timeline) {
    collected.timeline = /^tom/i.test(timelineMatch[1]) ? "tomorrow" : timelineMatch[1];
  }

  const dateMatch = lower.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|(?:on|for|visit(?:\s+on)?)\s+(\d{1,2})(?:st|nd|rd|th)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tom+or+ow|tomor+ow|today|day after tomorrow|after tomorrow)\b/,
  );
  if (dateMatch?.[1] && !collected.preferred_date) {
    collected.preferred_date = /^tom/i.test(dateMatch[1]) ? "tomorrow" : dateMatch[1];
  }

  for (const entry of INTEREST_PATTERNS) {
    if (entry.pattern.test(lower)) {
      collected.interest = entry.value;
      break;
    }
  }

  if (isSchedulingOrBookingRequest(text) || isCounselorConnectRequest(text)) {
    collected.appointmentRequested = true;
    collected.interest = collected.interest || "appointment";
  }

  for (const entry of COURSE_SYNONYMS) {
    const match = text.match(entry.pattern);
    if (match?.[1] || match?.[0]) {
      collected.course = entry.normalize(match[1] || match[0]);
      break;
    }
  }

  for (const pattern of SPECIALIZATION_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const specialization = cleanText(match[1], 50).replace(/\b(next year|this year|soon|later)\b/gi, "").trim();
      if (
        specialization &&
        !/^(admission|fees|pricing|course|program|degree|call|details?)$/i.test(specialization)
      ) {
        collected.specialization = specialization;
        break;
      }
    }
  }

  if (/\b(my mother|mom|mother)\b/i.test(lower)) {
    collected.decision_maker = "mother";
  } else if (/\b(my father|dad|father)\b/i.test(lower)) {
    collected.decision_maker = "father";
  } else if (/\b(my parents|parents)\b/i.test(lower)) {
    collected.decision_maker = "parents";
  } else if (/\b(my family|family)\b/i.test(lower)) {
    collected.decision_maker = "family";
  }

  if (/\b(wants me to|asked me to|told me to)\b/i.test(lower)) {
    collected.user_role = "influenced";
  } else if (/\b(i want to|i'm planning to|i am planning to)\b/i.test(lower)) {
    collected.user_role = "self_directed";
  }

  return collected;
};
