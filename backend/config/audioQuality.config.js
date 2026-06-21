/**
 * Telephony-oriented audio settings for LiveKit + Sarvam.
 * Voice identity (speaker) is unchanged — only sample rates and playback shaping.
 */

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** LiveKit room audio rate — matches STT ingest and TTS publish for fewer resample steps. */
export const LIVEKIT_AUDIO_RATE = parsePositiveInt(process.env.LIVEKIT_AUDIO_RATE, 16000);

/** Sarvam STT ingest rate (8k or 16k supported; 16k matches LiveKit SIP bridge). */
export const STT_SAMPLE_RATE = parsePositiveInt(
  process.env.STT_SAMPLE_RATE,
  LIVEKIT_AUDIO_RATE,
);

/**
 * Sarvam WAV generation rate. 16 kHz is Sarvam's "good quality voice" tier and
 * survives the PSTN 8 kHz downlink better than 22 kHz → 48 kHz → 8 kHz chains.
 */
export const TTS_WAV_SAMPLE_RATE = parsePositiveInt(process.env.TTS_WAV_SAMPLE_RATE, 16000);

/** Rate published to LiveKit from the worker TTS track. */
export const TTS_OUTPUT_RATE = parsePositiveInt(process.env.TTS_OUTPUT_RATE, LIVEKIT_AUDIO_RATE);

/** Streaming TTS input rate when ENABLE_TTS_STREAMING=true. */
export const TTS_STREAM_SAMPLE_RATE = parsePositiveInt(
  process.env.TTS_STREAM_SAMPLE_RATE,
  TTS_WAV_SAMPLE_RATE,
);

/** Peak target for telephony playback (lower = less clipping on G.711). */
export const TTS_PEAK_TARGET = parsePositiveInt(process.env.TTS_PEAK_TARGET, 24000);

/** Fixed 20 ms frames at the published sample rate for smoother playout. */
export const PLAYBACK_FRAME_MS = parsePositiveInt(process.env.PLAYBACK_FRAME_MS, 20);

export const playbackFrameSamples = (sampleRate) =>
  Math.max(1, Math.floor((sampleRate * PLAYBACK_FRAME_MS) / 1000));
