import express from "express";
import { realtimeCallOrchestrator } from "../orchestrators/realtime-call-orchestrator.js";
import { realtimeSessionManager } from "../managers/realtime-session-manager.js";

const router = express.Router();

router.post("/session/start", async (req, res, next) => {
  try {
    const { callId, tenantId, agentId } = req.body;
    const session = await realtimeCallOrchestrator.startSession({ callId, tenantId, agentId });
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
});

router.post("/session/:callId/speech/start", async (req, res, next) => {
  try {
    const session = await realtimeCallOrchestrator.onUserSpeechStarted(req.params.callId);
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
});

router.post("/session/:callId/speech/end", async (req, res, next) => {
  try {
    const session = await realtimeCallOrchestrator.onUserSpeechEnded(req.params.callId, req.body || {});
    res.json({ success: true, session });
  } catch (error) {
    next(error);
  }
});

router.get("/session/:callId", (req, res) => {
  const session = realtimeSessionManager.get(req.params.callId);
  res.json({ success: true, session });
});

export default router;
