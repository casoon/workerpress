import { describe, expect, it } from 'vitest';
import {
  applyVars,
  nextSteps,
  renderAuth,
  renderWranglerToml,
  validateProjectName,
} from './scaffold.js';

describe('applyVars', () => {
  it('substitutes known placeholders and leaves unknown ones', () => {
    expect(applyVars('name = "__PROJECT_NAME__" / __OTHER__', { PROJECT_NAME: 'shop' })).toBe(
      'name = "shop" / __OTHER__',
    );
  });
});

describe('validateProjectName', () => {
  it('accepts valid npm names', () => {
    expect(validateProjectName('my-cms')).toBeNull();
    expect(validateProjectName('shop123')).toBeNull();
  });
  it('rejects invalid names', () => {
    expect(validateProjectName('')).not.toBeNull();
    expect(validateProjectName('Bad Name')).not.toBeNull();
    expect(validateProjectName('-leading')).not.toBeNull();
  });
});

describe('renderWranglerToml', () => {
  it('always includes DB + CACHE', () => {
    const toml = renderWranglerToml({
      projectName: 'shop',
      auth: 'access',
      media: false,
      aiSearch: false,
    });
    expect(toml).toContain('name = "shop"');
    expect(toml).toContain('binding = "DB"');
    expect(toml).toContain('binding = "CACHE"');
    expect(toml).not.toContain('binding = "MEDIA"');
    expect(toml).not.toContain('[ai]');
  });
  it('adds R2 + AI bindings when modules are enabled', () => {
    const toml = renderWranglerToml({
      projectName: 'shop',
      auth: 'access',
      media: true,
      aiSearch: true,
    });
    expect(toml).toContain('binding = "MEDIA"');
    expect(toml).toContain('[ai]');
  });
});

describe('renderAuth', () => {
  it('emits the Access verifier for access', () => {
    expect(renderAuth('access')).toContain('createCloudflareAccessAuth');
  });
  it('emits a Better Auth stub for better-auth', () => {
    expect(renderAuth('better-auth')).toContain('Better Auth');
  });
});

describe('nextSteps', () => {
  it('mentions setup, migrate, seed and dev', () => {
    const steps = nextSteps({
      projectName: 'shop',
      auth: 'access',
      media: true,
      aiSearch: false,
    }).join('\n');
    expect(steps).toContain('cd shop');
    expect(steps).toContain('cms setup');
    expect(steps).toContain('db:migrate');
    expect(steps).toContain('seed');
    expect(steps).toContain('dev');
  });
});
