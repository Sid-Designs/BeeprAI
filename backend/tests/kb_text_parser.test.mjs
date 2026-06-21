import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseTextDocument,
  splitPlainTextSections,
} from "../services/kb/parser.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(__dirname, "fixtures/met-institute-admissions-faq.txt");
const sampleText = readFileSync(samplePath, "utf8");

test("splitPlainTextSections breaks MET sample into focused sections", async () => {
  const sections = splitPlainTextSections(sampleText, "MET Admissions");
  assert.ok(sections.length >= 8);
  const mcaFees = sections.find((section) =>
    /mca program fees/i.test(`${section.heading}\n${section.content}`),
  );
  assert.ok(mcaFees, "expected dedicated MCA fee section");
  assert.match(mcaFees.content, /1,20,000/);
});

test("parseTextDocument preserves MCA fee section for chunking", async () => {
  const parsed = await parseTextDocument(sampleText, "MET Admissions");
  const feeSection = parsed.sections.find((section) =>
    /mca program fees/i.test(`${section.heading}\n${section.content}`),
  );
  assert.ok(feeSection);
  assert.match(feeSection.content, /1,20,000/);
  assert.doesNotMatch(feeSection.content, /step 7:/i);
});
