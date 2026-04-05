# Knowledge Base Developer Guide

## Overview

The HelmOS Knowledge Base capability adds a production-minded MVP retrieval layer to the Node control plane. Admins can create logical knowledge bases, upload approved files, queue asynchronous processing, search embedded chunks, and expose scoped retrieval access to agents through a service abstraction.

## Architecture at a Glance

- Admin UI pages live in the Angular app under `/admin/knowledge-bases` and `/admin/knowledge-base-search`.
- The Node backend owns CRUD, upload registration, file deletion, search, and the asynchronous processing runtime.
- PostgreSQL stores knowledge-base metadata, file records, tags, queue jobs, audits, and embedding chunks.
- `pgvector` stores chunk embeddings in `knowledge_base_embeddings.embedding`.
- File storage goes through `FileStorageService`, with local storage implemented now and S3 structured as a drop-in adapter.
- Agent access is mediated by `KnowledgeBaseToolService`, which enforces allowed knowledge-base scope per agent key.

The package-level view is documented in [knowledge_base_architecture.puml](/Users/ralfe/Dev/HelmOS/docs/knowledge_base_architecture.puml), and the database entities are reflected in [erd.puml](/Users/ralfe/Dev/HelmOS/docs/erd.puml).

## Storage Behaviour

### Local development

- Set `KNOWLEDGE_BASE_STORAGE_MODE=local`
- Files are written under `KNOWLEDGE_BASE_LOCAL_STORAGE_ROOT`
- This is the default mode for local development and the easiest way to exercise uploads end-to-end

### Production / AWS path

- Set `KNOWLEDGE_BASE_STORAGE_MODE=s3`
- Configure:
  - `KNOWLEDGE_BASE_S3_BUCKET_NAME`
  - `KNOWLEDGE_BASE_S3_REGION`
  - `KNOWLEDGE_BASE_S3_ACCESS_KEY_ID`
  - `KNOWLEDGE_BASE_S3_SECRET_ACCESS_KEY`
- The S3 adapter keeps the same object-key contract as local storage so higher-level services do not change

Note:
- The S3 adapter is wired structurally, but the current shell environment did not allow dependency installation during implementation. If `@aws-sdk/client-s3` is not installed, S3 mode will fail fast on startup instead of degrading silently.

## Allowed File Types

The current allow-list validates both extension and MIME type.

Implemented now:

- `.txt` / `text/plain`
- `.md` / `.markdown`
- `.csv`
- `.json`
- `.html` / `.htm`

Accepted but not yet extracted in the MVP:

- `.pdf`
- `.docx`
- common image formats
- common audio formats
- common video formats

Explicitly rejected:

- executable and installer-like extensions such as `.exe`, `.dll`, `.dmg`, `.msi`, `.sh`, `.bat`, `.jar`, and similar binary payloads

## Embeddings

- Provider abstraction: `JinaEmbeddingsProvider`
- Default model: `jina-embeddings-v4`
- Current embedding column: `vector(2048)`
- Search uses pgvector cosine distance and returns structured results with filename, tags, score, chunk text, provenance, and submitter metadata

Upload processing flow:

1. Validate file type
2. Store object through `FileStorageService`
3. Persist `knowledge_base_files`
4. Create `knowledge_base_processing_jobs`
5. Worker runtime picks queued jobs
6. Extract text
7. Chunk with overlap
8. Generate embeddings with Jina
9. Persist `knowledge_base_embeddings`
10. Mark file/job `COMPLETED` or `FAILED`

## Worker Runtime

The MVP uses a lightweight database-backed queue with an in-process poller:

- queue table: `knowledge_base_processing_jobs`
- runtime factory: `createKnowledgeBaseProcessingRuntime(...)`
- startup hook: started from `src/backend/server.js`

Useful environment variables:

- `KNOWLEDGE_BASE_QUEUE_POLL_MS`
- `KNOWLEDGE_BASE_QUEUE_BATCH_SIZE`
- `KNOWLEDGE_BASE_CHUNK_SIZE`
- `KNOWLEDGE_BASE_CHUNK_OVERLAP`
- `KNOWLEDGE_BASE_MAX_UPLOAD_BYTES`
- `KNOWLEDGE_BASE_TOOL_API_KEY`

To run locally:

1. Apply Prisma migrations
2. Start the Node backend
3. Ensure `JINA_API_KEY` is present
4. Upload a supported text-oriented file from the admin detail page

## Agent Access

Agents should use `KnowledgeBaseToolService`, not direct database queries or storage reads.

Current agent-facing methods:

- `searchKnowledgeBase(query, knowledgeBaseIds?, tags?, limit?)`
- `getKnowledgeBaseFileMetadata(fileId)`
- `getKnowledgeBaseFileChunks(fileId, limit?, offset?)`

Scope control:

- Configure `KNOWLEDGE_BASE_AGENT_SCOPES` as JSON
- Example:

```json
{
  "ideation": ["<knowledge-base-id>"],
  "value-proposition": ["<knowledge-base-id-1>", "<knowledge-base-id-2>"]
}
```

The service intersects requested knowledge-base IDs with the configured scope before searching or returning file data. Tool usage is also written to `knowledge_base_tool_audits`.

The Python retrieval adapter can call the protected internal tool routes at:

- `POST /api/tools/knowledge-base/search`
- `GET /api/tools/knowledge-base/files/:id`
- `GET /api/tools/knowledge-base/files/:id/chunks`

That bridge expects:

- `KNOWLEDGE_BASE_TOOL_API_KEY` on both the Node control plane and the agentic runtime
- `HELMOS_NODE_CONTROL_PLANE_URL` in the agentic runtime when it should reach a non-default Node API origin

## Current MVP Boundaries

- Text-first extraction is implemented now.
- Image/audio/video ingestion is structurally supported but still reports as not yet implemented during processing.
- `pdf` and `docx` are allow-listed and intentionally scaffolded for the next extraction pass.
- Upload transport in the admin UI currently uses base64 JSON payloads for simplicity. If larger files become common, the next step should be multipart upload or direct-to-object-store upload with a registration endpoint.
