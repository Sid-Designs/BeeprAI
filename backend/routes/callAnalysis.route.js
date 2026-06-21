import express from "express";
import {
  finalizeCallAnalysis,
  getCallAnalysis,
  getCallAnalysisList,
  getAnalyticsSummary,
  getKbGapClusters,
  getLiveCallStatus,
} from "../controllers/callAnalysis.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { internalAuth } from "../middlewares/internalAuth.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router();

// Called by the internal voice pipeline — protected by internal token
// Falls back to open in development when INTERNAL_SERVICE_TOKEN is not set
router.post("/finalize", internalAuth, finalizeCallAnalysis);

// Read endpoints — require authenticated user scoped to their workspace
router.get(
  "/analytics/summary",
  authenticate(),
  requireTenantAccess("query"),
  getAnalyticsSummary,
);
router.get("/list", authenticate(), requireTenantAccess("query"), getCallAnalysisList);
router.get("/kb-gaps", authenticate(), requireTenantAccess("query"), getKbGapClusters);
router.get("/live/:sessionId", authenticate(), getLiveCallStatus);
router.get("/:sessionId", authenticate(), getCallAnalysis);

export default router;
