"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input, Label, Select } from "@/components/shared/FormField";
import { InlineAlert } from "@/components/shared/InlineAlert";
import {
  AGENT_TYPE_OPTIONS,
  DEFAULT_TONE,
  TONE_OPTIONS,
  isAgentType,
  toneLabel,
} from "@/lib/agentOptions";
import type { Agent, AgentType } from "@/lib/types";

export function AgentsPanel() {
  const tenantId = getTenantId();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; type: AgentType; tone: string; script: string }>({
    name: "",
    type: "sales",
    tone: DEFAULT_TONE.sales,
    script: "Greet, qualify, and guide the customer.",
  });

  const handleTypeChange = (value: string) => {
    if (!isAgentType(value)) return;
    setForm((v) => ({
      ...v,
      type: value,
      tone: TONE_OPTIONS[value].includes(v.tone) ? v.tone : DEFAULT_TONE[value],
    }));
  };

  const refresh = async (id: string) => {
    const response = await api.listAgents(id);
    return response.data ?? [];
  };

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    refresh(tenantId)
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    setError("");
    try {
      await api.createAgent({
        tenantId,
        ...form,
        callConfig: { objective: "lead_generation" },
      });
      setForm((current) => ({ ...current, name: "" }));
      const data = await refresh(tenantId);
      setAgents(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkspaceGate>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <DashboardPanel
          title="Create agent"
          description="Add a new AI voice agent to your workspace."
        >
          <form onSubmit={onCreate} className="grid gap-4">
            <div>
              <Label htmlFor="name">Agent name</Label>
              <Input
                id="name"
                placeholder="Sales Agent"
                value={form.name}
                onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                {AGENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select
                id="tone"
                value={form.tone}
                onChange={(e) => setForm((v) => ({ ...v, tone: e.target.value }))}
              >
                {TONE_OPTIONS[form.type].map((value) => (
                  <option key={value} value={value}>
                    {toneLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={busy} className="shine w-full sm:w-auto">
              {busy ? "Creating..." : "Create agent"}
            </Button>
          </form>
        </DashboardPanel>

        <div className="space-y-4">
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

          {!agents.length ? (
            <EmptyState
              icon="agents"
              title="No agents yet"
              description="Create your first AI agent to start handling customer conversations."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.map((agent) => (
                <Card key={agent._id} hover>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#0F172A]">{agent.name}</p>
                      <p className="mt-1 text-xs capitalize text-[#64748B]">{agent.type}</p>
                    </div>
                    <span className="rounded-full bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
                      Active
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#64748B]">
                    Tone: <span className="font-medium text-[#334155]">{agent.tone || "default"}</span>
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </WorkspaceGate>
  );
}
