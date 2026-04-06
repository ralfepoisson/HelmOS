import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLinkWithHref } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { TopNavComponent } from './top-nav.component';

describe('TopNavComponent', () => {
  const authService = {
    isAdmin: vi.fn(() => true),
    getProfileInitials: vi.fn(() => 'RP'),
    getProfileName: vi.fn(() => 'Ralfe Poisson'),
    getProfileRoleLabel: vi.fn(() => 'Admin'),
    signOut: vi.fn()
  };

  async function renderComponent(inputs?: Partial<TopNavComponent>) {
    await TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TopNavComponent);
    Object.assign(fixture.componentInstance, {
      productName: 'HelmOS',
      saveStatus: 'All changes saved',
      profileInitials: 'RP',
      profileName: 'Ralfe Poisson',
      profileRoleLabel: 'Admin',
      showAdminMenu: true,
      ...inputs
    });
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authService.isAdmin.mockReturnValue(true);
    authService.getProfileInitials.mockReturnValue('RP');
    authService.getProfileName.mockReturnValue('Ralfe Poisson');
    authService.getProfileRoleLabel.mockReturnValue('Admin');
  });

  it('hides the admin menu when the signed-in user is not an admin', async () => {
    const fixture = await renderComponent({
      showAdminMenu: false,
      profileRoleLabel: 'Member'
    });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Admin');
    expect(compiled.textContent).toContain('Member');
  });

  it('renders the signed-in profile summary from auth state', async () => {
    const fixture = await renderComponent({
      profileInitials: 'RP',
      profileName: 'Ralfe Poisson',
      profileRoleLabel: 'Admin'
    });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.profile-avatar')?.textContent).toContain('RP');
    expect(compiled.textContent).toContain('Ralfe Poisson');
    expect(compiled.textContent).toContain('Admin');
  });

  it('links the brand cluster back to root', async () => {
    const fixture = await renderComponent();
    const brandLink = fixture.debugElement
      .queryAll((node) => node.providerTokens.includes(RouterLinkWithHref))
      .find((node) => node.nativeElement.classList.contains('brand-home-link'));

    expect(brandLink?.injector.get(RouterLinkWithHref).href).toBe('/');
  });

  it('shows a sign out button that signs the user out', async () => {
    const fixture = await renderComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const signOutButton = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Sign Out'
    );

    signOutButton?.dispatchEvent(new MouseEvent('click'));

    expect(signOutButton).toBeTruthy();
    expect(authService.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows conceptual tools and agent testing in the admin menu', async () => {
    const fixture = await renderComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const adminTrigger = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Admin')
    );

    adminTrigger?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.textContent).toContain('Conceptual Tools');
    expect(compiled.textContent).toContain('Agent Testing');
  });

  it('lists admin submenu items in alphabetical order', async () => {
    const fixture = await renderComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const adminTrigger = Array.from(compiled.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Admin')
    );

    adminTrigger?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    await fixture.whenStable();

    const menuItems = Array.from(compiled.querySelectorAll('.admin-panel .admin-link-title')).map((node) =>
      node.textContent?.trim()
    );

    expect(menuItems).toEqual([
      'Agent Admin',
      'Agent Testing',
      'Conceptual Tools',
      'Knowledge Bases',
      'Knowledge Search',
      'Logs',
      'Support Dashboard'
    ]);
  });

  it('shows Idea Foundry in the primary navigation', async () => {
    const fixture = await renderComponent();
    const navLinks = fixture.debugElement
      .queryAll((node) => node.providerTokens.includes(RouterLinkWithHref))
      .map((node) => ({
        classes: node.nativeElement.className,
        href: node.injector.get(RouterLinkWithHref).href,
        text: node.nativeElement.textContent?.trim()
      }));

    expect(navLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classes: expect.stringContaining('primary-nav-link'),
          href: '/idea-foundry',
          text: 'Idea Foundry'
        })
      ])
    );
  });
});
