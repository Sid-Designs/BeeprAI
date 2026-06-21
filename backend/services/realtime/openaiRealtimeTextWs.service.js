import WebSocket from "ws";

const OPENAI_RT_URL = process.env.OPENAI_REALTIME_URL || "wss://api.openai.com/v1/realtime?model=gpt-realtime-2";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WS_LOG_ENABLED = String(process.env.REALTIME_WS_LOGS || "false").toLowerCase() === "true";

export async function callOpenAIRealtimeWS({
  instructions,
  userMessage,
  timeoutMs = 20000,
  maxOutputTokens = 90,
}) {
  return new Promise((resolve, reject) => {
    let result = "";
    let done = false;
    const ws = new WebSocket(OPENAI_RT_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });
    const timer = setTimeout(() => {
      ws.close();
      if (!done) reject(new Error("OpenAI Realtime WS timeout"));
    }, timeoutMs);
    ws.on("open", () => {
      if (WS_LOG_ENABLED) {
        console.log("[rt-ws] connected");
      }
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: ["text"],
            instructions,
          },
        })
      );
      ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: userMessage,
            max_output_tokens: maxOutputTokens,
          },
        })
      );
    });
    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.type === "response.output_text.delta") {
          result += event.delta;
        }
        if (event.type === "response.done") {
          done = true;
          clearTimeout(timer);
          if (WS_LOG_ENABLED) {
            const usage = event?.response?.usage || {};
            console.log("[rt-ws] response.done", {
              inputTokens: Number(usage?.input_tokens || 0),
              outputTokens: Number(usage?.output_tokens || 0),
              totalTokens: Number(usage?.total_tokens || 0),
            });
          }
          ws.close();
          resolve(result);
        }
        if (event.type === "error") {
          done = true;
          clearTimeout(timer);
          console.error("[rt-ws] error", event?.error?.message || "OpenAI Realtime WS error");
          ws.close();
          reject(new Error(event.error?.message || "OpenAI Realtime WS error"));
        }
      } catch (err) {
        done = true;
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    });
    ws.on("error", (err) => {
      done = true;
      clearTimeout(timer);
      console.error("[rt-ws] socket error", err?.message || err);
      ws.close();
      reject(err);
    });
    ws.on("close", () => {
      if (!done) {
        clearTimeout(timer);
        reject(new Error("OpenAI Realtime WS closed unexpectedly"));
      }
    });
  });
}
