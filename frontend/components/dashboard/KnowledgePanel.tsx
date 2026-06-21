"use client";

import { useEffect, useState } from "react";
import { KnowledgeManager } from "@/components/knowledge/KnowledgeManager";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { EmptyState } from "@/components/shared/EmptyState";
import { Label, Select } from "@/components/shared/FormField";
import type { Agent, Tenant } from "@/lib/types";

export function KnowledgePanel() {
  const tenantId = getTenantId() ?? "";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    api.getTenant(tenantId).then((response) => {
      setTenant(response.data ?? null);
    }).catch(() => setTenant(null));
    api.listAgents(tenantId).then((response) => {
      setAgents(response.data);
      setSelectedAgent(response.data?.[0]?._id ?? "");
    });
  }, [tenantId]);

  return (
    <WorkspaceGate>
      <DashboardPanel
        title="Knowledge base"
        description="Add sources on the left, manage and edit them in the workspace on the right."
        bodyClassName="pt-5"
      >
        {agents.length === 0 ? (
          <EmptyState
            icon="agents"
            title="Create an agent first"
            description="Add at least one agent before uploading knowledge sources."
            cta={{ label: "Go to Agents", href: "/dashboard/agents" }}
          />
        ) : (
          <div className="space-y-5">
            <div className="max-w-md">
              <Label htmlFor="agent">Target agent</Label>
              <Select
                id="agent"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedAgent ? (
              <KnowledgeManager
                key={selectedAgent}
                tenantId={tenantId}
                agentId={selectedAgent}
                agent={agents.find((item) => item._id === selectedAgent) ?? null}
                orgName={tenant?.orgName}
                industry={tenant?.industry}
              />
            ) : null}
          </div>
        )}
      </DashboardPanel>
    </WorkspaceGate>
  );
}
