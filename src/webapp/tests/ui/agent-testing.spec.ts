import { expect, test } from '@playwright/test';

test.describe('Agent Testing admin workspace', () => {
  test('hides the agent loading spinner once testable agents resolve even while runs are still loading', async ({
    page
  }) => {
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
              baseUrl: 'http://127.0.0.1:8000/api/v1',
              service: 'helmos-agent-gateway',
              checkedAt: '2026-03-30T07:54:23.000Z',
              agents: [
                {
                  key: 'ideation',
                  name: 'Ideation Agent',
                  version: '1.0.0',
                  purpose: 'Transforms founder input into a structured concept.',
                  allowed_tools: ['retrieval']
                },
                {
                  key: 'testing',
                  name: 'Testing Agent',
                  version: '1.0.0',
                  purpose: 'Evaluates target agents.',
                  allowed_tools: ['retrieval']
                },
                {
                  key: 'value-proposition',
                  name: 'Value Proposition Agent',
                  version: '1.0.0',
                  purpose: 'Builds a strong value proposition canvas.',
                  allowed_tools: ['retrieval']
                }
              ]
            },
            agents: [
              {
                id: 'agent-1',
                key: 'ideation',
                name: 'Ideation Agent',
                version: '1.0.0',
                description: 'Transforms founder input into a structured concept.',
                allowedTools: ['retrieval'],
                defaultModel: 'helmos-default',
                active: true,
                createdAt: '2026-03-30T07:00:00.000Z',
                updatedAt: '2026-03-30T07:05:00.000Z',
                promptConfig: {
                  id: 'prompt-1',
                  key: 'ideation.default',
                  version: '1.0.0',
                  promptTemplate: 'Prompt',
                  configJson: {
                    purpose: 'Transforms founder input into a structured concept.'
                  },
                  active: true,
                  updatedAt: '2026-03-30T07:06:00.000Z'
                },
                runtime: {
                  registered: true,
                  name: 'Ideation Agent',
                  version: '1.0.0',
                  purpose: 'Transforms founder input into a structured concept.',
                  allowedTools: ['retrieval']
                }
              },
              {
                id: 'agent-2',
                key: 'testing',
                name: 'Testing Agent',
                version: '1.0.0',
                description: 'Evaluates target agents.',
                allowedTools: ['retrieval'],
                defaultModel: 'helmos-default',
                active: true,
                createdAt: '2026-03-30T07:10:00.000Z',
                updatedAt: '2026-03-30T07:15:00.000Z',
                promptConfig: null,
                runtime: {
                  registered: true,
                  name: 'Testing Agent',
                  version: '1.0.0',
                  purpose: 'Evaluates target agents.',
                  allowedTools: ['retrieval']
                }
              },
              {
                id: 'agent-3',
                key: 'value-proposition',
                name: 'Value Proposition Agent',
                version: '1.0.0',
                description: 'Builds a strong value proposition canvas.',
                allowedTools: ['retrieval'],
                defaultModel: 'helmos-default',
                active: true,
                createdAt: '2026-03-30T07:20:00.000Z',
                updatedAt: '2026-03-30T07:25:00.000Z',
                promptConfig: {
                  id: 'prompt-2',
                  key: 'value-proposition.default',
                  version: '1.0.0',
                  promptTemplate: 'Prompt',
                  configJson: {
                    purpose: 'Builds a strong value proposition canvas.'
                  },
                  active: true,
                  updatedAt: '2026-03-30T07:26:00.000Z'
                },
                runtime: {
                  registered: true,
                  name: 'Value Proposition Agent',
                  version: '1.0.0',
                  purpose: 'Builds a strong value proposition canvas.',
                  allowedTools: ['retrieval']
                }
              }
            ]
          }
        })
      });
    });

    await page.route('**/api/v1/admin/agent-tests/fixtures', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            fixtures: [
              {
                fixture_key: 'saas_b2b_finops_assistant',
                fixture_version: '1.0.0',
                fixture_class: 'regression',
                title: 'FinOps Copilot for small multi-cloud SaaS teams',
                applicable_agents: ['ideation', 'value-proposition'],
                min_turns: 20,
                max_turns: 24,
                scenario_dimensions: ['customer', 'pricing'],
                path: '/docs/agent_test_fixtures/regression/saas_b2b_finops_assistant.md'
              }
            ]
          }
        })
      });
    });

    await page.route('**/api/v1/admin/agent-tests/runs?target_agent_key=*', async (route) => {
      await page.waitForTimeout(2500);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            runs: []
          }
        })
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.getByRole('menuitem', { name: /Agent Testing/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /Agent Testing/i }).click();

    await expect(page).toHaveURL(/\/#\/admin\/agent-testing$/);
    await expect(page.getByRole('heading', { name: 'Agent Testing' })).toBeVisible();
    await expect(page.getByText(/Loading agents/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /Ideation Agent/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Value Proposition Agent/i })).toBeVisible();
    await expect(page.getByText(/Loading agents/i)).toHaveCount(0);
    await expect(page.getByText(/Loading runs/i)).toBeVisible();
    await expect(page.getByText('Testing Agent', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /\+ Test/i }).click();
    await expect(page.getByLabel('Minimum turns')).toHaveValue('20');
    await expect(page.getByLabel('Maximum turns')).toHaveValue('30');
  });
});
