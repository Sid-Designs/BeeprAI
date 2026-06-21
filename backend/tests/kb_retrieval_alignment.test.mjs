import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const controllerPath = path.resolve("controllers/ai.controller.js");
const controllerSource = readFileSync(controllerPath, "utf8");

test("KB retrieval minScore uses KB_CONFIDENCE_MIN gate value", () => {
  assert.match(controllerSource, /minScore:\s*KB_CONFIDENCE_MIN/);
  assert.doesNotMatch(controllerSource, /minScore:\s*0\.35/);
});

test("KB_CONFIDENCE_MIN defaults to 0.55 in controller", () => {
  assert.match(controllerSource, /KB_CONFIDENCE_MIN\s*=\s*Number\.parseFloat\(process\.env\.KB_CONFIDENCE_MIN \|\| "0\.55"\)/);
});
