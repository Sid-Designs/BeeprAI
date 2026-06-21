import type { AgentType } from "@/lib/types";

/**
 * These options MIRROR the backend agent configuration in
 * `backend/config/agents.js` (getAgentConfig + AGENT_DEFAULTS).
 * Tone values MUST stay lowercase and within each type's whitelist,
 * otherwise the backend rejects creation with "Tone not allowed for type".
 */

export const AGENT_TYPE_OPTIONS: { value: AgentType; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "appointment", label: "Appointment" },
  { value: "custom", label: "Custom" },
];

export const TONE_OPTIONS: Record<AgentType, string[]> = {
  support: ["neutral", "friendly", "empathetic"],
  appointment: ["neutral", "friendly", "formal", "empathetic"],
  sales: ["neutral", "friendly", "formal", "persuasive"],
  // custom has no whitelist on the backend; offer the full union.
  custom: ["neutral", "friendly", "formal", "empathetic", "persuasive"],
};

export const DEFAULT_TONE: Record<AgentType, string> = {
  support: "friendly",
  appointment: "formal",
  sales: "friendly",
  custom: "neutral",
};

export function toneLabel(tone: string): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

export function isAgentType(value: string): value is AgentType {
  return value === "sales" || value === "support" || value === "appointment" || value === "custom";
}
