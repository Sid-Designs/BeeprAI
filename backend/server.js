import "./config/env.js";
import http from "node:http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initCallSessionStore } from "./services/memory.service.js";
import { registerAudioWs } from "./ws/audio.ws.js";
import { registerEventWs } from "./realtime/events/event-ws.server.js";
import { startQueueWorkers } from "./realtime/index.js";

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

process.on("unhandledRejection", (reason) => {
  const message = String(reason?.message || reason || "");
  if (message.includes("ECONNRESET")) {
    console.warn("[runtime] unhandled rejection (socket reset):", message);
    return;
  }
  console.error("[runtime] unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  const message = String(error?.message || "");
  if (message.includes("ECONNRESET")) {
    console.warn("[runtime] uncaught exception (socket reset):", message);
    return;
  }
  console.error("[runtime] uncaught exception:", error);
});

// Start Server
const startServer = async () => {
  try {
    // Connect Database
    const conn = await connectDB();
    const sessionStore = await initCallSessionStore();
    console.log(`[session-store] mode=${sessionStore.mode}`);

    const server = http.createServer(app);
    server.on("error", (error) => {
      if (error?.code === "ECONNRESET") {
        console.warn("[server] socket reset:", error.message);
        return;
      }
      console.error("[server] error:", error);
    });
    registerAudioWs(server);
    registerEventWs(server);
    await startQueueWorkers();

    // Start Express Server (0.0.0.0 required for Railway / container hosts)
    server.listen(PORT, "0.0.0.0", () => {
      console.log("======================================");
      console.log(`🚀 Server running in ${NODE_ENV} mode`);
      console.log(`🗄️  MongoDB Connected Successfully`);
      console.log(`🌐 http://localhost:${PORT}`);
      console.log("======================================");
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
