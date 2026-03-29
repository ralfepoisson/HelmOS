import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TopNavComponent } from '../../core/layout/top-nav.component';
import { WorkspaceShellService } from '../../core/services/workspace-shell.service';

@Component({
  selector: 'app-agent-testing-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, TopNavComponent],
  template: `
    <app-top-nav
      [productName]="shell.productName"
      [surfaceLabel]="'Agent evaluation'"
      [saveStatus]="'Page structure ready'"
      [showWorkspaceSwitcher]="false"
    />

    <main class="testing-shell container-fluid">
      <section class="testing-hero helmos-card">
        <div class="hero-copy">
          <div class="section-kicker">Admin</div>
          <h1>Agent Testing</h1>
          <p>
            Design and review structured evaluation runs for specialist agents. This page is ready
            for the backend contract, but it intentionally does not show seeded or mock data.
          </p>
        </div>

        <div class="hero-summary">
          <div class="summary-chip">
            <span class="summary-label">Manual runs</span>
            <strong>Not connected</strong>
          </div>
          <div class="summary-chip">
            <span class="summary-label">Schedules</span>
            <strong>Not connected</strong>
          </div>
          <div class="summary-chip">
            <span class="summary-label">Reports</span>
            <strong>Not connected</strong>
          </div>
        </div>
      </section>

      <section class="workspace-grid">
        <article class="builder-card helmos-card">
          <div class="section-kicker">Run Builder</div>
          <h2>Create Test Run</h2>
          <p class="section-copy">
            This form establishes the structure for a manual evaluation launch once registry,
            fixtures, rubrics, and schedules are wired in.
          </p>

          <form class="builder-form">
            <label class="field">
              <span>Target agent</span>
              <select class="form-select" disabled>
                <option selected>Will load from the agent registry</option>
              </select>
            </label>

            <label class="field">
              <span>Test mode</span>
              <select class="form-select" disabled>
                <option selected>Will load supported evaluation modes</option>
              </select>
            </label>

            <label class="field">
              <span>Fixture</span>
              <select class="form-select" disabled>
                <option selected>Will load versioned fixtures</option>
              </select>
            </label>

            <label class="field">
              <span>Rubric version</span>
              <input class="form-control" disabled placeholder="Resolved from selected agent and fixture" />
            </label>

            <label class="field">
              <span>Driver version</span>
              <input class="form-control" disabled placeholder="Resolved from selected fixture" />
            </label>

            <label class="field">
              <span>Target model</span>
              <input class="form-control" disabled placeholder="Will resolve from runtime configuration" />
            </label>

            <label class="field field-wide">
              <span>Notes</span>
              <textarea
                class="form-control"
                rows="4"
                disabled
                placeholder="Optional launch notes and operator context will live here."
              ></textarea>
            </label>

            <div class="action-row">
              <button type="button" class="btn btn-primary" disabled>Start Run</button>
              <button type="button" class="btn btn-outline-secondary" disabled>Save As Suite</button>
            </div>
          </form>
        </article>

        <article class="config-card helmos-card">
          <div class="section-kicker">Evaluation Setup</div>
          <h2>Fixture, Rubric, and Runtime</h2>
          <p class="section-copy">
            These panels reserve space for the immutable testing inputs that will define
            comparability across runs.
          </p>

          <div class="config-stack">
            <section class="config-panel">
              <h3>Fixture Snapshot</h3>
              <p>Selected fixture metadata, version, scenario dimensions, and reveal rules.</p>
            </section>
            <section class="config-panel">
              <h3>Rubric Snapshot</h3>
              <p>Universal, agent-specific, and scenario-specific weighted scoring dimensions.</p>
            </section>
            <section class="config-panel">
              <h3>Runtime Snapshot</h3>
              <p>Identity markdown, composed system prompt, model resolution, and tool availability.</p>
            </section>
          </div>
        </article>
      </section>

      <section class="results-grid">
        <article class="results-card helmos-card">
          <div class="results-header">
            <div>
              <div class="section-kicker">Runs</div>
              <h2>Recent Test Runs</h2>
            </div>
            <button class="btn btn-light" type="button" disabled>Refresh</button>
          </div>

          <div class="empty-state">
            <h3>No runs to display yet</h3>
            <p>
              Once the backend is connected, this area will list manual and scheduled evaluation
              runs with status, verdict, score, fixture, model, and duration.
            </p>
          </div>
        </article>

        <article class="schedule-card helmos-card">
          <div class="section-kicker">Schedules</div>
          <h2>Recurring Benchmarks</h2>
          <p class="section-copy">
            This panel is reserved for nightly regressions, pre-release shadow-fixture checks, and
            model comparison schedules.
          </p>

          <div class="empty-state compact">
            <h3>No schedules configured</h3>
            <p>Scheduling controls will appear here once the backend scheduling endpoints are ready.</p>
          </div>
        </article>
      </section>

      <section class="analysis-grid">
        <article class="report-card helmos-card">
          <div class="section-kicker">Report</div>
          <h2>Evaluation Summary</h2>
          <p class="section-copy">
            The report surface will combine deterministic scorecards with Testing Agent narrative
            analysis and human review actions.
          </p>

          <div class="report-layout">
            <section class="report-panel">
              <h3>Scorecard</h3>
              <p>Layer scores, blocking dimensions, failure classes, confidence, and verdict.</p>
            </section>
            <section class="report-panel">
              <h3>Findings</h3>
              <p>Qualitative strengths, weaknesses, missed opportunities, and remediation guidance.</p>
            </section>
          </div>
        </article>

        <article class="transcript-card helmos-card">
          <div class="section-kicker">Transcript</div>
          <h2>Turn-by-Turn Review</h2>
          <p class="section-copy">
            Transcript review will live here with annotations, linked evidence, and full message
            history for the target agent and the scenario driver.
          </p>

          <div class="empty-state transcript-empty">
            <h3>No transcript selected</h3>
            <p>Select a run to inspect the message history, annotations, and evidence references.</p>
          </div>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .testing-shell {
        padding: 92px 1rem 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .testing-hero,
      .builder-card,
      .config-card,
      .results-card,
      .schedule-card,
      .report-card,
      .transcript-card {
        padding: 1.15rem 1.2rem;
      }

      .testing-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
        gap: 1.25rem;
        align-items: start;
      }

      .section-kicker,
      .summary-label {
        font-size: 0.77rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #356489;
      }

      .testing-hero h1,
      .builder-card h2,
      .config-card h2,
      .results-card h2,
      .schedule-card h2,
      .report-card h2,
      .transcript-card h2 {
        margin: 0.25rem 0 0.45rem;
        font-size: clamp(1.7rem, 2vw, 2.35rem);
        letter-spacing: -0.03em;
      }

      .hero-copy p,
      .section-copy,
      .config-panel p,
      .report-panel p,
      .empty-state p {
        margin: 0;
        color: var(--helmos-muted);
      }

      .hero-summary {
        display: grid;
        gap: 0.75rem;
      }

      .summary-chip {
        border: 1px solid rgba(53, 100, 137, 0.14);
        border-radius: 1rem;
        padding: 0.9rem 1rem;
        background:
          linear-gradient(180deg, rgba(250, 252, 255, 0.95), rgba(242, 247, 252, 0.9));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }

      .summary-chip strong {
        display: block;
        margin-top: 0.25rem;
        font-size: 1.05rem;
      }

      .workspace-grid,
      .results-grid,
      .analysis-grid {
        display: grid;
        gap: 1rem;
      }

      .workspace-grid {
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
      }

      .results-grid {
        grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
      }

      .analysis-grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .builder-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.95rem 1rem;
        margin-top: 1rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }

      .field span {
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--helmos-text);
      }

      .field-wide {
        grid-column: 1 / -1;
      }

      .action-row {
        grid-column: 1 / -1;
        display: flex;
        gap: 0.75rem;
        padding-top: 0.25rem;
      }

      .config-stack,
      .report-layout {
        display: grid;
        gap: 0.85rem;
        margin-top: 1rem;
      }

      .config-panel,
      .report-panel {
        border-radius: 1rem;
        border: 1px solid rgba(53, 100, 137, 0.14);
        padding: 1rem;
        background: rgba(248, 251, 255, 0.88);
      }

      .config-panel h3,
      .report-panel h3,
      .empty-state h3 {
        margin: 0 0 0.35rem;
        font-size: 1rem;
        letter-spacing: -0.02em;
      }

      .results-header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }

      .empty-state {
        margin-top: 1rem;
        border: 1px dashed rgba(53, 100, 137, 0.22);
        border-radius: 1rem;
        padding: 1.25rem;
        background:
          linear-gradient(135deg, rgba(247, 250, 255, 0.9), rgba(240, 246, 252, 0.9));
      }

      .compact {
        padding: 1rem;
      }

      .transcript-empty {
        min-height: 220px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      @media (max-width: 1199.98px) {
        .workspace-grid,
        .results-grid,
        .analysis-grid,
        .testing-hero {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 767.98px) {
        .testing-shell {
          padding: 84px 0.75rem 1.5rem;
        }

        .builder-form {
          grid-template-columns: minmax(0, 1fr);
        }

        .action-row {
          flex-direction: column;
        }
      }
    `
  ]
})
export class AgentTestingScreenComponent {
  protected readonly shell = inject(WorkspaceShellService);
}
