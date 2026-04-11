import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { StrategyCopilotData } from '../ideation/ideation.models';
import { AgentChatPanelComponent } from '../ideation/agent-chat-panel.component';
import { StrategyCopilotHomeComponent } from './strategy-copilot-home.component';
import { StrategyCopilotShellComponent } from './strategy-copilot-shell.component';

describe('StrategyCopilotHomeComponent', () => {
  const queryParamMap$ = new BehaviorSubject(convertToParamMap({ workspaceId: 'workspace-existing-1' }));
  const listBusinessIdeas = vi.fn();
  const getBusinessIdea = vi.fn();

  const strategyCopilotData: StrategyCopilotData = {
    workspaceOption: {
      id: 'workspace-existing-1',
      name: 'HelmOS',
      businessType: 'PRODUCT',
      businessTypeLabel: 'Product-based'
    },
    workspace: {
      pageTitle: 'HelmOS',
      pageStatus: 'Draft',
      completionHintTitle: 'Keep refining',
      completionHint: 'Continue clarifying the concept.',
      overview: {
        completeness: 32,
        readinessLabel: 'In progress',
        readinessTone: 'info',
        nextAction: 'Clarify the ideal customer and the initial wedge.',
        completionSummary: 'The concept is still early.'
      },
      availableToolIds: ['ideation'],
      sections: []
    },
    chat: {
      panelTitle: 'HelmOS Agent',
      panelSubtitle: 'Guided strategy collaboration',
      placeholder: 'Ask the agent to refine, challenge, or summarise your concept...',
      messages: [
        {
          id: 1,
          role: 'agent',
          author: 'HelmOS Agent',
          content: 'I remember your previous ideation notes.',
          timestamp: '2 min ago'
        },
        {
          id: 2,
          role: 'user',
          author: 'You',
          content: 'Please summarise the strongest angle.',
          timestamp: '1 min ago'
        }
      ]
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap$.next(convertToParamMap({ workspaceId: 'workspace-existing-1' }));
    listBusinessIdeas.mockResolvedValue([
      {
        id: 'workspace-existing-1',
        name: 'HelmOS',
        businessType: 'PRODUCT',
        businessTypeLabel: 'Product-based'
      }
    ]);
    getBusinessIdea.mockResolvedValue(strategyCopilotData);

    await TestBed.configureTestingModule({
      imports: [StrategyCopilotHomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ workspaceId: 'workspace-existing-1' })
            },
            queryParamMap: queryParamMap$.asObservable()
          }
        },
        {
          provide: BusinessIdeasApiService,
          useValue: {
            listBusinessIdeas,
            getBusinessIdea
          }
        }
      ]
    }).compileComponents();
  });

  it('renders persisted chat history for the selected workspace', async () => {
    const fixture = TestBed.createComponent(StrategyCopilotHomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const text = fixture.nativeElement.textContent;
    const shell = fixture.debugElement.query(By.directive(StrategyCopilotShellComponent)).componentInstance as StrategyCopilotShellComponent;
    const chatPanel = fixture.debugElement.query(By.directive(AgentChatPanelComponent)).componentInstance as AgentChatPanelComponent;

    expect(getBusinessIdea).toHaveBeenCalledWith('workspace-existing-1');
    expect(fixture.componentInstance.messages).toEqual(strategyCopilotData.chat.messages);
    expect(shell.messages).toEqual(strategyCopilotData.chat.messages);
    expect(chatPanel.visibleMessages).toEqual(strategyCopilotData.chat.messages);
    expect(text).toContain('I remember your previous ideation notes.');
    expect(text).toContain('Please summarise the strongest angle.');
  });
});
