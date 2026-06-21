import express from "express";
import {
  createAppointment,
  getAppointments,
  getAvailability,
  getSettings,
  putSettings,
} from "../controllers/calendar.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router({ mergeParams: true });

router.get(
  "/settings",
  authenticate(),
  requireTenantAccess("params"),
  getSettings,
);
router.put(
  "/settings",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  requireTenantAccess("params"),
  putSettings,
);

router.get(
  "/appointments",
  authenticate(),
  requireTenantAccess("params"),
  getAppointments,
);
router.post(
  "/appointments",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  requireTenantAccess("params"),
  createAppointment,
);

router.get(
  "/availability",
  authenticate(),
  requireTenantAccess("params"),
  getAvailability,
);

export default router;
