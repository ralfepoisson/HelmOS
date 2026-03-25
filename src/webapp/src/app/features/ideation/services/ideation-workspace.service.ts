import { Injectable } from '@angular/core';

import { IdeationOverview, IdeationSection } from '../ideation.models';

@Injectable({
  providedIn: 'root'
})
export class IdeationWorkspaceService {
  readonly pageTitle = 'Ideation: Define Your Business Concept';
  readonly pageStatus = 'Living document';
  readonly completionHintTitle = 'Next strategy step is waiting';
  readonly completionHint =
    'When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.';

  getOverview(): IdeationOverview {
    return {
      completeness: 65,
      readinessLabel: 'Needs refinement',
      readinessTone: 'warning',
      nextAction: 'Clarify the value proposition with the agent so the target customer pain and product promise connect more crisply.',
      completionSummary: 'Three core sections are forming, but the proposition and audience still need sharper framing before the next tool unlocks.'
    };
  }

  getSections(): IdeationSection[] {
    return [
      {
        id: 'problem-statement',
        title: 'Problem Statement',
        helper: 'Describe the pain, inefficiency, or unmet need the business should solve.',
        content:
          'Early draft: Independent consultants and small service firms often lose momentum after strategy workshops because ideas, notes, and decisions live across scattered documents. The result is slow execution and weak alignment.',
        emphasis: 'primary',
        statusLabel: 'Strong',
        statusTone: 'success',
        confidence: 'high',
        updatedAgo: '6 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: false
      },
      {
        id: 'target-customer',
        title: 'Target Customer',
        helper: 'Clarify the first users or buyers who feel this problem most acutely.',
        content:
          'Working hypothesis: Boutique consultancies, digital agencies, and founder-led professional services teams with 5 to 50 people that need a lightweight way to turn strategic thinking into an actionable operating plan.',
        emphasis: 'primary',
        statusLabel: 'Needs refinement',
        statusTone: 'warning',
        confidence: 'medium',
        updatedAgo: '4 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: true
      },
      {
        id: 'value-proposition',
        title: 'Value Proposition',
        helper: 'Explain why this concept is useful and what meaningful outcome it creates.',
        content:
          'Draft proposition: HelmOS gives early-stage strategy teams an AI-guided workspace that transforms rough business ideas into structured strategic artefacts, so teams can move from concept to execution faster with more confidence.',
        emphasis: 'primary',
        statusLabel: 'Needs refinement',
        statusTone: 'warning',
        confidence: 'medium',
        updatedAgo: '2 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: true,
        needsAttention: true
      },
      {
        id: 'product-service-description',
        title: 'Product / Service Description',
        helper: 'Summarise what the product does today and what the user experiences on the platform.',
        content:
          'Emerging product description: HelmOS is a strategy operating workspace where a built-in agent helps founders and teams articulate a business concept, refine assumptions, and gradually expand into downstream strategy tools such as value proposition design and business modelling.',
        emphasis: 'secondary',
        statusLabel: 'Draft',
        statusTone: 'info',
        confidence: 'medium',
        updatedAgo: '9 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: false
      },
      {
        id: 'differentiation',
        title: 'Differentiation',
        helper: 'Note what makes this offer distinct from consultants, canvases, or generic AI tools.',
        content:
          'Current angle: Instead of offering a blank document or generic chat interface, HelmOS progressively unlocks the right strategy tools in sequence, keeping the user focused while the agent continuously updates the shared workspace.',
        emphasis: 'secondary',
        statusLabel: 'Draft',
        statusTone: 'info',
        confidence: 'medium',
        updatedAgo: '12 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: false
      },
      {
        id: 'early-monetisation-idea',
        title: 'Early Monetisation Idea',
        helper: 'Capture the first revenue model assumptions, even if they are tentative.',
        content:
          'Initial monetisation thought: Subscription pricing for small strategy teams, with a premium tier for collaborative workspaces, richer artefact generation, and guided progression into more advanced strategic planning modules.',
        emphasis: 'secondary',
        statusLabel: 'Too vague',
        statusTone: 'muted',
        confidence: 'low',
        updatedAgo: '14 min ago',
        updatedBy: 'HelmOS Agent',
        recentlyUpdated: false,
        needsAttention: true
      }
    ];
  }
}
