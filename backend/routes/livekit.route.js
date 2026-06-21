import express from "express";
import {
  checkRoomStatus,
  checkSipDiagnostic,
  getLiveKitToken,
  startOpenAIRealtimeWorkerController,
  startWorker,
} from "../controllers/livekit.controller.js";
import { handleLiveKitSipWebhook } from "../controllers/sip.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { internalAuth } from "../middlewares/internalAuth.middleware.js";

const router = express.Router();

// Token generation — requires authenticated user
router.get("/token", authenticate(), getLiveKitToken);
router.post("/token", authenticate(), getLiveKitToken);

// Worker start — internal pipeline only (called by workerLauncher.js)
router.post("/worker/start", internalAuth, startWorker);
router.post("/worker/openai-realtime/start", internalAuth, startOpenAIRealtimeWorkerController);

// SIP webhook — must remain unauthenticated (external callback from LiveKit)
router.post("/sip/webhook", handleLiveKitSipWebhook);

// Diagnostic/status — require authenticated user
router.get("/sip/diagnostic", authenticate(), checkSipDiagnostic);
router.get("/room/status/:roomName", authenticate(), checkRoomStatus);

export default router;
