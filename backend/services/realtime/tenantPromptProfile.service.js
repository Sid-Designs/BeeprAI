import Tenant from "../../models/tenant.model.js";
import Agent from "../../models/agent.model.js";

const clean = (value, max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const buildMasterInstruction = ({
  agentName,
  orgName,
  roleType,
  tone,
  objective,
  primaryGoal,
  reasonForCalling,
  businessContext,
  language,
}) =>
  [
    `You are ${agentName} from ${orgName}.`,
    `Role type: ${roleType}.`,
    `Tone: ${tone}.`,
    `Primary objective: ${objective}.`,
    `Primary call intent: ${primaryGoal}.`,
    `Reason for calling: ${reasonForCalling}.`,
    `Business context: ${businessContext || "No extra context."}`,
    `Language mirroring: Start in ${language}. Mirror caller language naturally; switch only when caller switches.`,
    "Memory usage: Use known memory only when consistent with this call. Never pretend uncertain memory is confirmed.",
    "Knowledge grounding: Use knowledge base and provided business context only for factual details. Never hallucinate fees, dates, policies, availability, eligibility, or offers.",
    "Unknown KB answer rule: If exact detail is missing, say you do not have that exact detail and offer the best next step.",
    "Human speech style: Natural and clear. Ask one question at a time. Avoid robotic phrases and repeated intros.",
    "Interruption handling: If interrupted, stop immediately and answer the latest caller intent.",
    "Off-topic recovery: Briefly acknowledge off-topic comments, answer briefly if business-related, then redirect to primary call intent.",
    "Intent policy: Keep one active primary intent state: pending -> in_progress -> completed -> closing_confirmed, or abandoned.",
    "Do not switch primary intent unless caller clearly corrects call purpose.",
    "Consent-based closing: Never end only because objective completed or caller says thanks once.",
    "After objective completion, ask: Is there anything else I can help you with before we close?",
    "End only on clear consent (no, nothing else, that's all, bye) or explicit hard-close request (hang up, end the call, do not call me).",
    "Never claim actions completed unless explicitly done in this system.",
  ].join("\n");

export const loadTenantPromptProfile = async ({ tenantId, agentId }) => {
  const [tenant, agent] = await Promise.all([
    Tenant.findById(tenantId).lean(),
    Agent.findById(agentId).lean(),
  ]);

  if (!tenant || !agent) {
    throw new Error("Tenant or agent not found for realtime session.");
  }

  const language = clean(agent?.callConfig?.languageConfig?.startLanguage || "en", 20).toLowerCase();
  const tone = clean(agent?.tone || agent?.callConfig?.personaConfig?.tone || "professional", 60);
  const objective = clean(agent?.callConfig?.objective || "custom", 80);
  const primaryGoal = clean(agent?.callConfig?.primaryGoal || objective, 220);
  const reasonForCalling = clean(agent?.callConfig?.reasonForCalling || "assist the caller", 220);
  const businessContext = clean(agent?.callConfig?.businessContext || agent?.script || "", 1400);
  const instruction = buildMasterInstruction({
    agentName: clean(agent?.name || "AI assistant", 100),
    orgName: clean(tenant.orgName, 120),
    roleType: clean(agent?.type || "assistant", 50),
    tone,
    objective,
    primaryGoal,
    reasonForCalling,
    businessContext,
    language,
  });

  return {
    tenant,
    agent,
    language,
    tone,
    objective,
    primaryGoal,
    reasonForCalling,
    businessContext,
    instruction,
    voice: process.env.OPENAI_REALTIME_VOICE || "alloy",
  };
};
