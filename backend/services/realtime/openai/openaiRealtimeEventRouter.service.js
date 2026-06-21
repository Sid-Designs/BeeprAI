import { EventEmitter } from "events";
import { RealtimeEvents } from "../../../events/realtime.events.js";

export class OpenAIRealtimeEventRouter extends EventEmitter {
  route(event = {}) {
    const type = String(event.type || "");

    switch (type) {
      case "session.updated":
      case "session.update":
        this.emit(RealtimeEvents.SESSION_UPDATED, event);
        break;
      case "response.text.delta":
        this.emit(RealtimeEvents.RESPONSE_TEXT_DELTA, event);
        break;
      case "response.audio.delta":
        this.emit(RealtimeEvents.RESPONSE_AUDIO_DELTA, event);
        break;
      case "response.done":
        this.emit(RealtimeEvents.RESPONSE_DONE, event);
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.emit(RealtimeEvents.USER_TRANSCRIPT_FINAL, event);
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.emit(RealtimeEvents.USER_TRANSCRIPT_FAILED, event);
        break;
      case "error":
        this.emit(RealtimeEvents.ERROR, event);
        break;
      default:
        this.emit("unhandled", event);
        break;
    }
  }
}
