export interface IdeationSection {
  id: string;
  title: string;
  helper: string;
  content: string;
  emphasis: 'primary' | 'secondary';
  statusLabel: 'Strong' | 'Needs refinement' | 'Draft' | 'Too vague';
  statusTone: 'success' | 'warning' | 'info' | 'muted';
  confidence: 'high' | 'medium' | 'low';
  updatedAgo: string;
  updatedBy: string;
  recentlyUpdated: boolean;
  needsAttention?: boolean;
}

export interface ChatMessage {
  id: number;
  role: 'agent' | 'user';
  author: string;
  content: string;
  timestamp: string;
}

export interface IdeationOverview {
  completeness: number;
  readinessLabel: 'In progress' | 'Needs refinement' | 'Ready for next tool';
  readinessTone: 'success' | 'warning' | 'info';
  nextAction: string;
  completionSummary: string;
}

export interface IdeationAgentStatusPayload {
  label?: string | null;
  tone?: 'success' | 'warning' | 'info' | 'muted' | null;
  agent_confidence?: 'high' | 'medium' | 'low' | null;
  score?: number | null;
  explanation?: string | null;
}

export interface IdeationAgentUiHintsPayload {
  highlight?: boolean | null;
  needs_attention?: boolean | null;
}

export interface IdeationAgentSectionPayload {
  content?: string | null;
  helper?: string | null;
  priority?: 'primary' | 'secondary' | null;
  status?: IdeationAgentStatusPayload | null;
  ui_hints?: IdeationAgentUiHintsPayload | null;
}

export interface IdeationAgentResponsePayload {
  reply_to_user?: {
    content?: string | null;
  } | null;
  ideation_overview?: {
    completeness_percent?: number | null;
    readiness?: {
      label?: string | null;
      reason?: string | null;
      next_best_action?: string | null;
    } | null;
  } | null;
  problem_statement?: IdeationAgentSectionPayload | null;
  target_customer?: IdeationAgentSectionPayload | null;
  value_proposition?: IdeationAgentSectionPayload | null;
  'Value Proposition'?: IdeationAgentSectionPayload | null;
  product_service_description?: IdeationAgentSectionPayload | null;
  differentiation?: IdeationAgentSectionPayload | null;
  early_monitization_idea?: IdeationAgentSectionPayload | null;
  early_monetization_idea?: IdeationAgentSectionPayload | null;
}

export type BusinessType =
  | 'PRODUCT'
  | 'SERVICE'
  | 'RESEARCH_AND_DEVELOPMENT'
  | 'MARKETPLACE'
  | 'PLATFORM'
  | 'AGENCY'
  | 'OTHER';

export interface BusinessIdeaOption {
  id: string;
  name: string;
  businessType: BusinessType;
  businessTypeLabel: string;
  updatedAt?: string;
}

export interface StrategyCopilotWorkspace {
  pageTitle: string;
  pageStatus: string;
  completionHintTitle: string;
  completionHint: string;
  overview: IdeationOverview;
  sections: IdeationSection[];
}

export interface StrategyCopilotChat {
  panelTitle: string;
  panelSubtitle: string;
  placeholder: string;
  messages: ChatMessage[];
  resendAvailable?: boolean;
}

export interface StrategyCopilotData {
  workspaceOption: BusinessIdeaOption;
  workspace: StrategyCopilotWorkspace;
  chat: StrategyCopilotChat;
}
