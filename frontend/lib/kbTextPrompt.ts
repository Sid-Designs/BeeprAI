import type { Agent } from "@/lib/types";

/** Same structure for every tenant — industry and agent only add context lines. */
const UNIVERSAL_SECTIONS = [
  "About the business — what the company does, in plain language",
  "Offerings — products, services, plans, or packages mentioned in the raw text",
  "Pricing and fees — amounts, currency, and payment terms (only if present in the raw text)",
  "How it works — steps to buy, book, apply, subscribe, or get started",
  "Requirements and policies — rules, eligibility, documents, or restrictions",
  "Practical details — hours, locations, areas served, timelines, and contact",
  "Frequently asked questions — Q: / A: pairs a caller might ask on the phone",
];

export type KbPromptContext = {
  agent?: Agent | null;
  /** Organization or business display name */
  orgName?: string;
  /** Tenant industry — hints vocabulary only, does not change the format */
  industry?: string;
  rawText?: string;
};

const resolveAgentPurpose = (agent?: Agent | null) => {
  const fromConfig =
    agent?.callConfig?.objective?.trim() ||
    agent?.callConfig?.primaryGoal?.trim() ||
    agent?.callConfig?.reasonForCalling?.trim();
  if (fromConfig) return fromConfig;

  switch (agent?.type) {
    case "appointment":
      return "Help callers learn about the business and book appointments or visits";
    case "sales":
      return "Answer questions and guide callers toward a purchase or next step";
    case "support":
      return "Answer caller questions and resolve common issues";
    default:
      return "Answer caller questions accurately using the business knowledge base";
  }
};

export const buildKbFormatPrompt = ({
  agent,
  orgName,
  industry,
  rawText = "",
}: KbPromptContext) => {
  const businessName = orgName?.trim() || agent?.name?.trim() || "the business";
  const industryLabel = industry?.trim() || "general";
  const agentPurpose = resolveAgentPurpose(agent);
  const contextHint = agent?.callConfig?.businessContext?.trim();
  const sectionList = UNIVERSAL_SECTIONS.map((s) => `- ${s}`).join("\n");

  const lines = [
    "You are formatting business knowledge for a voice AI phone agent.",
    "The business can be any industry (retail, healthcare, education, services, SaaS, etc.).",
    "Use ONLY facts found in the raw text below.",
    "Do NOT invent prices, dates, policies, features, or contact details.",
    "If something important is missing, write [MISSING: brief label] instead of guessing.",
    "",
    `Business name: ${businessName}`,
    `Industry (wording hint only): ${industryLabel}`,
    `What this phone agent should help with: ${agentPurpose}`,
    ...(contextHint ? [`Additional business context: ${contextHint}`] : []),
    "",
    "Formatting rules:",
    "- Group content under clear section headings.",
    "- Use short bullets or Q: / A: pairs suitable for spoken phone answers.",
    "- Keep each answer to 1–3 sentences.",
    "- Put numbers, prices, dates, and phone numbers on their own lines.",
    "- Add common spoken aliases if the raw text implies them (abbreviations, alternate names).",
    "- Remove website menus, ads, and filler — keep factual content only.",
    "",
    "Use this section outline (omit sections that do not apply to the raw text):",
    sectionList,
    "",
    "Return only the formatted knowledge text — no preamble or commentary.",
    "",
    "--- RAW TEXT TO FORMAT ---",
    rawText.trim() || "[Paste your raw notes here before sending to ChatGPT]",
  ];

  return lines.join("\n");
};
