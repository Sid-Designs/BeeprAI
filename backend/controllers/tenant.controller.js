import tenantService from "../services/tenant.service.js";
import { buildTenantUsageSummary } from "../services/tenantUsage.service.js";
import { getTelephonyConfig } from "../config/telephony.js";

const registerTenant = async (req, res, next) => {
  try {
    const { orgName, industry } = req.body;
    const organizationId = req.user?.organizationId ?? null;

    const tenant = await tenantService.createTenant({
      orgName,
      industry,
      organizationId,
    });

    const usage = await buildTenantUsageSummary(tenant);

    res.status(201).json({
      success: true,
      data: tenant,
      usage,
      telephony: getTelephonyConfig(),
    });
  } catch (error) {
    next(error);
  }
};

const getMyTenant = async (req, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(404).json({
        success: false,
        message: "No organization linked to this account.",
      });
    }

    const tenant = await tenantService.getTenantByOrganizationId(organizationId);
    const usage = await buildTenantUsageSummary(tenant);

    res.status(200).json({
      success: true,
      data: tenant,
      usage,
      telephony: getTelephonyConfig(),
    });
  } catch (error) {
    if (error.message === "Tenant not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await tenantService.getTenantById(tenantId);
    const usage = await buildTenantUsageSummary(tenant);

    res.status(200).json({
      success: true,
      data: tenant,
      usage,
      telephony: getTelephonyConfig(),
    });
  } catch (error) {
    if (error.message === "Tenant not found") {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export default { registerTenant, getMyTenant, getTenant };
