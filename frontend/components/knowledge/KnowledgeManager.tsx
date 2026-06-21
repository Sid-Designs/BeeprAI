"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Input, Label, Textarea } from "@/components/shared/FormField";
import { cn } from "@/lib/cn";
import type {
  Agent,
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  KnowledgeSourceType,
} from "@/lib/types";
import { KbTextPrepareFlow } from "@/components/knowledge/KbTextPrepareFlow";

type PanelMode = "welcome" | "add" | "edit" | "test";
type AddType = "text" | "pdf" | "url";

const sourceLabels: Record<KnowledgeSourceType, string> = {
  text: "Text",
  pdf: "PDF",
  url: "Website",
};

const sourceColors: Record<KnowledgeSourceType, string> = {
  text: "bg-[#EFF6FF] text-[#1D4ED8]",
  pdf: "bg-[#FEF3C7] text-[#B45309]",
  url: "bg-[#ECFDF5] text-[#047857]",
};

const addTypes: { id: AddType; label: string; desc: string }[] = [
  { id: "text", label: "Text", desc: "3-step AI formatting guide" },
  { id: "pdf", label: "PDF", desc: "Upload a document" },
  { id: "url", label: "Website", desc: "Import a page" },
];

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function KnowledgeManager({
  tenantId,
  agentId,
  agent,
  orgName,
  industry,
}: {
  tenantId: string;
  agentId: string;
  agent?: Agent | null;
  orgName?: string;
  industry?: string;
}) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [panelMode, setPanelMode] = useState<PanelMode>("welcome");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  const [addType, setAddType] = useState<AddType>("text");
  const [addText, setAddText] = useState("");
  const [addUrls, setAddUrls] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [kbTextStep, setKbTextStep] = useState<1 | 2 | 3>(1);

  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);

  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState("");

  function bumpRefresh() {
    setRefreshKey((value) => value + 1);
  }

  function showMessage(text: string, tone: "success" | "error" | "info" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  useEffect(() => {
    if (!tenantId || !agentId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.listKbDocuments(tenantId, agentId);
        if (!cancelled) {
          setDocuments(res.data ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDocuments([]);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId, agentId, refreshKey]);

  useEffect(() => {
    if (panelMode !== "edit" || !selectedDocId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.getKbDocument(tenantId, agentId, selectedDocId);
        if (!cancelled) {
          const doc = res.data;
          setDetail(doc);
          setEditTitle(doc.title);
          setEditText(doc.text);
          setEditUrl(doc.sourceUrl || "");
          setEditFile(null);
          setDetailLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          showMessage((err as Error).message, "error");
          closePanel();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [panelMode, selectedDocId, tenantId, agentId]);

  function openAdd(type: AddType = "text") {
    setPanelMode("add");
    setAddType(type);
    setKbTextStep(1);
    setSelectedDocId(null);
    setDetail(null);
    setDetailLoading(false);
    setMessage("");
    setAddFile(null);
  }

  function openEdit(doc: KnowledgeDocument) {
    setPanelMode("edit");
    setSelectedDocId(doc.docId);
    setDetail(null);
    setDetailLoading(true);
    setMessage("");
  }

  function openTest() {
    setPanelMode("test");
    setSelectedDocId(null);
    setDetail(null);
    setDetailLoading(false);
    setMessage("");
    setTestResult("");
  }

  function closePanel() {
    setPanelMode("welcome");
    setSelectedDocId(null);
    setDetail(null);
    setDetailLoading(false);
  }

  async function handleDelete(doc: KnowledgeDocument) {
    const confirmed = window.confirm(
      `Delete "${doc.title}"? This removes ${doc.chunkCount} chunk(s) from this agent.`,
    );
    if (!confirmed) return;

    setBusy(`delete-${doc.docId}`);
    try {
      await api.deleteKbDocument({ tenantId, agentId, docId: doc.docId });
      if (selectedDocId === doc.docId) {
        closePanel();
      }
      showMessage("Knowledge source deleted.", "success");
      bumpRefresh();
    } catch (err) {
      showMessage((err as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy("add");
    setMessage("");

    try {
      if (addType === "text") {
        if (!addText.trim()) return;
        const res = await api.addKbText({ tenantId, agentId, text: addText });
        setAddText("");
        showMessage(`${res.totalChunks} chunks added from text.`, "success");
      } else if (addType === "pdf") {
        if (!addFile) return;
        const form = new FormData();
        form.append("tenantId", tenantId);
        form.append("agentId", agentId);
        form.append("file", addFile);
        const res = await api.addKbPdf(form);
        setAddFile(null);
        showMessage(`${res.totalChunks} chunks added from PDF.`, "success");
      } else {
        const list = addUrls
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter(Boolean);
        if (!list.length) {
          showMessage("Add at least one valid URL.", "error");
          return;
        }
        const res = await api.addKbUrl({ tenantId, agentId, urls: list });
        setAddUrls("");
        showMessage(`${res.totalChunks} chunks imported from website.`, "success");
      }

      bumpRefresh();
      closePanel();
    } catch (err) {
      showMessage((err as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;

    setBusy("save");
    try {
      if (detail.sourceType === "text") {
        const res = await api.updateKbText({
          tenantId,
          agentId,
          docId: detail.docId,
          text: editText,
          title: editTitle,
        });
        showMessage(`Text updated — ${res.totalChunks} chunks saved.`, "success");
      } else if (detail.sourceType === "url") {
        const res = await api.updateKbUrl({
          tenantId,
          agentId,
          docId: detail.docId,
          url: editUrl,
        });
        showMessage(`Website refreshed — ${res.totalChunks} chunks saved.`, "success");
      } else {
        if (!editFile) {
          showMessage("Choose a new PDF file to replace this document.", "error");
          return;
        }
        const form = new FormData();
        form.append("tenantId", tenantId);
        form.append("agentId", agentId);
        form.append("docId", detail.docId);
        form.append("file", editFile);
        const res = await api.updateKbPdf(form);
        setEditFile(null);
        showMessage(`PDF replaced — ${res.totalChunks} chunks saved.`, "success");
      }

      bumpRefresh();
    } catch (err) {
      showMessage((err as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  async function handleTest(e: FormEvent) {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setBusy("test");
    setTestResult("");
    try {
      const res = await api.queryKb({ tenantId, agentId, query: testQuery });
      const chunks = (res.context ?? []) as { text?: string }[];
      if (!chunks.length) {
        setTestResult("No matching knowledge found. Try adding more content first.");
      } else {
        setTestResult(chunks.map((c, i) => `${i + 1}. ${c.text ?? "—"}`).join("\n\n"));
      }
      showMessage("Test complete — review results below.", "success");
    } catch (err) {
      showMessage((err as Error).message, "error");
    } finally {
      setBusy("");
    }
  }

  const selectedDoc = documents.find((doc) => doc.docId === selectedDocId);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,320px)_1fr] lg:items-start">
      {/* Left — source library */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Sources</h3>
            <p className="text-xs text-[#64748B]">
              {loading ? "Loading…" : `${documents.length} uploaded`}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => openAdd("text")}>
            + Add
          </Button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={openTest}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
              panelMode === "test"
                ? "border-[#2563EB] bg-white text-[#2563EB] shadow-sm"
                : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
            )}
          >
            Test retrieval
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
            ))
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-4 text-center text-xs text-[#64748B]">
              No sources yet. Click <strong>Add</strong> to upload your first one.
            </div>
          ) : (
            documents.map((doc) => {
              const active = panelMode === "edit" && selectedDocId === doc.docId;
              return (
                <div
                  key={doc.docId}
                  className={cn(
                    "group rounded-xl border bg-white p-3 transition",
                    active
                      ? "border-[#2563EB] ring-2 ring-[#2563EB]/15"
                      : "border-[#E2E8F0] hover:border-[#CBD5E1]",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => openEdit(doc)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          sourceColors[doc.sourceType],
                        )}
                      >
                        {sourceLabels[doc.sourceType]}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {formatDate(doc.updatedAt || doc.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-[#0F172A]">{doc.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#94A3B8]">{doc.chunkCount} chunks</p>
                  </button>
                  <div className="mt-2 flex justify-end opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => handleDelete(doc)}
                      className="text-xs font-medium text-[#EF4444] hover:text-[#DC2626] disabled:opacity-50"
                    >
                      {busy === `delete-${doc.docId}` ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right — workspace */}
      <div className="min-h-[420px] rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        {message ? (
          <InlineAlert
            className="mb-4"
            variant={messageTone === "success" ? "success" : messageTone === "error" ? "error" : "info"}
          >
            {message}
          </InlineAlert>
        ) : null}

        {panelMode === "welcome" && (
          <div className="flex h-full min-h-[360px] flex-col">
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                {documents.length ? "Manage your knowledge" : "Add your first source"}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {documents.length
                  ? "Select a source on the left to view and edit it, or add a new one."
                  : "Choose how you want to train this agent — text, PDF, or website."}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {addTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => openAdd(type.id)}
                  className="rounded-xl border border-[#E2E8F0] p-4 text-left transition hover:border-[#BFDBFE] hover:bg-[#F8FAFC] hover:shadow-sm"
                >
                  <span className="text-sm font-semibold text-[#0F172A]">{type.label}</span>
                  <p className="mt-1 text-xs text-[#64748B]">{type.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-[#F8FAFC] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Quick tip</p>
              <p className="mt-1 text-sm text-[#475569]">
                Use <button type="button" className="font-medium text-[#2563EB] hover:underline" onClick={openTest}>Test retrieval</button> to preview what your agent will see before going live.
              </p>
            </div>
          </div>
        )}

        {panelMode === "add" && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">Add knowledge source</h3>
                <p className="mt-1 text-sm text-[#64748B]">Choose a format and upload content for this agent.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                Cancel
              </Button>
            </div>

            {addType === "text" ? (
              <p className="mt-3 text-sm text-[#64748B]">
                Follow all three steps each time you add text knowledge — raw notes, ChatGPT prompt,
                then paste the formatted result.
              </p>
            ) : null}

            <div className="mt-4 flex gap-1 rounded-xl bg-[#F1F5F9] p-1">
              {addTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setAddType(type.id)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                    addType === type.id
                      ? "bg-white text-[#0F172A] shadow-sm"
                      : "text-[#64748B] hover:text-[#0F172A]",
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAdd} className="mt-5 grid gap-4">
              {addType === "text" ? (
                <KbTextPrepareFlow
                  key="add-text"
                  value={addText}
                  onChange={setAddText}
                  agent={agent}
                  orgName={orgName}
                  industry={industry}
                  pasteFieldId="kb-add-text"
                  onActiveStepChange={setKbTextStep}
                />
              ) : null}

              {addType === "pdf" ? (
                <div>
                  <Label htmlFor="kb-add-pdf">PDF document</Label>
                  <div className="mt-1 rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
                    <input
                      id="kb-add-pdf"
                      type="file"
                      accept="application/pdf,.pdf"
                      className="mx-auto block text-sm text-[#64748B] file:mr-3 file:rounded-lg file:border-0 file:bg-[#2563EB] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                      onChange={(e) => setAddFile(e.target.files?.[0] ?? null)}
                    />
                    {addFile ? (
                      <p className="mt-2 text-sm font-medium text-[#0F172A]">{addFile.name}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {addType === "url" ? (
                <div>
                  <Label htmlFor="kb-add-url">Website URLs</Label>
                  <Textarea
                    id="kb-add-url"
                    rows={5}
                    placeholder={"https://yourbusiness.com/about\nhttps://yourbusiness.com/pricing"}
                    value={addUrls}
                    onChange={(e) => setAddUrls(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-[#94A3B8]">One URL per line or comma-separated</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={
                    busy === "add" ||
                    (addType === "text" && (kbTextStep < 3 || !addText.trim()))
                  }
                >
                  {busy === "add" ? "Saving…" : "Add to knowledge base"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {panelMode === "edit" && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedDoc ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        sourceColors[selectedDoc.sourceType],
                      )}
                    >
                      {sourceLabels[selectedDoc.sourceType]}
                    </span>
                  ) : null}
                  <h3 className="truncate text-base font-semibold text-[#0F172A]">
                    {selectedDoc?.title ?? "Edit source"}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-[#64748B]">
                  Update this source — changes are re-indexed for your agent.
                </p>
              </div>
              <div className="flex gap-2">
                {selectedDoc ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#EF4444] hover:bg-[#FEF2F2]"
                    disabled={Boolean(busy)}
                    onClick={() => handleDelete(selectedDoc)}
                  >
                    Delete
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                  Close
                </Button>
              </div>
            </div>

            {detailLoading ? (
              <div className="mt-8 space-y-3">
                <div className="h-10 animate-pulse rounded-lg bg-[#F1F5F9]" />
                <div className="h-40 animate-pulse rounded-lg bg-[#F1F5F9]" />
              </div>
            ) : detail ? (
              <form onSubmit={handleSaveEdit} className="mt-5 grid gap-4">
                {detail.sourceType === "text" ? (
                  <>
                    <div>
                      <Label htmlFor="kb-edit-title">Title</Label>
                      <Input
                        id="kb-edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <KbTextPrepareFlow
                      key={detail.docId}
                      value={editText}
                      onChange={setEditText}
                      agent={agent}
                      orgName={orgName}
                      industry={industry}
                      pasteFieldId="kb-edit-text"
                      pasteLabel="Formatted knowledge"
                      onActiveStepChange={setKbTextStep}
                    />
                  </>
                ) : null}

                {detail.sourceType === "url" ? (
                  <div>
                    <Label htmlFor="kb-edit-url">Website URL</Label>
                    <Input
                      id="kb-edit-url"
                      type="url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      required
                    />
                    <p className="mt-1.5 text-xs text-[#94A3B8]">
                      Saving will re-fetch content from this URL.
                    </p>
                  </div>
                ) : null}

                {detail.sourceType === "pdf" ? (
                  <div>
                    <Label htmlFor="kb-edit-pdf">Replace PDF</Label>
                    <div className="mt-1 rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
                      <input
                        id="kb-edit-pdf"
                        type="file"
                        accept="application/pdf,.pdf"
                        className="mx-auto block text-sm text-[#64748B] file:mr-3 file:rounded-lg file:border-0 file:bg-[#2563EB] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                        onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                      />
                      {editFile ? (
                        <p className="mt-2 text-sm font-medium text-[#0F172A]">{editFile.name}</p>
                      ) : (
                        <p className="mt-2 text-xs text-[#94A3B8]">Current file: {detail.title}</p>
                      )}
                    </div>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={
                    busy === "save" ||
                    (detail.sourceType === "text" && (kbTextStep < 3 || !editText.trim()))
                  }
                >
                  {busy === "save" ? "Saving…" : "Save changes"}
                </Button>
              </form>
            ) : null}
          </div>
        )}

        {panelMode === "test" && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#0F172A]">Test retrieval</h3>
                <p className="mt-1 text-sm text-[#64748B]">
                  Ask a question to preview what context your agent would use.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                Close
              </Button>
            </div>

            <form onSubmit={handleTest} className="mt-5 grid gap-4">
              <div>
                <Label htmlFor="kb-test-query">Test question</Label>
                <Input
                  id="kb-test-query"
                  placeholder="What are your business hours?"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={busy === "test"}>
                {busy === "test" ? "Searching…" : "Run test"}
              </Button>
              {testResult ? (
                <div className="max-h-64 overflow-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm leading-relaxed text-[#475569] whitespace-pre-wrap">
                  {testResult}
                </div>
              ) : null}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
