export class InterruptionManager {
  handleUserSpeechDuringTts(session) {
    return {
      interrupted: true,
      reason: "barge_in",
      action: "stop_tts",
      activeTurnOwner: "user",
      metrics: {
        interruptions: (session.metrics?.interruptions || 0) + 1,
      },
    };
  }
}

export const interruptionManager = new InterruptionManager();
