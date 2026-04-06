const { randomUUID } = require("node:crypto");
const path = require("node:path");

const { createLogEntry } = require("./log-entry.service");
const {
  assertAllowedFileType,
  findAllowedFileType,
  getKnowledgeBaseConfig,
  normalizeTagList,
} = require("./knowledge-base.config");
const { computeSha256 } = require("./knowledge-base-storage.service");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isKnowledgeBaseSchemaMissing(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    error.message.toLowerCase().includes("knowledge_base")
  );
}

function stripHtml(value) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

class UnsupportedModalityError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedModalityError";
  }
}

class ExtractionRegistry {
  extract({ fileRecord, body }) {
    const allowedType = findAllowedFileType({
      filename: fileRecord.originalFilename,
      mimeType: fileRecord.mimeType,
    });

    if (!allowedType) {
      throw new UnsupportedModalityError("The uploaded file type is not on the approved allow-list.");
    }

    if (!allowedType.implemented) {
      throw new UnsupportedModalityError(
        `${allowedType.modality} extraction is scaffolded but not yet implemented in this MVP.`,
      );
    }

    const rawText = body.toString("utf8");
    const normalizedText =
      fileRecord.mimeType === "text/html" ? stripHtml(rawText) : rawText;

    return {
      modality: allowedType.modality,
      text: normalizedText.replace(/\r\n/g, "\n").trim(),
      metadata: {
        modality: allowedType.modality,
        extractor: "text-document-extractor",
        fileExtension: fileRecord.fileExtension,
      },
    };
  }
}

class TextChunker {
  constructor({ chunkSize, chunkOverlap }) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  chunk({ text, baseMetadata }) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const paragraphs = text
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    const chunks = [];
    let current = "";
    let currentParagraphStart = 0;

    const pushChunk = () => {
      const value = current.trim();
      if (!value) {
        return;
      }

      const overlapText = value.slice(Math.max(0, value.length - this.chunkOverlap));
      chunks.push({
        chunkIndex: chunks.length,
        chunkText: value,
        chunkSummary: value.slice(0, 220),
        metadata: {
          ...baseMetadata,
          paragraphStart: currentParagraphStart,
          paragraphEnd: currentParagraphStart + Math.max(0, value.split(/\n{2,}/).length - 1),
        },
      });
      current = overlapText;
      currentParagraphStart += 1;
    };

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length > this.chunkSize && current) {
        pushChunk();
      }

      current = current ? `${current}\n\n${paragraph}` : paragraph;
      if (paragraphIndex === paragraphs.length - 1 || current.length >= this.chunkSize) {
        pushChunk();
      }
    });

    if (chunks.length === 0 && text.trim()) {
      chunks.push({
        chunkIndex: 0,
        chunkText: text.trim(),
        chunkSummary: text.trim().slice(0, 220),
        metadata: baseMetadata,
      });
    }

    return chunks;
  }
}

class JinaEmbeddingsProvider {
  constructor(config) {
    this.config = config;
  }

  async embedTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (!this.config.jinaApiKey) {
      throw new Error("JINA_API_KEY is required to generate embeddings.");
    }

    const response = await fetch(this.config.jinaBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.jinaApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input: texts,
        dimensions: this.config.embeddingDimensions,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Jina embeddings request failed: ${response.status} ${message}`);
    }

    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data.map((entry) => entry.embedding) : [];
  }
}

class KnowledgeBaseSearchService {
  constructor({ prisma, embeddingProvider, config }) {
    this.prisma = prisma;
    this.embeddingProvider = embeddingProvider;
    this.config = config;
  }

  async search({ query, knowledgeBaseIds = [], tags = [], mediaTypes = [], limit = 10, actorUserId = null }) {
    const normalizedQuery = `${query ?? ""}`.trim();
    if (!normalizedQuery) {
      throw createHttpError(400, "Search query is required.");
    }

    const [embedding] = await this.embeddingProvider.embedTexts([normalizedQuery]);
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return [];
    }

    const params = [];
    let paramIndex = 0;
    const addParam = (value) => {
      params.push(value);
      paramIndex += 1;
      return `$${paramIndex}`;
    };

    const whereClauses = ['f.deleted_at IS NULL', `f.processing_status = 'COMPLETED'`];
    const embeddingParam = addParam(vectorLiteral(embedding));

    if (knowledgeBaseIds.length > 0) {
      whereClauses.push(`kb.id = ANY(${addParam(knowledgeBaseIds)}::uuid[])`);
    }

    if (tags.length > 0) {
      whereClauses.push(
        `EXISTS (
          SELECT 1
          FROM knowledge_base_file_tags tag_filter
          WHERE tag_filter.file_id = f.id
            AND tag_filter.tag = ANY(${addParam(tags)}::text[])
        )`,
      );
    }

    if (mediaTypes.length > 0) {
      whereClauses.push(`COALESCE(f.metadata_json->>'modality', '') = ANY(${addParam(mediaTypes)}::text[])`);
    }

    const limitParam = addParam(Math.max(1, Math.min(limit, 25)));

    const sql = `
      SELECT
        kb.id AS "knowledgeBaseId",
        kb.name AS "knowledgeBaseName",
        f.id AS "fileId",
        f.original_filename AS "filename",
        f.mime_type AS "mimeType",
        f.submitted_at AS "submittedAt",
        u.display_name AS "submittedByName",
        u.email AS "submittedByEmail",
        e.chunk_index AS "chunkIndex",
        e.chunk_text AS "chunkText",
        e.chunk_summary AS "chunkSummary",
        e.metadata_json AS "metadata",
        COALESCE(array_remove(array_agg(DISTINCT t.tag), NULL), '{}') AS "tags",
        1 - (e.embedding <=> ${embeddingParam}::vector) AS "score"
      FROM knowledge_base_embeddings e
      INNER JOIN knowledge_bases kb ON kb.id = e.knowledge_base_id
      INNER JOIN knowledge_base_files f ON f.id = e.file_id
      INNER JOIN users u ON u.id = f.submitted_by
      LEFT JOIN knowledge_base_file_tags t ON t.file_id = f.id
      WHERE ${whereClauses.join("\n        AND ")}
      GROUP BY
        kb.id,
        kb.name,
        f.id,
        f.original_filename,
        f.mime_type,
        f.submitted_at,
        u.display_name,
        u.email,
        e.chunk_index,
        e.chunk_text,
        e.chunk_summary,
        e.metadata_json,
        e.embedding
      ORDER BY e.embedding <=> ${embeddingParam}::vector ASC
      LIMIT ${limitParam}
    `;

    const rows = await this.prisma.$queryRawUnsafe(sql, ...params);

    await this.prisma.knowledgeBaseSearchAudit.create({
      data: {
        actorUserId: actorUserId ?? undefined,
        queryText: normalizedQuery,
        knowledgeBaseId: knowledgeBaseIds.length === 1 ? knowledgeBaseIds[0] : undefined,
        tagsJson: tags.length > 0 ? tags : undefined,
        mediaTypesJson: mediaTypes.length > 0 ? mediaTypes : undefined,
        resultCount: rows.length,
      },
    });

    await createLogEntry(this.prisma, {
      level: "info",
      scope: "knowledge-base",
      event: "knowledge_base_search_executed",
      message: `Knowledge base search returned ${rows.length} results.`,
      context: {
        knowledgeBaseIds,
        tags,
        mediaTypes,
        resultCount: rows.length,
      },
    });

    return rows.map((row) => ({
      knowledgeBaseId: row.knowledgeBaseId,
      knowledgeBaseName: row.knowledgeBaseName,
      fileId: row.fileId,
      filename: row.filename,
      mimeType: row.mimeType,
      tags: row.tags,
      score: Number(row.score),
      chunkText: row.chunkText,
      chunkSummary: row.chunkSummary,
      chunkIndex: row.chunkIndex,
      metadata: row.metadata,
      submittedAt: row.submittedAt,
      submittedBy: row.submittedByName || row.submittedByEmail,
    }));
  }
}

class KnowledgeBaseToolService {
  constructor({ prisma, searchService, config }) {
    this.prisma = prisma;
    this.searchService = searchService;
    this.config = config;
  }

  resolveAllowedKnowledgeBaseIds(agentKey, requestedIds = []) {
    const configuredIds = this.config.agentScopes?.[agentKey] ?? [];
    if (configuredIds.length === 0) {
      return [];
    }

    if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
      return configuredIds;
    }

    return requestedIds.filter((entry) => configuredIds.includes(entry));
  }

  async searchKnowledgeBase({ agentKey, query, knowledgeBaseIds = [], tags = [], limit = 10, actorUserId = null }) {
    const allowedKnowledgeBaseIds = this.resolveAllowedKnowledgeBaseIds(agentKey, knowledgeBaseIds);
    if (allowedKnowledgeBaseIds.length === 0) {
      return [];
    }

    const results = await this.searchService.search({
      query,
      knowledgeBaseIds: allowedKnowledgeBaseIds,
      tags,
      limit,
      actorUserId,
    });

    await this.prisma.knowledgeBaseToolAudit.create({
      data: {
        agentKey,
        action: "search",
        knowledgeBaseIdsJson: allowedKnowledgeBaseIds,
        queryText: query,
        resultCount: results.length,
        actorUserId: actorUserId ?? undefined,
      },
    });

    return results;
  }

  async getKnowledgeBaseFileMetadata({ agentKey, fileId, actorUserId = null }) {
    const file = await this.prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
      include: {
        knowledgeBase: true,
        tags: true,
        submittedBy: true,
      },
    });

    if (!file) {
      return null;
    }

    const allowedIds = this.resolveAllowedKnowledgeBaseIds(agentKey, [file.knowledgeBaseId]);
    if (allowedIds.length === 0) {
      return null;
    }

    await this.prisma.knowledgeBaseToolAudit.create({
      data: {
        agentKey,
        action: "get_file_metadata",
        knowledgeBaseIdsJson: allowedIds,
        fileId,
        actorUserId: actorUserId ?? undefined,
      },
    });

    return serializeFileRecord(file);
  }

  async getKnowledgeBaseFileChunks({ agentKey, fileId, limit = 20, offset = 0, actorUserId = null }) {
    const file = await this.prisma.knowledgeBaseFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return [];
    }

    const allowedIds = this.resolveAllowedKnowledgeBaseIds(agentKey, [file.knowledgeBaseId]);
    if (allowedIds.length === 0) {
      return [];
    }

    const chunks = await this.prisma.knowledgeBaseEmbedding.findMany({
      where: { fileId },
      orderBy: { chunkIndex: "asc" },
      take: Math.max(1, Math.min(limit, 50)),
      skip: Math.max(0, offset),
      select: {
        id: true,
        chunkIndex: true,
        chunkText: true,
        chunkSummary: true,
        metadataJson: true,
      },
    });

    await this.prisma.knowledgeBaseToolAudit.create({
      data: {
        agentKey,
        action: "get_file_chunks",
        knowledgeBaseIdsJson: allowedIds,
        fileId,
        resultCount: chunks.length,
        actorUserId: actorUserId ?? undefined,
      },
    });

    return chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText,
      chunkSummary: chunk.chunkSummary,
      metadata: chunk.metadataJson,
    }));
  }
}

async function listKnowledgeBases(prisma) {
  const records = await prisma.knowledgeBase.findMany({
    include: {
      _count: {
        select: {
          files: true,
          embeddings: true,
        },
      },
      createdBy: true,
      updatedBy: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return records.map(serializeKnowledgeBaseRecord);
}

async function getKnowledgeBaseDetail(prisma, knowledgeBaseId) {
  const record = await prisma.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    include: {
      _count: {
        select: {
          files: true,
          embeddings: true,
        },
      },
      createdBy: true,
      updatedBy: true,
      files: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          submittedAt: "desc",
        },
        include: {
          tags: true,
          submittedBy: true,
          _count: {
            select: {
              embeddings: true,
            },
          },
        },
      },
    },
  });

  return record
    ? {
        ...serializeKnowledgeBaseRecord(record),
        files: record.files.map(serializeFileRecord),
      }
    : null;
}

async function createKnowledgeBase(prisma, payload, actorUser) {
  const record = await prisma.knowledgeBase.create({
    data: {
      name: payload.name,
      description: payload.description ?? null,
      ownerType: payload.ownerType ?? null,
      ownerId: payload.ownerId ?? null,
      status: payload.status ?? "ACTIVE",
      createdById: actorUser.id,
      updatedById: actorUser.id,
    },
    include: {
      _count: {
        select: {
          files: true,
          embeddings: true,
        },
      },
      createdBy: true,
      updatedBy: true,
    },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_created",
    message: `Knowledge base "${record.name}" created.`,
    context: {
      knowledgeBaseId: record.id,
      actorUserId: actorUser.id,
    },
  });

  return serializeKnowledgeBaseRecord(record);
}

async function updateKnowledgeBase(prisma, knowledgeBaseId, payload, actorUser) {
  const record = await prisma.knowledgeBase.update({
    where: { id: knowledgeBaseId },
    data: {
      name: payload.name ?? undefined,
      description: typeof payload.description === "undefined" ? undefined : payload.description,
      ownerType: typeof payload.ownerType === "undefined" ? undefined : payload.ownerType,
      ownerId: typeof payload.ownerId === "undefined" ? undefined : payload.ownerId,
      status: payload.status ?? undefined,
      updatedById: actorUser.id,
    },
    include: {
      _count: {
        select: {
          files: true,
          embeddings: true,
        },
      },
      createdBy: true,
      updatedBy: true,
    },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_updated",
    message: `Knowledge base "${record.name}" updated.`,
    context: {
      knowledgeBaseId: record.id,
      actorUserId: actorUser.id,
    },
  });

  return serializeKnowledgeBaseRecord(record);
}

async function deleteKnowledgeBase(prisma, storageService, knowledgeBaseId, actorUser) {
  const record = await prisma.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    include: {
      files: true,
    },
  });

  if (!record) {
    throw createHttpError(404, "Knowledge base not found.");
  }

  await Promise.all(
    record.files.map((file) => storageService.deleteFile(file.storedObjectKey)),
  );

  await prisma.knowledgeBase.delete({
    where: { id: knowledgeBaseId },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_deleted",
    message: `Knowledge base "${record.name}" deleted.`,
    context: {
      knowledgeBaseId,
      actorUserId: actorUser.id,
      deletedFileCount: record.files.length,
    },
  });
}

async function uploadKnowledgeBaseFile({
  prisma,
  storageService,
  knowledgeBaseId,
  payload,
  actorUser,
}) {
  const knowledgeBase = await prisma.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
  });
  if (!knowledgeBase) {
    throw createHttpError(404, "Knowledge base not found.");
  }

  const originalFilename = `${payload.originalFilename ?? ""}`.trim();
  const mimeType = `${payload.mimeType ?? ""}`.trim().toLowerCase();
  const contentBase64 = `${payload.contentBase64 ?? ""}`.trim();
  if (!contentBase64) {
    throw createHttpError(400, "contentBase64 is required.");
  }

  const body = Buffer.from(contentBase64, "base64");
  const allowedType = assertAllowedFileType({
    filename: originalFilename,
    mimeType,
    sizeBytes: body.byteLength,
  });

  const fileId = randomUUID();
  const checksumSha256 = computeSha256(body);
  const storageResult = await storageService.storeFile({
    knowledgeBaseId,
    fileId,
    originalFilename,
    mimeType,
    body,
  });

  const tags = normalizeTagList(payload.tags);
  const fileRecord = await prisma.knowledgeBaseFile.create({
    data: {
      id: fileId,
      knowledgeBaseId,
      originalFilename,
      storedObjectKey: storageResult.objectKey,
      storageProvider: storageResult.provider,
      mimeType,
      fileExtension: path.extname(originalFilename).toLowerCase(),
      fileSizeBytes: BigInt(body.byteLength),
      checksumSha256,
      sourceType: payload.sourceType ?? "upload",
      submittedById: actorUser.id,
      processingStatus: "QUEUED",
      metadataJson: {
        modality: allowedType.modality,
      },
      tags: tags.length > 0
        ? {
            createMany: {
              data: tags.map((tag) => ({ tag })),
            },
          }
        : undefined,
      jobs: {
        create: {
          knowledgeBaseId,
          status: "QUEUED",
          payloadJson: {
            modality: allowedType.modality,
          },
        },
      },
    },
    include: {
      tags: true,
      submittedBy: true,
      knowledgeBase: true,
      _count: {
        select: {
          embeddings: true,
        },
      },
    },
  });

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_file_uploaded",
    message: `File "${originalFilename}" uploaded to knowledge base "${knowledgeBase.name}".`,
    context: {
      knowledgeBaseId,
      fileId,
      mimeType,
      sizeBytes: body.byteLength,
      actorUserId: actorUser.id,
      tags,
    },
  });

  return serializeFileRecord(fileRecord);
}

async function getKnowledgeBaseFileDetail(prisma, fileId) {
  const record = await prisma.knowledgeBaseFile.findUnique({
    where: { id: fileId },
    include: {
      knowledgeBase: true,
      tags: true,
      submittedBy: true,
      embeddings: {
        orderBy: { chunkIndex: "asc" },
        take: 10,
        select: {
          id: true,
          chunkIndex: true,
          chunkText: true,
          chunkSummary: true,
          metadataJson: true,
        },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          embeddings: true,
        },
      },
    },
  });

  return record
    ? {
        ...serializeFileRecord(record),
        chunks: record.embeddings.map((chunk) => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          chunkSummary: chunk.chunkSummary,
          metadata: chunk.metadataJson,
        })),
        jobs: record.jobs,
      }
    : null;
}

async function deleteKnowledgeBaseFile(prisma, storageService, fileId, actorUser) {
  const record = await prisma.knowledgeBaseFile.findUnique({
    where: { id: fileId },
    include: {
      tags: true,
      knowledgeBase: true,
    },
  });

  if (!record) {
    throw createHttpError(404, "Knowledge base file not found.");
  }

  await storageService.deleteFile(record.storedObjectKey);

  await prisma.$transaction([
    prisma.knowledgeBaseEmbedding.deleteMany({ where: { fileId } }),
    prisma.knowledgeBaseProcessingJob.deleteMany({ where: { fileId } }),
    prisma.knowledgeBaseFile.update({
      where: { id: fileId },
      data: {
        processingStatus: "DELETED",
        deletedAt: new Date(),
        errorMessage: null,
      },
    }),
  ]);

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_file_deleted",
    message: `File "${record.originalFilename}" deleted from knowledge base "${record.knowledgeBase.name}".`,
    context: {
      knowledgeBaseId: record.knowledgeBaseId,
      fileId,
      actorUserId: actorUser.id,
    },
  });
}

async function processKnowledgeBaseJob({ prisma, storageService, extractorRegistry, chunker, embeddingProvider, job }) {
  const file = await prisma.knowledgeBaseFile.findUnique({
    where: { id: job.fileId },
    include: {
      tags: true,
      knowledgeBase: true,
    },
  });

  if (!file || file.deletedAt) {
    await prisma.knowledgeBaseProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: "Source file no longer exists.",
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.$transaction([
    prisma.knowledgeBaseProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attemptCount: {
          increment: 1,
        },
        errorMessage: null,
      },
    }),
    prisma.knowledgeBaseFile.update({
      where: { id: file.id },
      data: {
        processingStatus: "PROCESSING",
        errorMessage: null,
      },
    }),
  ]);

  await createLogEntry(prisma, {
    level: "info",
    scope: "knowledge-base",
    event: "knowledge_base_job_started",
    message: `Started processing "${file.originalFilename}".`,
    context: {
      fileId: file.id,
      jobId: job.id,
      knowledgeBaseId: file.knowledgeBaseId,
    },
  });

  try {
    const body = await storageService.readFile(file.storedObjectKey);
    const extraction = extractorRegistry.extract({ fileRecord: file, body });
    const chunks = chunker.chunk({
      text: extraction.text,
      baseMetadata: {
        ...extraction.metadata,
        tags: file.tags.map((tag) => tag.tag),
      },
    });

    if (chunks.length === 0) {
      throw new Error("No searchable text could be extracted from the file.");
    }

    const vectors = await embeddingProvider.embedTexts(chunks.map((chunk) => chunk.chunkText));

    await prisma.$transaction([
      prisma.knowledgeBaseEmbedding.deleteMany({
        where: { fileId: file.id },
      }),
      ...chunks.map((chunk, index) =>
        prisma.$executeRawUnsafe(
          `
            INSERT INTO knowledge_base_embeddings (
              id,
              knowledge_base_id,
              file_id,
              chunk_index,
              chunk_text,
              chunk_summary,
              embedding_model,
              embedding,
              metadata_json,
              created_at
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::integer, $5::text, $6::text, $7::varchar, $8::vector, $9::jsonb, NOW())
          `,
          randomUUID(),
          file.knowledgeBaseId,
          file.id,
          chunk.chunkIndex,
          chunk.chunkText,
          chunk.chunkSummary,
          embeddingProvider.config.embeddingModel,
          vectorLiteral(vectors[index]),
          JSON.stringify(chunk.metadata ?? {}),
        ),
      ),
      prisma.knowledgeBaseFile.update({
        where: { id: file.id },
        data: {
          processingStatus: "COMPLETED",
          errorMessage: null,
          metadataJson: {
            ...(file.metadataJson ?? {}),
            modality: extraction.modality,
            chunkCount: chunks.length,
          },
        },
      }),
      prisma.knowledgeBaseProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          errorMessage: null,
        },
      }),
    ]);

    await createLogEntry(prisma, {
      level: "info",
      scope: "knowledge-base",
      event: "knowledge_base_job_completed",
      message: `Completed processing "${file.originalFilename}".`,
      context: {
        fileId: file.id,
        jobId: job.id,
        knowledgeBaseId: file.knowledgeBaseId,
        chunkCount: chunks.length,
      },
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.knowledgeBaseFile.update({
        where: { id: file.id },
        data: {
          processingStatus: "FAILED",
          errorMessage: error.message,
        },
      }),
      prisma.knowledgeBaseProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error.message,
        },
      }),
    ]);

    await createLogEntry(prisma, {
      level: error instanceof UnsupportedModalityError ? "warn" : "error",
      scope: "knowledge-base",
      event: "knowledge_base_job_failed",
      message: `Failed processing "${file.originalFilename}": ${error.message}`,
      context: {
        fileId: file.id,
        jobId: job.id,
        knowledgeBaseId: file.knowledgeBaseId,
        errorMessage: error.message,
      },
    });
  }
}

function createKnowledgeBaseProcessingRuntime({ prisma, storageService, config = getKnowledgeBaseConfig() }) {
  const extractorRegistry = new ExtractionRegistry();
  const chunker = new TextChunker({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  const embeddingProvider = new JinaEmbeddingsProvider(config);
  const searchService = new KnowledgeBaseSearchService({
    prisma,
    embeddingProvider,
    config,
  });
  const toolService = new KnowledgeBaseToolService({
    prisma,
    searchService,
    config,
  });

  let timer = null;
  let draining = false;
  let schemaReady = true;

  const tick = async () => {
    if (draining) {
      return;
    }

    draining = true;
    try {
      let jobs = [];
      try {
        jobs = await prisma.knowledgeBaseProcessingJob.findMany({
          where: {
            status: "QUEUED",
            availableAt: {
              lte: new Date(),
            },
          },
          orderBy: {
            createdAt: "asc",
          },
          take: config.queueBatchSize,
        });
        schemaReady = true;
      } catch (error) {
        if (isKnowledgeBaseSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }

      for (const job of jobs) {
        await processKnowledgeBaseJob({
          prisma,
          storageService,
          extractorRegistry,
          chunker,
          embeddingProvider,
          job,
        });
      }
    } finally {
      draining = false;
    }
  };

  return {
    config,
    embeddingProvider,
    searchService,
    toolService,
    isAvailable() {
      return schemaReady;
    },
    assertAvailable() {
      if (!schemaReady) {
        throw createHttpError(
          503,
          "Knowledge base tables are not available yet. Run the latest Prisma migration before using this feature.",
        );
      }
    },
    async start() {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        tick().catch(() => {});
      }, config.queuePollMs);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
      try {
        await tick();
      } catch (error) {
        if (isKnowledgeBaseSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async triggerProcessingPass() {
      try {
        await tick();
      } catch (error) {
        if (isKnowledgeBaseSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
  };
}

function serializeKnowledgeBaseRecord(record) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy
      ? {
          id: record.createdBy.id,
          displayName: record.createdBy.displayName,
          email: record.createdBy.email,
        }
      : null,
    updatedBy: record.updatedBy
      ? {
          id: record.updatedBy.id,
          displayName: record.updatedBy.displayName,
          email: record.updatedBy.email,
        }
      : null,
    fileCount: record._count?.files ?? 0,
    embeddingCount: record._count?.embeddings ?? 0,
  };
}

function serializeFileRecord(record) {
  return {
    id: record.id,
    knowledgeBaseId: record.knowledgeBaseId,
    knowledgeBaseName: record.knowledgeBase?.name ?? null,
    originalFilename: record.originalFilename,
    storedObjectKey: record.storedObjectKey,
    storageProvider: record.storageProvider,
    mimeType: record.mimeType,
    fileExtension: record.fileExtension,
    fileSizeBytes: Number(record.fileSizeBytes),
    checksumSha256: record.checksumSha256,
    sourceType: record.sourceType,
    submittedAt: record.submittedAt,
    submittedBy: record.submittedBy
      ? {
          id: record.submittedBy.id,
          displayName: record.submittedBy.displayName,
          email: record.submittedBy.email,
        }
      : null,
    processingStatus: record.processingStatus,
    errorMessage: record.errorMessage,
    mediaDurationMs: record.mediaDurationMs,
    pageCount: record.pageCount,
    imageWidth: record.imageWidth,
    imageHeight: record.imageHeight,
    deletedAt: record.deletedAt,
    metadata: record.metadataJson ?? null,
    tags: Array.isArray(record.tags) ? record.tags.map((tag) => tag.tag) : [],
    embeddingCount: record._count?.embeddings ?? 0,
  };
}

function vectorLiteral(values) {
  if (!Array.isArray(values)) {
    throw new Error("Embedding vector must be an array.");
  }

  return `[${values.map((value) => Number(value) || 0).join(",")}]`;
}

module.exports = {
  ExtractionRegistry,
  JinaEmbeddingsProvider,
  KnowledgeBaseSearchService,
  KnowledgeBaseToolService,
  TextChunker,
  createKnowledgeBaseProcessingRuntime,
  createKnowledgeBase,
  createHttpError,
  deleteKnowledgeBase,
  deleteKnowledgeBaseFile,
  getKnowledgeBaseDetail,
  getKnowledgeBaseFileDetail,
  listKnowledgeBases,
  processKnowledgeBaseJob,
  serializeFileRecord,
  serializeKnowledgeBaseRecord,
  updateKnowledgeBase,
  uploadKnowledgeBaseFile,
  vectorLiteral,
  isKnowledgeBaseSchemaMissing,
};
