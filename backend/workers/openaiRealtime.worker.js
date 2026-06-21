import {
  Room,
  RoomEvent,
  AudioSource,
  LocalAudioTrack,
  AudioFrame,
  AudioStream,
  TrackSource,
} from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { OpenAIRealtimeCallPipeline } from "../services/realtime/openai/openaiRealtimeCallPipeline.service.js";
import { RealtimeEvents } from "../events/realtime.events.js";

const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

const SAMPLE_RATE = Number.parseInt(process.env.OPENAI_REALTIME_PCM_RATE || "24000", 10);

const createToken = async (roomName, identity) => {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
};

export const startOpenAIRealtimeWorker = async (
  roomName,
  {
    tenantId,
    agentId,
    callerNumber = "",
    callId = `rt-${Date.now()}`,
  } = {},
) => {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LiveKit env is missing for OpenAI realtime worker.");
  }

  const room = new Room();
  const identity = `openai-rt-${callId}`;
  const token = await createToken(roomName, identity);

  const source = new AudioSource(SAMPLE_RATE, 1);
  const track = LocalAudioTrack.createAudioTrack("openai-realtime-audio", source);

  const pipeline = new OpenAIRealtimeCallPipeline({
    callId,
    tenantId,
    agentId,
    roomId: roomName,
    callerNumber,
    sampleRate: SAMPLE_RATE,
  });

  room
    .on(RoomEvent.TrackSubscribed, async (remoteTrack, publication, participant) => {
      if (remoteTrack.kind !== 1) return;
      if (participant.identity === identity) return;

      const stream = new AudioStream(remoteTrack, {
        sampleRate: SAMPLE_RATE,
        numChannels: 1,
      });

      for await (const frameEvent of stream) {
        const samples = frameEvent?.frame?.data;
        if (!samples || !samples.length) continue;
        await pipeline.ingestCallerAudioPcm16(samples);
      }
    })
    .on(RoomEvent.Disconnected, async () => {
      await pipeline.stop("room_disconnected");
    });

  pipeline.on(RealtimeEvents.AUDIO_OUTGOING, async ({ samples }) => {
    if (!samples?.length) return;
    const frame = new AudioFrame(samples, SAMPLE_RATE, 1, samples.length);
    await source.captureFrame(frame);
  });

  pipeline.on(RealtimeEvents.USER_SPEECH_END, async () => {
    await pipeline.commitCallerTurn();
  });

  pipeline.on(RealtimeEvents.ERROR, (payload) => {
    console.error("[openai-rt-worker] pipeline error:", payload?.error || payload);
  });

  await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
  await room.localParticipant.publishTrack(track, {
    source: TrackSource.SOURCE_MICROPHONE,
  });

  await pipeline.start();

  console.log("[openai-rt-worker] started", {
    roomName,
    callId,
    tenantId,
    agentId,
  });

  return {
    room,
    pipeline,
    callId,
  };
};

