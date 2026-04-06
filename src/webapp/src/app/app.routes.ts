import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { BusinessIdeasApiService } from './core/services/business-ideas-api.service';
import { AuthCallbackPageComponent } from './features/auth/auth-callback-page.component';
import { AuthStatusPageComponent } from './features/auth/auth-status-page.component';
import { AgentAdminScreenComponent } from './features/admin/agent-admin-screen.component';
import { AgentTestingScreenComponent } from './features/admin/agent-testing-screen.component';
import { AdminLogsScreenComponent } from './features/admin/admin-logs-screen.component';
import { KnowledgeBaseDetailScreenComponent } from './features/admin/knowledge-base-detail-screen.component';
import { KnowledgeBaseListScreenComponent } from './features/admin/knowledge-base-list-screen.component';
import { KnowledgeBaseSearchScreenComponent } from './features/admin/knowledge-base-search-screen.component';
import { ConceptualToolsScreenComponent } from './features/admin/conceptual-tools-screen.component';
import { NewIdeaPageComponent } from './features/ideation/new-idea-page.component';
import { IdeationScreenComponent } from './features/ideation/ideation-screen.component';
import { ValuePropositionScreenComponent } from './features/value-proposition/value-proposition-screen.component';
import { MyBusinessIdeasPageComponent } from './features/strategy-copilot/my-business-ideas-page.component';
import { StrategyCopilotHomeComponent } from './features/strategy-copilot/strategy-copilot-home.component';
import { IdeaFoundryOverviewComponent } from './features/idea-foundry/idea-foundry-overview.component';
import { IdeaFoundryShellComponent } from './features/idea-foundry/idea-foundry-shell.component';
import { IdeaFoundryStagePageComponent } from './features/idea-foundry/idea-foundry-stage-page.component';
import { IdeaRefinementComponent } from './features/idea-foundry/idea-refinement.component';
import { ProspectingConfigurationComponent } from './features/idea-foundry/prospecting-configuration.component';
import { ProtoIdeaExtractionComponent } from './features/idea-foundry/proto-idea-extraction.component';

export const rootIdeaSelectionRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const businessIdeasApi = inject(BusinessIdeasApiService);

  try {
    const ideas = await businessIdeasApi.listBusinessIdeas();
    return router.parseUrl(ideas.length > 0 ? '/strategy-copilot/my-business-ideas' : '/strategy-copilot/new-idea');
  } catch {
    return router.parseUrl('/strategy-copilot/new-idea');
  }
};

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard, rootIdeaSelectionRedirectGuard],
    children: [],
    pathMatch: 'full'
  },
  {
    path: 'strategy-copilot',
    component: StrategyCopilotHomeComponent,
    canActivate: [authGuard],
    title: 'HelmOS Strategy Copilot'
  },
  {
    path: 'strategy-copilot/new-idea',
    component: NewIdeaPageComponent,
    canActivate: [authGuard],
    title: 'HelmOS New Idea'
  },
  {
    path: 'strategy-copilot/my-business-ideas',
    component: MyBusinessIdeasPageComponent,
    canActivate: [authGuard],
    title: 'HelmOS My Business Ideas'
  },
  {
    path: 'strategy-copilot/ideation',
    component: IdeationScreenComponent,
    canActivate: [authGuard],
    title: 'HelmOS Strategy Copilot Ideation'
  },
  {
    path: 'strategy-copilot/value-proposition',
    component: ValuePropositionScreenComponent,
    canActivate: [authGuard],
    title: 'HelmOS Strategy Copilot Value Proposition'
  },
  {
    path: 'idea-foundry',
    component: IdeaFoundryShellComponent,
    canActivate: [authGuard],
    title: 'HelmOS Idea Foundry',
    children: [
      {
        path: '',
        component: IdeaFoundryOverviewComponent,
        pathMatch: 'full',
        title: 'HelmOS Idea Foundry Overview'
      },
      {
        path: 'prospecting-configuration',
        component: ProspectingConfigurationComponent,
        title: 'HelmOS Idea Foundry Prospecting Configuration',
      },
      {
        path: 'proto-idea-extraction',
        component: ProtoIdeaExtractionComponent,
        canActivate: [adminGuard],
        title: 'HelmOS Idea Foundry Proto-Idea Extraction',
      },
      {
        path: 'idea-refinement',
        component: IdeaRefinementComponent,
        canActivate: [adminGuard],
        title: 'HelmOS Idea Foundry Idea Refinement',
      },
      {
        path: 'idea-evaluator',
        component: IdeaFoundryStagePageComponent,
        title: 'HelmOS Idea Foundry Idea Evaluator',
        data: {
          title: 'Idea Evaluator',
          summary: 'Apply quality gates that decide whether an opportunity is promoted, recycled for further refinement, or parked as latent.',
          detail:
            'This screen is scaffolded and ready for progression criteria, evaluator rubrics, and downstream Strategy Copilot handoff controls.'
        }
      }
    ]
  },
  {
    path: 'ideation',
    redirectTo: 'strategy-copilot/ideation'
  },
  {
    path: 'admin/conceptual-tools',
    component: ConceptualToolsScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Conceptual Tools'
  },
  {
    path: 'admin/knowledge-bases',
    component: KnowledgeBaseListScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Knowledge Bases'
  },
  {
    path: 'admin/knowledge-bases/:id',
    component: KnowledgeBaseDetailScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Knowledge Base Detail'
  },
  {
    path: 'admin/knowledge-base-search',
    component: KnowledgeBaseSearchScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Knowledge Base Search'
  },
  {
    path: 'admin/agents',
    component: AgentAdminScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Agent Admin'
  },
  {
    path: 'admin/agent-testing',
    component: AgentTestingScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Agent Testing'
  },
  {
    path: 'admin/logs',
    component: AdminLogsScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Admin Logs'
  },
  {
    path: 'auth/callback',
    component: AuthCallbackPageComponent,
    title: 'HelmOS Sign In'
  },
  {
    path: 'signed-out',
    component: AuthStatusPageComponent,
    title: 'HelmOS Signed Out'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
