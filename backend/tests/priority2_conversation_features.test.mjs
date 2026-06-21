import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLeadIntent,
  computeLeadStatus,
  detectConversationSignals,
  extractLeadDataFromQuery,
} from "../services/callPolicy.service.js";
import {
  detectLanguageProfile,
  getInitialLanguageState,
  resolveLanguageConfig,
} from "../services/language.service.js";

test("semantic extraction captures masters intent and specialization", () => {
  const extracted = extractLeadDataFromQuery("I'm thinking of doing my Masters in tech next year");
  assert.equal(extracted.course, "Masters");
  assert.equal(extracted.timeline, "next year");
  assert.match(extracted.specialization, /tech/i);
});

test("semantic extraction captures parent influence", () => {
  const extracted = extractLeadDataFromQuery("My mother wants me to apply for B.Com");
  assert.equal(extracted.course, "BCOM");
  assert.equal(extracted.decision_maker, "mother");
  assert.equal(extracted.user_role, "influenced");
});

test("semantic extraction handles spaced course transcripts", () => {
  const extracted = extractLeadDataFromQuery("I am interested in B C A for next year");
  assert.equal(extracted.course, "BCA");
  assert.equal(extracted.timeline, "next year");
});

test("call me later is callback intent, not a generic phone request", () => {
  const signals = detectConversationSignals("Hey, can you call me later?");
  assert.equal(signals.callbackIntent, true);
});

test("appointment typo is captured as appointment request", () => {
  const extracted = extractLeadDataFromQuery("Can you book aapointment for me");
  assert.equal(extracted.interest, "appointment");
  assert.equal(extracted.appointmentRequested, true);
});

test("appointment request captures natural date and time", () => {
  const extracted = extractLeadDataFromQuery("Book appointment 12th june Tommorrow around 1pm");
  assert.equal(extracted.appointmentRequested, true);
  assert.equal(extracted.preferred_date, "12th june");
  assert.equal(extracted.timeline, "tomorrow");
  assert.equal(extracted.preferred_time, "1pm");
});

test("appointment typo does not switch language to Hindi", () => {
  const languageConfig = resolveLanguageConfig({
    languageConfig: {
      startLanguage: "en",
      allowedLanguages: ["en", "hi", "mr"],
    },
  });
  const result = detectLanguageProfile({
    query: "Can you book aapointment for me",
    previousState: getInitialLanguageState(languageConfig),
    languageConfig,
  });
  assert.equal(result.dominantLanguage, "en");
  assert.equal(result.mixLevel, "low");
});

test("mid-call Hindi romanized switches dominant language", () => {
  const languageConfig = resolveLanguageConfig({
    languageConfig: {
      startLanguage: "en",
      allowedLanguages: ["en", "hi", "mr"],
    },
  });
  const englishState = getInitialLanguageState(languageConfig);
  const result = detectLanguageProfile({
    query: "Haan mujhe admission ki information chahiye",
    previousState: englishState,
    languageConfig,
  });
  assert.equal(result.dominantLanguage, "hi");
  assert.ok(result.lockTurnsRemaining >= 3);
});

test("mid-call Marathi devanagari switches dominant language", () => {
  const languageConfig = resolveLanguageConfig({
    languageConfig: {
      startLanguage: "en",
      allowedLanguages: ["en", "hi", "mr"],
    },
  });
  const result = detectLanguageProfile({
    query: "मला उद्या कॉल करा",
    previousState: getInitialLanguageState(languageConfig),
    languageConfig,
  });
  assert.equal(result.dominantLanguage, "mr");
});

test("intent analyzer marks strong commitment as hot lead", () => {
  const signals = detectConversationSignals("I definitely want to enroll now");
  const intentProfile = analyzeLeadIntent({
    query: "I definitely want to enroll now",
    signals,
    collectedData: { course: "MBA" },
  });
  assert.equal(intentProfile.label, "hot_lead");
  assert.ok(intentProfile.commitmentScore >= 80);
});

test("intent analyzer marks maybe as lukewarm", () => {
  const signals = detectConversationSignals("Maybe, I am just exploring options");
  const intentProfile = analyzeLeadIntent({
    query: "Maybe, I am just exploring options",
    signals,
    collectedData: {},
  });
  assert.equal(intentProfile.label, "lukewarm_lead");
});

test("lead status uses intent profile to promote interested leads", () => {
  const signals = detectConversationSignals("Tell me more about MBA fees");
  const intentProfile = analyzeLeadIntent({
    query: "Tell me more about MBA fees",
    signals,
    collectedData: { course: "MBA", interest: "fees" },
  });
  const leadStatus = computeLeadStatus({
    currentStatus: "new",
    signals,
    collectedData: { course: "MBA", interest: "fees" },
    intentProfile,
    objective: "lead_generation",
  });
  assert.equal(leadStatus, "interested");
});
