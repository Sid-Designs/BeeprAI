const formatMeta = (meta = {}) => {
  const mask = (value) => {
    const str = String(value ?? "");
    return str
      .replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})\b/gi, "***@$2")
      .replace(/\b\d{10,15}\b/g, (m) => `${m.slice(0, 2)}******${m.slice(-2)}`);
  };
  const entries = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${mask(value)}`);
  return entries.length ? ` ${entries.join(" ")}` : "";
};

export const logInfo = (message, meta) => {
  console.log(`${message}${formatMeta(meta)}`);
};

export const logWarn = (message, meta) => {
  console.warn(`${message}${formatMeta(meta)}`);
};

export const logError = (message, meta) => {
  console.error(`${message}${formatMeta(meta)}`);
};
