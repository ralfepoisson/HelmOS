import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { MyBusinessIdeasPageComponent } from './my-business-ideas-page.component';

describe('MyBusinessIdeasPageComponent', () => {
  const ideas = [
    {
      id: 'signalforge',
      name: 'SignalForge AI Studio',
      businessType: 'PRODUCT' as const,
      businessTypeLabel: 'Product-based'
    },
    {
      id: 'harbor',
      name: 'Harbor Health Ops',
      businessType: 'SERVICE' as const,
      businessTypeLabel: 'Service-based'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyBusinessIdeasPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessIdeasApiService,
          useValue: {
            listBusinessIdeas: () => Promise.resolve(ideas)
          }
        }
      ]
    }).compileComponents();
  });

  it('renders the business idea cards from the API', async () => {
    const fixture = TestBed.createComponent(MyBusinessIdeasPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cardTitles = Array.from(fixture.nativeElement.querySelectorAll('.idea-card-title')).map((node) =>
      (node as HTMLElement).textContent?.trim()
    );

    expect(cardTitles).toEqual(['SignalForge AI Studio', 'Harbor Health Ops']);
  });

  it('navigates to Strategy Copilot with the clicked workspace id', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(MyBusinessIdeasPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstCard = fixture.nativeElement.querySelector('.idea-card') as HTMLButtonElement;
    firstCard.click();

    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(['/strategy-copilot'], {
      queryParams: { workspaceId: 'signalforge' }
    });
    expect(fixture.componentInstance.selectedWorkspaceId).toBe('signalforge');
  });
});
