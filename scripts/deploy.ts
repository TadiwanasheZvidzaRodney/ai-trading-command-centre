import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEnv, envSchema, parseEnvText } from '@atc/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnvPath = path.join(root, '.env.deploy.local');
const exampleEnvPath = path.join(root, '.env.deploy.example');
const vercelLinkPath = path.join(root, '.vercel', 'project.json');
const controlKeys = [
  'DEPLOY_ENV',
  'VERCEL_TOKEN',
  'VERCEL_ORG_ID',
  'VERCEL_PROJECT_ID',
  'RENDER_API_KEY',
  'RENDER_SERVICE_ID',
  'NEXT_PUBLIC_API_URL',
] as const;
const runtimeKeys = Object.keys(envSchema.shape);
const requiredControlKeys = controlKeys.filter((key) => key !== 'DEPLOY_ENV');
const renderApiBase = 'https://api.render.com/v1';
const vercelApiBase = 'https://api.vercel.com';

export type DeploymentValues = Record<string, string>;

export function parseDeploymentFile(contents: string): DeploymentValues {
  return parseEnvText(contents);
}

export function validateDeploymentValues(values: DeploymentValues) {
  const allowedKeys = new Set([...controlKeys, ...runtimeKeys]);
  const unknownKeys = Object.keys(values).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported deployment variables: ${unknownKeys.join(', ')}`);
  }

  const missingControls = requiredControlKeys.filter((key) => !values[key]?.trim());
  if (missingControls.length > 0) {
    throw new Error(`Set required deployment variables: ${missingControls.join(', ')}`);
  }
  if (values.DEPLOY_ENV !== 'production') {
    throw new Error('DEPLOY_ENV must be production for this deployment workflow');
  }
  const placeholderKeys = requiredControlKeys.filter((key) => isPlaceholder(values[key]));
  if (placeholderKeys.length > 0) {
    throw new Error(`Replace placeholder values for: ${placeholderKeys.join(', ')}`);
  }

  const missingRuntimeKeys = runtimeKeys.filter(
    (key) => key !== 'PORT' && !Object.hasOwn(values, key),
  );
  if (missingRuntimeKeys.length > 0) {
    throw new Error(
      `Deployment template is missing runtime variables: ${missingRuntimeKeys.join(', ')}`,
    );
  }

  if (!/^team_|^user_/.test(values.VERCEL_ORG_ID)) {
    throw new Error('VERCEL_ORG_ID must be a Vercel team_ or user_ identifier');
  }
  if (!values.VERCEL_PROJECT_ID.startsWith('prj_')) {
    throw new Error('VERCEL_PROJECT_ID must be a Vercel prj_ identifier');
  }
  if (!values.RENDER_SERVICE_ID.startsWith('srv-')) {
    throw new Error('RENDER_SERVICE_ID must be a Render srv- identifier');
  }

  const appInput: Record<string, string | undefined> = {};
  for (const key of runtimeKeys) {
    const value = values[key]?.trim();
    appInput[key] = value || undefined;
  }
  const appEnv = createEnv(appInput);
  const placeholderSecrets = [
    'AUTH_USERNAME',
    'AUTH_PASSWORD_HASH',
    'SESSION_SECRET',
    'MONGODB_URI',
    'API_URL',
    'WEB_URL',
    'NEXT_PUBLIC_API_URL',
    'MARKET_DATA_TWELVE_DATA_API_KEY',
    'MARKET_DATA_OANDA_API_TOKEN',
    'AI_API_KEY',
  ].filter((key) => isPlaceholder(values[key]));
  if (placeholderSecrets.length > 0) {
    throw new Error(`Replace placeholder values for: ${placeholderSecrets.join(', ')}`);
  }

  const publicApiUrl = parseHttpsUrl(values.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');
  const apiUrl = parseHttpsUrl(appEnv.API_URL, 'API_URL');
  parseHttpsUrl(appEnv.WEB_URL, 'WEB_URL');
  if (publicApiUrl.origin !== apiUrl.origin) {
    throw new Error('NEXT_PUBLIC_API_URL and API_URL must use the same origin');
  }
  if (/your-cluster|your-password|example\.com/i.test(appEnv.MONGODB_URI)) {
    throw new Error('Set MONGODB_URI to the real MongoDB Atlas connection string');
  }

  return { appEnv };
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return Boolean(
    /^(?:your(?:[-_ ].*)?|replace(?:[-_ ].*)?|placeholder.*|x{4,}|(?:rnd|team|user|prj|srv)_?x{4,}|<.*>)$/i.test(
      normalized,
    ) || /(?:your-|replace-with|placeholder|example\.com|xxxxxxxxxx)/i.test(normalized),
  );
}

function parseHttpsUrl(value: string, key: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.hostname === 'localhost') {
    throw new Error(`${key} must be a public HTTPS URL`);
  }
  return url;
}

export function mapDeploymentTargets(values: DeploymentValues) {
  const render: DeploymentValues = {};
  for (const key of runtimeKeys) {
    const value = values[key]?.trim();
    if (key !== 'PORT' && value) render[key] = value;
  }
  return {
    render,
    vercel: { NEXT_PUBLIC_API_URL: values.NEXT_PUBLIC_API_URL },
  };
}

export function mergeRenderEnvironment(
  existing: Array<{ key: string; value: string }>,
  managed: DeploymentValues,
): Array<{ key: string; value: string }> {
  const merged = new Map(existing.map(({ key, value }) => [key, value]));
  for (const [key, value] of Object.entries(managed)) merged.set(key, value);
  return Array.from(merged, ([key, value]) => ({ key, value }));
}

async function loadValues(): Promise<DeploymentValues> {
  let contents: string;
  try {
    contents = await readFile(localEnvPath, 'utf8');
  } catch {
    throw new Error('Missing .env.deploy.local. Run `npm run deploy -- init` first.');
  }
  return parseDeploymentFile(contents);
}

async function loadValidatedValues() {
  const values = await loadValues();
  const { appEnv } = validateDeploymentValues(values);
  return { values, appEnv, targets: mapDeploymentTargets(values) };
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Git preflight failed');
  return result.stdout.trim();
}

function assertCleanWorktree(): void {
  if (git(['status', '--porcelain']).length > 0) {
    throw new Error(
      'Production deployment requires a clean worktree. Commit the intended changes first.',
    );
  }
}

function getHeadCommit(): string {
  const head = git(['rev-parse', 'HEAD']);
  let upstream: string;
  try {
    upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  } catch {
    throw new Error('The deployment branch needs a Git upstream before deploying to Render.');
  }
  if (git(['rev-parse', upstream]) !== head) {
    throw new Error(
      'Push the current commit and update the upstream branch before deploying to Render.',
    );
  }
  return head;
}

function isIgnored(relativePath: string): boolean {
  return spawnSync('git', ['check-ignore', '-q', relativePath], { cwd: root }).status === 0;
}

function isVercelCliAvailable(): boolean {
  const result =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'vercel --version'], {
          cwd: root,
          encoding: 'utf8',
          stdio: 'ignore',
        })
      : spawnSync('vercel', ['--version'], { cwd: root, encoding: 'utf8', stdio: 'ignore' });
  return result.status === 0;
}

function printHelp(): void {
  console.log(`Personal deployment CLI (Vercel + Render + MongoDB Atlas)

Commands:
  init                 Create .env.deploy.local from the safe template
  link-web             Write the ignored Vercel project link from local IDs
  doctor               Validate local configuration without showing values
  build                Run the production workspace build
  sync-env             Sync production variables to Vercel and Render
  sync-render          Sync production runtime variables to Render only
  configure-api        Configure the existing Render service for this monorepo
  deploy-api           Configure, sync and deploy the pushed Render commit
  deploy-web           Sync the public URL and deploy with the Vercel CLI
  deploy-all           Deploy Render, then Vercel, then verify both
  verify               Check provider access, web/API health and Mongo readiness

Provider deployment commands accept --dry-run. init and link-web only write ignored local files.
No command creates cloud resources.`);
}

async function apiRequest(
  url: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Provider API request failed before receiving a response');
  }
  if (!response.ok) {
    throw new Error(`Provider API request failed with HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function vercelProjectUrl(values: DeploymentValues, endpoint: string): string {
  const url = new URL(`${vercelApiBase}${endpoint}`);
  if (values.VERCEL_ORG_ID.startsWith('team_')) {
    url.searchParams.set('teamId', values.VERCEL_ORG_ID);
  }
  return url.toString();
}

async function syncVercel(values: DeploymentValues, dryRun: boolean): Promise<void> {
  const entries = [
    {
      key: 'NEXT_PUBLIC_API_URL',
      value: values.NEXT_PUBLIC_API_URL,
      type: 'plain',
      target: ['production'],
      comment: 'Managed by the ATC deployment CLI',
    },
  ];
  console.log(
    `Vercel: ${dryRun ? 'would sync' : 'syncing'} ${entries.map((item) => item.key).join(', ')}`,
  );
  if (dryRun) return;
  const endpoint = `/v10/projects/${encodeURIComponent(values.VERCEL_PROJECT_ID)}/env?upsert=true`;
  const result = await apiRequest(
    vercelProjectUrl(values, endpoint),
    values.VERCEL_TOKEN,
    'POST',
    entries,
  );
  const payload = result as { failed?: Array<{ error?: { key?: string } }> } | null;
  if (payload?.failed?.length) {
    const keys = payload.failed
      .map((item) => item.error?.key)
      .filter(Boolean)
      .join(', ');
    throw new Error(`Vercel rejected environment variables${keys ? `: ${keys}` : ''}`);
  }
}

async function syncRender(values: DeploymentValues, dryRun: boolean): Promise<void> {
  const { render } = mapDeploymentTargets(values);
  const keys = Object.keys(render);
  console.log(`Render: ${dryRun ? 'would sync' : 'syncing'} ${keys.length} runtime variables`);
  if (dryRun) {
    console.log(`Render variables: ${keys.join(', ')}`);
    return;
  }

  const serviceEnvUrl = new URL(
    `${renderApiBase}/services/${encodeURIComponent(values.RENDER_SERVICE_ID)}/env-vars`,
  );
  const existing = new Map<string, string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    serviceEnvUrl.searchParams.set('limit', '100');
    if (cursor) serviceEnvUrl.searchParams.set('cursor', cursor);
    const page = (await apiRequest(serviceEnvUrl.toString(), values.RENDER_API_KEY)) as Array<{
      envVar?: { key?: string; value?: string };
      cursor?: string;
    }> | null;
    if (!Array.isArray(page)) {
      throw new Error('Render returned an invalid environment-variable list');
    }
    for (const item of page) {
      if (item.envVar?.key && typeof item.envVar.value === 'string') {
        existing.set(item.envVar.key, item.envVar.value);
      }
    }
    const nextCursor = page.at(-1)?.cursor;
    if (!nextCursor || page.length < 100) break;
    if (seenCursors.has(nextCursor)) {
      throw new Error('Render environment pagination repeated a cursor');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
    if (pageNumber === 99) {
      throw new Error('Render environment list exceeded the pagination safety limit');
    }
  }

  serviceEnvUrl.search = '';
  await apiRequest(
    serviceEnvUrl.toString(),
    values.RENDER_API_KEY,
    'PUT',
    mergeRenderEnvironment(
      Array.from(existing, ([key, value]) => ({ key, value })),
      render,
    ),
  );
}

async function configureRender(values: DeploymentValues, dryRun: boolean): Promise<void> {
  console.log(
    `Render service ${values.RENDER_SERVICE_ID}: ${dryRun ? 'would configure' : 'configuring'} monorepo commands`,
  );
  if (dryRun) return;
  await apiRequest(
    `${renderApiBase}/services/${encodeURIComponent(values.RENDER_SERVICE_ID)}`,
    values.RENDER_API_KEY,
    'PATCH',
    {
      rootDir: '.',
      serviceDetails: {
        envSpecificDetails: {
          buildCommand: 'npm ci && npm run build -w @atc/api',
          startCommand: 'npm run start:api',
        },
        healthCheckPath: '/health/ready',
      },
    },
  );
}

async function triggerRenderDeploy(values: DeploymentValues, commitId: string): Promise<string> {
  const servicePath = `/services/${encodeURIComponent(values.RENDER_SERVICE_ID)}`;
  const created = (await apiRequest(
    `${renderApiBase}${servicePath}/deploys`,
    values.RENDER_API_KEY,
    'POST',
    { commitId },
  )) as { id?: string } | null;
  if (created?.id) return created.id;

  const latest = await apiRequest(
    `${renderApiBase}${servicePath}/deploys?limit=1`,
    values.RENDER_API_KEY,
  );
  if (Array.isArray(latest)) {
    const record = latest[0] as { deploy?: { id?: string } } | undefined;
    if (record?.deploy?.id) return record.deploy.id;
  }
  throw new Error('Render accepted the deploy but did not return a deployment ID');
}

async function waitForRenderDeploy(values: DeploymentValues, deployId: string): Promise<void> {
  const endpoint = `${renderApiBase}/services/${encodeURIComponent(values.RENDER_SERVICE_ID)}/deploys/${encodeURIComponent(deployId)}`;
  const terminalFailure = new Set(['build_failed', 'update_failed', 'canceled', 'deactivated']);
  for (let attempt = 0; attempt < 75; attempt += 1) {
    const result = (await apiRequest(endpoint, values.RENDER_API_KEY)) as {
      status?: string;
    } | null;
    if (result?.status === 'live') {
      console.log(`Render deploy ${deployId}: live`);
      return;
    }
    if (result?.status && terminalFailure.has(result.status)) {
      throw new Error(`Render deployment ended with status ${result.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 8_000));
  }
  throw new Error(`Render deployment ${deployId} did not become live before timeout`);
}

async function ensureVercelLink(values: DeploymentValues, dryRun: boolean): Promise<void> {
  let current: { orgId?: string; projectId?: string } | undefined;
  try {
    current = JSON.parse(await readFile(vercelLinkPath, 'utf8')) as typeof current;
  } catch {
    current = undefined;
  }
  if (current) {
    if (current.orgId !== values.VERCEL_ORG_ID || current.projectId !== values.VERCEL_PROJECT_ID) {
      throw new Error(
        '.vercel/project.json does not match the deployment IDs; inspect it before relinking',
      );
    }
    return;
  }
  if (dryRun) {
    console.log('Vercel: would create ignored .vercel/project.json');
    return;
  }
  await mkdir(path.dirname(vercelLinkPath), { recursive: true });
  await writeFile(
    vercelLinkPath,
    `${JSON.stringify({ orgId: values.VERCEL_ORG_ID, projectId: values.VERCEL_PROJECT_ID }, null, 2)}\n`,
    { flag: 'wx' },
  );
}

async function runVercel(values: DeploymentValues): Promise<void> {
  const env = { ...process.env, VERCEL_TOKEN: values.VERCEL_TOKEN };
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', 'vercel --prod --yes --non-interactive'],
          {
            cwd: root,
            env,
            stdio: 'inherit',
          },
        )
      : spawnSync('vercel', ['--prod', '--yes', '--non-interactive'], {
          cwd: root,
          env,
          stdio: 'inherit',
        });
  if (result.error || result.status !== 0) {
    throw new Error('Vercel CLI deployment failed; inspect the CLI output for details');
  }
}

async function verify(values: DeploymentValues): Promise<void> {
  await apiRequest(
    vercelProjectUrl(values, `/v9/projects/${encodeURIComponent(values.VERCEL_PROJECT_ID)}`),
    values.VERCEL_TOKEN,
  );
  console.log('Vercel project: reachable');

  await apiRequest(
    `${renderApiBase}/services/${encodeURIComponent(values.RENDER_SERVICE_ID)}`,
    values.RENDER_API_KEY,
  );
  console.log('Render service: reachable');

  for (const [label, url] of [
    ['Render API liveness', new URL('/health/live', values.API_URL).toString()],
    ['MongoDB Atlas readiness', new URL('/health/ready', values.API_URL).toString()],
    ['Vercel web', values.WEB_URL],
  ]) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    } catch {
      throw new Error(`${label}: no response`);
    }
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    console.log(`${label}: ok (${response.status})`);
  }
}

async function doctor(): Promise<void> {
  let failed = false;
  const ignored = isIgnored('.env.deploy.local');
  console.log(`.env.deploy.local: ${ignored ? 'Git-ignored' : 'NOT ignored'}`);
  if (!ignored) failed = true;

  try {
    const values = await loadValues();
    for (const key of requiredControlKeys) {
      console.log(`${key}: ${values[key]?.trim() ? 'configured' : 'missing'}`);
      if (!values[key]?.trim()) failed = true;
    }
    try {
      validateDeploymentValues(values);
      console.log('Production runtime configuration: valid');
    } catch (error) {
      console.log(`Production runtime configuration: ${(error as Error).message}`);
      failed = true;
    }
  } catch (error) {
    console.log((error as Error).message);
    failed = true;
  }

  console.log(
    `Vercel CLI: ${isVercelCliAvailable() ? 'available' : 'missing (install with npm install --global vercel)'}`,
  );
  if (failed) process.exitCode = 1;
}

async function initialize(): Promise<void> {
  try {
    await readFile(localEnvPath);
    console.log('.env.deploy.local already exists; it was left unchanged.');
    return;
  } catch {
    await writeFile(localEnvPath, await readFile(exampleEnvPath), { flag: 'wx', mode: 0o600 });
  }
  console.log(
    'Created .env.deploy.local. It is Git-ignored; populate it locally with your provider values.',
  );
}

async function linkWeb(): Promise<void> {
  const values = await loadValues();
  for (const key of ['VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']) {
    if (!values[key]?.trim()) throw new Error(`Set ${key} in .env.deploy.local first`);
  }
  await ensureVercelLink(values, false);
  console.log('Vercel project link written to the ignored .vercel directory.');
}

async function build(): Promise<void> {
  const result =
    process.platform === 'win32'
      ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
          cwd: root,
          encoding: 'utf8',
          stdio: 'inherit',
        })
      : spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Workspace production build failed');
}

async function main(args: string[]): Promise<void> {
  const [command = 'help'] = args;
  const dryRun = args.includes('--dry-run');
  if (command === 'help' || command === '--help') return printHelp();
  if (command === 'init') return initialize();
  if (command === 'link-web') return linkWeb();
  if (command === 'doctor') return doctor();
  if (command === 'build') return build();
  if (command === 'verify') {
    const { values } = await loadValidatedValues();
    return verify(values);
  }

  const { values, targets } = await loadValidatedValues();
  if (command === 'sync-env') {
    await syncVercel(values, dryRun);
    await syncRender(values, dryRun);
    return;
  }
  if (command === 'sync-render') return syncRender(values, dryRun);
  if (command === 'configure-api') return configureRender(values, dryRun);
  if (command === 'deploy-api') {
    if (dryRun) {
      console.log(`Would configure and deploy Render service ${values.RENDER_SERVICE_ID}`);
      console.log(`Would sync Render variables: ${Object.keys(targets.render).join(', ')}`);
      return;
    }
    assertCleanWorktree();
    const commitId = getHeadCommit();
    await configureRender(values, false);
    await syncRender(values, false);
    const deployId = await triggerRenderDeploy(values, commitId);
    await waitForRenderDeploy(values, deployId);
    return;
  }
  if (command === 'deploy-web') {
    if (dryRun) {
      await ensureVercelLink(values, true);
      console.log(`Would sync Vercel variables: ${Object.keys(targets.vercel).join(', ')}`);
      console.log('Would run Vercel production deployment');
      return;
    }
    assertCleanWorktree();
    await ensureVercelLink(values, false);
    await syncVercel(values, false);
    await runVercel(values);
    return;
  }
  if (command === 'deploy-all') {
    if (dryRun) {
      await ensureVercelLink(values, true);
      console.log(`Would configure and deploy Render service ${values.RENDER_SERVICE_ID}`);
      console.log(
        `Would sync ${Object.keys(targets.render).length} Render variables and NEXT_PUBLIC_API_URL to Vercel`,
      );
      console.log('Would deploy Vercel production and verify provider/API/database readiness');
      return;
    }
    assertCleanWorktree();
    const commitId = getHeadCommit();
    await ensureVercelLink(values, false);
    await configureRender(values, false);
    await syncVercel(values, false);
    await syncRender(values, false);
    const deployId = await triggerRenderDeploy(values, commitId);
    await waitForRenderDeploy(values, deployId);
    await runVercel(values);
    await verify(values);
    return;
  }
  printHelp();
  throw new Error(`Unknown deployment command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main(process.argv.slice(2)).catch((error: unknown) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
