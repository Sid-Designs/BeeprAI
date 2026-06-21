import Tenant from "../../models/tenant.model.js";
import Agent from "../../models/agent.model.js";

export class MultiTenantAgentEngine {
  async resolve(tenantId, agentId) {
    const [tenant, agent] = await Promise.all([
      Tenant.findById(tenantId).lean(),
      Agent.findOne({ _id: agentId, tenantId }).lean(),
    ]);

    if (!tenant) throw new Error("tenant_not_found");
    if (!agent) throw new Error("agent_not_found");

    return { tenant, agent };
  }
}

export const multiTenantAgentEngine = new MultiTenantAgentEngine();
