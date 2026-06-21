import axios from "axios";
import * as cheerio from "cheerio";
import { extractTextFromPDF } from "../pdf.service.js";

const cleanText = (text) => {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizePlainText = (text) =>
  String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .trim();

const isSectionHeading = (line) => {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.length > 120) return false;

  if (
    /^(programs offered|eligibility criteria|entrance examinations|admission process|important admission dates|fee structure|program highlights|scholarships|placements|campus facilities|contact|frequently asked questions)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (/^(mca|pgdm|mms|mba)\b/i.test(trimmed)) return true;
  if (/^(mca|pgdm|mms|mba)\s+program\s+fees\b/i.test(trimmed)) return true;
  if (/^q:\s/i.test(trimmed)) return true;
  if (/^step\s+\d+:/i.test(trimmed)) return true;
  if (/^[A-Z0-9][A-Za-z0-9\s/&—–-]+:\s*$/.test(trimmed)) return true;

  return (
    trimmed.length <= 72 &&
    !/[.!?]$/.test(trimmed) &&
    /^[A-Z][A-Za-z0-9\s/&—–-]+$/.test(trimmed)
  );
};

export const splitPlainTextSections = (text, titleOverride = "Document") => {
  const normalized = normalizePlainText(text);
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections = [];
  let current = {
    heading: titleOverride,
    content: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isSectionHeading(trimmed)) {
      if (current.content.length) {
        sections.push({
          heading: current.heading,
          content: current.content.join("\n").trim(),
        });
      }
      current = {
        heading: trimmed.replace(/:$/, "").trim(),
        content: [],
      };
      continue;
    }

    current.content.push(trimmed);
  }

  if (current.content.length) {
    sections.push({
      heading: current.heading,
      content: current.content.join("\n").trim(),
    });
  }

  return sections.filter((section) => section.content);
};

const buildSectionsFromHtml = ($, title) => {
  const sections = [];
  let current = {
    heading: title || "Document",
    content: "",
  };

  const nodes = $("h1, h2, h3, p, li").toArray();

  for (const node of nodes) {
    const $node = $(node);
    const tag = node.tagName?.toLowerCase();
    const text = cleanText($node.text());

    if (!text) continue;

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      if (current.content.trim()) {
        sections.push({
          heading: current.heading,
          content: current.content.trim(),
        });
      }
      current = {
        heading: text,
        content: "",
      };
      continue;
    }

    if (current.content) {
      current.content += `\n${text}`;
    } else {
      current.content = text;
    }
  }

  if (current.content.trim()) {
    sections.push({
      heading: current.heading,
      content: current.content.trim(),
    });
  }

  if (sections.length === 0) {
    const fallback = cleanText($("body").text());
    if (fallback) {
      sections.push({ heading: title || "Document", content: fallback });
    }
  }

  return sections;
};

export const parsePdfDocument = async (filePath, titleOverride = "") => {
  const text = cleanText(await extractTextFromPDF(filePath));

  return {
    title: titleOverride || "PDF Document",
    sections: text
      ? [{ heading: titleOverride || "PDF Document", content: text }]
      : [],
  };
};

export const parseUrlDocument = async (url) => {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  $("script, style, noscript, iframe, header, footer, nav, svg").remove();

  const title = cleanText($("title").text());
  const sections = buildSectionsFromHtml($, title || url);

  return { title: title || url, sections };
};

export const parseTextDocument = async (text, titleOverride = "Document") => {
  const sections = splitPlainTextSections(text, titleOverride);
  if (sections.length) {
    return { title: titleOverride, sections };
  }

  const cleaned = cleanText(text);
  return {
    title: titleOverride,
    sections: cleaned ? [{ heading: titleOverride, content: cleaned }] : [],
  };
};
