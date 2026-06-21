import express from "express";
import * as orgController from "../controllers/organization.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { requireOrganization } from "../middlewares/organizationScope.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateMemberRoleSchema,
} from "../validations/organization.validation.js";

const router = express.Router();

// Create org — no existing org required
router.post(
  "/",
  authenticate(),
  validate(createOrganizationSchema),
  orgController.create,
);

// All routes below require an existing organization
router.get("/", authenticate(), requireOrganization, orgController.get);

router.patch(
  "/",
  authenticate(),
  requireOrganization,
  authorize("owner", "admin"),
  validate(updateOrganizationSchema),
  orgController.update,
);

router.get("/members", authenticate(), requireOrganization, orgController.listMembers);

router.patch(
  "/members/:userId/role",
  authenticate(),
  requireOrganization,
  authorize("owner", "admin"),
  validate(updateMemberRoleSchema),
  orgController.updateRole,
);

router.delete(
  "/members/:userId",
  authenticate(),
  requireOrganization,
  authorize("owner", "admin"),
  orgController.removeMemberHandler,
);

export default router;
