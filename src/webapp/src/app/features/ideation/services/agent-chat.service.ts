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
        content: 'Hi there. Please tell me about your business idea.',
        timestamp: 'Now'
      }
    ];
  }
}
