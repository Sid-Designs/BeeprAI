import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRetrievalBoosts,
  expandRetrievalQuery,
  extractCourseFromQuery,
  isFeeQuery,
} from "../services/kb/retrieval.service.js";
import { buildQueryResolutionAnswer } from "../services/conversation/queryResolution.service.js";

test("extractCourseFromQuery and isFeeQuery detect MCA fee questions", () => {
  assert.equal(extractCourseFromQuery("What are the MCA fees?"), "mca");
  assert.equal(isFeeQuery("What are the MCA fees?"), true);
});

test("expandRetrievalQuery adds course and tuition hints", () => {
  const expanded = expandRetrievalQuery("What are the fees?", { course: "MCA" });
  assert.match(expanded, /MCA/i);
  assert.match(expanded, /tuition fee structure/i);
});

test("applyRetrievalBoosts prefers MCA tuition chunk over admission steps", () => {
  const mcaFees = {
    text: "MCA Program Fees: Tuition fee per year approximately Rs. 1,20,000.",
    metadata: { heading: "MCA Program Fees" },
  };
  const admissionSteps = {
    text: "Step 4: Pay the application fee (non-refundable) — currently Rs. 1,500 for most programs.",
    metadata: { heading: "Admission Process" },
  };

  const boostedMca = applyRetrievalBoosts("What are the MCA fees?", mcaFees, 0.42);
  const boostedAdmission = applyRetrievalBoosts(
    "What are the MCA fees?",
    admissionSteps,
    0.44,
  );

  assert.ok(boostedMca > boostedAdmission);
});

test("buildQueryResolutionAnswer picks MCA fee line from mixed KB context", () => {
  const kbContext = [
    "Step 4: Pay the application fee (non-refundable) — currently Rs. 1,500 for most programs.",
    "MCA Program Fees: Tuition fee per year: approximately Rs. 1,20,000.",
    "PGDM Program: Tuition fee per year: approximately Rs. 2,40,000.",
  ].join("\n");

  const response = buildQueryResolutionAnswer({
    kbContext,
    query: "What are the MCA fees?",
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
  });

  assert.match(response, /1,20,000|1\.2 lakh/i);
  assert.doesNotMatch(response, /1,500/);
});
