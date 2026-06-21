import mongoose from "mongoose";

import { PLANS } from "../config/plans.js";
import Agent from "../models/agent.model.js";
import Tenant from "../models/tenant.model.js";

const usagePeriodKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${year}-${month}`;
};

const syncUsagePeriod = (tenant) => {
  const currentPeriod = usagePeriodKey();
  const storedPeriod = String(tenant?.metadata?.usagePeriod || "");

  if (storedPeriod !== currentPeriod) {
    tenant.usage = tenant.usage || {};
    tenant.usage.callsUsed = 0;
    tenant.metadata = tenant.metadata || {};
    tenant.metadata.usagePeriod = currentPeriod;
    if (typeof tenant.markModified === "function") {
      tenant.markModified("usage");
      tenant.markModified("metadata");
    }
  }

  return tenant;
};

export const buildTenantUsageSummary = async (tenantDoc) => {
  const tenant = tenantDoc?.toObject ? tenantDoc.toObject() : { ...tenantDoc };
  syncUsagePeriod(tenant);

  const agentsUsed = await Agent.countDocuments({
    tenantId: tenant._id,
    isActive: { $ne: false },
  });

  const maxCalls = Number(tenant.usageLimits?.maxCallsPerMonth || 0);
  const callsUsed = Number(tenant.usage?.callsUsed || 0);
  const maxAgents = Number(tenant.usageLimits?.maxAgents || 0);

  return {
    plan: tenant.plan || "free",
    usageLimits: {
      maxCallsPerMonth: maxCalls,
      maxAgents: maxAgents,
    },
    usage: {
      callsUsed,
      agentsUsed,
    },
    callsRemaining: Math.max(0, maxCalls - callsUsed),
    agentsRemaining: Math.max(0, maxAgents - agentsUsed),
    usagePeriod: tenant.metadata?.usagePeriod || usagePeriodKey(),
    planFeatures: PLANS[tenant.plan] || PLANS.free,
  };
};

export const assertTenantCanStartCall = async (tenantId) => {
  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    throw new Error("Invalid tenantId");
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  if (!tenant.isActive) {
    throw new Error("Tenant is inactive");
  }

  syncUsagePeriod(tenant);
  if (tenant.isModified()) {
    await tenant.save();
  }

  const maxCalls = Number(tenant.usageLimits?.maxCallsPerMonth || 0);
  const callsUsed = Number(tenant.usage?.callsUsed || 0);

  if (maxCalls > 0 && callsUsed >= maxCalls) {
    const err = new Error(
      `Monthly call limit reached (${maxCalls} calls on ${tenant.plan} plan). Upgrade your plan to continue.`,
    );
    err.code = "CALL_LIMIT_REACHED";
    err.statusCode = 403;
    throw err;
  }

  return tenant;
};

export const incrementTenantCallUsage = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return null;

  syncUsagePeriod(tenant);
  tenant.usage = tenant.usage || {};
  tenant.usage.callsUsed = Number(tenant.usage.callsUsed || 0) + 1;
  tenant.metadata = tenant.metadata || {};
  tenant.metadata.usagePeriod = tenant.metadata.usagePeriod || usagePeriodKey();
  tenant.metadata.lastCallAt = new Date().toISOString();

  await tenant.save();
  return tenant;
};
