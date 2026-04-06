import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeaFoundryApiService } from './idea-foundry-api.service';
import { ProtoIdeaExtractionComponent } from './proto-idea-extraction.component';

describe('ProtoIdeaExtractionComponent', () => {
  const ideaFoundryApi = {
    getProtoIdeaExtractionConfiguration: vi.fn(async () => ({
      policy: {
        id: 'policy-1',
        profileName: 'default',
        extractionBreadth: 'standard',
        inferenceTolerance: 'balanced',
        noveltyBias: 'balanced',
        minimumSignalThreshold: 'medium',
        maxProtoIdeasPerSource: 4
      },
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:15:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        }
      }
    })),
    saveProtoIdeaExtractionConfiguration: vi.fn(async (policy) => ({
      policy,
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:15:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        }
      }
    })),
    runProtoIdeaAgent: vi.fn(async () => ({
      policy: {
        id: 'policy-1',
        profileName: 'default',
        extractionBreadth: 'standard',
        inferenceTolerance: 'balanced',
        noveltyBias: 'balanced',
        minimumSignalThreshold: 'medium',
        maxProtoIdeasPerSource: 4
      },
      runtime: {
        latestRunStatus: 'COMPLETED',
        lastRunAt: '2026-04-06T10:20:00.000Z',
        latestRunSummary: {
          processedCount: 1,
          completedCount: 1,
          failedCount: 0,
          skippedCount: 0
        }
      },
      result: {
        processedCount: 1,
        completedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        selectedSourceIds: ['proto-source-1'],
        policyId: 'policy-1',
        policyProfileName: 'default'
      }
    }))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ProtoIdeaExtractionComponent],
      providers: [
        {
          provide: IdeaFoundryApiService,
          useValue: ideaFoundryApi
        }
      ]
    }).compileComponents();
  });

  it('renders the administrator policy controls', async () => {
    const fixture = TestBed.createComponent(ProtoIdeaExtractionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Configure how the Proto-Idea Agent extracts early opportunity hypotheses');
    expect(text).toContain('Extraction breadth');
    expect(text).toContain('Inference tolerance');
    expect(text).toContain('Novelty bias');
    expect(text).toContain('Minimum signal threshold');
    expect(text).toContain('Max proto-ideas per source');
    expect(text).toContain('Run Agent');
  });

  it('loads the saved policy when the page initializes', async () => {
    const fixture = TestBed.createComponent(ProtoIdeaExtractionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ideaFoundryApi.getProtoIdeaExtractionConfiguration).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.policy.maxProtoIdeasPerSource).toBe(4);
    expect(fixture.componentInstance.runtime.latestRunStatus).toBe('COMPLETED');
  });

  it('saves the updated policy', async () => {
    const fixture = TestBed.createComponent(ProtoIdeaExtractionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.policy.extractionBreadth = 'expansive';
    fixture.componentInstance.policy.maxProtoIdeasPerSource = 6;

    await fixture.componentInstance.saveChanges();

    expect(ideaFoundryApi.saveProtoIdeaExtractionConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        extractionBreadth: 'expansive',
        maxProtoIdeasPerSource: 6
      })
    );
    expect(fixture.componentInstance.surfaceMessage).toContain('Saved the Proto-Idea extraction policy');
  });

  it('runs the agent with double-submit protection state', async () => {
    const fixture = TestBed.createComponent(ProtoIdeaExtractionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const promise = fixture.componentInstance.runAgent();
    expect(fixture.componentInstance.isRunning).toBe(true);
    await promise;

    expect(ideaFoundryApi.runProtoIdeaAgent).toHaveBeenCalledWith({ batchSize: 1 });
    expect(fixture.componentInstance.isRunning).toBe(false);
    expect(fixture.componentInstance.surfaceMessage).toContain('Processed 1 source');
  });
});
