import { WebSocketServer } from "ws";
import { websocketEventBus } from "./websocket-event-bus.js";

export const registerEventWs = (server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws/events") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      websocketEventBus.attach(ws);
      ws.send(JSON.stringify({ event: "CONNECTED", ts: Date.now() }));
    });
  });

  return wss;
};
