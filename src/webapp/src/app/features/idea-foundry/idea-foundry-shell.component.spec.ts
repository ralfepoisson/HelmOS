import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLinkWithHref } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { IdeaFoundryShellComponent } from './idea-foundry-shell.component';

describe('IdeaFoundryShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdeaFoundryShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            getProfileInitials: () => 'RP',
            getProfileName: () => 'Ralfe Poisson',
            getProfileRoleLabel: () => 'Admin',
            signOut: () => undefined
          }
        }
      ]
    }).compileComponents();
  });

  it('wires the Prospecting Configuration submenu item to the prospecting configuration route', () => {
    const fixture = TestBed.createComponent(IdeaFoundryShellComponent);
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll((node) => node.providerTokens.includes(RouterLinkWithHref))
      .map((node) => ({
        text: node.nativeElement.textContent?.trim(),
        href: node.injector.get(RouterLinkWithHref).href
      }));

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('Prospecting Configuration'),
          href: '/idea-foundry/prospecting-configuration'
        })
      ])
    );
  });
});
