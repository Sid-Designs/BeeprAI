#!/usr/bin/env node
/**
 * CLI simulator for the intent-driven conversation pipeline.
 * Usage: node scripts/simulate-intent-call.mjs
 *        node scripts/simulate-intent-call.mjs "I want MCA admission" "Yes" "What are the fees?"
 */

import { getInitialConversationState } from "../services/callPolicy.service.js";
import { detectConversationSignals, extractLeadDataFromQuery, mergeCollectedData, analyzeLeadIntent } from "../services/callPolicy.service.js";
import {
  accumulateUserIntent,
  detectUserIntent,
} from "../services/conversation/userIntent.service.js";
import {
  buildBookingReadinessProbe,
  buildClarifyIntentReply,
  buildConversationDirective,
  buildIntentDiscoveryReply,
  buildIntentMenuReply,
  buildSlotCollectionReply,
  buildBookingDeclinedReply,
} from "../services/conversation/conversationDirector.service.js";
import { composeQueryResolutionResponse } from "../services/conversation/queryResolution.service.js";
import {
  buildAnythingElsePrompt,
  buildGracefulCloseReply,
} from "../services/conversation/callClosure.service.js";
import {
  resolveBookingTurn,
} from "../services/conversation/bookingFlow.service.js";

const DEFAULT_TURNS = [
  "I want MCA admission information",
  "Yes",
  "What are the MCA fees?",
  "Yes please",
  "Tomorrow at 3pm",
  "My name is Rahul",
  "Yes confirm",
];

const policy = {
  objective: "appointment_booking",
  qualificationFields: ["preferred_date", "preferred_time", "name"],
  orgName: "Beepr Admissions",
};

const resolveTurn = ({
  state,
  query,
  kbContext = "MCA fees are approximately 1.2 lakh per year.",
}) => {
  const signals = detectConversationSignals(query);
  const extractedData = extractLeadDataFromQuery(query);
  const intentProfile = analyzeLeadIntent({
    query,
    signals,
    collectedData: { ...state.collectedData, ...extractedData },
  });

  const userIntent = accumulateUserIntent(
    state.userIntent,
    detectUserIntent({
      query,
      signals,
      previousIntent: state.userIntent,
      collectedData: { ...state.collectedData, ...extractedData },
      turnCount: state.turnCount || 0,
    }),
  );

  state = { ...state, userIntent };
  const turnDirective = buildConversationDirective({
    policy,
    state,
    userIntent,
    signals,
    query,
    extractedData,
    intentProfile,
  });

  if (turnDirective.bookingReadiness) {
    state.bookingReadiness = turnDirective.bookingReadiness;
  }
  if (turnDirective.returnStage) {
    state.returnStage = turnDirective.returnStage;
  }

  const action = turnDirective.action;
  let answer = "";
  let stage = turnDirective.stage || state.stage;

  if (action === "intent_discovery_reply") {
    answer = buildIntentDiscoveryReply({ userIntent, collectedData: extractedData, policy });
    state.intentStatus = "resolved";
    state.intentResolvedAtTurn = (state.turnCount || 0) + 1;
    if (state.callStartedAt) {
      state.intentResolutionMs = Date.now() - state.callStartedAt;
    }
    stage = "intent_discovery";
  } else if (action === "clarify_intent") {
    answer = buildClarifyIntentReply({ policy });
    stage = "intent_discovery";
  } else if (action === "intent_menu") {
    answer = buildIntentMenuReply({ collectedData: extractedData, userIntent });
    state.intentStatus = "resolved";
    stage = "qualification";
  } else if (action === "collect_slot") {
    answer = buildSlotCollectionReply(turnDirective.nextSlot);
    stage = "information_collection";
  } else if (action === "probe_booking_readiness") {
    answer = buildBookingReadinessProbe({});
    stage = "booking_readiness";
    state.bookingReadiness = "probing";
  } else if (action === "answer_then_steer") {
    answer = composeQueryResolutionResponse({
      kbContext,
      query,
      userIntent,
      policy,
      bookingReadiness: state.bookingReadiness,
    });
    stage = "query_resolution";
    state.returnStage = turnDirective.returnStage || state.returnStage;
  } else if (action === "booking_declined") {
    answer = buildBookingDeclinedReply({});
    stage = turnDirective.stage || "qualification";
    state.bookingReadiness = "declined";
  } else if (action === "offer_close") {
    answer = buildAnythingElsePrompt({});
    stage = "closing";
    state.closeOffered = true;
  } else if (action === "graceful_close") {
    answer = buildGracefulCloseReply({ reason: turnDirective.endReason, orgName: policy.orgName });
    stage = "closing";
    state.endCall = true;
    state.endReason = turnDirective.endReason || "conversation_closed";
  } else if (action === "appointment_booking" || action === "complete_booking") {
    const booking = resolveBookingTurn({
      state,
      extractedData,
      query,
      policy,
      intentProfile,
      mergeCollectedDataFn: mergeCollectedData,
    });
    answer = booking.answer;
    state = booking.nextState;
    stage = booking.stage;
    if (booking.endCall) state.endCall = true;
  } else {
    answer = `[LLM fallback for action=${action}]`;
    state = {
      ...state,
      turnCount: (state.turnCount || 0) + 1,
      collectedData: mergeCollectedData(state.collectedData, extractedData),
    };
    return { state, answer, action, stage, userIntent };
  }

  state = {
    ...state,
    stage,
    turnCount: (state.turnCount || 0) + 1,
    collectedData: mergeCollectedData(state.collectedData, extractedData),
  };

  return { state, answer, action, stage, userIntent };
};

const turns = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TURNS;

let state = getInitialConversationState(policy);
state.callStartedAt = Date.now();

console.log("=== Beepr Intent Pipeline Simulator ===\n");
console.log(`Policy objective: ${policy.objective}\n`);

for (const query of turns) {
  console.log(`User: ${query}`);
  const result = resolveTurn({ state, query });
  state = result.state;
  console.log(`AI:   ${result.answer}`);
  console.log(
    `     [intent=${result.userIntent.intent}@${result.userIntent.confidence}, action=${result.action}, stage=${result.stage}, booking=${state.bookingReadiness || "not_asked"}]`,
  );
  if (state.intentResolutionMs) {
    console.log(`     [intentResolutionMs=${state.intentResolutionMs}]`);
  }
  if (state.endCall) {
    console.log(`     [CALL ENDED reason=${state.endReason || "conversation_closed"}]`);
  }
  console.log("");
  if (state.endCall) break;
}

console.log("=== Done ===");
