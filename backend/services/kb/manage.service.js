import KnowledgeBase from "../../models/knowledgeBase.model.js";
import {
  ingestPdf,
  ingestText,
  ingestUrl,
  deleteDocumentChunks,
} from "./ingest.service.js";

export async function listDocuments(tenantId, agentId) {
  const chunks = await KnowledgeBase.find({ tenantId, agentId })
    .select("docId sourceType sourceUrl metadata text content createdAt updatedAt")
    .sort({ createdAt: 1 })
    .lean();

  const byDoc = new Map();

  for (const chunk of chunks) {
    const docId = chunk.docId;
    if (!docId) continue;

    if (!byDoc.has(docId)) {
      byDoc.set(docId, {
        docId,
        sourceType: chunk.sourceType,
        sourceUrl: chunk.sourceUrl || chunk.metadata?.sourceUrl || "",
        title: chunk.metadata?.heading || "Document",
        chunkCount: 0,
        preview: "",
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
      });
    }

    const doc = byDoc.get(docId);
    doc.chunkCount += 1;
    if (chunk.updatedAt && new Date(chunk.updatedAt) > new Date(doc.updatedAt)) {
      doc.updatedAt = chunk.updatedAt;
    }
    if (!doc.preview) {
      const snippet = String(chunk.text || chunk.content || "").trim();
      if (snippet) doc.preview = snippet.slice(0, 160);
    }
  }

  return Array.from(byDoc.values()).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );
}

export async function getDocument(tenantId, agentId, docId) {
  const chunks = await KnowledgeBase.find({ tenantId, agentId, docId })
    .sort({ "metadata.chunkIndex": 1 })
    .lean();

  if (!chunks.length) return null;

  const first = chunks[0];
  const rawFromMeta = chunks.find((c) => c.metadata?.rawText)?.metadata?.rawText;

  return {
    docId,
    sourceType: first.sourceType,
    sourceUrl: first.sourceUrl || first.metadata?.sourceUrl || "",
    title: first.metadata?.heading || "Document",
    text:
      rawFromMeta ||
      chunks
        .map((c) => String(c.text || c.content || "").trim())
        .filter(Boolean)
        .join("\n\n"),
    chunkCount: chunks.length,
    createdAt: first.createdAt,
    updatedAt: chunks[chunks.length - 1].updatedAt,
  };
}

export async function deleteDocument(tenantId, agentId, docId) {
  const deleted = await deleteDocumentChunks({ tenantId, agentId, docId });
  return { deleted };
}

export async function updateTextDocument({ tenantId, agentId, docId, text, title }) {
  const existing = await getDocument(tenantId, agentId, docId);
  if (!existing) return null;
  if (existing.sourceType !== "text") {
    throw new Error("Only text knowledge sources can be edited as text.");
  }

  await deleteDocumentChunks({ tenantId, agentId, docId });

  const result = await ingestText({
    tenantId,
    agentId,
    text,
    docId,
    title: title || existing.title,
  });

  return { docId, ...result };
}

export async function updateUrlDocument({ tenantId, agentId, docId, url }) {
  const existing = await getDocument(tenantId, agentId, docId);
  if (!existing) return null;
  if (existing.sourceType !== "url") {
    throw new Error("Only URL knowledge sources can be refreshed from a website.");
  }

  const targetUrl = url || existing.sourceUrl;
  if (!targetUrl) {
    throw new Error("URL is required.");
  }

  await deleteDocumentChunks({ tenantId, agentId, docId });

  const result = await ingestUrl({
    tenantId,
    agentId,
    url: targetUrl,
    docId,
  });

  return { docId, sourceUrl: targetUrl, ...result };
}

export async function updatePdfDocument({
  tenantId,
  agentId,
  docId,
  filePath,
  fileName,
}) {
  const existing = await getDocument(tenantId, agentId, docId);
  if (!existing) return null;
  if (existing.sourceType !== "pdf") {
    throw new Error("Only PDF knowledge sources can be replaced with a new PDF.");
  }

  await deleteDocumentChunks({ tenantId, agentId, docId });

  const result = await ingestPdf({
    tenantId,
    agentId,
    filePath,
    fileName: fileName || existing.title,
    docId,
  });

  return { docId, ...result };
}
