import express from "express";
import { listAdminAgents, listAdminCallAnalysis, listAdminTenants } from "../controllers/admin.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requirePlatformAdmin } from "../middlewares/platformAdmin.middleware.js";

const router = express.Router();

// Platform admin — cross-tenant visibility (not the same as org "owner" role)
router.get("/tenants", authenticate(), requirePlatformAdmin, listAdminTenants);
router.get("/agents", authenticate(), requirePlatformAdmin, listAdminAgents);
router.get("/call-analysis", authenticate(), requirePlatformAdmin, listAdminCallAnalysis);

export default router;
