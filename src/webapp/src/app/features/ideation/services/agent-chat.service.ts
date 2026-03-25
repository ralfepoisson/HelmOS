import { Injectable } from '@angular/core';

import { ChatMessage } from '../ideation.models';

@Injectable({
  providedIn: 'root'
})
export class AgentChatService {
  readonly panelTitle = 'HelmOS Agent';
  readonly panelSubtitle = 'Guided strategy collaboration';
  readonly placeholder = 'Ask the agent to refine, challenge, or summarise your concept...';

  getMessages(): ChatMessage[] {
    return [
      {
        id: 1,
        role: 'agent',
        author: 'HelmOS Agent',
        content:
          'What problem should this business solve first? A sharp problem statement will make the rest of the strategy flow much easier.',
        timestamp: '09:12'
      },
      {
        id: 2,
        role: 'user',
        author: 'You',
        content:
          'I want to help small strategy teams stop losing momentum after ideation sessions and turn their ideas into an organised plan.',
        timestamp: '09:14'
      },
      {
        id: 3,
        role: 'agent',
        author: 'HelmOS Agent',
        content:
          'Great starting point. I have updated the problem statement and drafted an initial value proposition in the workspace so we can pressure-test it together.',
        timestamp: '09:15'
      },
      {
        id: 4,
        role: 'user',
        author: 'You',
        content:
          'Can you also shape the product description around an AI-guided strategy workspace rather than just a note-taking tool?',
        timestamp: '09:17'
      },
      {
        id: 5,
        role: 'agent',
        author: 'HelmOS Agent',
        content:
          'Done. I reframed the product as a guided strategic workflow and left the monetisation idea intentionally tentative so we can refine pricing next.',
        timestamp: '09:18'
      }
    ];
  }
}
