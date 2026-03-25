import { Routes } from '@angular/router';

import { AgentAdminScreenComponent } from './features/admin/agent-admin-screen.component';
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
    title: 'HelmOS Strategy Copilot'
  },
  {
    path: 'strategy-copilot/new-idea',
    component: NewIdeaPageComponent,
    title: 'HelmOS New Idea'
  },
  {
    path: 'strategy-copilot/ideation',
    component: IdeationScreenComponent,
    title: 'HelmOS Strategy Copilot Ideation'
  },
  {
    path: 'ideation',
    redirectTo: 'strategy-copilot/ideation'
  },
  {
    path: 'admin/agents',
    component: AgentAdminScreenComponent,
    title: 'HelmOS Agent Admin'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
