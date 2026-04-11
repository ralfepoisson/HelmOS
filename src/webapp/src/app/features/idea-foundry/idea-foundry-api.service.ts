import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { readAuthConfig } from '../../core/auth/bootstrap-auth';
import { ProspectingConfigurationSnapshot } from './prospecting-configuration.models';

interface ApiEnvelope<T> {
  data: T;
}

export interface ProspectingConfigurationRuntimeState {
  agentState: string;
  latestRunStatus: string;
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  resultRecordCount: number;
}

export interface ProspectingResultRecord {
  id: string;
  sourceKey?: string;
  query?: string;
  queryFamilyTitle?: string;
  themeLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  snippet?: string;
  provider?: string;
  rank?: number;
  capturedAt?: string;
  isProcessedForPipeline?: boolean;
}

export interface ProspectingConfigurationResponse {
  snapshot: ProspectingConfigurationSnapshot | null;
  latestReview: Record<string, unknown> | null;
  runtime: ProspectingConfigurationRuntimeState;
}

export interface IdeaFoundryPipelineContentsResponse {
  sources: ProspectingResultRecord[];
  sourceProcessing: ProtoIdeaSourceRecord[];
  protoIdeas: ProtoIdeaRecord[];
  ideaCandidates: IdeaCandidateRecord[];
  curatedOpportunities: CuratedOpportunityRecord[];
  runtime: ProspectingConfigurationRuntimeState;
}

export interface IdeaFoundryPipelineStageStates {
  sources: 'pending' | 'running' | 'completed' | 'failed';
  'proto-ideas': 'pending' | 'running' | 'completed' | 'failed';
  'idea-candidates': 'pending' | 'running' | 'completed' | 'failed';
  'curated-opportunities': 'pending' | 'running' | 'completed' | 'failed';
}

export interface IdeaFoundryPipelineStageResult {
  key: string;
  status: string;
  stopReason?: string | null;
  attempts?: number;
  lastResult?: Record<string, unknown> | null;
  totals?: Record<string, unknown> | null;
}

export interface IdeaFoundryPipelineStatusResponse {
  runId: string | null;
  ownerUserId?: string | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  startedAt: string | null;
  endedAt: string | null;
  stageStates: IdeaFoundryPipelineStageStates;
  stageResults: IdeaFoundryPipelineStageResult[];
  completedStageCount: number;
  failedStageCount: number;
  errorMessage: string | null;
}

export interface IdeaFoundryPipelineRunResponse {
  started: boolean;
  run: IdeaFoundryPipelineStatusResponse;
}

export interface IdeaFoundryPipelineHistoryEntry {
  runId: string;
  ownerUserId: string | null;
  requestedStartStage: IdeaFoundryPipelineStageKey;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
  startedAt: string | null;
  endedAt: string | null;
  completedStageCount: number;
  failedStageCount: number;
  errorMessage: string | null;
}

export interface IdeaFoundryPipelineHistoryChange {
  kind: 'created' | 'state_changed';
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  fromState?: string;
  toState?: string;
}

export interface IdeaFoundryPipelineHistoryStage {
  stageKey: IdeaFoundryPipelineStageKey;
  status: string;
  attempts: number;
  processedCount: number;
  producedCount: number;
  totals?: Record<string, unknown>;
  startedAt: string | null;
  endedAt: string | null;
  history: IdeaFoundryPipelineHistoryChange[];
}

export interface IdeaFoundryPipelineHistoryDetail extends IdeaFoundryPipelineHistoryEntry {
  stageStates: IdeaFoundryPipelineStageStates;
  stages: IdeaFoundryPipelineHistoryStage[];
}

export type IdeaFoundryPipelineStageKey =
  | 'sources'
  | 'proto-ideas'
  | 'idea-candidates'
  | 'curated-opportunities';

export interface ProtoIdeaSourceRecord {
  id: string;
  upstreamSourceRecordId: string;
  sourceKey: string;
  processingStatus: string;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  processingCompletedAt?: string | null;
  processingFailedAt?: string | null;
  updatedAt?: string | null;
}

export interface ProtoIdeaRecord {
  id: string;
  sourceId: string;
  title: string;
  problemStatement: string;
  targetCustomer: string;
  opportunityHypothesis: string;
  whyItMatters: string;
  opportunityType: string;
  explicitSignals: string[];
  inferredSignals: string[];
  assumptions: string[];
  openQuestions: string[];
  statusLabel: string;
  statusTone: string;
  agentConfidence: string;
  statusExplanation: string;
  refinementStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProtoIdeaExtractionPolicy {
  id: string | null;
  profileName: string;
  extractionBreadth: 'conservative' | 'standard' | 'expansive';
  inferenceTolerance: 'strict_grounding' | 'balanced' | 'exploratory';
  noveltyBias: 'pragmatic' | 'balanced' | 'exploratory';
  minimumSignalThreshold: 'low' | 'medium' | 'high';
  maxProtoIdeasPerSource: number;
}

export interface ProtoIdeaExtractionRuntimeState {
  latestRunStatus: string;
  lastRunAt: string | null;
  latestRunSummary: Record<string, unknown> | null;
}

export interface ProtoIdeaExtractionConfigurationResponse {
  policy: ProtoIdeaExtractionPolicy;
  runtime: ProtoIdeaExtractionRuntimeState;
}

export interface ProtoIdeaExtractionRunResponse extends ProtoIdeaExtractionConfigurationResponse {
  result: {
    processedCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    selectedSourceIds: string[];
    policyId: string | null;
    policyProfileName: string;
  };
}

export interface IdeaRefinementPolicy {
  id: string | null;
  profileName: string;
  refinementDepth: 'light' | 'standard' | 'deep';
  creativityLevel: 'low' | 'medium' | 'high';
  strictness: 'conservative' | 'balanced' | 'exploratory';
  maxConceptualToolsPerRun: number;
  internalQualityThreshold: 'basic' | 'standard' | 'high';
}

export interface IdeaRefinementRuntimeState {
  latestRunStatus: string;
  lastRunAt: string | null;
  latestRunSummary: Record<string, unknown> | null;
}

export interface IdeaRefinementConfigurationResponse {
  policy: IdeaRefinementPolicy;
  runtime: IdeaRefinementRuntimeState;
}

export interface IdeaCandidateRecord {
  id: string;
  protoIdeaId: string;
  policyId?: string | null;
  problemStatement: string;
  targetCustomer: string;
  valueProposition: string;
  opportunityConcept: string;
  differentiation: string;
  assumptions: string[];
  openQuestions: string[];
  improvementSummary: string;
  keyChanges: string[];
  appliedReasoningSummary: string;
  appliedConceptualToolIds: string[];
  selectedConceptualToolNames?: string[];
  qualityCheckCoherence: string;
  qualityCheckGaps: string[];
  qualityCheckRisks: string[];
  statusLabel: string;
  statusTone: string;
  agentConfidence: string;
  statusExplanation: string;
  refinementIteration: number;
  workflowState?: 'AWAITING_EVALUATION' | 'NEEDS_REFINEMENT' | 'REJECTED' | 'PROMOTED';
  evaluationStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  evaluationDecision?: 'PROMOTE' | 'REFINE' | 'REJECT' | null;
  evaluationDecisionReason?: string | null;
  evaluationNextBestAction?: string | null;
  evaluationRecommendedActionReason?: string | null;
  evaluationReadinessLabel?: string | null;
  evaluationBlockingIssue?: string | null;
  evaluationStrongestAspect?: string | null;
  evaluationBiggestRisk?: string | null;
  evaluationDuplicateRiskLabel?: string | null;
  evaluationDuplicateRiskExplanation?: string | null;
  evaluationPayloadJson?: Record<string, unknown> | null;
  evaluationCompletedAt?: string | null;
  protoIdeaTitle?: string | null;
  sourceTitle?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CuratedOpportunityRecord {
  id: string;
  ideaCandidateId: string;
  title: string;
  summary?: string | null;
  problemStatement: string;
  targetCustomer: string;
  valueProposition: string;
  productServiceDescription: string;
  differentiation: string;
  earlyMonetizationIdea: string;
  readinessLabel: string;
  strongestAspect: string;
  biggestRisk: string;
  blockingIssue?: string | null;
  duplicateRiskLabel: string;
  duplicateRiskExplanation: string;
  nextBestAction: string;
  promotionReason: string;
  tagsJson?: Record<string, unknown> | null;
  promotedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IdeaRefinementRunResponse extends IdeaRefinementConfigurationResponse {
  result: {
    processedCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    selectedProtoIdeaIds: string[];
    createdCount: number;
    updatedCount: number;
    candidateCount: number;
    policyId: string | null;
    policyProfileName: string;
  };
}

export interface IdeaEvaluationRunResponse {
  result: {
    processedCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    selectedIdeaCandidateIds: string[];
    promotedCount: number;
    refinedCount: number;
    rejectedCount: number;
    opportunityCount: number;
  };
  opportunities: CuratedOpportunityRecord[];
}

@Injectable({
  providedIn: 'root'
})
export class IdeaFoundryApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = `${normalizeBaseUrl(readAuthConfig().apiBaseUrl)}/api`;

  async getProspectingConfiguration(): Promise<ProspectingConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/prospecting/configuration`, 'GET');
    return this.parseApiResponse<ProspectingConfigurationResponse>(response, 'load the prospecting configuration');
  }

  async getIdeaFoundryContents(): Promise<IdeaFoundryPipelineContentsResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/prospecting/contents`, 'GET');
    return this.parseApiResponse<IdeaFoundryPipelineContentsResponse>(response, 'load the idea foundry contents');
  }

  async runProspectingConfigurationReview(
    snapshot: ProspectingConfigurationSnapshot
  ): Promise<ProspectingConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/prospecting/configuration/run`, 'POST', {
      snapshot
    });
    return this.parseApiResponse<ProspectingConfigurationResponse>(response, 'run the prospecting agent');
  }

  async executeProspectingRun(): Promise<ProspectingConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/prospecting/configuration/execute`, 'POST', {});
    return this.parseApiResponse<ProspectingConfigurationResponse>(response, 'execute the prospecting strategy');
  }

  async runIdeaFoundryPipeline(
    payload: { retryFailed?: boolean; maxStageIterations?: number; startStage?: IdeaFoundryPipelineStageKey } = {}
  ): Promise<IdeaFoundryPipelineRunResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/pipeline/run`, 'POST', payload);
    return this.parseApiResponse<IdeaFoundryPipelineRunResponse>(response, 'run the Idea Foundry pipeline');
  }

  async getIdeaFoundryPipelineStatus(): Promise<IdeaFoundryPipelineStatusResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/pipeline/status`, 'GET');
    return this.parseApiResponse<IdeaFoundryPipelineStatusResponse>(response, 'load the Idea Foundry pipeline status');
  }

  async listIdeaFoundryPipelineRuns(): Promise<IdeaFoundryPipelineHistoryEntry[]> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/pipeline/history`, 'GET');
    return this.parseApiResponse<IdeaFoundryPipelineHistoryEntry[]>(response, 'load Idea Foundry pipeline history');
  }

  async getIdeaFoundryPipelineRunDetail(runId: string): Promise<IdeaFoundryPipelineHistoryDetail> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/pipeline/history/${encodeURIComponent(runId)}`, 'GET');
    return this.parseApiResponse<IdeaFoundryPipelineHistoryDetail>(
      response,
      'load the selected Idea Foundry pipeline execution detail'
    );
  }

  async getProtoIdeaExtractionConfiguration(): Promise<ProtoIdeaExtractionConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/proto-idea/configuration`, 'GET');
    return this.parseApiResponse<ProtoIdeaExtractionConfigurationResponse>(
      response,
      'load the Proto-Idea extraction policy'
    );
  }

  async saveProtoIdeaExtractionConfiguration(
    policy: ProtoIdeaExtractionPolicy
  ): Promise<ProtoIdeaExtractionConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/proto-idea/configuration`, 'POST', policy);
    return this.parseApiResponse<ProtoIdeaExtractionConfigurationResponse>(
      response,
      'save the Proto-Idea extraction policy'
    );
  }

  async runProtoIdeaAgent(payload: { batchSize?: number; retryFailed?: boolean } = {}): Promise<ProtoIdeaExtractionRunResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/proto-idea/run`, 'POST', payload);
    return this.parseApiResponse<ProtoIdeaExtractionRunResponse>(
      response,
      'run the Proto-Idea agent'
    );
  }

  async getIdeaRefinementConfiguration(): Promise<IdeaRefinementConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/refinement/configuration`, 'GET');
    return this.parseApiResponse<IdeaRefinementConfigurationResponse>(
      response,
      'load the Idea Refinement policy'
    );
  }

  async saveIdeaRefinementConfiguration(policy: IdeaRefinementPolicy): Promise<IdeaRefinementConfigurationResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/refinement/configuration`, 'POST', policy);
    return this.parseApiResponse<IdeaRefinementConfigurationResponse>(
      response,
      'save the Idea Refinement policy'
    );
  }

  async getIdeaCandidates(): Promise<IdeaCandidateRecord[]> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/refinement/candidates`, 'GET');
    return this.parseApiResponse<IdeaCandidateRecord[]>(
      response,
      'load refined idea candidates'
    );
  }

  async runIdeaRefinementAgent(
    payload: { batchSize?: number; retryFailed?: boolean; protoIdeaId?: string } = {}
  ): Promise<IdeaRefinementRunResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/refinement/run`, 'POST', payload);
    return this.parseApiResponse<IdeaRefinementRunResponse>(
      response,
      'run the Idea Refinement agent'
    );
  }

  async getCuratedOpportunities(): Promise<CuratedOpportunityRecord[]> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/evaluation/opportunities`, 'GET');
    return this.parseApiResponse<CuratedOpportunityRecord[]>(
      response,
      'load curated opportunities'
    );
  }

  async runIdeaEvaluation(
    payload: { batchSize?: number; retryFailed?: boolean; ideaCandidateId?: string } = {}
  ): Promise<IdeaEvaluationRunResponse> {
    const response = await this.requestText(`${this.apiBaseUrl}/idea-foundry/evaluation/run`, 'POST', payload);
    return this.parseApiResponse<IdeaEvaluationRunResponse>(
      response,
      'run the Idea Evaluation agent'
    );
  }

  private async requestText(
    url: string,
    method: 'GET' | 'POST',
    payload?: unknown
  ): Promise<HttpResponse<string>> {
    if (method === 'POST') {
      return firstValueFrom(
        this.http.post(url, payload, {
          observe: 'response',
          responseType: 'text'
        })
      );
    }

    return firstValueFrom(
      this.http.get(url, {
        observe: 'response',
        responseType: 'text'
      })
    );
  }

  private parseApiResponse<T>(response: HttpResponse<string>, action: string): T {
    const body = response.body ?? '';
    const contentType = response.headers.get('content-type') ?? '';

    if (!body.trim()) {
      throw new Error(`The backend returned an empty response while trying to ${action}.`);
    }

    try {
      const parsed = JSON.parse(body) as ApiEnvelope<T>;

      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
        throw new Error('Response JSON is missing the expected data envelope.');
      }

      return parsed.data;
    } catch {
      if (contentType.includes('text/html') || body.trimStart().startsWith('<!doctype')) {
        throw new Error(
          `The Idea Foundry API returned HTML instead of JSON while trying to ${action}. Check that the frontend proxy and backend API are both running.`
        );
      }

      throw new Error(`The backend returned an invalid response while trying to ${action}.`);
    }
  }

  private normalizeRequestError(error: unknown, url: string): Error {
    if (!(error instanceof HttpErrorResponse)) {
      return error instanceof Error ? error : new Error('The Idea Foundry API request failed.');
    }

    if (error.status === 0) {
      return new Error(
        `The Idea Foundry API is unavailable at ${url}. Start the backend server or check that the local proxy is forwarding /api requests correctly.`
      );
    }

    return new Error(error.error?.error ?? error.message);
  }

}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
