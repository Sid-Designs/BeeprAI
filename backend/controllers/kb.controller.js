import fs from "fs";
import {
  ingestPdf,
  ingestText,
  ingestUrl,
} from "../services/kb/ingest.service.js";
import {
  deleteDocument,
  getDocument,
  listDocuments,
  updatePdfDocument,
  updateTextDocument,
  updateUrlDocument,
} from "../services/kb/manage.service.js";
import { retrieveContext } from "../services/kb/retrieval.service.js";

export const addTextToKB = async (req, res) => {
  try {
    const { tenantId, agentId, text } = req.body;

    // 1. Validate input
    if (!tenantId || !agentId || !text) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and text are required",
      });
    }

    const result = await ingestText({ tenantId, agentId, text });

    if (!result.inserted) {
      return res.status(400).json({
        success: false,
        message: "No valid content to process",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Text processed and stored successfully",
      totalChunks: result.inserted,
    });
  } catch (error) {
    console.error("KB Text Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const addPDFToKB = async (req, res) => {
  try {
    const { tenantId, agentId } = req.body;

    if (!tenantId || !agentId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and PDF file are required",
      });
    }

    const result = await ingestPdf({
      tenantId,
      agentId,
      filePath: req.file.path,
      fileName: req.file.originalname,
    });

    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      success: true,
      message: "PDF processed successfully",
      totalChunks: result.inserted,
    });
  } catch (error) {
    console.error("PDF KB Error:", error.message);

    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore cleanup errors */
      }
    }

    const message =
      error.message === "Failed to extract PDF text"
        ? "Could not read this PDF. Try a text-based PDF or paste the content as text."
        : "Failed to process PDF. Please try again.";

    return res.status(500).json({
      success: false,
      message,
    });
  }
};

export const addURLToKB = async (req, res) => {
  try {
    const { tenantId, agentId, urls } = req.body;

    if (!tenantId || !agentId || !urls || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and urls are required",
      });
    }

    let totalChunks = 0;

    for (const url of urls) {
      try {
        const result = await ingestUrl({ tenantId, agentId, url });
        totalChunks += result.inserted || 0;
      } catch (err) {
        console.error(`Error processing URL: ${url}`, err.message);
        continue; // skip failed URL
      }
    }

    if (!totalChunks) {
      return res.status(400).json({
        success: false,
        message: "No content could be extracted from URLs",
      });
    }

    return res.status(200).json({
      success: true,
      message: "URLs processed successfully",
      totalChunks,
    });
  } catch (error) {
    console.error("URL KB Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const queryKB = async (req, res) => {
  try {
    const { tenantId, agentId, query } = req.body;

    // 1. Validation
    if (!tenantId || !agentId || !query) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and query are required",
      });
    }

    // 2. Get relevant context
    const context = await retrieveContext(query, tenantId, agentId, {
      topK: 5,
    });

    return res.status(200).json({
      success: true,
      query,
      context,
    });
  } catch (error) {
    console.error("Query KB Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const listKBDocuments = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.query.tenantId;
    const agentId = req.params.agentId || req.query.agentId;

    if (!tenantId || !agentId) {
      return res.status(400).json({
        success: false,
        message: "tenantId and agentId are required",
      });
    }

    const documents = await listDocuments(tenantId, agentId);

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error("List KB Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load knowledge sources",
    });
  }
};

export const getKBDocument = async (req, res) => {
  try {
    const { tenantId, agentId, docId } = req.params;

    if (!tenantId || !agentId || !docId) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and docId are required",
      });
    }

    const document = await getDocument(tenantId, agentId, docId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Get KB Document Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load knowledge source",
    });
  }
};

export const deleteKBDocument = async (req, res) => {
  try {
    const { tenantId, agentId, docId } = req.body;

    if (!tenantId || !agentId || !docId) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and docId are required",
      });
    }

    const result = await deleteDocument(tenantId, agentId, docId);
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Knowledge source deleted",
      deletedChunks: result.deleted,
    });
  } catch (error) {
    console.error("Delete KB Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete knowledge source",
    });
  }
};

export const updateKBText = async (req, res) => {
  try {
    const { tenantId, agentId, docId, text, title } = req.body;

    if (!tenantId || !agentId || !docId || !text) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId, docId and text are required",
      });
    }

    const result = await updateTextDocument({
      tenantId,
      agentId,
      docId,
      text,
      title,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Text knowledge updated",
      totalChunks: result.inserted,
      docId: result.docId,
    });
  } catch (error) {
    console.error("Update KB Text Error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update text knowledge",
    });
  }
};

export const updateKBUrl = async (req, res) => {
  try {
    const { tenantId, agentId, docId, url } = req.body;

    if (!tenantId || !agentId || !docId) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId and docId are required",
      });
    }

    const result = await updateUrlDocument({
      tenantId,
      agentId,
      docId,
      url,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website knowledge refreshed",
      totalChunks: result.inserted,
      docId: result.docId,
      sourceUrl: result.sourceUrl,
    });
  } catch (error) {
    console.error("Update KB URL Error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update website knowledge",
    });
  }
};

export const updateKBPdf = async (req, res) => {
  try {
    const { tenantId, agentId, docId } = req.body;

    if (!tenantId || !agentId || !docId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "tenantId, agentId, docId and PDF file are required",
      });
    }

    const result = await updatePdfDocument({
      tenantId,
      agentId,
      docId,
      filePath: req.file.path,
      fileName: req.file.originalname,
    });

    fs.unlinkSync(req.file.path);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Knowledge source not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "PDF knowledge updated",
      totalChunks: result.inserted,
      docId: result.docId,
    });
  } catch (error) {
    console.error("Update KB PDF Error:", error.message);

    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore cleanup errors */
      }
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update PDF knowledge",
    });
  }
};