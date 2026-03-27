import { WorkspaceShellService } from './workspace-shell.service';

describe('WorkspaceShellService', () => {
  it('keeps downstream strategy tools locked until the business idea unlocks them', () => {
    const service = new WorkspaceShellService();

    const tools = service.getStrategyTools(['ideation']);

    expect(tools.find((tool) => tool.id === 'ideation')?.status).toBe('available');
    expect(tools.find((tool) => tool.id === 'value-proposition')?.status).toBe('locked');
    expect(tools.find((tool) => tool.id === 'customer-segments')?.status).toBe('locked');
  });

  it('marks unlocked strategy tools as available from persisted business idea access', () => {
    const service = new WorkspaceShellService();

    const tools = service.getStrategyTools([
      'ideation',
      'value-proposition',
      'customer-segments',
      'business-model',
      'market-research'
    ]);

    expect(tools.find((tool) => tool.id === 'value-proposition')?.status).toBe('available');
    expect(tools.find((tool) => tool.id === 'customer-segments')?.status).toBe('available');
    expect(tools.find((tool) => tool.id === 'business-model')?.status).toBe('available');
    expect(tools.find((tool) => tool.id === 'market-research')?.status).toBe('available');
  });
});
