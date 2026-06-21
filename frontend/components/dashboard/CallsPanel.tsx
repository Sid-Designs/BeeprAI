"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { getAnalysisPollInterval, isAnalysisPending } from "@/lib/callDetail";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { CallsHistorySidebar, CallReviewPanel } from "@/components/dashboard/CallsTable";
import { Button } from "@/components/shared/Button";
import { Input, Label, Select } from "@/components/shared/FormField";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { LiveCallPanel } from "@/components/dashboard/LiveCallPanel";
import type { Agent, CallAnalysis, LeadOutcomeLive, TelephonyConfig } from "@/lib/types";

export function CallsPanel() {
  const tenantId = getTenantId() ?? "";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [history, setHistory] = useState<CallAnalysis[]>([]);
  const [agentId, setAgentId] = useState("");
  const [receiverNumber, setReceiverNumber] = useState("");
  const [telephony, setTelephony] = useState<TelephonyConfig | null>(null);
  const [note, setNote] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activePhoneNumber, setActivePhoneNumber] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<CallAnalysis | null>(null);
  const [skipAutoSelect, setSkipAutoSelect] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  const scrollToReview = useCallback(() => {
    requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const refreshHistory = useCallback(() => {
    if (!tenantId) return Promise.resolve();
    return api
      .listCallAnalysis(tenantId, { limit: 50, agentId: agentId || undefined })
      .then((callResponse) => {
        setHistory(callResponse.data ?? []);
      });
  }, [tenantId, agentId]);

  const hasPendingAnalysis = history.some((row) => isAnalysisPending(row));

  const handleLiveCallEnded = (_status: LeadOutcomeLive) => {
    setActiveSessionId(null);
    setActivePhoneNumber("");
    void refreshHistory();
    setNote({ type: "info", text: "Call ended. Analysis will appear in the list shortly." });
  };

  const openDetail = (row: CallAnalysis) => {
    setSelectedPreview(row);
    setSelectedSessionId(row.sessionId);
    setSkipAutoSelect(false);
    scrollToReview();
  };

  const clearDetail = () => {
    setSelectedSessionId(null);
    setSelectedPreview(null);
    setSkipAutoSelect(true);
  };

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      api.listAgents(tenantId),
      api.getTenant(tenantId),
      api.listCallAnalysis(tenantId, { limit: 50 }),
    ])
      .then(([agentResponse, tenantResponse, callResponse]) => {
        setAgents(agentResponse.data);
        setAgentId(agentResponse.data?.[0]?._id ?? "");
        setTelephony(tenantResponse.telephony ?? null);
        setHistory(callResponse.data ?? []);
      })
      .catch((error: Error) => setNote({ type: "error", text: error.message }));
  }, [tenantId]);

  useEffect(() => {
    if (!hasPendingAnalysis || !tenantId) return;
    const timer = setInterval(() => void refreshHistory(), getAnalysisPollInterval());
    return () => clearInterval(timer);
  }, [hasPendingAnalysis, tenantId, refreshHistory]);

  useEffect(() => {
    if (!history.length) {
      clearDetail();
      setSkipAutoSelect(false);
      return;
    }
    if (skipAutoSelect) {
      if (selectedSessionId && !history.some((row) => row.sessionId === selectedSessionId)) {
        clearDetail();
      }
      return;
    }
    if (!selectedSessionId || !history.some((row) => row.sessionId === selectedSessionId)) {
      const first = history[0];
      setSelectedPreview(first);
      setSelectedSessionId(first.sessionId);
    }
  }, [history, selectedSessionId, skipAutoSelect]);

  useEffect(() => {
    if (didInitialScroll.current || skipAutoSelect || !selectedSessionId || !history.length) return;
    didInitialScroll.current = true;
    setTimeout(scrollToReview, 200);
  }, [history.length, selectedSessionId, skipAutoSelect, scrollToReview]);

  const onStart = async () => {
    if (!tenantId || !agentId || !receiverNumber.trim()) {
      setNote({ type: "info", text: "Select an agent and enter a customer number." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const response = await api.startCall({
        tenantId,
        agentId,
        receiverNumber: receiverNumber.trim(),
        triggerOutboundCall: true,
        autoJoinCaller: true,
        callObjective: "lead_generation",
        callConfig: {},
      });
      const sessionId = response.data?.sessionId;
      if (sessionId) {
        setActiveSessionId(sessionId);
        setActivePhoneNumber(receiverNumber.trim());
      }
      setNote({
        type: "success",
        text: sessionId ? "Call started — live status appears below." : "Call started.",
      });
      setReceiverNumber("");
      await refreshHistory();
    } catch (error) {
      setNote({ type: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkspaceGate>
      <div className="space-y-4">
        {note ? <InlineAlert variant={note.type}>{note.text}</InlineAlert> : null}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]">
          <CallsHistorySidebar
            rows={history}
            selectedSessionId={selectedSessionId}
            onSelect={openDetail}
            emptyMessage="No calls yet. Use the dialer on the right to place your first call."
          />

          <div className="space-y-4">
            <DashboardPanel
              title="Place a call"
              description="Start a one-off outbound call with your AI agent."
              action={
                <Button href="/dashboard/bulk-calls" variant="secondary" size="sm" className="!text-xs">
                  Bulk calling
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="agent">Agent</Label>
                  <Select id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    {agents.length === 0 ? (
                      <option value="">No agents</option>
                    ) : (
                      agents.map((agent) => (
                        <option key={agent._id} value={agent._id}>{agent.name}</option>
                      ))
                    )}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="caller">Caller ID</Label>
                  <Input
                    id="caller"
                    readOnly
                    value={telephony?.defaultCallerNumber || "Not configured"}
                    className="bg-[#F8FAFC]"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="receiver">Customer number</Label>
                <Input
                  id="receiver"
                  value={receiverNumber}
                  onChange={(e) => setReceiverNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={onStart} disabled={busy || !agents.length} className="shine">
                  {busy ? "Starting…" : "Start call"}
                </Button>
                {!agents.length ? (
                  <Button href="/dashboard/agents" variant="secondary" size="sm">
                    Create an agent
                  </Button>
                ) : null}
                {!telephony?.defaultCallerNumber ? (
                  <span className="text-xs text-[#64748B]">
                    Configure caller ID in Settings before calling.
                  </span>
                ) : null}
              </div>
            </DashboardPanel>

            {activeSessionId ? (
              <LiveCallPanel
                sessionId={activeSessionId}
                phoneNumber={activePhoneNumber}
                onEnded={handleLiveCallEnded}
              />
            ) : null}

            <div ref={reviewRef} className="scroll-mt-6">
              <CallReviewPanel
                sessionId={selectedSessionId}
                preview={selectedPreview}
                onClear={clearDetail}
              />
            </div>
          </div>
        </div>
      </div>
    </WorkspaceGate>
  );
}
