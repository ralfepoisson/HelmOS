import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-completion-callout',
  standalone: true,
  template: `
    <section class="completion-callout">
      <div class="callout-header">
        <span class="callout-kicker">HelmOS guidance</span>
        <span class="callout-pill">Next unlock</span>
      </div>

      <h3 class="callout-title">{{ title }}</h3>
      <p class="callout-copy mb-0">{{ copy }}</p>

      <button type="button" class="btn btn-link btn-sm callout-action">
        Review unlock criteria
      </button>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .completion-callout {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.55rem;
        padding: 0.85rem 0.95rem 0.8rem;
        border-radius: 0.95rem;
        border: 1px solid rgba(159, 171, 188, 0.28);
        background:
          radial-gradient(circle at top right, rgba(99, 115, 129, 0.06), transparent 38%),
          linear-gradient(180deg, rgba(248, 249, 251, 0.96), rgba(255, 255, 255, 0.98));
      }

      .callout-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .callout-kicker {
        display: inline-block;
        color: #6f7c8e;
        font-size: 0.67rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.09em;
      }

      .callout-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.28rem 0.5rem;
        border-radius: 999px;
        background: rgba(111, 124, 142, 0.08);
        color: #6f7c8e;
        font-size: 0.67rem;
        font-weight: 700;
      }

      .callout-title {
        margin: 0;
        font-size: 0.98rem;
        line-height: 1.3;
        font-weight: 700;
      }

      .callout-copy {
        color: #6f7c8e;
        font-size: 0.86rem;
        line-height: 1.55;
      }

      .callout-action {
        align-self: flex-start;
        width: auto;
        padding: 0;
        color: #4f5d70;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.83rem;
      }

      @media (max-width: 767.98px) {
        .completion-callout {
          padding-inline: 1rem;
        }
      }
    `
  ]
})
export class CompletionCalloutComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) copy!: string;
}
