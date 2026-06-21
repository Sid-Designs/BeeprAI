import express from "express";
import multer from "multer";
import {
  addPDFToKB,
  addTextToKB,
  addURLToKB,
  deleteKBDocument,
  getKBDocument,
  listKBDocuments,
  queryKB,
  updateKBPdf,
  updateKBText,
  updateKBUrl,
} from "../controllers/kb.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { requireTenantAccess } from "../middlewares/tenantAccess.middleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

const writeRoles = authorize("owner", "admin", "agentManager");

router.get(
  "/documents/:tenantId/:agentId",
  authenticate(),
  requireTenantAccess("params"),
  listKBDocuments,
);

router.get(
  "/documents/:tenantId/:agentId/:docId",
  authenticate(),
  requireTenantAccess("params"),
  getKBDocument,
);

router.delete(
  "/documents",
  authenticate(),
  writeRoles,
  requireTenantAccess("body"),
  deleteKBDocument,
);

router.put("/text/update", authenticate(), writeRoles, requireTenantAccess("body"), updateKBText);
router.put("/url/update", authenticate(), writeRoles, requireTenantAccess("body"), updateKBUrl);
router.put(
  "/pdf/update",
  authenticate(),
  writeRoles,
  upload.single("file"),
  requireTenantAccess("body"),
  updateKBPdf,
);

router.post("/text", authenticate(), writeRoles, requireTenantAccess("body"), addTextToKB);
router.post(
  "/pdf",
  authenticate(),
  writeRoles,
  upload.single("file"),
  requireTenantAccess("body"),
  addPDFToKB,
);
router.post("/url", authenticate(), writeRoles, requireTenantAccess("body"), addURLToKB);
router.post("/query", authenticate(), requireTenantAccess("body"), queryKB);

export default router;
