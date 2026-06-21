import express from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { updateProfileSchema, changePasswordSchema } from "../validations/user.validation.js";

const router = express.Router();

router.get("/profile", authenticate(), userController.getProfile);

router.patch(
  "/profile",
  authenticate(),
  validate(updateProfileSchema),
  userController.updateProfile,
);

router.patch(
  "/change-password",
  authenticate(),
  validate(changePasswordSchema),
  userController.changePassword,
);

export default router;
