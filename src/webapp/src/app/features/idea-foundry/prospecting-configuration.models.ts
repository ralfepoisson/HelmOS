export type ProspectingAgentState = 'active' | 'paused';
export type ProspectingStrategyMode = 'Broad exploration' | 'Focused search' | 'Hypothesis test';
export type SearchPosture = 'Broad exploration' | 'Targeted exploration';
export type PriorityLevel = 'Low' | 'Medium' | 'High';
export type RunMode = 'Continuous' | 'Scheduled' | 'Manual only';
export type ThemeStatus = 'active' | 'paused';
export type QueryFamilyStatus = 'Active' | 'Paused' | 'Watch';
export type FreshnessLevel = 'Fresh' | 'Stable' | 'Aging';
export type NoiseProfile = 'Low noise' | 'Balanced' | 'High noise';
export type HealthLabel = 'Strong' | 'Healthy' | 'Needs attention' | 'At risk';
export type TrendDirection = 'up' | 'down' | 'steady';

export interface ProspectingObjective {
  name: string;
  description: string;
  targetDomain: string;
  searchPosture: SearchPosture;
  includeKeywords: string;
  excludeThemes: string;
  operatorNote: string;
}

export interface StrategyPattern {
  id: string;
  label: string;
  description: string;
  selected: boolean;
  priority: PriorityLevel;
}

export interface SearchTheme {
  id: string;
  label: string;
  status: ThemeStatus;
  priority: PriorityLevel;
  rationale: string;
}

export interface SourceMixItem {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  freshness: FreshnessLevel;
  signalType: string;
  noiseProfile: NoiseProfile;
  reviewFrequency: string;
}

export interface QueryFamily {
  id: string;
  title: string;
  intent: string;
  representativeQueries: string[];
  themeLink: string;
  sourceApplicability: string[];
  status: QueryFamilyStatus;
  confidence: 'Promising' | 'Useful' | 'Watching';
  expanded: boolean;
  priorityRank: number;
}

export interface SignalQualityRule {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  strictness: PriorityLevel;
}

export interface ProspectingCadence {
  runMode: RunMode;
  cadence: string;
  maxResultsPerRun: number;
  reviewThreshold: string;
  geographicScope: string;
  languageScope: string;
  budgetGuardrail: string;
}

export interface ConfigurationHealthItem {
  label: string;
  state: HealthLabel;
  helper: string;
}

export interface OutputQualityMetric {
  label: string;
  value: string;
  trend: TrendDirection;
  helper: string;
}

export interface StrategyChangeEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
}

export interface ProspectingConfigurationSnapshot {
  agentState: ProspectingAgentState;
  strategyMode: ProspectingStrategyMode;
  lastRun: string;
  nextRun: string;
  objective: ProspectingObjective;
  strategySummary: string;
  steeringHypothesis: string;
  strategyPatterns: StrategyPattern[];
  themes: SearchTheme[];
  sources: SourceMixItem[];
  queryFamilies: QueryFamily[];
  signalRules: SignalQualityRule[];
  cadence: ProspectingCadence;
  recentMetrics: OutputQualityMetric[];
  recentChanges: StrategyChangeEntry[];
}
