import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { AuthCallbackPageComponent } from './features/auth/auth-callback-page.component';
import { AuthStatusPageComponent } from './features/auth/auth-status-page.component';
import { AgentAdminScreenComponent } from './features/admin/agent-admin-screen.component';
import { AdminLogsScreenComponent } from './features/admin/admin-logs-screen.component';
import { NewIdeaPageComponent } from './features/ideation/new-idea-page.component';
import { IdeationScreenComponent } from './features/ideation/ideation-screen.component';
import { StrategyCopilotHomeComponent } from './features/strategy-copilot/strategy-copilot-home.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'strategy-copilot',
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
    path: 'strategy-copilot/ideation',
    component: IdeationScreenComponent,
    canActivate: [authGuard],
    title: 'HelmOS Strategy Copilot Ideation'
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
