import express from "express";
import {
  handleAnswerWebhook,
  handleHangupWebhook,
  triggerOutboundCall,
  createSipCallSession,
  initiateSipCall,
  startSipCall,
  debugXmlFormats,
} from "../controllers/call.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";

const router = express.Router();

// ===== UNIFIED ONE-CLICK API — requires auth =====
router.post(
  "/sip/start",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  startSipCall,
);

// ===== SIP Session Management (internal pipeline calls) =====
router.post("/sip/session", createSipCallSession);
router.post("/sip/initiate", initiateSipCall);

// ===== Debug Endpoints =====
router.get("/debug/xml-formats", debugXmlFormats);

// ===== VoIPBIZ Webhooks — must remain unauthenticated (external callbacks) =====
router.post("/answer", handleAnswerWebhook);
router.post("/hangup", handleHangupWebhook);

// ===== Manual outbound trigger — requires auth =====
router.post(
  "/trigger",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  triggerOutboundCall,
);

export default router;
