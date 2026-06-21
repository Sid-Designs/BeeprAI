import { readFileSync } from "node:fs";
import {
  addContactsToCampaign,
  cancelBulkCampaign,
  clearPendingContacts,
  createBulkCampaign,
  deleteBulkCampaign,
  getBulkCampaign,
  getGroupTypeLabels,
  listBulkCampaigns,
  listCampaignContacts,
  parseContactsFromFile,
  parseContactsFromManualText,
  pauseBulkCampaign,
  removeCampaignContact,
  startBulkCampaign,
} from "../services/bulkCall.service.js";
import { assertTenantAccess } from "../services/tenantAccess.service.js";
import { sendResponse } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";

export async function getGroupTypes(req, res) {
  sendResponse(res, 200, "Bulk campaign group types.", getGroupTypeLabels());
}

export async function listCampaigns(req, res) {
  const { tenantId } = req.query;
  if (!tenantId) throw new AppError("tenantId is required.", 400);
  await assertTenantAccess(req.user, tenantId);

  const campaigns = await listBulkCampaigns(tenantId);
  sendResponse(res, 200, "Bulk campaigns.", campaigns);
}

export async function createCampaign(req, res) {
  const {
    tenantId,
    name,
    groupType,
    agentId,
    callObjective,
    callConfig,
    delayBetweenCallsSec,
  } = req.body;

  if (!tenantId || !name || !agentId) {
    throw new AppError("tenantId, name, and agentId are required.", 400);
  }

  await assertTenantAccess(req.user, tenantId);

  const campaign = await createBulkCampaign({
    tenantId,
    organizationId: req.user.organizationId,
    createdBy: req.user._id,
    name,
    groupType,
    agentId,
    callObjective,
    callConfig,
    delayBetweenCallsSec,
  });

  sendResponse(res, 201, "Bulk campaign created.", campaign);
}

export async function getCampaign(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());
  sendResponse(res, 200, "Bulk campaign.", campaign);
}

export async function addContacts(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const { contacts, manualText } = req.body || {};
  let parsed = Array.isArray(contacts) ? contacts : [];

  if (manualText) {
    parsed = [...parsed, ...parseContactsFromManualText(manualText)];
  }

  const result = await addContactsToCampaign(campaign._id, parsed);
  sendResponse(res, 200, "Contacts added.", result);
}

export async function uploadContacts(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  if (!req.file?.buffer && !req.file?.path) {
    throw new AppError("Upload a CSV or Excel file.", 400);
  }

  const buffer = req.file.buffer || readFileSync(req.file.path);
  const contacts = await parseContactsFromFile(buffer, req.file.originalname || "");
  const result = await addContactsToCampaign(campaign._id, contacts);
  sendResponse(res, 200, "File imported.", { ...result, parsed: contacts.length });
}

export async function listContacts(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const contacts = await listCampaignContacts(campaign._id, {
    limit: Number(req.query.limit) || 200,
    skip: Number(req.query.skip) || 0,
  });

  sendResponse(res, 200, "Campaign contacts.", contacts);
}

export async function startCampaign(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const updated = await startBulkCampaign(campaign._id);
  sendResponse(res, 200, "Bulk campaign started.", updated);
}

export async function pauseCampaign(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const updated = await pauseBulkCampaign(campaign._id);
  sendResponse(res, 200, "Bulk campaign paused.", updated);
}

export async function cancelCampaign(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const updated = await cancelBulkCampaign(campaign._id);
  sendResponse(res, 200, "Bulk campaign cancelled.", updated);
}

export async function removeContact(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const contact = await removeCampaignContact(campaign._id, req.params.contactId);
  sendResponse(res, 200, "Contact removed.", contact);
}

export async function clearPending(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const result = await clearPendingContacts(campaign._id);
  sendResponse(res, 200, "Pending contacts cleared.", result);
}

export async function removeCampaign(req, res) {
  const campaign = await getBulkCampaign(req.params.campaignId);
  await assertTenantAccess(req.user, campaign.tenantId.toString());

  const result = await deleteBulkCampaign(campaign._id);
  sendResponse(res, 200, "Bulk campaign deleted.", result);
}
