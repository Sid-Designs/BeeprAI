import {
  AudioFrame,
  AudioSource,
  AudioResampler,
  AudioResamplerQuality,
  LocalAudioTrack,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { TTS_OUTPUT_RATE } from "../config/audioQuality.config.js";
import { createFramePusher } from "./audio/pcmPlayback.util.js";

const safeClose = async (fn) => {
  try {
    await fn?.();
  } catch {}
};

const appendBytes = (left, right) => {
  if (!right?.length) return left;
  const next = Buffer.from(right);
  if (!left?.length) return next;
  return Buffer.concat([left, next]);
};

const toInt16Samples = (bytes) => {
  const usable = bytes.length - (bytes.length % 2);
  if (usable <= 0) return new Int16Array(0);
  const view = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    usable / 2,
  );
  return view;
};

/**
 * Play a Sarvam linear16 PCM byte stream to a LiveKit room as it arrives.
 */
export const createStreamingTTSPlayback = async (
  room,
  byteStream,
  { inputSampleRate = TTS_OUTPUT_RATE, onFirstFrame } = {},
) => {
  let stopped = false;
  let closed = false;

  const outputRate = TTS_OUTPUT_RATE;
  const needsResample = inputSampleRate !== outputRate;
  const source = new AudioSource(outputRate, 1);
  const resampler = needsResample
    ? new AudioResampler(inputSampleRate, outputRate, 1, AudioResamplerQuality.HIGH)
    : null;
  const framePusher = createFramePusher(source, outputRate);
  const track = LocalAudioTrack.createAudioTrack("ai-voice", source);

  const options = new TrackPublishOptions();
  options.source = TrackSource.SOURCE_MICROPHONE;

  const close = async () => {
    if (closed) return;
    closed = true;
    await safeClose(() => track.close(false));
    await safeClose(() => source.close());
    if (resampler) await safeClose(() => resampler.close());
  };

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await close();
  };

  const done = (async () => {
    const reader = byteStream.getReader();
    let pending = Buffer.alloc(0);
    let firstFrameSent = false;
    const frameSamples = Math.max(1, Math.floor(inputSampleRate / 50));
    const bytesPerFrame = frameSamples * 2;

    try {
      await room.localParticipant.publishTrack(track, options);

      while (!stopped) {
        const { done: streamDone, value } = await reader.read();
        if (value?.length) {
          pending = appendBytes(pending, value);
        }

        while (!stopped && pending.length >= bytesPerFrame) {
          const slice = pending.subarray(0, bytesPerFrame);
          pending = pending.subarray(bytesPerFrame);
          const samples = toInt16Samples(slice);
          if (!samples.length) continue;

          if (!needsResample) {
            if (!firstFrameSent) {
              firstFrameSent = true;
              onFirstFrame?.();
            }
            await framePusher.pushSamples(samples);
            continue;
          }

          const inputFrame = new AudioFrame(samples, inputSampleRate, 1, samples.length);
          for (const outputFrame of resampler.push(inputFrame)) {
            if (!firstFrameSent) {
              firstFrameSent = true;
              onFirstFrame?.();
            }
            if (stopped) break;
            await framePusher.pushSamples(outputFrame.data);
          }
        }

        if (streamDone) break;
      }

      if (!stopped && pending.length >= 2) {
        const samples = toInt16Samples(pending);
        if (samples.length) {
          if (!needsResample) {
            await framePusher.pushSamples(samples);
          } else {
            const inputFrame = new AudioFrame(samples, inputSampleRate, 1, samples.length);
            for (const outputFrame of resampler.push(inputFrame)) {
              if (!firstFrameSent) {
                firstFrameSent = true;
                onFirstFrame?.();
              }
              if (stopped) break;
              await framePusher.pushSamples(outputFrame.data);
            }
          }
        }
      }

      if (!stopped) {
        if (needsResample) {
          for (const outputFrame of resampler.flush()) {
            if (stopped) break;
            await framePusher.pushSamples(outputFrame.data);
          }
        }
        await framePusher.flush();
        await source.waitForPlayout();
      }
    } finally {
      await close();
    }
  })();

  return { stop, done };
};
