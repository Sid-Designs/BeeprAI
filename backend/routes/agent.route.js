import agentController from "../controllers/agent.controller.js";
import express from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router();

// Write operations — require agentManager or above
router.post(
  "/create",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  requireTenantAccess("body"),
  agentController.createAgent,
);

// Read operations — scoped to the user's workspace
router.get("/list/:tenantId", authenticate(), requireTenantAccess("params"), agentController.getAgents);
router.get(
  "/:tenantId/:agentId",
  authenticate(),
  requireTenantAccess("params"),
  agentController.getAgentById,
);

export default router;
