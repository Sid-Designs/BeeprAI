/**
 * Platform telephony — shared Vobiz account for all tenants (MVP).
 * Per-tenant numbers can be added later via CallRoute.
 */

const normalizeDigits = (value = "") => String(value || "").replace(/\D+/g, "");

export const VOBIZ_DEFAULT_CALLER_NUMBER = normalizeDigits(
  process.env.VOBIZ_DEFAULT_CALLER_NUMBER || process.env.VOBIZ_CALLER_NUMBER || "",
);

export const resolvePlatformCallerNumber = (requested = "") => {
  const explicit = normalizeDigits(requested);
  if (explicit) return explicit;
  if (VOBIZ_DEFAULT_CALLER_NUMBER) return VOBIZ_DEFAULT_CALLER_NUMBER;
  return "";
};

export const getTelephonyConfig = () => ({
  provider: "vobiz",
  bridgeMode: String(process.env.VOBIZ_BRIDGE_MODE || "voice_app").toLowerCase(),
  defaultCallerNumber: VOBIZ_DEFAULT_CALLER_NUMBER,
  callerNumberConfigurable: false,
  configured: Boolean(VOBIZ_DEFAULT_CALLER_NUMBER),
});
