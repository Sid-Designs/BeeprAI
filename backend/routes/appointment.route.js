import express from "express";
import { patchAppointment } from "../controllers/calendar.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";

const router = express.Router();

router.patch(
  "/:appointmentId",
  authenticate(),
  authorize("owner", "admin", "agentManager"),
  patchAppointment,
);

export default router;
