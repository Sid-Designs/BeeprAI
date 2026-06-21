export class EndpointingManager {
  decide({ speechDurationMs, silenceMs }) {
    if (speechDurationMs > 350 && silenceMs > 280) {
      return { finalize: true, mode: "early_finalize" };
    }

    if (silenceMs > 650) {
      return { finalize: true, mode: "silence_finalize" };
    }

    return { finalize: false, mode: "wait" };
  }
}

export const endpointingManager = new EndpointingManager();
