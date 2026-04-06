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
  curatedOpportunities: Array<Record<string, unknown>>;
  runtime: ProspectingConfigurationRuntimeState;
}

export interface ProtoIdeaSourceRecord {
  id: string;
  upstreamSourceRecordId: string;
  sourceKey: string;
  processingStatus: string;
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
  protoIdeaTitle?: string | null;
  sourceTitle?: string | null;
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
