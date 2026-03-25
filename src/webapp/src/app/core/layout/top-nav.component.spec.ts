import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TopNavComponent } from './top-nav.component';

describe('TopNavComponent', () => {
  async function renderComponent(inputs?: Partial<TopNavComponent>) {
    await TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [provideRouter([])]
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
});
