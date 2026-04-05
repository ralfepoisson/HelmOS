import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-idea-foundry-stage-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="stage-page helmos-card">
      <span class="stage-kicker">Idea Foundry</span>
      <h2>{{ title }}</h2>
      <p class="stage-summary">{{ summary }}</p>

      <div class="stage-callout">
        <strong>UI scaffold ready</strong>
        <p>{{ detail }}</p>
      </div>
    </section>
  `,
  styles: [
    `
      .stage-page {
        padding: 1.4rem;
        max-width: 56rem;
      }

      .stage-kicker {
        display: inline-block;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--helmos-accent);
      }

      .stage-page h2 {
        margin: 0.45rem 0 0.5rem;
        font-size: clamp(1.55rem, 2.4vw, 2.1rem);
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .stage-summary,
      .stage-callout p {
        margin: 0;
        color: var(--helmos-muted);
        line-height: 1.65;
      }

      .stage-callout {
        margin-top: 1.1rem;
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(248, 251, 255, 0.82);
        border: 1px solid rgba(219, 228, 238, 0.95);
      }

      .stage-callout strong {
        display: block;
        margin-bottom: 0.35rem;
      }
    `
  ]
})
export class IdeaFoundryStagePageComponent {
  private readonly route = inject(ActivatedRoute);

  get title(): string {
    return this.route.snapshot.data['title'] as string;
  }

  get summary(): string {
    return this.route.snapshot.data['summary'] as string;
  }

  get detail(): string {
    return this.route.snapshot.data['detail'] as string;
  }
}
