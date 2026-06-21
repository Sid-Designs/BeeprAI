export class EmotionEngine {
  infer(text = "") {
    const t = String(text).toLowerCase();
    if (/\b(angry|frustrated|upset|waste|annoyed)\b/.test(t)) return "frustrated";
    if (/\b(urgent|asap|immediately|now)\b/.test(t)) return "urgent";
    if (/\b(great|interested|sounds good|yes)\b/.test(t)) return "interested";
    if (/\b(confused|not clear|don't understand)\b/.test(t)) return "confused";
    return "neutral";
  }
}

export const emotionEngine = new EmotionEngine();
