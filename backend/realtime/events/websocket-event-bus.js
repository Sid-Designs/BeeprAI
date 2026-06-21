import { EventEmitter } from "node:events";

class WebsocketEventBus extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  attach(ws) {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
  }

  publish(event, payload = {}) {
    // Only emit and send important events to clients
    this.emit(event, payload);
    // List of important events to send to clients
    const importantEvents = [
      "CONNECTED", "DISCONNECTED", "ERROR", "CALL_STARTED", "CALL_TERMINATED", "USER_SPEECH_STARTED", "USER_SPEECH_ENDED", "AI_RESPONSE_STARTED", "AI_RESPONSE_COMPLETED", "STATE_CHANGED", "HANDOFF_TRIGGERED", "FALLBACK_TRIGGERED", "LATENCY_WARNING"
    ];
    if (!importantEvents.includes(event)) return;
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ event, payload, ts: Date.now() }));
      }
    }
  }
}

export const websocketEventBus = new WebsocketEventBus();
