import Organization from "../models/organization.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

async function uniqueSlug(base) {
  let slug = base;
  let counter = 1;
  while (await Organization.exists({ slug })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function createOrganization(ownerId, { name, industry = "" }) {
  const slug = await uniqueSlug(generateSlug(name));

  const org = await Organization.create({
    name,
    slug,
    industry,
    ownerId,
    members: [{ userId: ownerId, role: "owner" }],
  });

  await User.findByIdAndUpdate(ownerId, {
    organizationId: org._id,
    role: "owner",
  });

  return org;
}

export async function getOrganizationById(orgId) {
  return Organization.findById(orgId);
}

export async function getOrganizationByOwner(ownerId) {
  return Organization.findOne({ ownerId, isActive: true });
}

export async function addMember(orgId, userId, role) {
  const org = await Organization.findById(orgId);
  if (!org) throw new AppError("Organization not found.", 404);

  const alreadyMember = org.members.some(
    (m) => m.userId.toString() === userId.toString(),
  );
  if (alreadyMember) throw new AppError("User is already a member.", 409);

  org.members.push({ userId, role });
  await org.save();

  await User.findByIdAndUpdate(userId, { organizationId: orgId, role });

  return org;
}

export async function removeMember(orgId, userId) {
  const org = await Organization.findById(orgId);
  if (!org) throw new AppError("Organization not found.", 404);

  if (org.ownerId.toString() === userId.toString()) {
    throw new AppError("Cannot remove the organization owner.", 400);
  }

  org.members = org.members.filter(
    (m) => m.userId.toString() !== userId.toString(),
  );
  await org.save();

  await User.findByIdAndUpdate(userId, { organizationId: null });
}

export async function updateMemberRole(orgId, userId, newRole) {
  const org = await Organization.findById(orgId);
  if (!org) throw new AppError("Organization not found.", 404);

  if (org.ownerId.toString() === userId.toString()) {
    throw new AppError("Cannot change the owner's role.", 400);
  }

  const member = org.members.find(
    (m) => m.userId.toString() === userId.toString(),
  );
  if (!member) throw new AppError("Member not found.", 404);

  member.role = newRole;
  await org.save();

  await User.findByIdAndUpdate(userId, { role: newRole });
}

export async function assertMembership(orgId, userId) {
  const org = await Organization.findById(orgId);
  if (!org) throw new AppError("Organization not found.", 404);

  const isMember = org.members.some(
    (m) => m.userId.toString() === userId.toString(),
  );
  if (!isMember) throw new AppError("Access denied.", 403, "NOT_MEMBER");

  return org;
}

export async function updateOrganization(orgId, updates) {
  const allowed = ["name", "industry", "settings"];
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k)),
  );
  return Organization.findByIdAndUpdate(orgId, filtered, {
    new: true,
    runValidators: true,
  });
}
