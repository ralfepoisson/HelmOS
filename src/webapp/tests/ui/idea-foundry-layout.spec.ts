import { expect, test } from '@playwright/test';

test.describe('HelmOS Idea Foundry', () => {
  test('renders the Idea Foundry overview with the stage menu and pipeline board', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Idea Foundry' }).first().click();

    await expect(page).toHaveURL(/#\/idea-foundry$/);
    await expect(page.getByRole('link', { name: 'Idea Foundry' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opportunity pipeline' })).toBeVisible();

    for (const label of [
      'Overview',
      'Prospecting Configuration',
      'Proto-Idea Extraction',
      'Idea Refinement',
      'Idea Evaluator'
    ]) {
      await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: 'Refine raw business signals into curated opportunities' })).toBeVisible();

    const board = page.getByTestId('idea-foundry-board');
    await expect(board).toBeVisible();

    for (const column of ['Sources', 'Proto-Ideas', 'Idea Candidates', 'Curated Opportunities']) {
      await expect(board.getByRole('heading', { name: column })).toBeVisible();
    }

    await expect(page.getByText('No proto-ideas yet', { exact: true })).toBeVisible();
    await expect(page.getByText('No curated opportunities yet', { exact: true })).toBeVisible();
  });
});
