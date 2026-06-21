import { AudioFrame } from "@livekit/rtc-node";
import { playbackFrameSamples, TTS_PEAK_TARGET } from "../../config/audioQuality.config.js";

export const convertToMono = (pcm, numChannels) => {
  const pcm16 = new Int16Array(
    pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
  );

  if (numChannels === 1) return pcm16;

  const mono = new Int16Array(Math.floor(pcm16.length / numChannels));
  for (let i = 0; i < mono.length; i += 1) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch += 1) {
      sum += pcm16[i * numChannels + ch] || 0;
    }
    mono[i] = Math.max(-32768, Math.min(32767, Math.round(sum / numChannels)));
  }

  return mono;
};

/** Gentle peak normalization — keeps Sarvam timbre, reduces harsh clipping on 8 kHz PSTN. */
export const normalizePcmForPlayback = (samples, targetPeak = TTS_PEAK_TARGET) => {
  if (!samples?.length) return samples;
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (!peak || peak <= targetPeak) return samples;

  const scale = targetPeak / peak;
  const normalized = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    normalized[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * scale)));
  }
  return normalized;
};

const appendInt16 = (left, right) => {
  if (!right?.length) return left;
  if (!left?.length) return right;
  const merged = new Int16Array(left.length + right.length);
  merged.set(left, 0);
  merged.set(right, left.length);
  return merged;
};

/**
 * Buffer resampler output into fixed-duration frames before captureFrame.
 * Reduces jitter that shows up as choppy audio on SIP trunks.
 */
export const createFramePusher = (source, sampleRate) => {
  const frameSamples = playbackFrameSamples(sampleRate);
  let pending = new Int16Array(0);

  const pushSamples = async (samples) => {
    if (!samples?.length || !source) return;
    pending = appendInt16(pending, samples);

    while (pending.length >= frameSamples) {
      const chunk = pending.slice(0, frameSamples);
      pending = pending.slice(frameSamples);
      await source.captureFrame(new AudioFrame(chunk, sampleRate, 1, chunk.length));
    }
  };

  const flush = async () => {
    if (!pending.length || !source) return;
    const tail = pending;
    pending = new Int16Array(0);
    await source.captureFrame(new AudioFrame(tail, sampleRate, 1, tail.length));
  };

  return { pushSamples, flush };
};
