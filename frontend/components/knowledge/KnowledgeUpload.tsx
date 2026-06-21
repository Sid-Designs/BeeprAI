"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { KbTextPrepareFlow } from "@/components/knowledge/KbTextPrepareFlow";
import type { Agent, Tenant } from "@/lib/types";

type Tab = "text" | "pdf" | "url" | "test";

const tabs: { id: Tab; label: string; desc: string }[] = [
  { id: "text", label: "Text", desc: "3-step AI formatting guide" },
  { id: "pdf", label: "PDF", desc: "Upload brochures & docs" },
  { id: "url", label: "Website", desc: "Import pages from URLs" },
  { id: "test", label: "Test", desc: "Preview answers before calling" },
];

export function KnowledgeUpload({
  tenantId,
  agentId,
  onUploaded,
  compact = false,
}: {
  tenantId: string;
  agentId: string;
  onUploaded?: () => void;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("text");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [kbTextStep, setKbTextStep] = useState<1 | 2 | 3>(1);
  const [urls, setUrls] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!tenantId || !agentId) {
      setAgent(null);
      return;
    }
    let cancelled = false;
    api
      .listAgents(tenantId)
      .then((response) => {
        if (!cancelled) {
          setAgent(response.data?.find((item) => item._id === agentId) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setAgent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, agentId]);

  useEffect(() => {
    if (!tenantId) {
      setTenant(null);
      return;
    }
    let cancelled = false;
    api
      .getTenant(tenantId)
      .then((response) => {
        if (!cancelled) setTenant(response.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setTenant(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const disabled = !tenantId || !agentId;

  const handleText = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled || !text.trim()) return;
    setBusy("text");
    setMessage("");
    try {
      const res = await api.addKbText({ tenantId, agentId, text });
      setMessage(`Saved successfully — ${res.totalChunks} knowledge chunks added.`);
      onUploaded?.();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const handlePdf = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled || !file) return;
    setBusy("pdf");
    setMessage("");
    try {
      const form = new FormData();
      form.append("tenantId", tenantId);
      form.append("agentId", agentId);
      form.append("file", file);
      const res = await api.addKbPdf(form);
      setMessage(`PDF processed — ${res.totalChunks} chunks added.`);
      setFile(null);
      onUploaded?.();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const handleUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const list = urls
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (!list.length) {
      setMessage("Add at least one valid URL.");
      return;
    }
    setBusy("url");
    setMessage("");
    try {
      const res = await api.addKbUrl({ tenantId, agentId, urls: list });
      setMessage(`Website content imported — ${res.totalChunks} chunks added.`);
      onUploaded?.();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (disabled || !query.trim()) return;
    setBusy("test");
    setMessage("");
    try {
      const res = await api.queryKb({ tenantId, agentId, query });
      const chunks = (res.context ?? []) as { text?: string; score?: number }[];
      if (!chunks.length) {
        setQueryResult("No matching knowledge found. Try adding more content first.");
      } else {
        setQueryResult(chunks.map((c, i) => `${i + 1}. ${c.text ?? "—"}`).join("\n\n"));
      }
      setMessage("Test complete — review retrieved context below.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (disabled) {
    return (
      <p className="rounded-xl border border-dashed border-[#d4e3f7] bg-[#f8fbff] p-4 text-sm text-[#5b7190]">
        Select or create an agent first to upload knowledge.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn("flex gap-1 overflow-x-auto rounded-xl bg-[#f0f7ff] p-1", compact && "flex-wrap")}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMessage("");
            }}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-left transition-all duration-200 sm:px-4",
              tab === t.id ? "bg-white text-[#0c1a2e] shadow-sm" : "text-[#5b7190] hover:text-[#0c1a2e]",
            )}
          >
            <span className="block text-sm font-semibold">{t.label}</span>
            {!compact ? <span className="hidden text-[10px] sm:block">{t.desc}</span> : null}
          </button>
        ))}
      </div>

      {tab === "text" && (
        <form onSubmit={handleText} className="grid gap-4">
          <KbTextPrepareFlow
            value={text}
            onChange={setText}
            agent={agent}
            orgName={tenant?.orgName}
            industry={tenant?.industry}
            compact={compact}
            pasteFieldId="kb-text"
            onActiveStepChange={setKbTextStep}
          />
          <Button type="submit" disabled={busy === "text" || kbTextStep < 3 || !text.trim()}>
            {busy === "text" ? "Saving..." : "Save text knowledge"}
          </Button>
        </form>
      )}

      {tab === "pdf" && (
        <form onSubmit={handlePdf} className="grid gap-4">
          <div>
            <Label htmlFor="kb-pdf">Upload PDF document</Label>
            <div className="mt-1 rounded-xl border-2 border-dashed border-[#d4e3f7] bg-[#f8fbff] p-6 text-center">
              <input
                id="kb-pdf"
                type="file"
                accept="application/pdf,.pdf"
                className="mx-auto block text-sm text-[#5b7190] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0ea5e9] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? <p className="mt-2 text-sm font-medium text-[#0c1a2e]">{file.name}</p> : null}
            </div>
          </div>
          <Button type="submit" disabled={busy === "pdf" || !file}>
            {busy === "pdf" ? "Processing..." : "Upload PDF"}
          </Button>
        </form>
      )}

      {tab === "url" && (
        <form onSubmit={handleUrl} className="grid gap-4">
          <div>
            <Label htmlFor="kb-url">Website URLs</Label>
            <Textarea
              id="kb-url"
              rows={4}
              placeholder={"https://yourbusiness.com/about\nhttps://yourbusiness.com/pricing"}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-[#94a3b8]">One URL per line or comma-separated</p>
          </div>
          <Button type="submit" disabled={busy === "url"}>
            {busy === "url" ? "Importing..." : "Import from website"}
          </Button>
        </form>
      )}

      {tab === "test" && (
        <form onSubmit={handleTest} className="grid gap-4">
          <div>
            <Label htmlFor="kb-query">Ask a test question</Label>
            <Input
              id="kb-query"
              placeholder="What are your business hours?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy === "test"}>
            {busy === "test" ? "Searching..." : "Test knowledge retrieval"}
          </Button>
          {queryResult ? (
            <div className="max-h-48 overflow-auto rounded-xl bg-[#f0f7ff] p-3 text-sm leading-relaxed text-[#325178] whitespace-pre-wrap">
              {queryResult}
            </div>
          ) : null}
        </form>
      )}

      {message ? (
        <p className={cn("text-sm", message.includes("success") || message.includes("chunks") || message.includes("complete") ? "text-emerald-700" : "text-[#5b7190]")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
