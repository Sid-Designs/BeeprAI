import mongoose from "mongoose";
import Tenant from "../models/tenant.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Ensures the authenticated user belongs to the organization linked to tenantId.
 * Regular dashboard routes must never return cross-tenant data.
 */
export async function assertTenantAccess(user, tenantId) {
  if (!tenantId) {
    throw new AppError("tenantId is required.", 400, "TENANT_REQUIRED");
  }

  if (!user) {
    throw new AppError("Authentication required.", 401, "NO_TOKEN");
  }

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new AppError("Invalid workspace id.", 400, "INVALID_TENANT");
  }

  const tenant = await Tenant.findById(tenantId).select("organizationId").lean();
  if (!tenant) {
    throw new AppError("Workspace not found.", 404, "TENANT_NOT_FOUND");
  }

  const userOrgId = user.organizationId?.toString();
  const tenantOrgId = tenant.organizationId?.toString();

  if (!userOrgId || !tenantOrgId || userOrgId !== tenantOrgId) {
    throw new AppError("Access denied for this workspace.", 403, "FORBIDDEN");
  }

  return tenant;
}
