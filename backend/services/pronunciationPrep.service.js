/**
 * Text prep for Sarvam TTS — spelling fixes only, no pitch/speed changes.
 * For persistent custom words, set SARVAM_TTS_DICT_ID from Sarvam pronunciation dictionary API.
 */

const DEVANAGARI_RE = /[\u0900-\u097F]/;

const REPLACEMENTS = [
  { pattern: /\bMET\s+Institute\b/gi, replacement: "Met Institute" },
  { pattern: /\bM\.E\.T\.\s+Institute\b/gi, replacement: "Met Institute" },
  { pattern: /\bM\.E\.T\.\b/g, replacement: "Met" },
  { pattern: /\bMET\b/g, replacement: "Met" },
  { pattern: /\bMCA\b/g, replacement: "M.C.A." },
  { pattern: /\bMBA\b/g, replacement: "M.B.A." },
  { pattern: /\bBCA\b/g, replacement: "B.C.A." },
  { pattern: /\bBBA\b/g, replacement: "B.B.A." },
];

export const prepareTextForTTS = (text = "", language = "en") => {
  let value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";

  for (const { pattern, replacement } of REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  if (DEVANAGARI_RE.test(value)) {
    return value;
  }

  return value;
};
