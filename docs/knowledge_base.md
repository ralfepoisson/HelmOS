# Knowledge Base Capability for HelmOS

## 1. Purpose

The Knowledge Base capability provides a shared but logically partitioned retrieval layer that HelmOS agents can use to ingest, store, embed, search, and retrieve multimodal knowledge assets. It is designed to support agent-specific knowledge domains while preserving a common administrative model, consistent metadata, traceable lineage from source input to embedding records, and a clear operational path from development to production.

The capability should support ingestion of the following input types:

- Plain text
- Structured and semi-structured documents
- Images
- Audio
- Video

Binary executable content is explicitly not allowed. In practice, the system should accept files whose MIME type and extension belong to an approved allow-list, and reject disallowed binaries such as executables, archives containing executables, and arbitrary opaque binary blobs.

The embedding model is **Jina Embeddings v4**, which should be used as the default and initially only embedding model for this capability.

---

## 2. Core Design Goals

1. **Logical partitioning by knowledge base**  
   Each agent can operate against its own knowledge base partition, while administrators can search across all knowledge bases when needed.

2. **Full traceability**  
   Every embedding must be traceable back to the specific input record and stored file from which it was derived.

3. **Multimodal ingestion**  
   The pipeline should normalise different media types into searchable representations suitable for embedding and retrieval.

4. **Asynchronous processing**  
   File upload and metadata persistence should be fast and reliable, while embedding generation happens through an asynchronous worker pipeline.

5. **Operational simplicity**  
   Development should use local file storage and a local-friendly deployment model; production should use AWS-native storage and scalable worker execution.

6. **Agent accessibility**  
   Agents must be able to query the knowledge base through a controlled tool interface rather than direct database access.

7. **Safe deletion semantics**  
   Deleting a file or knowledge base must cascade to associated dependent records and storage objects.

8. **Search quality and explainability**  
   Search results should return not just matched chunks but also the parent file, knowledge base, tags, scores, and snippet/preview information.

---

## 3. Functional Requirements

### 3.1 Knowledge Base Management

The system shall maintain a standard table of knowledge bases. A knowledge base represents a logical partition or category for stored content.

Examples:

- Ideation Agent Knowledge Base
- Value Proposition Agent Knowledge Base
- Prospecting Agent Knowledge Base
- Shared Research Knowledge Base

Each knowledge base should support the following attributes:

- Unique identifier
- Name
- Optional description
- Optional owning agent or logical owner
- Status (active / archived)
- Created timestamp
- Updated timestamp
- Created by
- Updated by

CRUD operations must be available in the UI and API.

### 3.2 File / Input Registration

Every uploaded input must be recorded in a standard file/input table before embedding occurs.

Required tracked attributes:

- Unique identifier
- Knowledge base identifier
- Original filename
- Stored object key / path
- MIME type
- File extension
- File size
- Submitted timestamp
- Submitted by user
- Optional tags (arbitrary strings)
- Processing status
- Optional source type (upload, pasted text, API import, future extension)
- Optional checksum / hash
- Optional error message
- Optional media duration (audio/video)
- Optional page count / dimensions when derivable

Processing status should minimally support:

- `UPLOADED`
- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `DELETED`

### 3.3 Embedding Records

Embedded data must be stored separately and linked back to the input file record.

Each embedding record should minimally include:

- Unique identifier
- Knowledge base identifier
- File/input identifier
- Chunk identifier / ordinal
- Chunk text or derived representation
- Embedding vector
- Embedding model name/version (`jina-embeddings-v4`)
- Chunk metadata JSON
- Created timestamp

Chunk metadata should be flexible enough to support:

- Page number for documents
- Time range for audio/video
- Segment or frame reference for image/video-derived content
- Extractor used
- OCR/transcription flags
- Tags inherited from parent file
- Searchable summary/snippet

### 3.4 Upload and Processing Flow

The UI must allow a user to upload a file, choose a target knowledge base, and optionally attach tags.

The upload flow should:

1. Validate file type against an allow-list.
2. Persist file metadata to the database.
3. Save the file to storage.
4. Enqueue a processing job.
5. Return control to the UI quickly.
6. Allow the user to monitor processing status.

A worker then performs:

1. Retrieval of file metadata and object.
2. Media-type-specific extraction.
3. Normalisation into searchable text/segment units.
4. Chunking strategy appropriate to the modality.
5. Embedding generation via Jina Embeddings v4.
6. Persistence of embedding records.
7. Status update to `COMPLETED` or `FAILED`.

### 3.5 Search

The system shall provide a search page with the ability to:

- Search across all knowledge bases
- Restrict search to a selected knowledge base
- Filter by one or more tags
- Optionally filter by file type / media type
- View ranked search results

Search results should include:

- Relevance score
- Chunk/snippet preview
- Parent filename
- Knowledge base name
- Tags
- Submitted timestamp
- Submitted by
- Optional modality icon / indicator

### 3.6 Agent Tool Exposure

The knowledge base must be exposed to AI agents as a tool abstraction.

The tool should support at least:

- Search knowledge base
- Retrieve file metadata
- Retrieve source excerpts / chunks
- Optionally list knowledge bases visible to the agent

The agent should not receive unrestricted low-level access to storage, database tables, or vectors. The tool layer should enforce:

- Scope restrictions by knowledge base
- Result limits
n- Safe output shaping
- Audit logging of agent access

---

## 4. Non-Functional Requirements

### 4.1 Security

- Only authenticated users may access the admin UI.
- Authorisation should control who can create, edit, and delete knowledge bases and files.
- Agents should only query knowledge bases explicitly granted to them.
- Uploaded files must be virus-scanned in production where feasible.
- Disallowed file types must be rejected.
- S3 objects should use private access only.
- Sensitive metadata changes and deletions should be audit logged.

### 4.2 Scalability

- Upload and embedding must be decoupled.
- Workers should scale horizontally.
- Vector search must support expected future growth in chunks.
- Storage design should support large media files in production.

### 4.3 Reliability

- Job processing must be retryable.
- Failed jobs should surface actionable error messages.
- Deletion operations should be transactional or compensation-aware.
- Checksums should help detect duplicate uploads and integrity issues.

### 4.4 Performance

- UI upload requests should remain responsive.
- Search should return quickly enough for interactive use.
- Result pagination should be supported.
- Worker throughput should be observable.

### 4.5 Observability

- Log upload, processing, search, and deletion events.
- Capture processing duration and failure reasons.
- Emit metrics for queue depth, job latency, search latency, and embedding volume.

---

## 5. Supported Content Types and Processing Strategy

The system should support multimodal input through a modality-specific extraction layer.

### 5.1 Text

Examples: pasted text, `.txt`, markdown, JSON, CSV-derived text content.

Processing:

- Normalise encoding to UTF-8
- Clean structural noise where appropriate
- Chunk by semantic or paragraph-aware rules
- Embed chunks directly

### 5.2 Documents

Examples: PDF, DOCX, PPTX, HTML, Markdown, possibly XLSX where sheet text extraction is useful.

Processing:

- Extract text and structural cues
- Preserve page/section/slide metadata
- Optionally OCR embedded images if needed later
- Chunk with document-aware rules

### 5.3 Images

Examples: PNG, JPEG, WEBP.

Processing options:

- Extract alt-text-like captions using a vision-capable extraction stage
- OCR text from images where relevant
- Store derived textual representation for embedding
- Link derived segments to image region/page metadata if available

### 5.4 Audio

Examples: MP3, WAV, M4A.

Processing:

- Transcribe audio to text
- Segment by time ranges
- Store transcript segments and timestamps
- Embed transcript chunks

### 5.5 Video

Examples: MP4, MOV, WebM.

Processing:

- Extract audio and transcribe
- Optionally sample frames and generate scene descriptions later
- Segment transcript/scenes by time windows
- Embed derived textual segments

### 5.6 Disallowed Binary Data

Disallowed examples include:

- Executables
- Dynamic libraries
- Disk images
- Unknown opaque binary formats
- Binary archives intended to smuggle executables

The backend should validate both extension and MIME type and may optionally inspect file signatures.

---

## 6. Recommended Logical Architecture

### 6.1 Main Components

1. **Admin UI**  
   Pages under the Admin menu for knowledge base management, file ingestion, and search.

2. **Knowledge Base API**  
   REST endpoints for CRUD, upload registration, search, and agent tool access.

3. **Storage Abstraction Layer**  
   Local filesystem in development, S3 in production.

4. **Job Queue**  
   Receives embedding jobs after upload.

5. **Embedding Worker**  
   Performs extraction, chunking, embedding, and persistence.

6. **Vector Store / Retrieval Layer**  
   Stores embeddings and performs vector similarity search.

7. **Agent Tool Adapter**  
   Presents controlled search/retrieval methods to agents.

### 6.2 Suggested Deployment Pattern

#### Development

- Web UI + API running locally
- Local file storage under a configured path
- PostgreSQL database
- pgvector for embedding storage and search
- Redis-backed or database-backed queue
- Local worker process

#### Production on AWS

- Frontend hosted in existing HelmOS web app
- Backend API on ECS/Fargate, Lambda, or existing backend runtime
- S3 for object storage
- RDS PostgreSQL with pgvector, or dedicated vector store if scale demands it later
- SQS for job queue
- Worker service on ECS/Fargate or Lambda step pipeline for smaller workloads
- CloudWatch metrics/logs

For HelmOS, **PostgreSQL + pgvector** is the most pragmatic first choice because it keeps metadata and vector search close together, simplifies deletion cascades, and reduces operational overhead.

---

## 7. Proposed Data Model

### 7.1 Table: `knowledge_base`

Fields:

- `id` UUID PK
- `name` VARCHAR unique not null
- `description` TEXT null
- `owner_type` VARCHAR null
- `owner_id` UUID/null or string identifier
- `status` VARCHAR not null default `ACTIVE`
- `created_at` TIMESTAMP not null
- `created_by` VARCHAR not null
- `updated_at` TIMESTAMP not null
- `updated_by` VARCHAR not null

### 7.2 Table: `knowledge_base_file`

Fields:

- `id` UUID PK
- `knowledge_base_id` UUID FK -> `knowledge_base.id` on delete cascade
- `original_filename` VARCHAR not null
- `stored_object_key` VARCHAR not null
- `storage_provider` VARCHAR not null (`LOCAL`, `S3`)
- `mime_type` VARCHAR not null
- `file_extension` VARCHAR null
- `file_size_bytes` BIGINT not null
- `checksum_sha256` VARCHAR null
- `source_type` VARCHAR not null default `UPLOAD`
- `submitted_at` TIMESTAMP not null
- `submitted_by` VARCHAR not null
- `processing_status` VARCHAR not null
- `error_message` TEXT null
- `media_duration_ms` BIGINT null
- `page_count` INTEGER null
- `image_width` INTEGER null
- `image_height` INTEGER null
- `deleted_at` TIMESTAMP null

### 7.3 Table: `knowledge_base_file_tag`

Fields:

- `file_id` UUID FK -> `knowledge_base_file.id` on delete cascade
- `tag` VARCHAR not null

Composite PK:

- (`file_id`, `tag`)

### 7.4 Table: `knowledge_base_embedding`

Fields:

- `id` UUID PK
- `knowledge_base_id` UUID FK -> `knowledge_base.id` on delete cascade
- `file_id` UUID FK -> `knowledge_base_file.id` on delete cascade
- `chunk_index` INTEGER not null
- `chunk_text` TEXT not null
- `chunk_summary` TEXT null
- `embedding_model` VARCHAR not null
- `embedding` VECTOR(n) not null
- `metadata_json` JSONB null
- `created_at` TIMESTAMP not null

Indexes:

- B-tree on `knowledge_base_id`
- B-tree on `file_id`
- GIN on `metadata_json` if needed
- Vector index on `embedding`

### 7.5 Optional Table: `knowledge_base_processing_job`

Useful for operational transparency.

Fields:

- `id` UUID PK
- `file_id` UUID FK -> `knowledge_base_file.id` on delete cascade
- `job_type` VARCHAR
- `status` VARCHAR
- `attempt_count` INTEGER
- `queued_at` TIMESTAMP
- `started_at` TIMESTAMP null
- `completed_at` TIMESTAMP null
- `error_message` TEXT null

### 7.6 Optional Table: `knowledge_base_access_audit`

Tracks human and agent searches.

Fields:

- `id` UUID PK
- `actor_type` VARCHAR (`USER`, `AGENT`, `SYSTEM`)
- `actor_id` VARCHAR
- `action` VARCHAR (`SEARCH`, `READ_FILE`, `READ_CHUNK`, `DELETE_FILE`, etc.)
- `knowledge_base_id` UUID null
- `file_id` UUID null
- `request_payload_json` JSONB null
- `created_at` TIMESTAMP

---

## 8. File Storage Design

### 8.1 Development

Use a local filesystem adapter, for example:

- `/data/knowledge-base/{knowledgeBaseId}/{fileId}/{originalFilename}`

### 8.2 Production

Use S3 object keys such as:

- `knowledge-bases/{knowledgeBaseId}/files/{fileId}/{originalFilename}`

Store only the object key/path in the database, never raw file content.

### 8.3 Storage Abstraction Interface

A storage service interface should expose methods such as:

- `save(fileStream, destinationKey)`
- `read(destinationKey)`
- `delete(destinationKey)`
- `exists(destinationKey)`
- `getSignedUrl(destinationKey)` (if later needed)

This keeps the rest of the application agnostic to local vs S3 storage.

---

## 9. Embedding and Retrieval Strategy

### 9.1 Embedding Model

Use **Jina Embeddings v4** for all chunk embeddings.

The implementation should encapsulate model invocation behind an embedding provider interface so that future models can be introduced without schema upheaval.

### 9.2 Chunking Principles

Chunking should be modality-aware:

- Text/documents: paragraph/heading-aware chunking with overlap
- Audio/video: transcript segments grouped into coherent windows
- Images: caption/OCR blocks as chunks

Store both raw extracted text and compact snippet/summary where useful.

### 9.3 Search Modes

The first version should support semantic vector search. It would be wise to design for later hybrid search with:

- Vector similarity
- Keyword filtering
- Tag filtering
- Knowledge base scoping

### 9.4 Retrieval Output Shape

A search result returned to users or agents should include:

- `knowledgeBaseId`
- `knowledgeBaseName`
- `fileId`
- `filename`
- `tags`
- `score`
- `chunkText`
- `chunkSummary`
- `chunkIndex`
- `metadata`

---

## 10. UI / UX Requirements

All pages should be accessible from the **Admin** menu.

### 10.1 Knowledge Base List Page

Purpose:

- View all knowledge bases
- Create new knowledge base
- Edit name/description/status
- Delete knowledge base with confirmation

Suggested columns:

- Name
- Description
- Owner / agent
- Status
- File count
- Embedding count
- Last updated
- Actions

### 10.2 Knowledge Base Detail Page

Purpose:

- View knowledge base metadata
- View files within the knowledge base
- Upload files into this knowledge base
- Filter files by tag or status

Suggested sections:

- Metadata header
- Upload panel
- File table
- Activity / processing status summary

### 10.3 File Upload Modal / Page

Fields:

- Knowledge base selector
- File chooser / drag-and-drop
- Optional tags input
- Optional notes/description in future

Behaviour:

- Validate before submit
- Show progress
- On success, create file record and queue job

### 10.4 File Detail Page

Purpose:

- View file metadata
- View tags
- View processing status/history
- Preview extracted chunks where practical
- Delete file

### 10.5 Search Page

Purpose:

- Global or filtered search across knowledge base content

Filters:

- Query text
- Knowledge base selector (all or one)
- Tag multi-select
- Optional file type selector

Results view:

- Ranked card/list view
- File and KB metadata shown clearly
- Click through to file detail

### 10.6 Deletion UX

Deletion must be guarded with explicit confirmation and a cascade warning.

Examples:

- Deleting a file removes all embeddings derived from it.
- Deleting a knowledge base removes the knowledge base, its files, and all embeddings.

---

## 11. Agent Tool Contract

The knowledge base should be made available to agents through a tool interface.

### 11.1 Example Tool Functions

#### `searchKnowledgeBase`

Inputs:

- `query` string
- `knowledgeBaseIds` optional list
- `tags` optional list
- `limit` optional integer

Returns:

- Ranked results with chunk text and source metadata

#### `getFileMetadata`

Inputs:

- `fileId`

Returns:

- File metadata, tags, KB info, status

#### `getFileChunks`

Inputs:

- `fileId`
- `limit` optional
- `offset` optional

Returns:

- Extracted chunks or transcript segments

### 11.2 Agent Security Model

Each agent should be mapped to allowed knowledge bases. The tool adapter enforces these rules.

Example:

- Ideation Agent may search only `Ideation Agent Knowledge Base`
- Shared Research Agent may search a shared research KB plus its own KB

### 11.3 Auditability

Every agent tool invocation should be logged with:

- Agent identity
- Query/filter parameters
- Result count
- Timestamp

---

## 12. API Design Recommendations

Illustrative REST endpoints:

### Knowledge Bases

- `GET /api/admin/knowledge-bases`
- `POST /api/admin/knowledge-bases`
- `GET /api/admin/knowledge-bases/:id`
- `PUT /api/admin/knowledge-bases/:id`
- `DELETE /api/admin/knowledge-bases/:id`

### Files

- `GET /api/admin/knowledge-base-files`
- `POST /api/admin/knowledge-base-files/upload`
- `GET /api/admin/knowledge-base-files/:id`
- `DELETE /api/admin/knowledge-base-files/:id`

### Search

- `POST /api/admin/knowledge-base-search`

### Agent Tool Endpoints / Internal Service Layer

- `POST /api/tools/knowledge-base/search`
- `GET /api/tools/knowledge-base/files/:id`
- `GET /api/tools/knowledge-base/files/:id/chunks`

---

## 13. Recommended Processing Pipeline

### Step 1: Upload

- User uploads file and metadata
- Backend validates request
- File record persisted as `UPLOADED`
- File stored in storage adapter
- Job enqueued
- File status becomes `QUEUED`

### Step 2: Worker Processing

- Worker fetches job
- Status changes to `PROCESSING`
- Appropriate extractor selected by MIME type
- Extracted content normalised
- Content chunked
- Jina Embeddings v4 invoked for each chunk or batched chunk set
- Embedding records persisted
- Status changes to `COMPLETED`

### Step 3: Failure Handling

- On failure, status becomes `FAILED`
- Error stored in file record and/or processing job table
- Retry policy applied if failure is transient

---

## 14. Suggested Technology Choices

### Backend

Given the rest of HelmOS, a pragmatic option would be:

- Node.js / TypeScript backend
- PostgreSQL
- pgvector
- BullMQ + Redis for local/dev queueing, or SQS in AWS
- AWS SDK for S3 in production

### Frontend

- Extend the existing HelmOS admin UI
- Maintain current design system and routing conventions
- Admin menu entries for:
  - Knowledge Bases
  - Knowledge Base Search

### Extraction Layer

Abstract per modality. For MVP:

- Text/documents first
- Images via OCR/caption extraction second
- Audio/video via transcription third

This sequence reduces implementation risk while still designing the model for all modalities.

---

## 15. Key Design Decisions and Trade-offs

### 15.1 Why Partition by Knowledge Base Instead of Separate Databases?

Using a shared schema with knowledge-base-level logical partitioning simplifies administration, search, observability, and evolution. Separate physical stores per agent would create unnecessary operational overhead early on.

### 15.2 Why Store Embeddings in PostgreSQL + pgvector?

It provides a strong balance of simplicity, transactional consistency, and enough retrieval capability for an MVP. If scale later requires it, the vector layer can be abstracted.

### 15.3 Why Asynchronous Embedding?

Uploads involving documents, audio, and video can be slow. Asynchronous processing keeps the UI responsive and supports retries, scaling, and observability.

### 15.4 Why Derived Text as the Search Substrate?

A single embedding model across modalities is easiest to operationalise when each modality is converted into high-quality textual representations. This also improves explainability because search results can show human-readable snippets.

---

## 16. MVP Scope Recommendation

### In MVP

- CRUD for knowledge bases
- File upload and metadata logging
- Local storage in dev, S3-ready abstraction
- Queue + worker
- Text/document support first
- Search page with KB and tag filters
- Agent search tool
- Cascade delete behaviour
- PostgreSQL + pgvector
- Jina Embeddings v4 integration

### Shortly After MVP

- Image OCR/caption support
- Audio transcription
- Video transcript ingestion
- Search pagination and better faceting
- Duplicate detection by checksum
- Access auditing UI
- Reprocessing action for failed files

### Later

- Hybrid lexical + semantic search
- Re-ranking
- Versioned embeddings/model migrations
- Per-agent access control policies
- Retention policies and archival lifecycle

---

## 17. Acceptance Criteria

The capability should be considered complete for MVP when:

1. An admin can create, edit, list, and delete knowledge bases from the Admin UI.
2. An admin can upload an allowed file into a selected knowledge base with optional tags.
3. The system writes the file metadata record and stores the physical file.
4. A queued worker processes the file asynchronously and writes embedding records linked to the source file.
5. The UI shows file processing status.
6. The UI supports search across all knowledge bases or a selected knowledge base, with optional tag filters.
7. Search results show chunk text plus source metadata.
8. Deleting a file removes associated embeddings and stored object.
9. Deleting a knowledge base removes associated files, embeddings, and stored objects.
10. An AI agent can query the knowledge base through a tool interface restricted to permitted knowledge bases.

---

## 18. Open Questions / Recommendations

1. **Tag model**: arbitrary strings are fine for MVP, but later you may want optional controlled vocabularies.
2. **Agent ownership mapping**: decide whether a knowledge base is linked to an agent type, an agent instance, or both.
3. **Search ranking**: consider later hybrid retrieval and reranking for higher precision.
4. **Large media files**: video and audio can become costly; define file size limits early.
5. **PII/sensitive data policy**: define whether uploads may contain sensitive content and how retention/access rules apply.
6. **Re-embedding strategy**: when changing chunking logic or model version, define how historical records are reprocessed.

---

## 19. Recommended Admin Menu Entries

- Admin
  - Knowledge Bases
  - Knowledge Base Search

Within Knowledge Bases:

- List all knowledge bases
- Open a knowledge base detail view
- Upload files from the detail view
- Open file detail pages

---

## 20. Summary

This Knowledge Base capability should become the standard retrieval substrate for HelmOS agents. Architecturally, it should use a shared metadata model, file-backed storage, asynchronous multimodal extraction and embedding, PostgreSQL + pgvector for vector retrieval, and a clean agent-facing tool contract. The design should optimise for traceability, partitioned access, operational simplicity, and smooth evolution from local development to AWS production.
