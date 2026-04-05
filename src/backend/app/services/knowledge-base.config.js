const path = require("node:path");

const KNOWLEDGE_BASE_EMBEDDING_MODEL = "jina-embeddings-v4";
const KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS = 2048;
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

const ALLOWED_FILE_TYPES = [
  { extension: ".txt", mimeTypes: ["text/plain"], modality: "text", implemented: true },
  { extension: ".md", mimeTypes: ["text/markdown", "text/plain"], modality: "text", implemented: true },
  { extension: ".markdown", mimeTypes: ["text/markdown", "text/plain"], modality: "text", implemented: true },
  { extension: ".csv", mimeTypes: ["text/csv", "application/csv"], modality: "document", implemented: true },
  { extension: ".json", mimeTypes: ["application/json", "text/json"], modality: "document", implemented: true },
  { extension: ".html", mimeTypes: ["text/html"], modality: "document", implemented: true },
  { extension: ".htm", mimeTypes: ["text/html"], modality: "document", implemented: true },
  { extension: ".pdf", mimeTypes: ["application/pdf"], modality: "document", implemented: false },
  {
    extension: ".docx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    modality: "document",
    implemented: false,
  },
  { extension: ".png", mimeTypes: ["image/png"], modality: "image", implemented: false },
  { extension: ".jpg", mimeTypes: ["image/jpeg"], modality: "image", implemented: false },
  { extension: ".jpeg", mimeTypes: ["image/jpeg"], modality: "image", implemented: false },
  { extension: ".webp", mimeTypes: ["image/webp"], modality: "image", implemented: false },
  { extension: ".gif", mimeTypes: ["image/gif"], modality: "image", implemented: false },
  { extension: ".mp3", mimeTypes: ["audio/mpeg"], modality: "audio", implemented: false },
  { extension: ".wav", mimeTypes: ["audio/wav", "audio/x-wav"], modality: "audio", implemented: false },
  { extension: ".m4a", mimeTypes: ["audio/mp4"], modality: "audio", implemented: false },
  { extension: ".ogg", mimeTypes: ["audio/ogg"], modality: "audio", implemented: false },
  { extension: ".webm", mimeTypes: ["audio/webm", "video/webm"], modality: "video", implemented: false },
  { extension: ".mp4", mimeTypes: ["video/mp4"], modality: "video", implemented: false },
  { extension: ".mov", mimeTypes: ["video/quicktime"], modality: "video", implemented: false },
];

const DISALLOWED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".bin",
  ".dmg",
  ".app",
  ".pkg",
  ".msi",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".com",
  ".jar",
  ".iso",
  ".apk",
  ".deb",
  ".rpm",
  ".so",
  ".o",
  ".a",
  ".pyc",
  ".class",
]);

const DISALLOWED_MIME_PREFIXES = ["application/x-ms", "application/x-executable"];

function getKnowledgeBaseConfig() {
  const storageMode = `${process.env.KNOWLEDGE_BASE_STORAGE_MODE ?? "local"}`.trim().toLowerCase();
  const queuePollMs = Math.max(1000, Number.parseInt(process.env.KNOWLEDGE_BASE_QUEUE_POLL_MS ?? "5000", 10) || 5000);
  const queueBatchSize = Math.max(
    1,
    Math.min(10, Number.parseInt(process.env.KNOWLEDGE_BASE_QUEUE_BATCH_SIZE ?? "2", 10) || 2),
  );

  return {
    storageMode,
    localStorageRoot: path.resolve(process.env.KNOWLEDGE_BASE_LOCAL_STORAGE_ROOT ?? "tmp/knowledge-base-storage"),
    s3BucketName: process.env.KNOWLEDGE_BASE_S3_BUCKET_NAME?.trim() || null,
    s3Region: process.env.KNOWLEDGE_BASE_S3_REGION?.trim() || null,
    s3AccessKeyId: process.env.KNOWLEDGE_BASE_S3_ACCESS_KEY_ID?.trim() || null,
    s3SecretAccessKey: process.env.KNOWLEDGE_BASE_S3_SECRET_ACCESS_KEY?.trim() || null,
    jinaApiKey: process.env.JINA_API_KEY?.trim() || null,
    jinaBaseUrl: process.env.JINA_EMBEDDINGS_BASE_URL?.trim() || "https://api.jina.ai/v1/embeddings",
    embeddingModel: process.env.KNOWLEDGE_BASE_EMBEDDING_MODEL?.trim() || KNOWLEDGE_BASE_EMBEDDING_MODEL,
    embeddingDimensions: Math.max(
      128,
      Number.parseInt(process.env.KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS ?? `${KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS}`, 10) ||
        KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS,
    ),
    chunkSize: Math.max(400, Number.parseInt(process.env.KNOWLEDGE_BASE_CHUNK_SIZE ?? `${DEFAULT_CHUNK_SIZE}`, 10) || DEFAULT_CHUNK_SIZE),
    chunkOverlap: Math.max(
      50,
      Number.parseInt(process.env.KNOWLEDGE_BASE_CHUNK_OVERLAP ?? `${DEFAULT_CHUNK_OVERLAP}`, 10) || DEFAULT_CHUNK_OVERLAP,
    ),
    queuePollMs,
    queueBatchSize,
    maxUploadBytes: Math.max(
      1_000_000,
      Number.parseInt(process.env.KNOWLEDGE_BASE_MAX_UPLOAD_BYTES ?? "20000000", 10) || 20_000_000,
    ),
    agentScopes: parseAgentScopes(process.env.KNOWLEDGE_BASE_AGENT_SCOPES),
  };
}

function parseAgentScopes(rawValue) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.entries(parsed).reduce((scopes, [agentKey, ids]) => {
      if (!Array.isArray(ids)) {
        return scopes;
      }

      const normalizedIds = ids
        .map((entry) => `${entry ?? ""}`.trim())
        .filter(Boolean);

      if (normalizedIds.length === 0) {
        return scopes;
      }

      return {
        ...scopes,
        [agentKey]: normalizedIds,
      };
    }, {});
  } catch {
    return {};
  }
}

function findAllowedFileType({ filename, mimeType }) {
  const normalizedExtension = path.extname(`${filename ?? ""}`).trim().toLowerCase();
  const normalizedMimeType = `${mimeType ?? ""}`.trim().toLowerCase();

  return (
    ALLOWED_FILE_TYPES.find(
      (entry) =>
        entry.extension === normalizedExtension &&
        entry.mimeTypes.some((candidate) => candidate.toLowerCase() === normalizedMimeType),
    ) ?? null
  );
}

function assertAllowedFileType({ filename, mimeType, sizeBytes, maxUploadBytes = getKnowledgeBaseConfig().maxUploadBytes }) {
  const normalizedExtension = path.extname(`${filename ?? ""}`).trim().toLowerCase();
  const normalizedMimeType = `${mimeType ?? ""}`.trim().toLowerCase();

  if (!normalizedExtension || !normalizedMimeType) {
    const error = new Error("File extension and MIME type are required.");
    error.statusCode = 400;
    throw error;
  }

  if (DISALLOWED_EXTENSIONS.has(normalizedExtension)) {
    const error = new Error(`Files with extension "${normalizedExtension}" are not allowed.`);
    error.statusCode = 400;
    throw error;
  }

  if (DISALLOWED_MIME_PREFIXES.some((prefix) => normalizedMimeType.startsWith(prefix))) {
    const error = new Error(`Files with MIME type "${normalizedMimeType}" are not allowed.`);
    error.statusCode = 400;
    throw error;
  }

  const match = findAllowedFileType({ filename, mimeType });
  if (!match) {
    const error = new Error(
      `Unsupported file type for "${filename}". Only approved text, document, image, audio, and video formats may be uploaded.`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxUploadBytes) {
    const error = new Error(`Files must be between 1 byte and ${maxUploadBytes} bytes.`);
    error.statusCode = 400;
    throw error;
  }

  return match;
}

function normalizeTagList(rawTags) {
  const input = Array.isArray(rawTags) ? rawTags : typeof rawTags === "string" ? rawTags.split(",") : [];
  return input
    .map((entry) => `${entry ?? ""}`.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => entry.replace(/[^a-z0-9:_-]+/g, "-"))
    .filter((entry) => entry.length > 0)
    .slice(0, 20)
    .filter((entry, index, values) => values.indexOf(entry) === index);
}

module.exports = {
  ALLOWED_FILE_TYPES,
  KNOWLEDGE_BASE_EMBEDDING_MODEL,
  KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS,
  getKnowledgeBaseConfig,
  assertAllowedFileType,
  findAllowedFileType,
  normalizeTagList,
};
