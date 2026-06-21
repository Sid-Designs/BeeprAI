import { EventEmitter } from "events";
import WebSocket from "ws";

const OPENAI_RT_URL = process.env.OPENAI_REALTIME_URL
  || "wss://api.openai.com/v1/realtime?model=gpt-realtime-2";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class OpenAIRealtimeWsService extends EventEmitter {
  constructor({
    apiKey = process.env.OPENAI_API_KEY || "",
    url = OPENAI_RT_URL,
    reconnectMaxAttempts = 8,
    reconnectBaseMs = 400,
    heartbeatMs = 15000,
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.url = url;
    this.reconnectMaxAttempts = reconnectMaxAttempts;
    this.reconnectBaseMs = reconnectBaseMs;
    this.heartbeatMs = heartbeatMs;

    this.ws = null;
    this.connected = false;
    this.manualClose = false;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
  }

  async connect() {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for realtime websocket.");
    }
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;

    this.manualClose = false;

    await new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      this.ws.once("open", () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.#startHeartbeat();
        this.emit("connected");
        resolve();
      });

      this.ws.once("error", (error) => {
        if (!this.connected) reject(error);
        this.emit("error", error);
      });

      this.ws.on("message", (data) => {
        try {
          const parsed = JSON.parse(String(data || "{}"));
          this.emit("event", parsed);
        } catch (error) {
          this.emit("error", new Error(`Invalid realtime event payload: ${error.message}`));
        }
      });

      this.ws.on("close", async (code, reason) => {
        this.connected = false;
        this.#stopHeartbeat();
        this.emit("disconnected", { code, reason: String(reason || "") });
        if (!this.manualClose) {
          await this.#reconnect();
        }
      });
    });
  }

  send(event) {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime websocket is not connected");
    }
    this.ws.send(JSON.stringify(event));
  }

  updateSession(sessionPatch = {}) {
    this.send({
      type: "session.update",
      session: sessionPatch,
    });
  }

  appendInputAudio(base64Pcm16) {
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Pcm16,
    });
  }

  commitInputAudio() {
    this.send({ type: "input_audio_buffer.commit" });
  }

  createConversationItem(item) {
    this.send({
      type: "conversation.item.create",
      item,
    });
  }

  requestResponse(response = {}) {
    this.send({
      type: "response.create",
      response,
    });
  }

  cancelResponse() {
    this.send({ type: "response.cancel" });
  }

  async disconnect() {
    this.manualClose = true;
    this.#stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "manual_shutdown");
      this.ws = null;
    }
    this.connected = false;
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      try {
        this.send({ type: "ping", ts: Date.now() });
      } catch {
        // No-op. Close handler will run reconnect flow.
      }
    }, this.heartbeatMs);
  }

  #stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async #reconnect() {
    if (this.reconnectAttempts >= this.reconnectMaxAttempts) {
      this.emit("fatal", new Error("OpenAI realtime reconnect attempts exhausted"));
      return;
    }

    this.reconnectAttempts += 1;
    const backoff = this.reconnectBaseMs * (2 ** (this.reconnectAttempts - 1));
    const jitter = Math.floor(Math.random() * 150);
    await wait(backoff + jitter);
    this.emit("reconnect_attempt", { attempt: this.reconnectAttempts, delayMs: backoff + jitter });

    try {
      await this.connect();
    } catch (error) {
      this.emit("error", error);
      await this.#reconnect();
    }
  }
}

