import express from "express";
import tenantController from "../controllers/tenant.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router();

router.post("/register", authenticate(), tenantController.registerTenant);
router.get("/mine", authenticate(), tenantController.getMyTenant);
router.get("/:tenantId", authenticate(), requireTenantAccess("params"), tenantController.getTenant);

export default router;
