import {
  createOrganization,
  getOrganizationById,
  updateOrganization,
  addMember,
  removeMember,
  updateMemberRole,
} from "../services/organization.service.js";
import { log } from "../services/auditLog.service.js";
import { sendResponse } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";

export async function create(req, res) {
  if (req.user.organizationId) {
    throw new AppError("You already belong to an organization.", 409, "ORG_EXISTS");
  }

  const org = await createOrganization(req.user._id, req.body);

  log({
    organizationId: org._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "organization.create",
    resourceType: "Organization",
    resourceId: org._id.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 201, "Organization created.", { organization: org });
}

export async function get(req, res) {
  if (!req.user.organizationId) {
    throw new AppError("You don't belong to an organization yet.", 404, "NO_ORGANIZATION");
  }

  const org = await getOrganizationById(req.user.organizationId);
  if (!org) throw new AppError("Organization not found.", 404);

  sendResponse(res, 200, "Organization details.", { organization: org });
}

export async function update(req, res) {
  if (!req.organizationId) {
    throw new AppError("No organization found.", 404);
  }

  const org = await updateOrganization(req.organizationId, req.body);

  log({
    organizationId: req.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "organization.update",
    resourceType: "Organization",
    resourceId: req.organizationId.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Organization updated.", { organization: org });
}

export async function listMembers(req, res) {
  const org = await getOrganizationById(req.organizationId);
  if (!org) throw new AppError("Organization not found.", 404);

  sendResponse(res, 200, "Organization members.", { members: org.members });
}

export async function updateRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;

  await updateMemberRole(req.organizationId, userId, role);

  log({
    organizationId: req.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "organization.updateMemberRole",
    resourceType: "User",
    resourceId: userId,
    metadata: { newRole: role },
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Member role updated.");
}

export async function removeMemberHandler(req, res) {
  const { userId } = req.params;

  await removeMember(req.organizationId, userId);

  log({
    organizationId: req.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "organization.removeMember",
    resourceType: "User",
    resourceId: userId,
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Member removed.");
}
