import { expect, test } from '@playwright/test';

test.describe('HelmOS ideation workspace', () => {
  test('renders the Strategy Copilot landing page and links ideation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/strategy-copilot(\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Choose the next strategy tool for this workspace' })).toBeVisible();
    await expect(page.getByText('Strategy Copilot', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Strategy Copilot' })).toBeVisible();
    const strategyCopilotNavLink = page.getByRole('link', { name: 'Strategy Copilot' }).first();
    const adminButton = page.getByRole('button', { name: 'Admin' });
    const [strategyCopilotNavBox, adminButtonBox] = await Promise.all([
      strategyCopilotNavLink.boundingBox(),
      adminButton.boundingBox()
    ]);
    expect(strategyCopilotNavBox).not.toBeNull();
    expect(adminButtonBox).not.toBeNull();
    expect(strategyCopilotNavBox!.x + strategyCopilotNavBox!.width).toBeLessThanOrEqual(adminButtonBox!.x + 8);
    await expect(page.getByRole('heading', { name: 'HelmOS Agent' })).toBeVisible();
    await expect(page.getByTestId('workspace-column').getByRole('heading', { name: 'Ideation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Coming soon' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Open Ideation' }).click();
    await expect(page).toHaveURL(/\/strategy-copilot\/ideation(\?.*)?$/);
    await expect(page.locator('h1.workspace-title')).toHaveText(/Ideation:/);
    await expect(page.getByRole('combobox', { name: 'Business idea switcher' })).toBeVisible();
  });

  test('renders a stable desktop three-column workspace', async ({ page }) => {
    await page.goto('/strategy-copilot/ideation');

    await expect(page.getByRole('heading', { name: 'Ideation: Define Your Business Concept' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HelmOS Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Strategy Copilot' })).toBeVisible();
    await expect(page.getByText('Strategy Copilot', { exact: true }).first()).toBeVisible();
    const workspaceHeader = page.locator('.workspace-header');
    await expect(workspaceHeader.getByText('Ideation completeness: 65%', { exact: true })).toBeVisible();
    await expect(workspaceHeader.getByText('Needs refinement', { exact: true }).first()).toBeVisible();
    await expect(workspaceHeader.getByText('Best next action', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Business idea switcher' })).toBeVisible();
    await expect(page.getByRole('option', { name: '+ New Business Idea' })).toBeAttached();
    await expect(page.getByText('More tools later', { exact: true })).toBeVisible();

    const strategyColumn = page.getByTestId('strategy-column');
    const workspaceColumn = page.getByTestId('workspace-column');
    const chatColumn = page.getByTestId('chat-column');

    const [strategyBox, workspaceBox, chatBox] = await Promise.all([
      strategyColumn.boundingBox(),
      workspaceColumn.boundingBox(),
      chatColumn.boundingBox()
    ]);

    expect(strategyBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(chatBox).not.toBeNull();

    const strategy = strategyBox!;
    const workspace = workspaceBox!;
    const chat = chatBox!;

    expect(workspace.x).toBeGreaterThan(strategy.x + strategy.width - 8);
    expect(chat.x).toBeGreaterThan(workspace.x + workspace.width - 8);

    expect(strategy.width).toBeGreaterThan(220);
    expect(workspace.width).toBeGreaterThan(500);
    expect(chat.width).toBeGreaterThan(220);

    expect(Math.abs(strategy.y - workspace.y)).toBeLessThan(6);
    expect(Math.abs(chat.y - workspace.y)).toBeLessThan(6);

    const topNav = page.locator('app-top-nav nav');
    const navBox = await topNav.boundingBox();
    expect(navBox).not.toBeNull();
    expect(navBox!.height).toBeGreaterThan(50);

    const heroTitle = page.getByRole('heading', { name: 'Ideation: Define Your Business Concept' });
    const heroBox = await heroTitle.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox!.y).toBeGreaterThan(navBox!.y + navBox!.height - 4);

    await page.evaluate(() => {
      const workspace = document.querySelector('[data-testid="workspace-column"]');
      if (workspace) {
        workspace.scrollTop = 1200;
      }
    });

    await page.waitForTimeout(100);

    const navAfterScroll = await topNav.boundingBox();
    const strategyAfterScroll = await strategyColumn.boundingBox();
    const chatAfterScroll = await chatColumn.boundingBox();
    const workspaceAfterScroll = await workspaceColumn.boundingBox();

    expect(navAfterScroll).not.toBeNull();
    expect(strategyAfterScroll).not.toBeNull();
    expect(chatAfterScroll).not.toBeNull();
    expect(workspaceAfterScroll).not.toBeNull();

    expect(navAfterScroll!.y).toBe(0);
    expect(strategyAfterScroll!.y).toBeLessThanOrEqual(navBox!.height + 20);
    expect(chatAfterScroll!.y).toBeLessThanOrEqual(navBox!.height + 20);
    expect(workspaceAfterScroll!.y).toBe(strategy.y);
  });

  test('opens the dedicated New Idea page and creates from a minimal centered form', async ({ page }) => {
    let hasCreatedIdea = false;

    await page.route(/\/api\/business-ideas$/, async (route) => {
      if (route.request().method() === 'GET') {
        const ideas = [
          {
            id: 'workspace-existing-1',
            name: 'Orbit Forge Labs',
            businessType: 'PRODUCT',
            businessTypeLabel: 'Product'
          }
        ];

        if (hasCreatedIdea) {
          ideas.unshift({
            id: 'workspace-created-1',
            name: 'Signal Loom',
            businessType: 'OTHER',
            businessTypeLabel: 'Mixture'
          });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: ideas
          })
        });
        return;
      }

      hasCreatedIdea = true;

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            workspaceOption: {
              id: 'workspace-created-1',
              name: 'Signal Loom',
              businessType: 'OTHER',
              businessTypeLabel: 'Mixture'
            },
            workspace: {
              pageTitle: 'Ideation: Signal Loom',
              pageStatus: 'Mixture business idea',
              completionHintTitle: 'Next strategy step is waiting',
              completionHint: 'When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.',
              availableToolIds: ['ideation'],
              overview: {
                completeness: 0,
                readinessLabel: 'In progress',
                readinessTone: 'info',
                nextAction: 'Start by defining the core problem Signal Loom should solve before expanding into customer and value framing.',
                completionSummary: 'No ideation sections have been developed yet. Begin with the problem statement to anchor the rest of the strategy.'
              },
              sections: []
            },
            chat: {
              panelTitle: 'HelmOS Agent',
              panelSubtitle: 'Guided strategy collaboration',
              placeholder: 'Ask the agent to refine, challenge, or summarise your concept...',
              messages: []
            }
          }
        })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-created-1$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            workspaceOption: {
              id: 'workspace-created-1',
              name: 'Signal Loom',
              businessType: 'OTHER',
              businessTypeLabel: 'Mixture'
            },
            workspace: {
              pageTitle: 'Ideation: Signal Loom',
              pageStatus: 'Mixture business idea',
              completionHintTitle: 'Next strategy step is waiting',
              completionHint: 'When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.',
              availableToolIds: ['ideation'],
              overview: {
                completeness: 0,
                readinessLabel: 'In progress',
                readinessTone: 'info',
                nextAction: 'Start by defining the core problem Signal Loom should solve before expanding into customer and value framing.',
                completionSummary: 'No ideation sections have been developed yet. Begin with the problem statement to anchor the rest of the strategy.'
              },
              sections: []
            },
            chat: {
              panelTitle: 'HelmOS Agent',
              panelSubtitle: 'Guided strategy collaboration',
              placeholder: 'Ask the agent to refine, challenge, or summarise your concept...',
              messages: []
            }
          }
        })
      });
    });

    await page.goto('/strategy-copilot/new-idea');

    await expect(page.getByRole('heading', { name: 'What is the working title of the idea?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Product-based' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Service-based' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mixture' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Business idea switcher' })).toHaveValue('new');

    await page.getByLabel('Working title of the idea').fill('Signal Loom');
    await page.getByRole('button', { name: 'Mixture' }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/strategy-copilot\/ideation\?workspaceId=workspace-created-1$/);
    await expect(page.getByRole('combobox', { name: 'Business idea switcher' })).toHaveValue('workspace-created-1');
    await expect(page.getByRole('heading', { name: 'Ideation: Signal Loom' })).toBeVisible();
    await expect(page.getByTestId('strategy-column')).toHaveCount(0);
  });

  test('shows section health, update cues, and guided chat input behavior', async ({ page }) => {
    const initialWorkspace = {
      workspaceOption: {
        id: 'workspace-existing-1',
        name: 'Northstar Ventures',
        businessType: 'PRODUCT',
        businessTypeLabel: 'Product'
      },
      workspace: {
        pageTitle: 'Ideation: Northstar Ventures',
        pageStatus: 'Product business idea',
        completionHintTitle: 'Next strategy step is waiting',
        completionHint:
          'When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.',
        availableToolIds: ['ideation'],
        overview: {
          completeness: 65,
          readinessLabel: 'Needs refinement',
          readinessTone: 'warning',
          nextAction: 'Clarify the value proposition with the agent so the target customer pain and product promise connect more crisply.',
          completionSummary:
            'Three core sections are forming, but the proposition and audience still need sharper framing before the next tool unlocks.'
        },
        sections: [
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
              'Emerging product description: HelmOS is a strategy operating workspace where a built-in agent helps founders and teams articulate a business concept, refine assumptions, and gradually expand into downstream strategy tools.',
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
        ]
      },
      chat: {
        panelTitle: 'HelmOS Agent',
        panelSubtitle: 'Guided strategy collaboration',
        placeholder: 'Ask the agent to refine, challenge, or summarise your concept...',
        resendAvailable: false,
        messages: [
          {
            id: 1,
            role: 'agent',
            author: 'HelmOS Agent',
            content: 'Hi there. Please tell me about your business idea.',
            timestamp: 'Now'
          }
        ]
      }
    };

    const updatedWorkspace = {
      ...initialWorkspace,
      chat: {
        ...initialWorkspace.chat,
        resendAvailable: false,
        messages: [
          ...initialWorkspace.chat.messages,
          {
            id: 2,
            role: 'user',
            author: 'You',
            content: 'Please sharpen the target-customer definition.',
            timestamp: 'Now'
          },
          {
            id: 3,
            role: 'agent',
            author: 'HelmOS Agent',
            content: 'I tightened the target customer framing and highlighted it for follow-up.',
            timestamp: 'Now'
          }
        ]
      }
    };

    await page.route(/\/api\/business-ideas$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'workspace-existing-1',
              name: 'Northstar Ventures',
              businessType: 'PRODUCT',
              businessTypeLabel: 'Product'
            }
          ]
        })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-existing-1$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: initialWorkspace })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-existing-1\/ideation\/messages$/, async (route) => {
      await page.waitForTimeout(250);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: updatedWorkspace })
      });
    });

    await page.goto('/strategy-copilot/ideation');

    await expect(page.getByRole('heading', { name: 'Problem Statement' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Target Customer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Value Proposition' })).toBeVisible();
    await expect(page.getByText('Updated by HelmOS Agent 2 min ago', { exact: true })).toBeVisible();
    await expect(page.locator('.section-confidence').filter({ hasText: 'Agent confidence: medium' }).first()).toBeVisible();

    await expect(page.getByText('Hi there. Please tell me about your business idea.')).toBeVisible();

    const chatInput = page.getByPlaceholder('Ask the agent to refine, challenge, or summarise your concept...');
    const sendButton = page.getByRole('button', { name: 'Send' });

    await expect(chatInput).toBeVisible();
    await expect(sendButton).toBeDisabled();
    await chatInput.fill('Please sharpen');
    await chatInput.press('Shift+Enter');
    await chatInput.type('the target-customer definition.');
    await expect(chatInput).toHaveValue('Please sharpen\nthe target-customer definition.');
    await expect(sendButton).toBeEnabled();
    await chatInput.press('Enter');
    await expect(page.getByText('Thinking...')).toBeVisible();
    await expect(page.locator('.message-bubble').filter({ hasText: 'Please sharpen the target-customer definition.' }).first()).toBeVisible();
    await expect(page.getByText('I tightened the target customer framing and highlighted it for follow-up.')).toBeVisible();

    const lockedBadge = page.locator('.lock-badge').first();
    await lockedBadge.hover();
    await expect(page.locator('.lock-tooltip').first()).toBeVisible();
  });

  test('allows resending the last user message after a delivery failure', async ({ page }) => {
    const initialWorkspace = {
      workspaceOption: {
        id: 'workspace-existing-1',
        name: 'Northstar Ventures',
        businessType: 'PRODUCT',
        businessTypeLabel: 'Product'
      },
      workspace: {
        pageTitle: 'Ideation: Northstar Ventures',
        pageStatus: 'Product business idea',
        completionHintTitle: 'Next strategy step is waiting',
        completionHint:
          'When the concept becomes more consistent and evidence-backed, HelmOS can unlock Value Proposition design and recommend the next structured strategy tool.',
        availableToolIds: ['ideation'],
        overview: {
          completeness: 65,
          readinessLabel: 'Needs refinement',
          readinessTone: 'warning',
          nextAction: 'Clarify the value proposition with the agent so the target customer pain and product promise connect more crisply.',
          completionSummary:
            'Three core sections are forming, but the proposition and audience still need sharper framing before the next tool unlocks.'
        },
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
            content: 'Hi there. Please tell me about your business idea.',
            timestamp: 'Now'
          }
        ]
      }
    };

    const updatedWorkspace = {
      ...initialWorkspace,
      chat: {
        ...initialWorkspace.chat,
        messages: [
          ...initialWorkspace.chat.messages,
          {
            id: 2,
            role: 'user',
            author: 'You',
            content: 'Please refine this founder brief.',
            timestamp: 'Now'
          },
          {
            id: 3,
            role: 'agent',
            author: 'HelmOS Agent',
            content: 'I have refined the founder brief and updated the workspace draft.',
            timestamp: 'Now'
          }
        ]
      }
    };

    let sendAttempts = 0;
    let retryAttempts = 0;

    await page.route(/\/api\/business-ideas$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'workspace-existing-1',
              name: 'Northstar Ventures',
              businessType: 'PRODUCT',
              businessTypeLabel: 'Product'
            }
          ]
        })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-existing-1$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: initialWorkspace })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-existing-1\/ideation\/messages$/, async (route) => {
      sendAttempts += 1;

      if (sendAttempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: updatedWorkspace })
      });
    });

    await page.route(/\/api\/business-ideas\/workspace-existing-1\/ideation\/messages\/retry-last$/, async (route) => {
      retryAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: updatedWorkspace })
      });
    });

    await page.goto('/strategy-copilot/ideation?workspaceId=workspace-existing-1');

    const chatInput = page.getByPlaceholder('Ask the agent to refine, challenge, or summarise your concept...');
    await chatInput.fill('Please refine this founder brief.');
    await page.getByRole('button', { name: 'Send' }).click();

    const retryableBubble = page.locator('.message-bubble').filter({ hasText: 'Please refine this founder brief.' });
    await expect(page.locator('.message-bubble').filter({ hasText: 'Please refine this founder brief.' })).toHaveCount(1);
    await retryableBubble.hover();
    await expect(page.getByRole('button', { name: 'Resend last message' })).toBeVisible();

    await page.getByRole('button', { name: 'Resend last message' }).click();

    expect(retryAttempts).toBe(1);
    await expect(page.getByRole('button', { name: 'Resend last message' })).toHaveCount(0);
    await expect(page.locator('.message-bubble').filter({ hasText: 'Please refine this founder brief.' })).toHaveCount(1);
    await expect(page.getByText('I have refined the founder brief and updated the workspace draft.')).toBeVisible();
  });

  test('opens the Admin menu and navigates to Agent Admin', async ({ page }) => {
    await page.route('**/api/admin/agents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            gateway: {
              configured: true,
              status: 'online',
              message: 'Agent gateway responded successfully.',
              baseUrl: 'http://localhost:8000/api/v1',
              service: 'helmos-agent-gateway',
              checkedAt: '2026-03-22T09:00:00.000Z',
              agents: [
                {
                  key: 'ideation',
                  name: 'Ideation Agent',
                  version: '1.0.0',
                  purpose: 'Transforms founder input into structured idea briefs.',
                  allowed_tools: ['retrieval']
                },
                {
                  key: 'research',
                  name: 'Research Agent',
                  version: '1.2.0',
                  purpose: 'Builds evidence-backed research briefs.',
                  allowed_tools: ['retrieval', 'web_search']
                }
              ]
            },
            agents: [
              {
                id: 'agent-1',
                key: 'ideation',
                name: 'Ideation Agent',
                version: '1.0.0',
                description: 'Transforms founder input into structured idea briefs.',
                allowedTools: ['retrieval'],
                defaultModel: 'gpt-4.1-mini',
                active: true,
                createdAt: '2026-03-22T08:00:00.000Z',
                updatedAt: '2026-03-22T08:05:00.000Z',
                promptConfig: {
                  id: 'prompt-1',
                  key: 'ideation.default',
                  version: '1.0.0',
                  promptTemplate:
                    'Role / Persona:\nYou are the HelmOS ideation specialist.\n\nTask Instructions:\nClarify the founder idea and identify assumptions.\n\nConstraints:\nDo not invent market evidence.\n\nOutput Format:\nReturn summary, risks, and next steps.',
                  configJson: {
                    purpose: 'Transforms founder input into structured idea briefs.',
                    scopeNotes: 'Focus on early-stage idea clarification.',
                    temperature: 0.2,
                    maxSteps: 8,
                    timeoutSeconds: 180,
                    retryPolicy: 'standard',
                    reasoningMode: 'balanced',
                    promptSections: {
                      rolePersona: 'You are the HelmOS ideation specialist.',
                      taskInstructions: 'Clarify the founder idea and identify assumptions.',
                      constraints: 'Do not invent market evidence.',
                      outputFormat: 'Return summary, risks, and next steps.'
                    }
                  },
                  active: true,
                  updatedAt: '2026-03-22T08:06:00.000Z'
                },
                runtime: {
                  registered: true,
                  name: 'Ideation Agent',
                  version: '1.0.0',
                  purpose: 'Transforms founder input into structured idea briefs.',
                  allowedTools: ['retrieval']
                }
              },
              {
                id: 'agent-2',
                key: 'research',
                name: 'Research Agent',
                version: '1.2.0',
                description: 'Builds evidence-backed research briefs.',
                allowedTools: ['retrieval', 'web_search'],
                defaultModel: 'helmos-research',
                active: false,
                createdAt: '2026-03-22T08:10:00.000Z',
                updatedAt: '2026-03-22T08:15:00.000Z',
                promptConfig: {
                  id: 'prompt-2',
                  key: 'research.default',
                  version: '1.2.0',
                  promptTemplate:
                    'Role / Persona:\nYou are the HelmOS research specialist.\n\nTask Instructions:\nCollect evidence and synthesize findings.\n\nConstraints:\nCite sources.\n\nOutput Format:\nReturn a research brief.',
                  configJson: {
                    purpose: 'Builds evidence-backed research briefs.',
                    scopeNotes: 'Focus on product and market research.',
                    temperature: 0.1,
                    maxSteps: 10,
                    timeoutSeconds: 240,
                    retryPolicy: 'standard',
                    reasoningMode: 'deep',
                    promptSections: {
                      rolePersona: 'You are the HelmOS research specialist.',
                      taskInstructions: 'Collect evidence and synthesize findings.',
                      constraints: 'Cite sources.',
                      outputFormat: 'Return a research brief.'
                    }
                  },
                  active: true,
                  updatedAt: '2026-03-22T08:16:00.000Z'
                },
                runtime: {
                  registered: false,
                  name: null,
                  version: null,
                  purpose: null,
                  allowedTools: []
                }
              }
            ]
          }
        })
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.getByRole('menuitem', { name: /Agent Admin/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /Agent Admin/i }).click();

    await expect(page).toHaveURL(/\/admin\/agents$/);
    await expect(page.getByRole('link', { name: 'Strategy Copilot' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agent Admin' })).toBeVisible();
    await expect(page.getByText('Manage the specialist registry that powers the agentic layer.')).toBeVisible();
    await expect(page.getByText('Persisted agents', { exact: true })).toBeVisible();
    await expect(page.getByText('Loading agent registry data...')).toBeHidden();
    await expect(page.getByText('Online', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ideation Agent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Research Agent/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'helmos-agent-gateway' })).toHaveCount(0);
    await expect(
      page.locator('.agent-card label').filter({ hasText: 'Purpose / Primary objective' }).locator('textarea')
    ).toHaveValue(
      'Transforms founder input into structured idea briefs.'
    );
    await expect(
      page.locator('.agent-card label').filter({ hasText: 'Scope notes' }).locator('textarea')
    ).toHaveValue(
      'Focus on early-stage idea clarification.'
    );
    await expect(
      page.locator('.agent-card label').filter({ hasText: 'Role / Persona' }).locator('textarea')
    ).toHaveValue(
      'You are the HelmOS ideation specialist.'
    );
    await expect(
      page.locator('.agent-card label').filter({ hasText: 'Task Instructions' }).locator('textarea')
    ).toHaveValue(
      'Clarify the founder idea and identify assumptions.'
    );
    await expect(
      page.locator('.agent-card label').filter({ hasText: 'Temperature' }).locator('input')
    ).toHaveValue('0.2');

    const persistedCard = page.locator('.hero-stat').filter({ hasText: 'Persisted agents' });
    const runtimeCard = page.locator('.hero-stat').filter({ hasText: 'Runtime agents' });
    const gatewayCard = page.locator('.hero-stat').filter({ hasText: 'Gateway' });
    const [persistedBox, runtimeBox, gatewayBox] = await Promise.all([
      persistedCard.boundingBox(),
      runtimeCard.boundingBox(),
      gatewayCard.boundingBox()
    ]);

    expect(persistedBox).not.toBeNull();
    expect(runtimeBox).not.toBeNull();
    expect(gatewayBox).not.toBeNull();
    expect(runtimeBox!.x).toBeGreaterThan(persistedBox!.x + 20);
    expect(gatewayBox!.x).toBeGreaterThan(runtimeBox!.x + 20);
    expect(Math.abs(persistedBox!.y - runtimeBox!.y)).toBeLessThan(8);
    expect(Math.abs(runtimeBox!.y - gatewayBox!.y)).toBeLessThan(8);

    await gatewayCard.click();
    await expect(page.getByRole('heading', { name: 'helmos-agent-gateway' })).toBeVisible();
    await expect(gatewayCard).toHaveAttribute('aria-expanded', 'true');

    await gatewayCard.click();
    await expect(page.getByRole('heading', { name: 'helmos-agent-gateway' })).toHaveCount(0);
    await expect(gatewayCard).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: /Research Agent/ }).click();
    const editorCard = page.locator('.agent-card').first();
    await expect(editorCard.getByRole('heading', { name: 'Research Agent' })).toBeVisible();
    await expect(editorCard.locator('.agent-key')).toHaveText('research');
    await expect(
      editorCard.locator('label').filter({ hasText: 'Role / Persona' }).locator('textarea')
    ).toHaveValue(
      'You are the HelmOS research specialist.'
    );

    await page.getByRole('link', { name: 'Strategy Copilot' }).click();
    await expect(page).toHaveURL(/\/strategy-copilot(\?.*)?$/);
  });

  test('creates a new agent from the Agent Admin screen', async ({ page }) => {
    let capturedCreatePayload: Record<string, unknown> | null = null;

    await page.route('**/api/admin/agents', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              gateway: {
                configured: false,
                status: 'not_configured',
                message: 'Agent gateway URL is not configured.',
                baseUrl: null,
                service: null,
                checkedAt: '2026-03-22T11:10:00.000Z',
                agents: []
              },
              agents: []
            }
          })
        });
        return;
      }

      if (method === 'POST') {
        capturedCreatePayload = route.request().postDataJSON() as Record<string, unknown>;

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'agent-1',
              key: 'ideation',
              name: 'Ideation Agent',
              version: '1.0.0',
              description: 'Transforms founder input into structured idea briefs.',
              allowedTools: ['retrieval'],
              defaultModel: 'helmos-default',
              active: true,
              createdAt: '2026-03-22T11:10:00.000Z',
              updatedAt: '2026-03-22T11:10:00.000Z',
              promptConfig: {
                id: 'prompt-1',
                key: 'ideation.default',
                version: '1.0.0',
                promptTemplate: 'Generate a founder-oriented idea brief from: {prompt}',
                configJson: { temperature: 0.2, artifact_kind: 'idea_brief' },
                active: true,
                updatedAt: '2026-03-22T11:10:00.000Z'
              },
              runtime: {
                registered: false,
                name: null,
                version: null,
                purpose: null,
                allowedTools: []
              }
            }
          })
        });
      }
    });

    await page.goto('/admin/agents');
    await expect(page.getByRole('button', { name: '+ New Agent' })).toBeVisible();
    await expect(page.locator('input[name="create-key"]')).toHaveCount(0);
    await page.getByRole('button', { name: '+ New Agent' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('input[name="create-key"]').fill('ideation');
    await page.locator('input[name="create-name"]').fill('Ideation Agent');
    await page
      .locator('textarea[name="create-purpose"]')
      .fill('Transforms founder input into structured idea briefs.');
    await page.locator('select[name="create-model"]').selectOption('helmos-default');
    await page.locator('input[name="create-tool-retrieval"]').check();
    await page
      .locator('textarea[name="create-prompt-role"]')
      .fill('You are the HelmOS ideation specialist for early concept shaping.');
    await page
      .locator('textarea[name="create-prompt-tasks"]')
      .fill('Clarify the idea, identify assumptions, and return a structured concept brief.');
    await page
      .locator('textarea[name="create-prompt-constraints"]')
      .fill('Do not invent market evidence. Surface uncertainty clearly.');
    await page
      .locator('textarea[name="create-prompt-output"]')
      .fill('Return summary, target user, assumptions, and next action.');

    await page.getByRole('button', { name: 'Register Agent' }).click();

    expect(capturedCreatePayload).toMatchObject({
      key: 'ideation',
      name: 'Ideation Agent',
      version: '1.0.0',
      defaultModel: 'helmos-default',
      active: true
    });
    expect(capturedCreatePayload).toHaveProperty('promptConfig.configJson.promptSections.rolePersona');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ideation Agent' })).toBeVisible();
    await expect(page.getByText('Persisted agents', { exact: true })).toBeVisible();
    await expect(page.getByText('Registered Ideation Agent')).toBeVisible();
  });

});
