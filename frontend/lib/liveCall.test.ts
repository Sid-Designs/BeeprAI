import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStageMilestones,
  getLiveCallPollInterval,
  isLiveCallPollingEnabled,
  labelLeadStatus,
  resolveStageMilestoneIndex,
} from "./liveCall.ts";

test("resolveStageMilestoneIndex maps conversation stages to timeline positions", () => {
  assert.equal(resolveStageMilestoneIndex("opening"), 0);
  assert.equal(resolveStageMilestoneIndex("intent_discovery"), 1);
  assert.equal(resolveStageMilestoneIndex("qualification"), 2);
  assert.equal(resolveStageMilestoneIndex("appointment_booking"), 3);
  assert.equal(resolveStageMilestoneIndex("closing"), 4);
  assert.equal(resolveStageMilestoneIndex("completed"), 5);
  assert.equal(resolveStageMilestoneIndex("query_resolution"), 2);
});

test("buildStageMilestones marks current and completed milestones", () => {
  const milestones = buildStageMilestones("qualification");

  assert.equal(milestones.length, 6);
  assert.equal(milestones[0]?.state, "complete");
  assert.equal(milestones[1]?.state, "complete");
  assert.equal(milestones[2]?.state, "current");
  assert.equal(milestones[3]?.state, "upcoming");
  assert.equal(milestones[2]?.label, "Qualification");
});

test("labelLeadStatus returns readable lead status labels", () => {
  assert.equal(labelLeadStatus("interested"), "Interested");
  assert.equal(labelLeadStatus("not_interested"), "Not interested");
  assert.equal(labelLeadStatus("custom_status"), "Custom Status");
});

test("live call polling defaults stay enabled with a 3s interval", () => {
  assert.equal(isLiveCallPollingEnabled(), true);
  assert.equal(getLiveCallPollInterval(), 3000);
});
