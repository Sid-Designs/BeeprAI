import Agent from "../models/agent.model.js";
import CallAnalysis from "../models/callAnalysis.model.js";
import Tenant from "../models/tenant.model.js";
import { buildTenantUsageSummary } from "../services/tenantUsage.service.js";

export const listAdminTenants = async (_req, res) => {
  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
  const withUsage = await Promise.all(
    tenants.map(async (tenant) => ({
      ...tenant,
      usageSummary: await buildTenantUsageSummary(tenant),
    })),
  );
  return res.status(200).json({
    success: true,
    count: withUsage.length,
    data: withUsage,
  });
};

export const listAdminAgents = async (_req, res) => {
  const agents = await Agent.find({}).sort({ createdAt: -1 }).lean();
  return res.status(200).json({
    success: true,
    count: agents.length,
    data: agents,
  });
};

export const listAdminCallAnalysis = async (_req, res) => {
  const records = await CallAnalysis.find({}).sort({ createdAt: -1 }).limit(200).lean();
  return res.status(200).json({
    success: true,
    count: records.length,
    data: records,
  });
};
