import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { envSchema } from '@atc/config';
import {
  mapDeploymentTargets,
  mergeRenderEnvironment,
  parseDeploymentFile,
  validateDeploymentValues,
} from './deploy.js';
import { replaceEnvValue } from './hash-password.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(path.join(root, '.env.deploy.example'), 'utf8');
const values = parseDeploymentFile(template);

function validValues() {
  return {
    ...values,
    VERCEL_TOKEN: 'vercel-token-value',
    VERCEL_ORG_ID: 'team_abcdefghijklmnopqrst',
    VERCEL_PROJECT_ID: 'prj_abcdefghijklmnopqrst',
    RENDER_API_KEY: 'render-api-key-value',
    RENDER_SERVICE_ID: 'srv-abcdefghijklmnopqrst',
    NEXT_PUBLIC_API_URL: 'https://atc-api.onrender.com',
    API_URL: 'https://atc-api.onrender.com',
    WEB_URL: 'https://atc-web.vercel.app',
    MONGODB_URI: 'mongodb+srv://app-user:long-password@cluster0.mongodb.net/atc',
    AUTH_USERNAME: 'owner',
    AUTH_PASSWORD_HASH: `$2b$12$${'a'.repeat(53)}`,
    SESSION_SECRET: 'production-secret-with-at-least-thirty-two-characters',
  };
}

describe('deployment configuration', () => {
  it('lists every runtime schema variable except Render-provided PORT', () => {
    const missing = Object.keys(envSchema.shape).filter(
      (key) => key !== 'PORT' && !Object.hasOwn(values, key),
    );
    expect(missing).toEqual([]);
    expect(template).toContain('Render supplies PORT at runtime');
  });

  it('validates production authentication and platform configuration', () => {
    expect(() => validateDeploymentValues(validValues())).not.toThrow();
    expect(() => validateDeploymentValues({ ...validValues(), AUTH_MODE: 'disabled' })).toThrow(
      /AUTH_MODE/,
    );
  });

  it('routes server settings only to Render and the public API URL to Vercel', () => {
    const target = mapDeploymentTargets(validValues());
    expect(target.render.MONGODB_URI).toContain('mongodb+srv://');
    expect(target.render.SESSION_SECRET).toBeTruthy();
    expect(target.render.PORT).toBeUndefined();
    expect(target.render.NEXT_PUBLIC_API_URL).toBeUndefined();
    expect(target.render.VERCEL_TOKEN).toBeUndefined();
    expect(target.vercel).toEqual({ NEXT_PUBLIC_API_URL: 'https://atc-api.onrender.com' });
  });

  it('updates managed Render variables while preserving unrelated service variables', () => {
    expect(
      mergeRenderEnvironment(
        [
          { key: 'EXISTING_FLAG', value: 'keep-me' },
          { key: 'LOG_LEVEL', value: 'debug' },
        ],
        { LOG_LEVEL: 'info', NODE_ENV: 'production' },
      ),
    ).toEqual([
      { key: 'EXISTING_FLAG', value: 'keep-me' },
      { key: 'LOG_LEVEL', value: 'info' },
      { key: 'NODE_ENV', value: 'production' },
    ]);
  });

  it('rejects unknown variables instead of silently ignoring deployment config', () => {
    expect(() =>
      validateDeploymentValues({ ...validValues(), AI_REQUEST_TIMEOUT_MS: '15000' }),
    ).toThrow(/AI_REQUEST_TIMEOUT_MS/);
  });

  it('rejects copied provider placeholders', () => {
    expect(() =>
      validateDeploymentValues({ ...validValues(), RENDER_API_KEY: 'rnd_xxxxxxxxxxxx' }),
    ).toThrow(/RENDER_API_KEY/);
  });

  it('rejects the example session secret even when it meets the length requirement', () => {
    expect(() =>
      validateDeploymentValues({
        ...validValues(),
        SESSION_SECRET: 'replace-with-a-32-plus-character-random-string',
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('rejects example deployment hostnames', () => {
    expect(() =>
      validateDeploymentValues({
        ...validValues(),
        API_URL: 'https://your-api.onrender.com',
        NEXT_PUBLIC_API_URL: 'https://your-api.onrender.com',
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('updates the password hash line without changing other env entries', () => {
    const contents = 'AUTH_MODE=session\r\nAUTH_PASSWORD_HASH=old-value\r\nMONGODB_DB=atc\r\n';
    const hash = `$2b$12$${'a'.repeat(53)}`;
    expect(replaceEnvValue(contents, 'AUTH_PASSWORD_HASH', 'new-hash')).toBe(
      'AUTH_MODE=session\r\nAUTH_PASSWORD_HASH=new-hash\r\nMONGODB_DB=atc\r\n',
    );
    expect(replaceEnvValue(contents, 'AUTH_PASSWORD_HASH', hash)).toBe(
      `AUTH_MODE=session\r\nAUTH_PASSWORD_HASH=${hash}\r\nMONGODB_DB=atc\r\n`,
    );
  });
});
