import https from "node:https";
import fetch from "node-fetch";
import { SarvamAIClient } from "sarvamai";
import { prepareTextForTTS } from "./pronunciationPrep.service.js";
import { TTS_STREAM_SAMPLE_RATE, TTS_WAV_SAMPLE_RATE } from "../config/audioQuality.config.js";

const API_KEY = process.env.SARVAM_API_KEY;
const TTS_URL = "https://api.sarvam.ai/text-to-speech";
const TTS_STREAM_URL = "https://api.sarvam.ai/text-to-speech/stream";
const VOICE_FAST_MODE =
  String(process.env.VOICE_FAST_MODE || "true").toLowerCase() === "true";
const TTS_TIMEOUT_MS = Number.parseInt(
  process.env.TTS_TIMEOUT_MS || (VOICE_FAST_MODE ? "8000" : "12000"),
  10,
);
const TTS_MAX_RETRIES = Number.parseInt(process.env.TTS_MAX_RETRIES || "2", 10);
const TTS_MODEL = String(process.env.TTS_MODEL || "bulbul:v3").trim();
const TTS_PACE = Number.parseFloat(process.env.TTS_PACE || "0.95");
const TTS_TEMPERATURE = Number.parseFloat(process.env.TTS_TEMPERATURE || "0.32");
const TTS_DICT_ID = String(process.env.SARVAM_TTS_DICT_ID || "").trim();
export const ENABLE_TTS_STREAMING =
  String(process.env.ENABLE_TTS_STREAMING || "false").toLowerCase() === "true";
export { TTS_STREAM_SAMPLE_RATE, TTS_WAV_SAMPLE_RATE };
const TTS_STREAM_CODEC = String(process.env.TTS_STREAM_CODEC || "linear16").trim();

let keepAliveAgent = null;
let sarvamClient = null;
let warmupInFlight = null;
let warmupWavInFlight = null;

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const mapLanguageCode = (value = "en") => {
  const key = String(value || "en").toLowerCase();
  if (key === "hi" || key === "hindi" || key === "hi-in") return "hi-IN";
  if (key === "mr" || key === "marathi" || key === "mr-in") return "mr-IN";
  return "en-IN";
};

const resolveSpeaker = ({ language = "en" } = {}) => {
  const key = String(language || "en").toLowerCase();
  if (key === "hi" || key.startsWith("hi")) {
    return process.env.TTS_VOICE_HI || process.env.TTS_VOICE_MULTI || "shubh";
  }
  if (key === "mr" || key.startsWith("mr")) {
    return process.env.TTS_VOICE_MR || process.env.TTS_VOICE_MULTI || "shubh";
  }
  return process.env.TTS_VOICE_EN || process.env.TTS_VOICE_MULTI || "shubh";
};

const getKeepAliveAgent = () => {
  if (!keepAliveAgent) {
    keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 6 });
  }
  return keepAliveAgent;
};

const getSarvamClient = () => {
  if (!sarvamClient && API_KEY) {
    sarvamClient = new SarvamAIClient({ apiSubscriptionKey: API_KEY });
  }
  return sarvamClient;
};

const buildTtsPayload = (text, options = {}, { streaming = false } = {}) => {
  const targetLanguageCode = mapLanguageCode(options?.language || "en");
  const speaker = resolveSpeaker({ language: options?.language || "en" });
  const ttsText = prepareTextForTTS(normalizeText(text), options?.language || "en");

  if (!ttsText) return null;

  const payload = {
    text: ttsText,
    target_language_code: targetLanguageCode,
    speaker,
    model: TTS_MODEL,
    pace: Number.isFinite(TTS_PACE) ? TTS_PACE : 0.95,
    temperature: Number.isFinite(TTS_TEMPERATURE) ? TTS_TEMPERATURE : 0.32,
  };

  if (TTS_DICT_ID) {
    payload.dict_id = TTS_DICT_ID;
  }

  if (streaming) {
    payload.output_audio_codec = TTS_STREAM_CODEC;
    payload.speech_sample_rate = TTS_STREAM_SAMPLE_RATE;
  } else {
    payload.speech_sample_rate = TTS_WAV_SAMPLE_RATE;
    payload.output_audio_codec = "wav";
  }

  return payload;
};

const unwrapBinaryStream = (response) => {
  const binary = response?.data ?? response;
  if (binary && typeof binary.stream === "function") {
    return binary.stream();
  }
  return binary;
};

const drainStream = async (stream) => {
  if (!stream?.getReader) return;
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
};

/** Discard an in-flight streaming TTS request (e.g. superseded by a newer turn). */
export const abandonSpeechStream = async (streamPromise) => {
  if (!streamPromise) return;
  try {
    await drainStream(await streamPromise);
  } catch {}
};

/**
 * Open a Sarvam HTTP streaming TTS request. Returns a Web ReadableStream of audio bytes.
 * Call without awaiting until playback to overlap with LLM post-processing.
 */
export const openSpeechStream = async (text, options = {}) => {
  if (!API_KEY) {
    console.error("[tts] SARVAM_API_KEY missing");
    return null;
  }
  if (!text || typeof text !== "string") {
    console.error("[tts] Invalid text input");
    return null;
  }

  const payload = buildTtsPayload(text, options, { streaming: true });
  if (!payload) return null;

  const client = getSarvamClient();
  if (client?.textToSpeech?.convertStream) {
    const response = await client.textToSpeech.convertStream(payload, {
      timeoutInSeconds: Math.ceil(TTS_TIMEOUT_MS / 1000),
    });
    return unwrapBinaryStream(response);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const response = await fetch(TTS_STREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      agent: getKeepAliveAgent(),
    });
    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || `HTTP ${response.status}`);
    }

    return response.body;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
};

/** Warm TLS + HTTP connection pool; audio is discarded. */
export const warmupTtsConnection = (language = "en") => {
  if (!API_KEY || !ENABLE_TTS_STREAMING) return;
  if (warmupInFlight) return warmupInFlight;

  warmupInFlight = openSpeechStream("Hello.", { language })
    .then((stream) => drainStream(stream))
    .catch(() => {})
    .finally(() => {
      warmupInFlight = null;
    });

  return warmupInFlight;
};

/** Warm TLS + HTTP for WAV mode; audio is discarded. */
export const warmupTtsWavConnection = (language = "en") => {
  if (!API_KEY) return;
  if (warmupWavInFlight) return warmupWavInFlight;

  warmupWavInFlight = generateSpeech(".", { language })
    .catch(() => {})
    .finally(() => {
      warmupWavInFlight = null;
    });

  return warmupWavInFlight;
};

export const generateSpeech = async (text, options = {}) => {
  if (!API_KEY) {
    console.error("[tts] SARVAM_API_KEY missing");
    return Buffer.alloc(0);
  }
  if (!text || typeof text !== "string") {
    console.error("[tts] Invalid text input");
    return Buffer.alloc(0);
  }

  const requestBody = buildTtsPayload(text, options, { streaming: false });
  if (!requestBody) {
    console.error("[tts] Invalid text input");
    return Buffer.alloc(0);
  }

  let response = null;
  let lastError = null;

  for (let attempt = 0; attempt <= TTS_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    try {
      response = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": API_KEY,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        agent: getKeepAliveAgent(),
      });
      clearTimeout(timer);

      if (response.ok) {
        break;
      }

      const err = await response.text();
      lastError = new Error(err || `HTTP ${response.status}`);
      console.error(`[tts] provider non-200 (attempt ${attempt + 1}):`, err || response.status);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      console.error(`[tts] request failed (attempt ${attempt + 1}):`, error?.message || error);
    }
  }

  if (!response || !response.ok) {
    console.error("[tts] all retries failed:", lastError?.message || "unknown_error");
    return Buffer.alloc(0);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json();

    const audioBase64 =
      payload?.audios?.[0] ||
      payload?.audio ||
      payload?.data?.audio ||
      payload?.result?.audio;

    if (!audioBase64) {
      console.error("[tts] invalid payload:", payload);
      return Buffer.alloc(0);
    }

    return Buffer.from(audioBase64, "base64");
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
