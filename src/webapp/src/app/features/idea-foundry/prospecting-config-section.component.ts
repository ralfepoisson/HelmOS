import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-prospecting-config-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="section-card helmos-card" [class.section-card-compact]="compact">
      <div class="section-header">
        <div>
          <span class="section-kicker">{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
          <p *ngIf="description">{{ description }}</p>
        </div>
        <ng-content select="[section-actions]" />
      </div>

      <div class="section-body">
        <ng-content />
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .section-card {
        padding: 1.15rem;
      }

      .section-card-compact {
        padding: 1rem;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
        margin-bottom: 1rem;
      }

      .section-kicker {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--helmos-accent);
      }

      .section-header h2 {
        margin: 0.35rem 0 0.3rem;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .section-header p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.55;
      }
    `
  ]
})
export class ProspectingConfigSectionComponent {
  @Input({ required: true }) eyebrow!: string;
  @Input({ required: true }) title!: string;
  @Input() description = '';
  @Input() compact = false;
}
