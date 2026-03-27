import { Injectable } from '@angular/core';

export interface WorkspaceOption {
  id: string;
  name: string;
}

export type StrategyToolId =
  | 'ideation'
  | 'value-proposition'
  | 'customer-segments'
  | 'business-model'
  | 'market-research'
  | 'business-case'
  | 'capability-map'
  | 'goals-kpis';

export interface StrategyTool {
  id: StrategyToolId;
  label: string;
  icon: string;
  description: string;
  helper: string;
  status: 'available' | 'locked';
  route?: string;
  group: 'core' | 'later';
}

@Injectable({
  providedIn: 'root'
})
export class WorkspaceShellService {
  readonly productName = 'HelmOS';
  readonly saveStatus = 'All changes saved';
  readonly newIdeaOption: WorkspaceOption = { id: 'new', name: '+ New Business Idea' };

  readonly strategyTools: StrategyTool[] = [
    {
      id: 'ideation',
      label: 'Ideation',
      icon: 'spark',
      description: 'Capture the core problem, audience, and value proposition with a guided strategic workspace.',
      status: 'available',
      helper: 'Refine and shape the initial concept.',
      route: '/strategy-copilot/ideation',
      group: 'core'
    },
    {
      id: 'value-proposition',
      label: 'Value Proposition',
      icon: 'diamond',
      description: 'Translate the early concept into a sharper customer-job, pain, and gain narrative.',
      status: 'locked',
      helper: 'Unlock when the core concept is defined.',
      route: '/strategy-copilot/value-proposition',
      group: 'core'
    },
    {
      id: 'customer-segments',
      label: 'Customer Segments',
      icon: 'people',
      description: 'Map the priority audiences that feel the problem most urgently and buy for clear reasons.',
      status: 'locked',
      helper: 'Available after ideation quality checks pass.',
      group: 'core'
    },
    {
      id: 'business-model',
      label: 'Business Model',
      icon: 'grid',
      description: 'Shape the commercial logic, delivery model, and operating assumptions behind the concept.',
      status: 'locked',
      helper: 'Depends on a validated concept and audience.',
      group: 'core'
    },
    {
      id: 'market-research',
      label: 'Market Research',
      icon: 'compass',
      description: 'Pressure-test the opportunity with evidence, competitors, and real market signals.',
      status: 'locked',
      helper: 'Suggested when there is enough detail to test.',
      group: 'core'
    },
    {
      id: 'business-case',
      label: 'Business Case',
      icon: 'chart',
      description: 'Turn the strategy into a practical case for investment, timing, and expected returns.',
      status: 'locked',
      helper: 'Requires stronger market and value assumptions.',
      group: 'later'
    },
    {
      id: 'capability-map',
      label: 'Capability Map',
      icon: 'stack',
      description: 'Define the capabilities, roles, and systems needed to execute the strategy consistently.',
      status: 'locked',
      helper: 'Build this once the business idea stabilises.',
      group: 'later'
    },
    {
      id: 'goals-kpis',
      label: 'Goals & KPIs',
      icon: 'target',
      description: 'Establish the metrics and checkpoints that show whether the strategy is actually working.',
      status: 'locked',
      helper: 'Define metrics after the strategy path is clearer.',
      group: 'later'
    }
  ];

  getStrategyTools(availableToolIds: StrategyToolId[] = ['ideation']): StrategyTool[] {
    const available = new Set<StrategyToolId>(availableToolIds);

    return this.strategyTools.map((tool) => ({
      ...tool,
      status: available.has(tool.id) ? 'available' : 'locked'
    }));
  }

  getDemoWorkspaces(): WorkspaceOption[] {
    return [
      { id: 'northstar', name: 'Northstar Ventures' },
      { id: 'signalforge', name: 'SignalForge AI Studio' },
      { id: 'harbor', name: 'Harbor Health Ops' },
      this.newIdeaOption
    ];
  }
}
