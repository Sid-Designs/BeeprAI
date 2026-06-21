import XLSX from "xlsx";
import BulkCampaign from "../models/bulkCampaign.model.js";
import BulkCampaignContact from "../models/bulkCampaignContact.model.js";
import { executeOutboundCall } from "./outboundCall.service.js";
import { AppError } from "../utils/AppError.js";

const PHONE_RE = /\+?[\d\s().-]{8,20}/;

const GROUP_LABELS = {
  cold_calling: "Cold calling",
  appointment: "Appointment",
  follow_up: "Follow-up",
  custom: "Custom",
};

const activeTimers = new Map();

function normalizePhone(raw = "") {
  const value = String(raw).trim();
  if (!value) return "";
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits.length >= 8 ? digits : "";
}

function parseManualContacts(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const contacts = [];
  for (const line of lines) {
    const parts = line.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && !PHONE_RE.test(parts[0])) {
      const phone = normalizePhone(parts.find((p) => PHONE_RE.test(p)) || parts[1]);
      const name = parts.find((p) => p !== phone && !PHONE_RE.test(p)) || "";
      if (phone) contacts.push({ name, phoneNumber: phone });
      continue;
    }
    const phone = normalizePhone(parts[0] || line);
    if (phone) contacts.push({ name: "", phoneNumber: phone });
  }
  return contacts;
}

function parseSpreadsheetBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  const contacts = [];

  for (const row of rows) {
    const keys = Object.keys(row);
    const phoneKey =
      keys.find((k) => /phone|mobile|number|contact/i.test(k)) || keys[0];
    const nameKey = keys.find((k) => /name|customer|lead/i.test(k));

    const phone = normalizePhone(row[phoneKey]);
    if (!phone) continue;
    contacts.push({
      name: nameKey ? String(row[nameKey] || "").trim() : "",
      phoneNumber: phone,
    });
  }

  return contacts;
}

async function refreshCampaignStats(campaignId) {
  const oid = campaignId;
  const counts = await BulkCampaignContact.aggregate([
    { $match: { campaignId: oid } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const stats = {
    total: 0,
    pending: 0,
    calling: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of counts) {
    const key = row._id;
    if (stats[key] !== undefined) stats[key] = row.count;
    stats.total += row.count;
  }

  await BulkCampaign.findByIdAndUpdate(campaignId, { stats });
  return stats;
}

export function getGroupTypeLabels() {
  return GROUP_LABELS;
}

export async function createBulkCampaign({
  tenantId,
  organizationId,
  createdBy,
  name,
  groupType,
  agentId,
  callObjective,
  callConfig,
  delayBetweenCallsSec,
}) {
  if (!name?.trim()) throw new AppError("Campaign name is required.", 400);

  const campaign = await BulkCampaign.create({
    tenantId,
    organizationId,
    createdBy,
    name: name.trim(),
    groupType: groupType || "cold_calling",
    agentId,
    callObjective: callObjective || "",
    callConfig: callConfig || {},
    delayBetweenCallsSec: Math.min(120, Math.max(3, Number(delayBetweenCallsSec) || 8)),
    status: "draft",
  });

  return campaign;
}

export async function listBulkCampaigns(tenantId) {
  return BulkCampaign.find({ tenantId }).sort({ createdAt: -1 }).lean();
}

export async function getBulkCampaign(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId).lean();
  if (!campaign) throw new AppError("Campaign not found.", 404);
  return campaign;
}

export async function addContactsToCampaign(campaignId, contacts = []) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.status === "running") {
    throw new AppError("Pause the campaign before adding contacts.", 400);
  }

  const unique = new Map();
  for (const entry of contacts) {
    const phoneNumber = normalizePhone(entry.phoneNumber || entry.phone);
    if (!phoneNumber) continue;
    unique.set(phoneNumber, {
      name: String(entry.name || "").trim().slice(0, 120),
      phoneNumber,
    });
  }

  if (unique.size === 0) {
    throw new AppError("No valid phone numbers found.", 400);
  }

  const existing = await BulkCampaignContact.find({
    campaignId,
    phoneNumber: { $in: [...unique.keys()] },
  }).select("phoneNumber");

  const existingSet = new Set(existing.map((c) => c.phoneNumber));
  const toInsert = [...unique.values()]
    .filter((c) => !existingSet.has(c.phoneNumber))
    .map((c) => ({
      campaignId,
      tenantId: campaign.tenantId,
      name: c.name,
      phoneNumber: c.phoneNumber,
      status: "pending",
    }));

  if (toInsert.length) {
    await BulkCampaignContact.insertMany(toInsert);
  }

  const stats = await refreshCampaignStats(campaignId);
  return { added: toInsert.length, skipped: unique.size - toInsert.length, stats };
}

export async function parseContactsFromManualText(text) {
  return parseManualContacts(text);
}

export async function parseContactsFromFile(buffer, filename = "") {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseManualContacts(Buffer.from(buffer).toString("utf8"));
  }
  return parseSpreadsheetBuffer(buffer);
}

function clearCampaignTimer(campaignId) {
  const key = campaignId.toString();
  const timer = activeTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(key);
  }
}

function scheduleNext(campaignId, delaySec) {
  clearCampaignTimer(campaignId);
  const key = campaignId.toString();
  const timer = setTimeout(() => {
    activeTimers.delete(key);
    processNextContact(campaignId).catch((err) => {
      console.error("[bulk-call] processNext error:", err.message);
    });
  }, Math.max(3, delaySec) * 1000);
  activeTimers.set(key, timer);
}

export async function processNextContact(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign || campaign.status !== "running") return;

  const contact = await BulkCampaignContact.findOne({
    campaignId,
    status: "pending",
  }).sort({ createdAt: 1 });

  if (!contact) {
    campaign.status = "completed";
    campaign.completedAt = new Date();
    campaign.currentContactId = null;
    await campaign.save();
    clearCampaignTimer(campaignId);
    return;
  }

  contact.status = "calling";
  contact.attempts += 1;
  contact.calledAt = new Date();
  contact.lastError = "";
  await contact.save();

  campaign.currentContactId = contact._id;
  campaign.lastError = "";
  await campaign.save();
  await refreshCampaignStats(campaignId);

  try {
    const result = await executeOutboundCall({
      tenantId: campaign.tenantId.toString(),
      agentId: campaign.agentId.toString(),
      receiverNumber: contact.phoneNumber,
      callObjective: campaign.callObjective,
      callConfig: campaign.callConfig,
      sessionMeta: {
        bulkCampaignId: campaign._id.toString(),
        bulkContactId: contact._id.toString(),
      },
    });

    if (!result.success) {
      contact.status = "failed";
      contact.lastError = result.error || "Call failed to start";
      contact.completedAt = new Date();
      await contact.save();
      campaign.lastError = contact.lastError;
      await campaign.save();
      await refreshCampaignStats(campaignId);
      scheduleNext(campaignId, campaign.delayBetweenCallsSec);
      return;
    }

    contact.sessionId = result.sessionId;
    contact.roomName = result.roomName;
    await contact.save();
  } catch (err) {
    contact.status = "failed";
    contact.lastError = err.message || "Call failed";
    contact.completedAt = new Date();
    await contact.save();
    campaign.lastError = contact.lastError;
    await campaign.save();
    await refreshCampaignStats(campaignId);
    scheduleNext(campaignId, campaign.delayBetweenCallsSec);
  }
}

export async function handleBulkCallHangup({ roomName }) {
  if (!roomName) return;

  const contact = await BulkCampaignContact.findOne({
    roomName,
    status: "calling",
  });

  if (!contact) return;

  contact.status = "completed";
  contact.completedAt = new Date();
  await contact.save();

  const campaign = await BulkCampaign.findById(contact.campaignId);
  if (!campaign || campaign.status !== "running") {
    await refreshCampaignStats(contact.campaignId);
    return;
  }

  campaign.currentContactId = null;
  await campaign.save();
  await refreshCampaignStats(contact.campaignId);
  scheduleNext(campaign._id, campaign.delayBetweenCallsSec);
}

export async function startBulkCampaign(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);

  const pending = await BulkCampaignContact.countDocuments({
    campaignId,
    status: "pending",
  });

  if (pending === 0) {
    throw new AppError("Add contacts before starting the campaign.", 400);
  }

  campaign.status = "running";
  campaign.startedAt = campaign.startedAt || new Date();
  campaign.completedAt = null;
  campaign.lastError = "";
  await campaign.save();

  await processNextContact(campaignId);
  return campaign;
}

export async function pauseBulkCampaign(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);
  clearCampaignTimer(campaignId);
  campaign.status = "paused";
  campaign.currentContactId = null;
  await campaign.save();

  await BulkCampaignContact.updateMany(
    { campaignId, status: "calling" },
    { $set: { status: "pending", lastError: "Paused mid-call" } },
  );
  await refreshCampaignStats(campaignId);
  return campaign;
}

export async function cancelBulkCampaign(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);
  clearCampaignTimer(campaignId);
  campaign.status = "cancelled";
  campaign.completedAt = new Date();
  campaign.currentContactId = null;
  await campaign.save();

  await BulkCampaignContact.updateMany(
    { campaignId, status: { $in: ["pending", "calling"] } },
    { $set: { status: "skipped" } },
  );
  await refreshCampaignStats(campaignId);
  return campaign;
}

export async function removeCampaignContact(campaignId, contactId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);

  const contact = await BulkCampaignContact.findOne({ _id: contactId, campaignId });
  if (!contact) throw new AppError("Contact not found.", 404);

  if (contact.status === "calling") {
    throw new AppError("Cannot remove a contact while a call is in progress.", 400);
  }

  if (campaign.status === "running" && contact.status !== "pending") {
    throw new AppError("Only pending contacts can be removed while a campaign is running.", 400);
  }

  await BulkCampaignContact.deleteOne({ _id: contactId });
  await refreshCampaignStats(campaignId);
  return contact;
}

export async function clearPendingContacts(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.status === "running") {
    throw new AppError("Pause the campaign before clearing contacts.", 400);
  }

  const result = await BulkCampaignContact.deleteMany({
    campaignId,
    status: "pending",
  });
  await refreshCampaignStats(campaignId);
  return { removed: result.deletedCount ?? 0 };
}

export async function listCampaignContacts(campaignId, { limit = 100, skip = 0 } = {}) {
  return BulkCampaignContact.find({ campaignId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(Math.min(limit, 500))
    .lean();
}

export async function deleteBulkCampaign(campaignId) {
  const campaign = await BulkCampaign.findById(campaignId);
  if (!campaign) throw new AppError("Campaign not found.", 404);
  if (campaign.status === "running") {
    throw new AppError("Pause or cancel the campaign before deleting.", 400);
  }
  clearCampaignTimer(campaignId);
  await BulkCampaignContact.deleteMany({ campaignId });
  await BulkCampaign.deleteOne({ _id: campaignId });
  return { deleted: true };
}
