const CONFUSION_RE = /\b(confused|didn't get|dont understand|not clear|again)\b/i;
const FRUSTRATION_RE = /\b(frustrat|wasting|hurry|quick|stop repeating)\b/i;
const EXCITEMENT_RE = /\b(great|awesome|perfect|nice|sounds good)\b/i;
const HESITATION_RE = /\b(maybe|not sure|let me think|later)\b/i;

export const detectEmotion = (text = "") => {
  const value = String(text || "");
  if (FRUSTRATION_RE.test(value)) return "frustrated";
  if (CONFUSION_RE.test(value)) return "confused";
  if (HESITATION_RE.test(value)) return "hesitant";
  if (EXCITEMENT_RE.test(value)) return "excited";
  return "neutral";
};

export const adaptByEmotion = ({ emotion = "neutral", constraints = {} } = {}) => {
  if (emotion === "confused") return { ...constraints, maxWords: 14, tone: "simple", askFollowUp: true };
  if (emotion === "frustrated") return { ...constraints, maxWords: 12, tone: "calm", askFollowUp: false };
  if (emotion === "hesitant") return { ...constraints, maxWords: 16, tone: "supportive", askFollowUp: true };
  if (emotion === "excited") return { ...constraints, maxWords: 20, tone: "warm", askFollowUp: true };
  return constraints;
};

