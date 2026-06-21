const clean = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const packSentences = (sentences = [], targetChars = 180) => {
  const chunks = [];
  let current = "";
  for (const sentence of sentences.map((s) => clean(s)).filter(Boolean)) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= targetChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = sentence;
  }
  if (current) chunks.push(current);
  return chunks;
};

export const splitSemanticChunks = (text = "", targetChars = 180) => {
  const value = clean(text);
  if (!value) return [];
  const sentences = value.match(/[^.!?]+[.!?]?/g) || [value];
  return packSentences(sentences, targetChars);
};

/** Smaller first chunk = faster time-to-first-audio on live calls. */
export const splitSemanticChunksWithFastStart = (
  text = "",
  firstChunkChars = 90,
  restChunkChars = 180,
) => {
  const value = clean(text);
  if (!value) return [];
  if (value.length <= firstChunkChars) return [value];

  const sentences = value.match(/[^.!?]+[.!?]?/g) || [value];
  const firstChunks = packSentences(sentences, firstChunkChars);
  if (!firstChunks.length) return [value];

  const first = firstChunks[0];
  if (firstChunks.length === 1 && first.length <= restChunkChars) {
    return [first];
  }

  const remainder = value.slice(first.length).trim();
  const tail = remainder ? splitSemanticChunks(remainder, restChunkChars) : firstChunks.slice(1);
  return [first, ...tail].filter(Boolean);
};

export const isCompleteThought = (text = "") => {
  const value = clean(text);
  if (!value) return false;
  if (/[.!?]$/.test(value)) return true;
  return value.split(" ").length >= 7;
};

