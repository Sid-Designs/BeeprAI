import KnowledgeBase from "../../models/knowledgeBase.model.js";
import { embedQuery } from "./embedding.service.js";

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (!magA || !magB) return 0;
  return dot / (magA * magB);
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "by",
  "as",
  "at",
  "from",
  "that",
  "this",
  "it",
  "you",
  "your",
  "what",
  "how",
]);

const COURSE_TERMS = ["mca", "pgdm", "mms", "mba", "bba", "bca", "bcom", "bsc"];

/** Common STT mis-hearings for MCA in admission calls. */
const STT_COURSE_CORRECTIONS = [
  { pattern: /\bHCA\b/gi, course: "MCA" },
  { pattern: /\bTGR\b/gi, course: "MCA" },
  { pattern: /\bHCL\b/gi, course: "MCA" },
  { pattern: /\bM\s*C\s*A\b/gi, course: "MCA" },
];

export const normalizeSpokenCourseTerms = (query = "") => {
  let text = String(query || "");
  for (const { pattern, course } of STT_COURSE_CORRECTIONS) {
    text = text.replace(pattern, course);
  }
  return text;
};

export const extractCourseFromQuery = (query = "") => {
  const lower = normalizeSpokenCourseTerms(query).toLowerCase();
  for (const course of COURSE_TERMS) {
    if (new RegExp(`\\b${course}\\b`, "i").test(lower)) return course;
  }
  return "";
};

export const isFeeQuery = (query = "") =>
  /\b(fees?|tuition|cost|price|pricing|charges?)\b/i.test(String(query || ""));

export const expandRetrievalQuery = (query = "", { course = "" } = {}) => {
  const normalizedQuery = normalizeSpokenCourseTerms(query);
  const parts = [String(normalizedQuery || "").trim()];
  const resolvedCourse =
    String(course || "").trim().toLowerCase() || extractCourseFromQuery(normalizedQuery);

  if (resolvedCourse && !String(query || "").toLowerCase().includes(resolvedCourse)) {
    parts.push(resolvedCourse.toUpperCase());
  }
  if (isFeeQuery(query)) {
    parts.push("tuition fee structure per year");
  }
  return parts.filter(Boolean).join(" ");
};

export const applyRetrievalBoosts = (query = "", item = {}, baseScore = 0) => {
  let score = Number(baseScore) || 0;
  const text = `${item.metadata?.heading || ""}\n${item.text || ""}`.toLowerCase();
  const course =
    String(item.courseHint || "").trim().toLowerCase() || extractCourseFromQuery(query);
  const feeQuery = isFeeQuery(query);
  const hasFeeSignal = /\b(fees?|tuition|cost|price|charges?|rs\.?|₹|lakh|per year)\b/i.test(
    text,
  );
  const hasProgramFeeSignal =
    /\b(tuition fee|fee per year|program cost|total approximate program cost)\b/i.test(text);

  if (feeQuery) {
    if (hasProgramFeeSignal) score += 0.18;
    else if (hasFeeSignal) score += 0.1;
    if (/\bapplication fee\b/i.test(text) && !hasProgramFeeSignal) score -= 0.12;
  }

  if (course) {
    if (text.includes(course)) score += 0.16;
    else score -= 0.12;
    if (feeQuery && text.includes(course) && hasFeeSignal) score += 0.22;
  }

  if (feeQuery && /\b(step \d+|group discussion|personal interview|documents? needed)\b/i.test(text)) {
    score -= 0.1;
  }

  return Math.min(1.25, Math.max(0, score));
};

const tokenize = (text) => {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
};

const keywordScore = (queryTokens, content) => {
  if (queryTokens.length === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let matches = 0;

  for (const token of queryTokens) {
    if (contentTokens.has(token)) matches += 1;
  }

  return matches / queryTokens.length;
};

const dedupeByContent = (items) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = item.text.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

const isNoisyContent = (content) => {
  const text = content.toLowerCase();
  const noisyPhrases = [
    "add to cart",
    "add to wishlist",
    "quick view",
    "sort by",
    "columns",
    "read more",
    "continue reading",
    "follow us",
  ];

  if (content.length < 40) return true;
  if (noisyPhrases.some((phrase) => text.includes(phrase))) return true;

  const alphaRatio = (content.match(/[a-z]/gi)?.length || 0) / content.length;
  return alphaRatio < 0.4;
};

export const retrieveContext = async (
  query,
  tenantId,
  agentId,
  options = {},
) => {
  const {
    topK = 5,
    minScore = 0.18,
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    maxCandidates = 400,
    courseHint = "",
  } = options;

  const expandedQuery = expandRetrievalQuery(query, { course: courseHint });
  const queryEmbedding = await embedQuery(expandedQuery);
  const queryTokens = tokenize(expandedQuery);
  const resolvedCourse =
    String(courseHint || "").trim().toLowerCase() || extractCourseFromQuery(query);

  const kbData = await KnowledgeBase.find({ tenantId, agentId })
    .select("text content embedding metadata sourceType sourceUrl docId")
    .limit(maxCandidates)
    .lean();

  const scored = kbData
    .map((item) => {
      const text = item.text || item.content || "";
      return {
        id: item._id?.toString?.() || undefined,
        text,
        metadata: item.metadata,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        docId: item.docId,
        score: cosineSimilarity(queryEmbedding, item.embedding),
        courseHint: resolvedCourse,
      };
    })
    .filter((item) => item.text && !isNoisyContent(item.text))
    .map((item) => {
      const keyword = keywordScore(queryTokens, item.text);
      const hybrid = item.score * semanticWeight + keyword * keywordWeight;
      const score = applyRetrievalBoosts(query, item, hybrid);
      return { ...item, score, keywordScore: keyword, semanticScore: item.score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return dedupeByContent(scored).slice(0, topK);
};
