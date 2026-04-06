import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = join(import.meta.dirname, '..', '..');

describe('Angular bootstrap zone wiring', () => {
  it('imports zone.js before bootstrapping the application', () => {
    const mainSource = readFileSync(join(projectRoot, 'src', 'main.ts'), 'utf8');

    expect(mainSource).toContain(`import 'zone.js';`);
  });

  it('opts Angular into zone-based change detection at bootstrap', () => {
    const appConfigSource = readFileSync(join(projectRoot, 'src', 'app', 'app.config.ts'), 'utf8');

    expect(appConfigSource).toContain('provideZoneChangeDetection');
    expect(appConfigSource).toContain('provideZoneChangeDetection()');
  });

  it('declares zone.js as an application dependency', () => {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.['zone.js']).toBeTruthy();
  });
});
