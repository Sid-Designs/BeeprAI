import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlatformCallerNumber,
  VOBIZ_DEFAULT_CALLER_NUMBER,
} from "../config/telephony.js";

test("resolvePlatformCallerNumber uses explicit caller when provided", () => {
  assert.equal(resolvePlatformCallerNumber("919876543210"), "919876543210");
});

test("resolvePlatformCallerNumber falls back to platform default", () => {
  const resolved = resolvePlatformCallerNumber("");
  if (VOBIZ_DEFAULT_CALLER_NUMBER) {
    assert.equal(resolved, VOBIZ_DEFAULT_CALLER_NUMBER);
  } else {
    assert.equal(resolved, "");
  }
});
