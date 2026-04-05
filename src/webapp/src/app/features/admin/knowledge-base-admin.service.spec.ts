import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { KnowledgeBaseAdminService } from './knowledge-base-admin.service';

describe('KnowledgeBaseAdminService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__ = undefined;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    delete (window as typeof window & { __HELMOS_CONFIG__?: unknown }).__HELMOS_CONFIG__;
  });

  it('loads knowledge bases from the local admin API fallback in development', async () => {
    const service = TestBed.inject(KnowledgeBaseAdminService);
    const promise = service.listKnowledgeBases();

    const request = httpTesting.expectOne('http://localhost:3001/api/admin/knowledge-bases');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: [
          {
            id: 'kb-1',
            name: 'Ideation Agent Knowledge Base',
            description: 'Foundational strategy material.',
            ownerType: 'AGENT',
            ownerId: 'ideation',
            status: 'ACTIVE',
            createdAt: '2026-04-05T10:00:00.000Z',
            updatedAt: '2026-04-05T11:00:00.000Z',
            createdBy: null,
            updatedBy: null,
            fileCount: 2,
            embeddingCount: 14
          }
        ]
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const knowledgeBases = await promise;
    expect(knowledgeBases.length).toBe(1);
    expect(knowledgeBases[0].name).toContain('Knowledge Base');
  });

  it('posts semantic search requests through the admin API', async () => {
    const service = TestBed.inject(KnowledgeBaseAdminService);
    const promise = service.search({
      query: 'pricing objections',
      knowledgeBaseIds: ['kb-1'],
      tags: ['sales'],
      limit: 5
    });

    const request = httpTesting.expectOne('http://localhost:3001/api/admin/knowledge-base-search');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.query).toBe('pricing objections');
    request.flush(
      JSON.stringify({
        data: [
          {
            knowledgeBaseId: 'kb-1',
            knowledgeBaseName: 'Sales Enablement',
            fileId: 'file-1',
            filename: 'sales-playbook.md',
            mimeType: 'text/markdown',
            tags: ['sales'],
            score: 0.92,
            chunkText: 'Prospects frequently raise implementation concerns.',
            chunkSummary: 'Prospects frequently raise implementation concerns.',
            chunkIndex: 0,
            metadata: { modality: 'text' },
            submittedAt: '2026-04-05T12:00:00.000Z',
            submittedBy: 'Founder Example'
          }
        ]
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const results = await promise;
    expect(results[0].filename).toBe('sales-playbook.md');
    expect(results[0].score).toBeGreaterThan(0.8);
  });
});
