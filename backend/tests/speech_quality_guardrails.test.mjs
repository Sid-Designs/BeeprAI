import test from "node:test";
import assert from "node:assert/strict";
import { enforcePolicyOnAnswer } from "../services/policy/dialoguePolicyEngine.service.js";

test("enforcePolicyOnAnswer removes dangling endings", () => {
  const result = enforcePolicyOnAnswer(
    "Perfect. Absolutely. The usual process starts from the Enquire option or the.",
    { maxWords: 40 },
  );
  assert.equal(/\bor the\.?$/i.test(result), false);
  assert.equal(/\bthe\.?$/i.test(result), false);
});

test("enforcePolicyOnAnswer truncates by full sentences when possible", () => {
  const result = enforcePolicyOnAnswer(
    "Step one is create your profile. Step two is upload documents. Step three is fee payment.",
    { maxWords: 9 },
  );
  assert.match(result, /profile\./i);
  assert.equal(/documents\./i.test(result), false);
});

