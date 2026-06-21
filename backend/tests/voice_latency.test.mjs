import test from "node:test";
import assert from "node:assert/strict";
import { splitSemanticChunksWithFastStart } from "../services/conversation/streamingResponseController.service.js";
import { TurnPipelineOrchestrator } from "../services/realtime/orchestrators/turnPipelineOrchestrator.js";

test("fast-start chunking uses smaller first chunk", () => {
  const chunks = splitSemanticChunksWithFastStart(
    "Admission usually covers eligibility. Then you submit the application form. Finally counseling happens.",
    40,
    120,
  );
  assert.ok(chunks[0].length <= 45);
  assert.ok(chunks.length >= 2);
});

test("turn pipeline prefetches next chunk while playing", async () => {
  const order = [];
  const orchestrator = new TurnPipelineOrchestrator({
    synthesize: async (text) => {
      order.push(`synth:${text}`);
      return Buffer.from(`audio:${text}`);
    },
    play: async () => {
      order.push("play");
    },
    isTurnActive: () => true,
  });

  await orchestrator.runTurn({
    turnId: 1,
    fullText: "First sentence here. Second sentence follows now.",
    firstChunkChars: 25,
    chunkChars: 80,
  });

  const firstSynth = order.indexOf("synth:First sentence here.");
  const firstPlay = order.indexOf("play");
  const secondSynth = order.findIndex((entry) => entry.startsWith("synth:Second"));
  assert.ok(firstSynth >= 0);
  assert.ok(firstPlay > firstSynth);
  assert.ok(secondSynth >= 0);
  assert.ok(secondSynth < firstPlay || order.indexOf("play", firstPlay + 1) > secondSynth);
});

test("streaming turn pipeline uses head-start stream and prefetches next chunk", async () => {
  const order = [];
  const streams = {
    head: makeMockStream("head", ["a1", "a2"]),
    tail: makeMockStream("tail", ["b1"]),
  };

  const orchestrator = new TurnPipelineOrchestrator({
    openStream: async (text) => {
      order.push(`open:${text}`);
      if (text.startsWith("First")) return streams.head;
      return streams.tail;
    },
    playStream: async ({ stream, onFirstFrame }) => {
      order.push(`play:${stream.id}`);
      onFirstFrame?.();
      await drainMockStream(stream);
      order.push("played");
    },
    isTurnActive: () => true,
  });

  await orchestrator.runTurn({
    turnId: 2,
    fullText: "First sentence here. Second sentence follows now.",
    firstChunkChars: 25,
    chunkChars: 80,
    ttsHeadStart: Promise.resolve(streams.head),
  });

  assert.equal(order.includes("open:First sentence here."), false);
  assert.ok(order.indexOf("play:head") >= 0);
  assert.ok(order.some((entry) => entry.startsWith("open:Second")));
  assert.ok(order.indexOf("play:tail") > order.indexOf("play:head"));
});

function makeMockStream(id, chunks) {
  let index = 0;
  return {
    id,
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true };
          const value = Buffer.from(chunks[index]);
          index += 1;
          return { done: false, value };
        },
      };
    },
  };
}

async function drainMockStream(stream) {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
});
