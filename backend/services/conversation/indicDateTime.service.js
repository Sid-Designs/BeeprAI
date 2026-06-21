/**
 * Marathi / Hindi date and time extraction for voice transcripts.
 */

const DEVANAGARI_DIGIT_MAP = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export const normalizeIndicDigits = (text = "") => {
  let value = String(text || "");
  for (const [indic, arabic] of Object.entries(DEVANAGARI_DIGIT_MAP)) {
    value = value.split(indic).join(arabic);
  }
  return value;
};

const MARATHI_DATE_PATTERNS = [
  { pattern: /(उद्या|udya)/i, value: "tomorrow" },
  { pattern: /(काल|कल)(\s*(से|ही|पण))?/i, value: "tomorrow" },
  { pattern: /(आज|aaj)/i, value: "today" },
  { pattern: /(परवा|parva)/i, value: "day after tomorrow" },
  { pattern: /\b(a\s+)?day\s+after\s+tomorrow\b/i, value: "day after tomorrow" },
  { pattern: /\bafter\s+tomorrow\b/i, value: "day after tomorrow" },
  { pattern: /(सोमवार|मंगळवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार)/, value: (m) => m[1] },
];

const MARATHI_MONTH_PATTERNS = [
  { pattern: /(\d{1,2})\s*(जून|जानेवारी|फेब्रुवारी|मार्च|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)/i, value: (m) => `${m[1]} ${m[2]}` },
  { pattern: /(जून|जानेवारी|फेब्रुवारी|मार्च|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)\s*(\d{1,2})/i, value: (m) => `${m[2]} ${m[1]}` },
];

const TIME_PATTERNS = [
  { pattern: /\b(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i, value: (m) => `${m[1]}${m[2] ? `:${m[2]}` : ""} ${m[3]}`.toLowerCase() },
  { pattern: /(\d{1,2})\s*(वाजता|vajta|vajata)/i, value: (m) => `${m[1]} o'clock` },
  { pattern: /(दोन|2)\s*(वाजता|vajta)/i, value: () => "2 pm" },
  { pattern: /(तीन|3)\s*(वाजता|vajta)/i, value: () => "3 pm" },
  { pattern: /(चार|4)\s*(वाजता|vajta)/i, value: () => "4 pm" },
  { pattern: /(morning|afternoon|evening|सकाळ|दुपार|संध्याकाळ)/i, value: (m) => m[1].toLowerCase() },
];

export const CALLBACK_INDIC_RE =
  /(नंतर).{0,40}(कॉल|फोन|call)|(कॉल करू शकता|कॉल करा|call me back|call later)/i;

export const BOOKING_INDIC_RE =
  /\b(अपॉइंटमेंट|appointment).{0,20}\b(बुक|book)\b|\b(बुक करा|book करा)\b|(अरेंज|arrange).{0,30}(करा|कर|करो|call|कॉल)/i;

/** Normalize common STT mis-hearings before time/date extraction. */
export const normalizeSpokenTimeText = (text = "") => {
  let value = normalizeIndicDigits(String(text || ""));
  const wordToHour = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12,
  };

  value = value.replace(/\b(\d{1,2})\s+years?\b/gi, "$1 am");
  value = value.replace(/\b(point|around|at)\s+(\d{1,2})(?!\s*(?:am|pm))(?:\s*here)?\b/gi, "$2 am");
  value = value.replace(/\b(\d{1,2})\s+in\s+the\s+morning\b/gi, "$1 am");
  value = value.replace(/\b(\d{1,2})\s+morning\b/gi, "$1 am");
  value = value.replace(
    /\b(ten|eleven|twelve)\s+morning\b/gi,
    (match, word) => `${wordToHour[word.toLowerCase()]} am`,
  );
  value = value.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(am|pm)\b/gi,
    (match, word, meridiem) => `${wordToHour[word.toLowerCase()]} ${meridiem.toLowerCase()}`,
  );
  value = value.replace(/\b(\d{3,4})\b/g, (match, digits) => {
    const hourDigits = digits.length === 4 ? digits.slice(0, 2) : digits.slice(0, 1);
    const minuteDigits = digits.length === 4 ? digits.slice(2) : digits.slice(1);
    const hour = Number.parseInt(hourDigits, 10);
    const minute = Number.parseInt(minuteDigits, 10);
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute < 60) {
      return `${hour}:${String(minute).padStart(2, "0")} am`;
    }
    return match;
  });
  value = value.replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+million\b/gi, "$1 july");
  value = value.replace(/\b(\d{1,2})\s+million\b/gi, "$1 july");
  value = value.replace(/\b(jewel|jule|jewellery)\b/gi, "july");
  value = value.replace(/\bthis year\b/gi, "this year");
  value = value.replace(/\bhis year\b/gi, "this year");
  return value;
};
/** Prefer hour part of H:MM am/pm — avoids ":00 am" false matches. */
export const extractEnglishClockTime = (text = "") => {
  const raw = normalizeSpokenTimeText(text);
  const re = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
  let match;
  let best = "";
  while ((match = re.exec(raw)) !== null) {
    const idx = match.index;
    if (idx > 0 && raw[idx - 1] === ":") continue;
    const hour = Number.parseInt(match[1], 10);
    if (!Number.isFinite(hour) || hour < 1 || hour > 12) continue;
    const value = `${match[1]}${match[2] ? `:${match[2]}` : ""} ${match[3]}`.toLowerCase();
    if (!best || match[2]) best = value;
  }
  return best;
};

export const extractIndicDateTime = (query = "") => {
  const raw = normalizeSpokenTimeText(String(query || "").trim());
  const text = normalizeIndicDigits(raw);
  const lower = text.toLowerCase();
  const result = {};

  for (const entry of MARATHI_DATE_PATTERNS) {
    const match = text.match(entry.pattern);
    if (match) {
      result.preferred_date = typeof entry.value === "function" ? entry.value(match) : entry.value;
      break;
    }
  }

  for (const entry of MARATHI_MONTH_PATTERNS) {
    const match = text.match(entry.pattern);
    if (match) {
      result.preferred_date = typeof entry.value === "function" ? entry.value(match) : entry.value;
      break;
    }
  }

  if (!result.preferred_date) {
    const englishDate = lower.match(
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2}(?:st|nd|rd|th)?|tom+or+ow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    );
    if (englishDate?.[1]) {
      result.preferred_date = /^tom/i.test(englishDate[1]) ? "tomorrow" : englishDate[1];
    }
  }

  if (!result.preferred_date) {
    const monthFirst = lower.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
    );
    if (monthFirst?.[1] && monthFirst?.[2]) {
      result.preferred_date = `${monthFirst[2]} ${monthFirst[1]}`;
    }
  }

  if (!result.preferred_date) {
    const ordinalOnly = lower.match(
      /\b(?:on|for|visit(?:\s+on)?|book(?:\s+for)?|college\s+on)?\s*(\d{1,2})(st|nd|rd|th)\b/,
    );
    if (ordinalOnly?.[1]) {
      result.preferred_date = `${ordinalOnly[1]}${ordinalOnly[2]}`;
    }
  }

  const englishClock = extractEnglishClockTime(text);
  if (englishClock) {
    result.preferred_time = englishClock;
  } else {
    for (const entry of TIME_PATTERNS) {
      const pattern = entry.pattern.global ? entry.pattern : new RegExp(entry.pattern.source, `${entry.pattern.flags}g`);
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const idx = match.index;
        if (idx > 0 && text[idx - 1] === ":") continue;
        result.preferred_time =
          typeof entry.value === "function" ? entry.value(match) : entry.value;
        break;
      }
      if (result.preferred_time) break;
    }
  }

  if (BOOKING_INDIC_RE.test(text)) {
    result.appointmentRequested = true;
  }

  if (CALLBACK_INDIC_RE.test(text)) {
    result.callbackRequested = true;
  }

  return result;
};
