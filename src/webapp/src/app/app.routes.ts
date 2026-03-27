import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { BusinessIdeasApiService } from './core/services/business-ideas-api.service';
import { AuthCallbackPageComponent } from './features/auth/auth-callback-page.component';
import { AuthStatusPageComponent } from './features/auth/auth-status-page.component';
import { AgentAdminScreenComponent } from './features/admin/agent-admin-screen.component';
import { AdminLogsScreenComponent } from './features/admin/admin-logs-screen.component';
import { NewIdeaPageComponent } from './features/ideation/new-idea-page.component';
import { IdeationScreenComponent } from './features/ideation/ideation-screen.component';
import { ValuePropositionScreenComponent } from './features/value-proposition/value-proposition-screen.component';
import { MyBusinessIdeasPageComponent } from './features/strategy-copilot/my-business-ideas-page.component';
import { StrategyCopilotHomeComponent } from './features/strategy-copilot/strategy-copilot-home.component';

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
    path: 'ideation',
    redirectTo: 'strategy-copilot/ideation'
  },
  {
    path: 'admin/agents',
    component: AgentAdminScreenComponent,
    canActivate: [adminGuard],
    title: 'HelmOS Agent Admin'
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
