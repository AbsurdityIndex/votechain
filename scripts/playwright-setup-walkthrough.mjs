import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const artifactsDir = 'playwright-artifacts';
const defaultPocRoot = '/votechain/poc';
const defaultServerWaitMs = 60000;

function resolvePocRootPath(rawBaseUrl) {
  const parsed = new URL(rawBaseUrl);
  const trimmed = parsed.pathname.replace(/\/+$/g, '');
  if (!trimmed || trimmed === '') return defaultPocRoot;
  if (trimmed === '/') return defaultPocRoot;
  return trimmed;
}

function buildPocUrl(rawBaseUrl, suffixPath = '') {
  const parsed = new URL(rawBaseUrl);
  const rootPath = resolvePocRootPath(rawBaseUrl);
  const targetPath = `${rootPath}${suffixPath}`;
  return new URL(targetPath, parsed.origin).toString();
}

async function canReach(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function shouldAutoStartDevServer(rawBaseUrl) {
  if (process.env.AUTO_START_DEV_SERVER === '0') return false;
  if (process.env.AUTO_START_DEV_SERVER === '1') return true;
  const host = new URL(rawBaseUrl).hostname;
  return host === '127.0.0.1' || host === 'localhost';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/g, '');
}

function normalizeNextPath(nextParam) {
  if (!nextParam) return '';
  try {
    const parsed = new URL(nextParam, 'https://example.local');
    return normalizePathname(parsed.pathname);
  } catch {
    return normalizePathname(nextParam);
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) return true;
    await wait(500);
  }
  return false;
}

async function ensureServerReady(rawBaseUrl, readinessUrl) {
  if (await canReach(readinessUrl)) return null;
  if (!shouldAutoStartDevServer(rawBaseUrl)) {
    throw new Error(
      `Server is not reachable at ${readinessUrl}. Start it first, or set BASE_URL to a reachable host.`,
    );
  }

  const parsed = new URL(rawBaseUrl);
  const host = parsed.hostname;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const logPath = path.join(artifactsDir, 'setup-walkthrough-dev-server.log');
  const logStream = createWriteStream(logPath, { flags: 'a' });
  const child = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', port], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);

  const ready = await waitForServer(readinessUrl, defaultServerWaitMs);
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(
      `Timed out waiting for local dev server at ${readinessUrl}. See ${logPath} for server output.`,
    );
  }

  return async () => {
    child.kill('SIGTERM');
    await wait(400);
    if (!child.killed) child.kill('SIGKILL');
    logStream.end();
  };
}

async function selectPoolByLabel(page, poolLabelIncludes) {
  const value = await page.$eval(
    '#question-pool',
    (select, needle) => {
      const options = Array.from(select.options);
      const found = options.find((option) => option.textContent?.includes(needle));
      return found?.value ?? '';
    },
    poolLabelIncludes,
  );
  assert(value, `No question-pool option matched "${poolLabelIncludes}"`);
  await page.selectOption('#question-pool', value);
}

async function addPool(page, { name, kind, scope, options }) {
  await page.fill('#pool-name', name);
  await page.selectOption('#pool-kind', kind);
  await page.selectOption('#pool-scope', scope);
  await page.fill('#pool-options', options.join('\n'));
  await page.click('#add-pool');
}

async function addQuestion(page, { title, scope, type, poolLabelIncludes }) {
  await page.fill('#question-title', title);
  await page.selectOption('#question-scope', scope);
  await page.selectOption('#question-type', type);
  await selectPoolByLabel(page, poolLabelIncludes);
  await page.click('#add-question');
}

async function run() {
  await mkdir(artifactsDir, { recursive: true });
  const setupUrl = buildPocUrl(baseUrl, '/setup');
  const readinessUrl = buildPocUrl(baseUrl);
  const stopDevServer = await ensureServerReady(baseUrl, readinessUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  const failedResponses = [];
  const ignoredFailurePaths = new Set([
    '/api/visitors.json',
    '/api/votechain/poc/replicate',
    '/favicon.ico',
  ]);

  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    try {
      const url = new URL(response.url());
      if (ignoredFailurePaths.has(url.pathname)) return;
      failedResponses.push(`${status} ${url.pathname}`);
    } catch {
      failedResponses.push(`${status} ${response.url()}`);
    }
  });

  try {
    await page.goto(setupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const current = new URL(page.url());
    const currentPath = normalizePathname(current.pathname);
    const expectedSetupPath = normalizePathname(new URL(setupUrl).pathname);
    const expectedPocPath = normalizePathname(new URL(readinessUrl).pathname);
    if (currentPath !== expectedSetupPath) {
      const nextPath = normalizeNextPath(current.searchParams.get('next'));
      if (currentPath === expectedPocPath && nextPath === expectedSetupPath) {
        throw new Error(
          `Setup route is gated by Turnstile/session on ${current.origin}. Unlock ${buildPocUrl(baseUrl)} in a browser, then rerun.`,
        );
      }
      throw new Error(`Expected setup route ${expectedSetupPath}, but landed on ${current.pathname}.`);
    }
    await page.waitForSelector('#setup-form', { timeout: 15000 });

    await page.fill('#election-id', 'poc-2026-local-walkthrough');
    await page.fill('#jurisdiction-id', 'jurisdiction-local-001');
    await page.fill('#scope-list', 'local');
    await page.fill('#voter-roll', '15000');
    await page.fill('#duration-days', '10');

    await addPool(page, {
      name: 'Local Leadership Slate',
      kind: 'who',
      scope: 'local',
      options: ['Alex Rivera', 'Morgan Hall', 'Sam Patel'],
    });
    await addPool(page, {
      name: 'City Referendum Choices',
      kind: 'what',
      scope: 'local',
      options: ['Yes', 'No'],
    });

    await addQuestion(page, {
      title: 'City Mayor',
      scope: 'local',
      type: 'candidate',
      poolLabelIncludes: 'Local Leadership Slate',
    });
    await addQuestion(page, {
      title: 'City Council Seat A',
      scope: 'local',
      type: 'candidate',
      poolLabelIncludes: 'Local Leadership Slate',
    });
    await addQuestion(page, {
      title: 'Proposition 1: Public Library Bond',
      scope: 'local',
      type: 'referendum',
      poolLabelIncludes: 'City Referendum Choices',
    });

    await page.click('#run-setup');
    await page.waitForSelector('#setup-result:not(.hidden)', { timeout: 20000 });

    const summary = await page.textContent('#setup-summary');
    assert(summary?.includes('poc-2026-local-walkthrough'), 'Expected success summary to include election ID');

    const persisted = await page.evaluate(() => {
      const raw = localStorage.getItem('votechain_poc_state_v2');
      return raw ? JSON.parse(raw) : null;
    });

    assert(persisted, 'Expected persisted POC state after setup');
    assert.equal(persisted.election.election_id, 'poc-2026-local-walkthrough');
    assert.deepEqual(persisted.setup?.scopes, ['local']);

    const localContests = persisted.election.contests.filter((contest) => contest.scope === 'local');
    assert.equal(localContests.length, 3, 'Expected exactly three local contests from builder');
    const contestTypes = new Set(localContests.map((contest) => contest.type));
    assert(contestTypes.has('candidate'), 'Expected candidate contest(s)');
    assert(contestTypes.has('referendum'), 'Expected referendum contest');

    const eventTypes = persisted.vcl.events.map((event) => event.type);
    assert(eventTypes.includes('election_manifest_published'), 'Missing election manifest setup event');
    assert(eventTypes.includes('form_definition_published'), 'Missing form definition setup event');

    await page.screenshot({ path: `${artifactsDir}/setup-walkthrough-success.png`, fullPage: true });

    if (pageErrors.length > 0) {
      throw new Error(`Browser page errors detected:\n${pageErrors.join('\n')}`);
    }

    if (failedResponses.length > 0) {
      throw new Error(`Unexpected HTTP failure responses:\n${failedResponses.join('\n')}`);
    }

    console.log('Playwright walkthrough passed: setup builder created local election with positions + referendum.');
    console.log(`Screenshot: ${artifactsDir}/setup-walkthrough-success.png`);
  } catch (error) {
    await page.screenshot({ path: `${artifactsDir}/setup-walkthrough-failure.png`, fullPage: true });
    console.error(`Failure screenshot: ${artifactsDir}/setup-walkthrough-failure.png`);
    throw error;
  } finally {
    await browser.close();
    if (typeof stopDevServer === 'function') await stopDevServer();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
