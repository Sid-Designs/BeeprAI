import { v4 as uuidv4 } from "uuid";
import KnowledgeBase from "../../models/knowledgeBase.model.js";
import {
  parsePdfDocument,
  parseTextDocument,
  parseUrlDocument,
} from "./parser.service.js";
import { chunkSections } from "./chunk.service.js";
import { embedChunks } from "./embedding.service.js";

const buildDocId = (prefix) => `${prefix}_${Date.now()}_${uuidv4()}`;

export const deleteDocumentChunks = async ({ tenantId, agentId, docId }) => {
  const result = await KnowledgeBase.deleteMany({ tenantId, agentId, docId });
  return result.deletedCount ?? 0;
};

const storeChunks = async ({
  tenantId,
  agentId,
  docId,
  sourceType,
  sourceUrl,
  chunks,
  rawText,
  documentTitle,
}) => {
  if (!chunks.length) return { inserted: 0 };

  const embedded = await embedChunks(chunks);

  const documents = embedded.map((item) => ({
    tenantId,
    agentId,
    docId,
    text: item.text,
    content: item.text,
    embedding: item.vector,
    metadata: {
      heading: documentTitle || item.metadata.heading,
      chunkIndex: item.metadata.chunkIndex,
      sourceType,
      sourceUrl,
      ...(item.metadata.chunkIndex === 0 && rawText ? { rawText } : {}),
    },
    sourceType,
    sourceUrl,
    sourceId: docId,
  }));

  await KnowledgeBase.insertMany(documents);
  return { inserted: documents.length };
};

export const ingestText = async ({
  tenantId,
  agentId,
  text,
  docId: existingDocId,
  title,
}) => {
  const docId = existingDocId || buildDocId("text");
  const documentTitle = title || "Text Document";
  const parsed = await parseTextDocument(text, documentTitle);

  const chunks = chunkSections(
    parsed.sections,
    {
      docId,
      sourceType: "text",
    },
    {
      chunkTokens: 180,
      overlapTokens: 30,
      minTokens: 35,
    },
  );

  return storeChunks({
    tenantId,
    agentId,
    docId,
    sourceType: "text",
    chunks,
    rawText: text,
    documentTitle,
  });
};

export const ingestPdf = async ({
  tenantId,
  agentId,
  filePath,
  fileName,
  docId: existingDocId,
}) => {
  const docId = existingDocId || buildDocId("pdf");
  const documentTitle = fileName || "PDF Document";
  const parsed = await parsePdfDocument(filePath, documentTitle);

  const chunks = chunkSections(parsed.sections, {
    docId,
    sourceType: "pdf",
  });

  return storeChunks({
    tenantId,
    agentId,
    docId,
    sourceType: "pdf",
    chunks,
    documentTitle,
  });
};

export const ingestUrl = async ({
  tenantId,
  agentId,
  url,
  docId: existingDocId,
}) => {
  const docId = existingDocId || buildDocId("url");
  const parsed = await parseUrlDocument(url);

  const chunks = chunkSections(parsed.sections, {
    docId,
    sourceType: "url",
    sourceUrl: url,
  });

  return storeChunks({
    tenantId,
    agentId,
    docId,
    sourceType: "url",
    sourceUrl: url,
    chunks,
    documentTitle: parsed.title || url,
  });
};
