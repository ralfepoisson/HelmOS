import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ConceptualToolsAdminService } from './conceptual-tools-admin.service';

describe('ConceptualToolsAdminService', () => {
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

  it('loads conceptual tools from the configured admin API', async () => {
    const service = TestBed.inject(ConceptualToolsAdminService);
    const loadPromise = service.listConceptualTools();

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/conceptual-tools');
    expect(request.request.method).toBe('GET');
    request.flush(
      JSON.stringify({
        data: [
          {
            id: 'tool-1',
            name: 'Inversion',
            category: 'transformative',
            purpose: 'Reverse core assumptions.',
            whenToUse: ['high market saturation'],
            whenNotToUse: ['problem statement unclear'],
            instructions: ['Reverse the assumption'],
            expectedEffect: 'Increase novelty.',
            status: 'ACTIVE',
            version: 1,
            createdAt: '2026-04-06T08:00:00.000Z',
            updatedAt: '2026-04-06T08:05:00.000Z'
          }
        ]
      }),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const records = await loadPromise;
    expect(records.length).toBe(1);
    expect(records[0].name).toBe('Inversion');
  });

  it('creates a conceptual tool through the admin API', async () => {
    const service = TestBed.inject(ConceptualToolsAdminService);
    const createPromise = service.createConceptualTool({
      name: 'Inversion',
      category: 'transformative',
      purpose: 'Reverse core assumptions.',
      whenToUse: 'high market saturation',
      whenNotToUse: 'problem statement unclear',
      instructions: 'Reverse the assumption',
      expectedEffect: 'Increase novelty.',
      status: 'active',
      version: 1
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/admin/conceptual-tools');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.status).toBe('active');
    expect(request.request.body.instructions).toBe('Reverse the assumption');
    request.flush(
      JSON.stringify({
        data: {
          id: 'tool-1',
          name: 'Inversion',
          category: 'transformative',
          purpose: 'Reverse core assumptions.',
          whenToUse: ['high market saturation'],
          whenNotToUse: ['problem statement unclear'],
          instructions: ['Reverse the assumption'],
          expectedEffect: 'Increase novelty.',
          status: 'ACTIVE',
          version: 1,
          createdAt: '2026-04-06T08:00:00.000Z',
          updatedAt: '2026-04-06T08:05:00.000Z'
        }
      }),
      {
        status: 201,
        statusText: 'Created',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const record = await createPromise;
    expect(record.status).toBe('ACTIVE');
    expect(record.instructions).toEqual(['Reverse the assumption']);
  });
});
