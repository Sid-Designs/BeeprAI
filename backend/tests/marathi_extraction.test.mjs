import test from "node:test";
import assert from "node:assert/strict";
import { extractLeadData } from "../services/conversation/dataExtraction.service.js";
import { extractIndicDateTime, CALLBACK_INDIC_RE, extractEnglishClockTime } from "../services/conversation/indicDateTime.service.js";
import { evaluateBookingProgress, isBookingAffirmation } from "../services/conversation/bookingFlow.service.js";
import { buildConversationDirective } from "../services/conversation/conversationDirector.service.js";
import { prepareTextForTTS } from "../services/pronunciationPrep.service.js";

test("extracts Marathi tomorrow and time", () => {
  const data = extractLeadData("उद्या दोन वाजता");
  assert.equal(data.preferred_date, "tomorrow");
  assert.equal(data.preferred_time, "2 pm");
});

test("extracts 3 PM from mixed transcript", () => {
  const data = extractLeadData("हराव. 3 PM");
  assert.equal(data.preferred_time, "3 pm");
});

test("extractEnglishClockTime ignores :00 am fragment from 11:00 AM", () => {
  assert.equal(extractEnglishClockTime("11:00 AM 11 A"), "11:00 am");
  const data = extractIndicDateTime("Tomorrow 11:00 AM Yeah confirm");
  assert.equal(data.preferred_time, "11:00 am");
});

test("isBookingAffirmation accepts confirm in middle of sentence", () => {
  assert.equal(isBookingAffirmation("Tomorrow 11 AM Yeah, confirm that"), true);
});

test("detects callback request in Marathi", () => {
  assert.equal(CALLBACK_INDIC_RE.test("तुम्ही मला नंतर कॉल करू शकता."), true);
  const data = extractIndicDateTime("तुम्ही मला नंतर कॉल करू शकता");
  assert.equal(data.callbackRequested, true);
});

test("booking progress completes with accumulated Marathi slots", () => {
  const progress = evaluateBookingProgress({
    collectedData: { preferred_date: "tomorrow" },
    extractedData: extractLeadData("3 PM"),
    query: "3 PM",
    policy: { objective: "appointment_booking" },
  });
  assert.equal(progress.hasDate, true);
  assert.equal(progress.hasTime, true);
  assert.equal(progress.nextSlot, "name");
});

test("compound admission+booking query answers first", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation" },
    state: { stage: "qualification", greeted: true, turnCount: 2, intentStatus: "resolved" },
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    signals: {},
    query: "Can you tell me some detail about admission and then book appointment for a counselor?",
    extractedData: {},
  });
  assert.equal(directive.action, "answer_then_steer");
  assert.notEqual(directive.action, "appointment_booking");
});

test("MET Institute is spelled for clearer TTS", () => {
  const text = prepareTextForTTS("Hello from MET Institute about MCA");
  assert.match(text, /M\.E\.T\. Institute/);
  assert.match(text, /M\.C\.A\./);
});
