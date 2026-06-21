import express from "express";
import multer from "multer";
import * as bulkCampaignController from "../controllers/bulkCampaign.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const manageRoles = authorize("owner", "admin", "agentManager");

router.get("/group-types", authenticate(), bulkCampaignController.getGroupTypes);

router.get(
  "/list",
  authenticate(),
  requireTenantAccess("query"),
  bulkCampaignController.listCampaigns,
);

router.post(
  "/create",
  authenticate(),
  manageRoles,
  requireTenantAccess("body"),
  bulkCampaignController.createCampaign,
);

router.get("/:campaignId", authenticate(), bulkCampaignController.getCampaign);
router.get("/:campaignId/contacts", authenticate(), bulkCampaignController.listContacts);

router.post(
  "/:campaignId/contacts",
  authenticate(),
  manageRoles,
  bulkCampaignController.addContacts,
);

router.post(
  "/:campaignId/contacts/upload",
  authenticate(),
  manageRoles,
  upload.single("file"),
  bulkCampaignController.uploadContacts,
);

router.delete(
  "/:campaignId/contacts/pending",
  authenticate(),
  manageRoles,
  bulkCampaignController.clearPending,
);

router.delete(
  "/:campaignId/contacts/:contactId",
  authenticate(),
  manageRoles,
  bulkCampaignController.removeContact,
);

router.post("/:campaignId/start", authenticate(), manageRoles, bulkCampaignController.startCampaign);
router.post("/:campaignId/pause", authenticate(), manageRoles, bulkCampaignController.pauseCampaign);
router.post(
  "/:campaignId/cancel",
  authenticate(),
  manageRoles,
  bulkCampaignController.cancelCampaign,
);
router.delete("/:campaignId", authenticate(), manageRoles, bulkCampaignController.removeCampaign);

export default router;
