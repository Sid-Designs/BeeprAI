export const int16ToBase64 = (int16Array) => {
  const buffer = Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  return buffer.toString("base64");
};

export const base64ToInt16 = (value = "") => {
  const buffer = Buffer.from(String(value || ""), "base64");
  return new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
};

export const concatInt16 = (chunks = []) => {
  const totalLength = chunks.reduce((sum, item) => sum + (item?.length || 0), 0);
  const out = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    if (!chunk || !chunk.length) continue;
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

export const rms = (samples = new Int16Array(0)) => {
  if (!samples.length) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = samples[i] / 32768;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
};

