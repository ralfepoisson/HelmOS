const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertAllowedFileType,
  normalizeTagList,
} = require("../app/services/knowledge-base.config");
const {
  KnowledgeBaseToolService,
  TextChunker,
  createKnowledgeBaseProcessingRuntime,
  vectorLiteral,
} = require("../app/services/knowledge-base-processing.service");

test("knowledge base validator accepts approved text files", () => {
  const allowed = assertAllowedFileType({
    filename: "brief.md",
    mimeType: "text/markdown",
    sizeBytes: 1200,
    maxUploadBytes: 5000,
  });

  assert.equal(allowed.modality, "text");
  assert.equal(allowed.implemented, true);
});

test("knowledge base validator rejects executable uploads", () => {
  assert.throws(
    () =>
      assertAllowedFileType({
        filename: "payload.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 200,
        maxUploadBytes: 5000,
      }),
    /not allowed/i,
  );
});

test("normalizeTagList deduplicates and sanitizes tags", () => {
  const tags = normalizeTagList([" Alpha Team ", "alpha team", "Roadmap/2026"]);
  assert.deepEqual(tags, ["alpha-team", "roadmap-2026"]);
});

test("text chunker creates ordered chunks with summaries", () => {
  const chunker = new TextChunker({
    chunkSize: 40,
    chunkOverlap: 10,
  });

  const chunks = chunker.chunk({
    text: "Paragraph one.\n\nParagraph two with more detail.\n\nParagraph three closes the section.",
    baseMetadata: { modality: "text" },
  });

  assert.equal(chunks.length >= 2, true);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(typeof chunks[0].chunkSummary, "string");
});

test("knowledge base tool service intersects agent scope with requested ids", async () => {
  const prisma = {
    knowledgeBaseToolAudit: {
      async create() {
        return null;
      },
    },
  };
  const toolService = new KnowledgeBaseToolService({
    prisma,
    config: {
      agentScopes: {
        ideation: ["kb-1", "kb-2"],
      },
    },
    searchService: {
      async search({ knowledgeBaseIds }) {
        return knowledgeBaseIds.map((knowledgeBaseId) => ({ knowledgeBaseId }));
      },
    },
  });

  const results = await toolService.searchKnowledgeBase({
    agentKey: "ideation",
    query: "customer problem framing",
    knowledgeBaseIds: ["kb-2", "kb-3"],
  });

  assert.deepEqual(results, [{ knowledgeBaseId: "kb-2" }]);
});

test("vectorLiteral serializes vectors for pgvector", () => {
  assert.equal(vectorLiteral([1, 2.5, 0]), "[1,2.5,0]");
});

test("knowledge base runtime tolerates missing schema on startup", async () => {
  const prisma = {
    knowledgeBaseProcessingJob: {
      async findMany() {
        const error = new Error("The table `knowledge_base_processing_jobs` does not exist.");
        error.code = "P2021";
        throw error;
      },
    },
  };

  const runtime = createKnowledgeBaseProcessingRuntime({
    prisma,
    storageService: {},
    config: {
      jinaApiKey: "test",
      jinaBaseUrl: "https://example.com",
      embeddingModel: "jina-embeddings-v4",
      embeddingDimensions: 2048,
      chunkSize: 1000,
      chunkOverlap: 100,
      queueBatchSize: 1,
      queuePollMs: 1000,
      agentScopes: {},
    },
  });

  await runtime.start();
  assert.equal(runtime.isAvailable(), false);
  await runtime.stop();
});
