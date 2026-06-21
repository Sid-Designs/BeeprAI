"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";
import { Button } from "@/components/shared/Button";
import { Input, Label, Select, Textarea } from "@/components/shared/FormField";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { cn } from "@/lib/cn";
import type {
  Agent,
  BulkCampaign,
  BulkCampaignContact,
  BulkCampaignGroupType,
} from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#F1F5F9] text-[#475569]",
  running: "bg-[#DCFCE7] text-[#15803D]",
  paused: "bg-[#FEF9C3] text-[#A16207]",
  completed: "bg-[#EFF6FF] text-[#2563EB]",
  cancelled: "bg-[#FEE2E2] text-[#B91C1C]",
  pending: "bg-[#F8FAFC] text-[#64748B]",
  calling: "bg-[#DBEAFE] text-[#1D4ED8]",
  failed: "bg-[#FEE2E2] text-[#B91C1C]",
  skipped: "bg-[#F1F5F9] text-[#94A3B8]",
  completed_contact: "bg-[#DCFCE7] text-[#15803D]",
};

function ContactStatusBadge({ status }: { status: string }) {
  const style =
    status === "completed"
      ? STATUS_STYLES.completed_contact
      : STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", style)}>
      {status}
    </span>
  );
}

export function BulkCallsPanel() {
  const tenantId = getTenantId() ?? "";
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [groupTypes, setGroupTypes] = useState<Record<string, string>>({});
  const [campaigns, setCampaigns] = useState<BulkCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [contacts, setContacts] = useState<BulkCampaignContact[]>([]);
  const [manualText, setManualText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);

  const [form, setForm] = useState({
    name: "",
    groupType: "cold_calling" as BulkCampaignGroupType,
    agentId: "",
    callObjective: "lead_generation",
    delayBetweenCallsSec: 8,
  });

  const selected = campaigns.find((c) => c._id === selectedId) ?? null;
  const isRunning = selected?.status === "running";
  const pendingCount = selected?.stats?.pending ?? 0;

  const scrollToWorkspace = useCallback(() => {
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const refreshCampaigns = useCallback(async () => {
    if (!tenantId) return;
    const res = await api.listBulkCampaigns(tenantId);
    setCampaigns(res.data);
    setCampaignsLoaded(true);
    if (!selectedId && res.data[0]) setSelectedId(res.data[0]._id);
  }, [tenantId, selectedId]);

  const refreshContacts = useCallback(async (campaignId: string) => {
    const res = await api.listBulkCampaignContacts(campaignId);
    setContacts(res.data);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    api
      .listAgents(tenantId)
      .then((res) => {
        setAgents(res.data);
        setForm((f) => ({ ...f, agentId: res.data[0]?._id ?? "" }));
      })
      .catch(() => {});
    api.getBulkGroupTypes().then((res) => setGroupTypes(res.data)).catch(() => {});
    refreshCampaigns().catch(() => {});
  }, [tenantId, refreshCampaigns]);

  useEffect(() => {
    if (campaignsLoaded && campaigns.length === 0) {
      setShowCreateForm(true);
    }
  }, [campaignsLoaded, campaigns.length]);

  useEffect(() => {
    if (!selectedId) return;
    refreshContacts(selectedId).catch(() => {});
    const interval = isRunning
      ? setInterval(() => {
          refreshCampaigns();
          refreshContacts(selectedId);
        }, 5000)
      : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedId, isRunning, refreshCampaigns, refreshContacts]);

  const clearFileSelection = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onCreate = async () => {
    if (!tenantId || !form.name.trim() || !form.agentId) {
      setNote({ type: "info", text: "Enter a campaign name and select an agent." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await api.createBulkCampaign({
        tenantId,
        name: form.name.trim(),
        groupType: form.groupType,
        agentId: form.agentId,
        callObjective: form.callObjective,
        delayBetweenCallsSec: form.delayBetweenCallsSec,
      });
      setForm((f) => ({ ...f, name: "" }));
      await refreshCampaigns();
      setSelectedId(res.data._id);
      setShowCreateForm(false);
      setNote({
        type: "success",
        text: "Campaign created — add your numbers below, then start calling.",
      });
      setTimeout(scrollToWorkspace, 150);
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onAddManual = async () => {
    if (!selectedId || !manualText.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await api.addBulkCampaignContacts(selectedId, { manualText });
      setManualText("");
      await refreshCampaigns();
      await refreshContacts(selectedId);
      setNote({
        type: "success",
        text: `Added ${res.data.added} numbers (${res.data.skipped} duplicates skipped).`,
      });
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onConfirmUpload = async () => {
    if (!selectedId || !pendingFile) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await api.uploadBulkCampaignContacts(selectedId, pendingFile);
      clearFileSelection();
      await refreshCampaigns();
      await refreshContacts(selectedId);
      setNote({
        type: "success",
        text: `Imported ${res.data.added} numbers from file (${res.data.skipped} skipped).`,
      });
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onRemoveContact = async (contactId: string) => {
    if (!selectedId) return;
    setBusy(true);
    setNote(null);
    try {
      await api.removeBulkCampaignContact(selectedId, contactId);
      await refreshCampaigns();
      await refreshContacts(selectedId);
      setNote({ type: "success", text: "Number removed from list." });
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onClearPending = async () => {
    if (!selectedId || pendingCount === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await api.clearPendingBulkContacts(selectedId);
      await refreshCampaigns();
      await refreshContacts(selectedId);
      setNote({ type: "success", text: `Removed ${res.data.removed} pending numbers.` });
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: "start" | "pause" | "cancel") => {
    if (!selectedId) return;
    setBusy(true);
    setNote(null);
    try {
      if (action === "start") await api.startBulkCampaign(selectedId);
      if (action === "pause") await api.pauseBulkCampaign(selectedId);
      if (action === "cancel") await api.cancelBulkCampaign(selectedId);
      await refreshCampaigns();
      await refreshContacts(selectedId);
      setNote({ type: "success", text: `Campaign ${action}ed.` });
    } catch (err) {
      setNote({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const canRemoveContact = (contact: BulkCampaignContact) => {
    if (contact.status === "calling") return false;
    if (isRunning) return contact.status === "pending";
    return true;
  };

  return (
    <WorkspaceGate>
      <div className="space-y-4">
        {note ? <InlineAlert variant={note.type}>{note.text}</InlineAlert> : null}

        <div
          ref={workspaceRef}
          className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]"
        >
          {/* Campaign sidebar */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#0F172A]">Campaigns</h3>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setShowCreateForm((v) => !v)}
                className="!px-3 !py-1.5 text-xs"
              >
                {showCreateForm ? "Close" : "+ New"}
              </Button>
            </div>

            {showCreateForm ? (
              <div className="mt-3 space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div>
                  <Label htmlFor="bulk-name">Name</Label>
                  <Input
                    id="bulk-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="March cold calling"
                  />
                </div>
                <div>
                  <Label htmlFor="bulk-group">Type</Label>
                  <Select
                    id="bulk-group"
                    value={form.groupType}
                    onChange={(e) =>
                      setForm({ ...form, groupType: e.target.value as BulkCampaignGroupType })
                    }
                  >
                    {Object.entries(groupTypes).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                    {!Object.keys(groupTypes).length ? (
                      <>
                        <option value="cold_calling">Cold calling</option>
                        <option value="appointment">Appointment</option>
                        <option value="follow_up">Follow-up</option>
                        <option value="custom">Custom</option>
                      </>
                    ) : null}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bulk-agent">Agent</Label>
                  <Select
                    id="bulk-agent"
                    value={form.agentId}
                    onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  >
                    {agents.map((agent) => (
                      <option key={agent._id} value={agent._id}>{agent.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bulk-delay">Delay (sec)</Label>
                  <Input
                    id="bulk-delay"
                    type="number"
                    min={3}
                    max={120}
                    value={form.delayBetweenCallsSec}
                    onChange={(e) =>
                      setForm({ ...form, delayBetweenCallsSec: Number(e.target.value) || 8 })
                    }
                  />
                </div>
                <Button
                  onClick={onCreate}
                  disabled={busy || !agents.length}
                  className="shine w-full"
                >
                  {busy ? "Creating…" : "Create campaign"}
                </Button>
              </div>
            ) : null}

            <ul className="mt-3 space-y-1.5">
              {campaigns.map((campaign) => (
                <button
                  key={campaign._id}
                  type="button"
                  onClick={() => setSelectedId(campaign._id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition",
                    selectedId === campaign._id
                      ? "border-[#2563EB] bg-[#EFF6FF]"
                      : "border-transparent bg-[#F8FAFC] hover:border-[#E2E8F0] hover:bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{campaign.name}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase",
                        STATUS_STYLES[campaign.status],
                      )}
                    >
                      {campaign.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                    {campaign.stats?.total ?? 0} contacts
                  </p>
                </button>
              ))}
            </ul>

            {campaigns.length === 0 && !showCreateForm ? (
              <p className="mt-3 text-xs text-[#64748B]">
                No campaigns yet.{" "}
                <button
                  type="button"
                  className="font-semibold text-[#2563EB] hover:underline"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create one
                </button>
              </p>
            ) : null}
          </div>

          {/* Main workspace */}
          {selected ? (
            <DashboardPanel
              title={selected.name}
              description={
                groupTypes[selected.groupType] || selected.groupType
              }
              bodyClassName="space-y-4"
              action={
                <Button
                  className="shine"
                  disabled={busy || isRunning || pendingCount === 0}
                  onClick={() => runAction("start")}
                >
                  Start calling
                </Button>
              }
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || !isRunning}
                  onClick={() => runAction("pause")}
                >
                  Pause
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    busy || selected.status === "completed" || selected.status === "cancelled"
                  }
                  onClick={() => runAction("cancel")}
                >
                  Cancel
                </Button>
                {pendingCount > 0 && !isRunning ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={onClearPending}
                    className="text-[#B91C1C] hover:border-[#FECACA]"
                  >
                    Clear pending
                  </Button>
                ) : null}
              </div>

              {selected.stats ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: "Total", value: selected.stats.total, accent: "text-[#0F172A]" },
                    { label: "Pending", value: selected.stats.pending, accent: "text-[#64748B]" },
                    { label: "Live", value: selected.stats.calling, accent: "text-[#2563EB]" },
                    { label: "Done", value: selected.stats.completed, accent: "text-[#15803D]" },
                    { label: "Failed", value: selected.stats.failed, accent: "text-[#B91C1C]" },
                    { label: "Skipped", value: selected.stats.skipped, accent: "text-[#94A3B8]" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] px-2 py-2 text-center"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                        {item.label}
                      </p>
                      <p className={cn("text-lg font-semibold leading-tight", item.accent)}>
                        {item.value ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {selected.lastError ? (
                <InlineAlert variant="error">{selected.lastError}</InlineAlert>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#E2E8F0] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="manual-numbers" className="!mb-0 text-xs font-semibold">
                      Paste numbers
                    </Label>
                    {manualText ? (
                      <button
                        type="button"
                        onClick={() => setManualText("")}
                        disabled={isRunning}
                        className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#B91C1C]"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <Textarea
                    id="manual-numbers"
                    rows={4}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="+91 98765 43210&#10;Name, +91 91234 56789"
                    disabled={isRunning}
                    className="mt-2"
                  />
                  <Button
                    className="mt-2"
                    variant="secondary"
                    disabled={busy || isRunning || !manualText.trim()}
                    onClick={onAddManual}
                  >
                    Add to list
                  </Button>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] p-3">
                  <Label className="text-xs font-semibold">Upload file</Label>
                  <p className="mt-0.5 text-[11px] text-[#94A3B8]">Excel or CSV · phone column required</p>
                  {!pendingFile ? (
                    <label
                      className={cn(
                        "mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-5 transition",
                        isRunning
                          ? "pointer-events-none opacity-50"
                          : "hover:border-[#2563EB] hover:bg-[#EFF6FF]",
                      )}
                    >
                      <span className="text-xs font-medium text-[#475569]">Choose file</span>
                      <span className="text-[10px] text-[#94A3B8]">.xlsx, .csv</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt"
                        disabled={isRunning}
                        className="hidden"
                        onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  ) : (
                    <div className="mt-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[#0F172A]">{pendingFile.name}</p>
                        <button
                          type="button"
                          onClick={clearFileSelection}
                          disabled={busy}
                          className="text-[#64748B] hover:text-[#B91C1C]"
                          aria-label="Remove file"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button onClick={onConfirmUpload} disabled={busy} className="shine !py-1.5 text-xs">
                          Import
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={clearFileSelection} className="!py-1.5 text-xs">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-[#EEF2F7] pt-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Contacts
                    {contacts.length ? (
                      <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">
                        ({contacts.length})
                      </span>
                    ) : null}
                  </p>
                </div>

                {contacts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center">
                    <p className="text-sm text-[#64748B]">No numbers yet — paste or import above.</p>
                  </div>
                ) : (
                  <div className="max-h-[280px] overflow-auto rounded-lg border border-[#EEF2F7]">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-[#F8FAFC]">
                        <tr className="border-b border-[#EEF2F7] text-left text-[10px] uppercase tracking-wide text-[#94A3B8]">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right" />
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((contact) => (
                          <tr key={contact._id} className="border-b border-[#F8FAFC] last:border-0">
                            <td className="px-3 py-2 text-[#475569]">{contact.name || "—"}</td>
                            <td className="px-3 py-2 font-medium text-[#0F172A]">{contact.phoneNumber}</td>
                            <td className="px-3 py-2">
                              <ContactStatusBadge status={contact.status} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canRemoveContact(contact) ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onRemoveContact(contact._id)}
                                  className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#B91C1C]"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DashboardPanel>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8">
              <div className="text-center">
                <p className="text-sm font-medium text-[#334155]">Select a campaign</p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  or{" "}
                  <button
                    type="button"
                    className="font-semibold text-[#2563EB] hover:underline"
                    onClick={() => setShowCreateForm(true)}
                  >
                    create a new one
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceGate>
  );
}
