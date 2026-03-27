import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';

import { BusinessIdeasApiService } from './core/services/business-ideas-api.service';
import { AuthService } from './core/auth/auth.service';
import { rootIdeaSelectionRedirectGuard } from './app.routes';

describe('rootIdeaSelectionRedirectGuard', () => {
  let businessIdeasApi: { listBusinessIdeas: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    businessIdeasApi = {
      listBusinessIdeas: vi.fn()
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BusinessIdeasApiService,
          useValue: businessIdeasApi
        },
        {
          provide: AuthService,
          useValue: {
            ensureAuthenticated: () => Promise.resolve(true),
            ensureAdmin: () => Promise.resolve(true),
            isAdmin: () => false,
            getProfileInitials: () => 'HG',
            getProfileName: () => 'Helm Guest',
            getProfileRoleLabel: () => 'Member'
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects to the new idea page when the user has no business ideas', async () => {
    businessIdeasApi.listBusinessIdeas.mockResolvedValue([]);

    const result = await TestBed.runInInjectionContext(() =>
      rootIdeaSelectionRedirectGuard({} as never, { url: '/' } as never)
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/strategy-copilot/new-idea');
  });

  it('redirects to the business ideas page when the user has saved ideas', async () => {
    businessIdeasApi.listBusinessIdeas.mockResolvedValue([
      {
        id: 'signalforge',
        name: 'SignalForge AI Studio',
        businessType: 'PRODUCT',
        businessTypeLabel: 'Product-based'
      }
    ]);

    const result = await TestBed.runInInjectionContext(() =>
      rootIdeaSelectionRedirectGuard({} as never, { url: '/' } as never)
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/strategy-copilot/my-business-ideas');
  });
});
