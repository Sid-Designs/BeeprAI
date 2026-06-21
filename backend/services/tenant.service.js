import Tenant from "../models/tenant.model.js";

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
};

const generateUniqueSlug = async (baseSlug) => {
  let slug = baseSlug;
  let counter = 1;

  while (await Tenant.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

const createTenant = async ({ orgName, industry, organizationId }) => {
  if (!orgName) {
    throw new Error("Organization name is required");
  }

  if (organizationId) {
    const existing = await Tenant.findOne({ organizationId });
    if (existing) return existing;
  }

  const baseSlug = generateSlug(orgName);
  const slug = await generateUniqueSlug(baseSlug);

  const tenant = new Tenant({
    orgName,
    industry,
    slug,
    organizationId: organizationId || undefined,
    metadata: {
      usagePeriod: `${new Date().getUTCFullYear()}-${new Date().getUTCMonth() + 1}`,
    },
  });

  await tenant.save();

  return tenant;
};

const getTenantById = async (tenantId) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
};

const getTenantByOrganizationId = async (organizationId) => {
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const tenant = await Tenant.findOne({ organizationId });
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
};

export default { createTenant, getTenantById, getTenantByOrganizationId };
