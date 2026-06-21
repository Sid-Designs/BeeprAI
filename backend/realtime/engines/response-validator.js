const FILLER_RE = /\b(um+|uh+|like\s+you\s+know|basically|actually)\b/i;

export class ResponseValidator {
  validate({ response, state, memory, objective }) {
    const text = String(response || "").trim();
    if (!text) return { ok: false, reason: "empty" };

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 25) return { ok: false, reason: "too_long" };
    if (FILLER_RE.test(text)) return { ok: false, reason: "filler_phrase" };

    if (String(memory?.lastQuestion || "").toLowerCase() === text.toLowerCase()) {
      return { ok: false, reason: "repeated_question" };
    }

    if (!state?.currentState || !objective) return { ok: false, reason: "missing_context" };

    return { ok: true, reason: "valid" };
  }
}

export const responseValidator = new ResponseValidator();
