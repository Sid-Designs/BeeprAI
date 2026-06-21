const cleanText = (value, max = 400) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const containsAny = (text = "", patterns = []) => patterns.some((pattern) => pattern.test(text));

const LEAVING_PATTERNS = [
  /\b(i will go|i'll go|i have to go|have to go|gotta go|need to go)\b/,
];

const HARD_CLOSE_PATTERNS = [
  /\b(end call|end the call|disconnect|hang up|stop calling)\b/,
  /\b(close (?:this |the )?call)\b/,
];

const NOT_INTERESTED_PATTERNS = [
  /\b(not interested|no thanks|no thank you|remove me)\b/,
  /\b(do not call|don't call)\b/,
];

const CALLBACK_PATTERNS = [
  /\b(i will call back|call you back|i'll call back|check website and call)\b/,
  /\b(call me later|call me back|call me again|let me check and call|can we talk later|talk later)\b/,
  /\b(i am busy|i'm busy|im busy|busy now)\b/,
];

const OFF_TOPIC_PATTERNS = [
  /\b(weather|sports|movie|politics|joke|music)\b/,
];

const GRATITUDE_CLOSE_PATTERNS = [
  /\b(thank you|thanks|okay thanks|got it thanks|that helps)\b/,
  /\b(that is all|that's all|thats all|done)\b/,
];

const STRONG_CLOSE_PATTERNS = [
  /^(?:goodbye|bye bye|bye\.?|goodbye\.?)$/i,
  /\b(nothing else|all good|we are done)\b/i,
];

const WEAK_CLOSE_PATTERNS = [
  /\b(bye|goodbye|see you|take care)\b/i,
];

const AFFIRMATION_PATTERNS = [
  /^(?:yes|yeah|yep|correct|right|sure|okay|ok)\b/i,
  /\b(please do|go ahead|you can close|close it)\b/i,
];

export const CLOSE_SIGNAL_THRESHOLD = 0.85;

export const detectConversationSignals = (query = "") => {
  const rawText = cleanText(query, 500);
  const text = rawText.toLowerCase();
  const punctuationEnded = /[.!?]$/.test(rawText);
  const shortUtterance = text.split(" ").filter(Boolean).length <= 3;

  const hardClose = containsAny(text, HARD_CLOSE_PATTERNS) || containsAny(text, LEAVING_PATTERNS);
  let notInterested = containsAny(text, NOT_INTERESTED_PATTERNS);
  const schedulingWithDecline =
    /\b(arrange|book|schedule|counselou?r|counsell\w*|appointment)\b/i.test(text) &&
    /\b(no thanks|not interested|cancel)\b/i.test(text);
  if (schedulingWithDecline) notInterested = false;
  const callbackIntent = containsAny(text, CALLBACK_PATTERNS);
  const offTopic = containsAny(text, OFF_TOPIC_PATTERNS);
  const gratitudeClose = containsAny(text, GRATITUDE_CLOSE_PATTERNS);
  const closeConfirmationAffirmed = containsAny(text, AFFIRMATION_PATTERNS);

  let closeConsentConfidence = 0;
  if (containsAny(rawText, STRONG_CLOSE_PATTERNS)) {
    closeConsentConfidence = 0.95;
  } else if (containsAny(rawText, WEAK_CLOSE_PATTERNS)) {
    closeConsentConfidence = punctuationEnded && shortUtterance ? 0.9 : 0.6;
  } else if (gratitudeClose && /\b(that is all|that's all|thats all|done)\b/.test(text)) {
    closeConsentConfidence = 0.88;
  } else if (gratitudeClose) {
    closeConsentConfidence = 0.55;
  }

  const closeConsent = closeConsentConfidence >= CLOSE_SIGNAL_THRESHOLD;
  const closeIntentDetected =
    hardClose || notInterested || closeConsentConfidence > 0 || gratitudeClose;
  const shouldConfirmClose =
    !hardClose &&
    !notInterested &&
    closeIntentDetected &&
    closeConsentConfidence > 0 &&
    closeConsentConfidence < CLOSE_SIGNAL_THRESHOLD;

  const uncertain =
    /\b(not sure|maybe|later|let me think|i will check)\b/.test(text);
  const interest =
    /\b(yes|interested|tell me more|book|schedule|admission|apply|price|fees|details|want to)\b/.test(
      text,
    );

  return {
    hardClose,
    notInterested,
    uncertain,
    interest,
    gratitudeClose,
    closeConsent,
    closeConsentConfidence,
    closeIntentDetected,
    closeConfirmationAffirmed,
    shouldConfirmClose,
    callbackIntent,
    offTopic,
  };
};
