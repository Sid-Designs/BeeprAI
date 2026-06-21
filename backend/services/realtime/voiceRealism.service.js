const clean = (value, max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const shapeVoiceFriendlyText = (text = "", { style = "balanced" } = {}) => {
  const value = clean(text, 900);
  if (!value) return "";

  let next = value
    .replace(/\bi am\b/gi, "I'm")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bi will\b/gi, "I'll");

  if (style === "explain") {
    next = next.replace(/\. /g, ", and ");
  }

  if (!/[.!?]$/.test(next)) {
    next = `${next}.`;
  }

  return next;
};

