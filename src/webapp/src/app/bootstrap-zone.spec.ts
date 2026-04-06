import { describe, expect, it } from 'vitest';
import appConfigSource from './app.config.ts?raw';
import mainSource from '../main.ts?raw';
import packageJsonSource from '../../package.json?raw';

describe('Angular bootstrap zone wiring', () => {
  it('imports zone.js before bootstrapping the application', () => {
    expect(mainSource).toContain(`import 'zone.js';`);
  });

  it('opts Angular into zone-based change detection at bootstrap', () => {
    expect(appConfigSource).toContain('provideZoneChangeDetection');
    expect(appConfigSource).toContain('provideZoneChangeDetection()');
  });

  it('declares zone.js as an application dependency', () => {
    const packageJson = JSON.parse(packageJsonSource) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.['zone.js']).toBeTruthy();
  });
});
