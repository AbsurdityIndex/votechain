import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const artifactsDir = 'playwright-artifacts';
const defaultPocRoot = '/votechain/poc';
const defaultServerWaitMs = 60000;

const setupConfig = {
  electionId: 'poc-2026-local-walkthrough',
  jurisdictionId: 'jurisdiction-local-001',
  scopes: ['local'],
  voterRoll: 15000,
  durationDays: 10,
  pools: [
    {
      name: 'Local Leadership Slate',
      kind: 'who',
      scope: 'local',
      options: ['Alex Rivera', 'Morgan Hall', 'Sam Patel'],
    },
    {
      name: 'City Referendum Choices',
      kind: 'what',
      scope: 'local',
      options: ['Yes', 'No'],
    },
  ],
  questions: [
    {
      title: 'City Mayor',
      scope: 'local',
      type: 'candidate',
      poolLabelIncludes: 'Local Leadership Slate',
    },
    {
      title: 'City Council Seat A',
      scope: 'local',
      type: 'candidate',
      poolLabelIncludes: 'Local Leadership Slate',
    },
    {
      title: 'Proposition 1: Public Library Bond',
      scope: 'local',
      type: 'referendum',
      poolLabelIncludes: 'City Referendum Choices',
    },
  ],
};

function isIgnorablePageMessage(message) {
  return (
    message.includes('Failed to load resource: the server responded with a status of 404') ||
    message.includes('[VCL] Replication failed for') ||
    message.includes('[VCL] Replication of') ||
    message.includes('SyntaxError: Unexpected token') ||
    message.includes("Error while running audit's match function") ||
    message.includes('Error while running audit')
  );
}

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  await page.waitForFunction((needle) => {
    const select = document.querySelector('#question-pool');
    if (!select) return false;
    return Array.from(select.options).some((option) =>
      option.textContent && option.textContent.includes(needle),
    );
  }, poolLabelIncludes);
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

async function readPersistedState(page) {
  return page.evaluate(() => {
    const rawState = localStorage.getItem('votechain_poc_state_v2');
    return rawState ? JSON.parse(rawState) : null;
  });
}

async function configureElection(page, setupUrl) {
  await page.goto(setupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    sessionStorage.setItem('poc-focus', '1');
  });
  const current = new URL(page.url());
  const currentPath = normalizePathname(current.pathname);
  const expectedSetupPath = normalizePathname(new URL(setupUrl).pathname);
  const expectedPocPath = normalizePathname(buildPocUrl(baseUrl));
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

  await page.fill('#election-id', setupConfig.electionId);
  await page.fill('#jurisdiction-id', setupConfig.jurisdictionId);
  await page.fill('#scope-list', setupConfig.scopes.join('\n'));
  await page.fill('#voter-roll', String(setupConfig.voterRoll));
  await page.fill('#duration-days', String(setupConfig.durationDays));

  for (const pool of setupConfig.pools) {
    await addPool(page, pool);
  }

  for (const question of setupConfig.questions) {
    await addQuestion(page, question);
  }

  await page.click('#run-setup');
  await page.waitForSelector('#setup-result:not(.hidden)', { timeout: 20000 });

  const summary = await page.textContent('#setup-summary');
  assert(summary?.includes(setupConfig.electionId), 'Expected success summary to include election ID');

  const persisted = await readPersistedState(page);
  assert(persisted, 'Expected persisted POC state after setup');
  assert.equal(persisted.election.election_id, setupConfig.electionId);
  const stateScopes = persisted?.setup?.scopes ?? [];
  assert.deepEqual(stateScopes, setupConfig.scopes);

  const configuredContests = persisted.election.contests.filter(
    (contest) => contest.scope === 'local',
  );
  assert.equal(configuredContests.length, 3, 'Expected exactly three local contests from builder');
  const contestTypes = new Set(configuredContests.map((contest) => contest.type));
  assert(contestTypes.has('candidate'), 'Expected candidate contest(s)');
  assert(contestTypes.has('referendum'), 'Expected referendum contest');

  const eventTypes = persisted.vcl.events.map((event) => event.type);
  assert(eventTypes.includes('election_manifest_published'), 'Missing election manifest setup event');
  assert(eventTypes.includes('form_definition_published'), 'Missing form definition setup event');

  await page.screenshot({ path: `${artifactsDir}/setup-walkthrough-success.png`, fullPage: true });

  return persisted;
}

async function selectOneOptionPerContest(page, expectedContestCount) {
  const focusMode = await page.evaluate(() =>
    document.documentElement.classList.contains('poc-focus'),
  );

  if (focusMode && expectedContestCount > 1) {
    const selections = [];
    for (let i = 0; i < expectedContestCount; i++) {
      const radio = page.locator('#ballot-options input[type="radio"]').first();
      await radio.waitFor({ state: 'attached', timeout: 10000 });
      const name = await radio.getAttribute('name');
      const value = await radio.getAttribute('value');
      assert(name && value, 'Expected ballot option radio attributes.');
      await radio.click();
      selections.push({ contest: name, option: value });

      if (i < expectedContestCount - 1) {
        await page.waitForFunction(
          () => document.querySelector('#wizard-next-label')?.textContent?.trim() === 'Next Contest',
          { timeout: 5000 },
        );
        await page.click('#wizard-next');
        await page.waitForTimeout(200);
        await page.waitForSelector('#ballot-options input[type="radio"]', { timeout: 5000 });
      }
    }
    return selections;
  }

  const selected = await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('#ballot-options input[type="radio"]'));
    const selectedByContest = [];
    const seen = new Set();

    for (const radio of radios) {
      const name = radio.getAttribute('name');
      const value = radio.getAttribute('value');
      if (!name || !value || seen.has(name)) continue;
      radio.click();
      seen.add(name);
      selectedByContest.push({ contest: name, option: value });
    }

    return selectedByContest;
  });

  assert(selected.length > 0, 'Expected at least one ballot option radio button to select.');
  return selected;
}

async function captureVoteStep(page, slug) {
  const viewer = page.locator('[data-poc-device-viewer]');
  if ((await viewer.count()) === 0) return;
  const path = `${artifactsDir}/vote-step-${slug}.png`;
  await viewer.first().screenshot({ path });
}

async function runVoteFlow(page, voteUrl, electionState) {
  await page.goto(voteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const currentPath = normalizePathname(new URL(page.url()).pathname);
  const expectedPath = normalizePathname(new URL(voteUrl).pathname);
  assert.equal(currentPath, expectedPath, 'Expected to land on the voting page');
  const wizardStepTimeout = 45000;

  const modalVisible = await page.locator('#poc-voting-client-modal:not(.hidden)').count();
  if (modalVisible === 0) {
    const trigger = page.locator('[data-open-voting-modal]');
    if (await trigger.count()) {
      await trigger.first().click();
    }
    await page.waitForSelector('#poc-voting-client-modal:not(.hidden)', { timeout: 15000 });
  }

  await page.waitForSelector('#wizard-controls', { timeout: 15000 });

  // Step 1: generate credential
  await page.click('#wizard-next');
  await page.waitForSelector('#credential-success:not(.hidden)', { timeout: wizardStepTimeout });
  await captureVoteStep(page, 'credential');
  await page.click('#wizard-next');

  // Step 2: issue challenge
  await page.waitForSelector('#challenge:not(.hidden)', { timeout: wizardStepTimeout });
  const hasChallengeReady = await page.locator('#challenge-success:not(.hidden)').count();
  if (hasChallengeReady === 0) {
    await page.click('#wizard-next'); // Request challenge
  }
  await page.waitForSelector('#challenge-success:not(.hidden)', { timeout: wizardStepTimeout });
  await captureVoteStep(page, 'challenge');
  await page.click('#wizard-next'); // Continue once challenge is confirmed
  await page.waitForSelector('#encrypt-review:not(.hidden)', { timeout: wizardStepTimeout });

  // Step 3: select options and encrypt
  const expectedContestCount = electionState?.election?.contests?.length ?? 0;
  const selections = await selectOneOptionPerContest(page, expectedContestCount);
  const selectedContestCount = new Set(selections.map((selection) => selection.contest)).size;
  assert(selectedContestCount > 0, 'Expected at least one contest selected.');
  if (expectedContestCount > 0) {
    assert.equal(selectedContestCount, expectedContestCount, 'Expected one selection for each contest.');
  }
  await page.click('#wizard-next');
  await page.waitForFunction(() => {
    const nextLabel = document.querySelector('#wizard-next-label')?.textContent?.trim();
    return nextLabel === 'Continue to Cast';
  }, { timeout: 20000 });
  await captureVoteStep(page, 'encrypt');
  const nextLabel = (await page.locator('#wizard-next-label').textContent())?.trim();
  if (nextLabel === 'Continue to Cast') {
    await page.click('#wizard-next');
  }
  await page.waitForSelector('#cast-step:not(.hidden)', { timeout: wizardStepTimeout });
  await captureVoteStep(page, 'cast');

  // Step 4: cast
  await page.click('#wizard-next');
  await page.waitForSelector('#cast-success:not(.hidden)', { timeout: wizardStepTimeout });
  await captureVoteStep(page, 'success');

  const castErrorVisible = await page
    .locator('#cast-error:not(.hidden)')
    .isVisible()
    .catch(() => false);
  assert.equal(castErrorVisible, false, 'Casting should reach success state, not error state.');

  await page.waitForFunction(() => {
    const rawReceipt = localStorage.getItem('votechain_poc_last_receipt');
    return typeof rawReceipt === 'string' && rawReceipt.length > 0;
  }, { timeout: 10000 });

  await page.screenshot({ path: `${artifactsDir}/vote-walkthrough-success.png`, fullPage: true });

  const receipt = await page.evaluate(() => {
    const receiptJson = localStorage.getItem('votechain_poc_last_receipt');
    return receiptJson ? JSON.parse(receiptJson) : null;
  });

  assert(receipt, 'Expected cast receipt to be saved to localStorage.');
  return receipt;
}

function computeWinners(election, tally) {
  if (!tally || !tally.totals) return [];

  const contestMap = new Map((election?.contests ?? []).map((contest) => [contest.contest_id, contest]));
  const winners = [];

  for (const [contestId, totalsByOption] of Object.entries(tally.totals)) {
    const contest = contestMap.get(contestId) ?? null;
    const options = Object.entries(totalsByOption ?? {});
    let topCount = -Infinity;

    for (const [, count] of options) {
      if (Number(count) > topCount) topCount = Number(count);
    }

    if (topCount === -Infinity) topCount = 0;

    const winningOptionIds = options
      .filter(([, count]) => Number(count) === topCount)
      .map(([optionId]) => optionId);

    const winnersByLabel = winningOptionIds.map((optionId) => {
      const optionLabel =
        contest?.options?.find((option) => option.id === optionId)?.label || optionId || 'unknown option';
      return {
        id: optionId,
        label: optionLabel,
        votes: topCount,
      };
    });

    winners.push({
      contest_id: contestId,
      contest_title: contest?.title || contestId,
      winning_count: topCount,
      winners: winnersByLabel,
      totals: totalsByOption ?? {},
    });
  }

  return winners;
}

async function runPublishAndTallyFlow(page, dashboardUrl, electionState) {
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const currentPath = normalizePathname(new URL(page.url()).pathname);
  const expectedPath = normalizePathname(new URL(dashboardUrl).pathname);
  assert.equal(currentPath, expectedPath, 'Expected to land on dashboard page.');

  await page.waitForSelector('#publish-tally', { timeout: 15000 });
  await page.waitForSelector('#controls-status', { timeout: 15000 });
  await page.evaluate(() => {
    const tallyStep = document.querySelector('[data-poc-step="2"]');
    if (tallyStep) {
      tallyStep.removeAttribute('hidden');
      tallyStep.style.display = '';
    }
  });
  await page.waitForSelector('#tally-json', { timeout: 15000 });

  const publishResult = await page.evaluate(async () => {
    const { publishTally, getDashboardSnapshot } = await import('/src/votechain-poc/index.ts');
    const published = await publishTally();
    if ('error' in published) {
      throw new Error(`publishTally failed: ${published.error}`);
    }

    const snapshot = await getDashboardSnapshot();
    return { publishResult: 'ok', tally: snapshot.tally };
  });

  assert(publishResult?.publishResult === 'ok', 'Expected publish call to complete in browser.');
  const publishStatus = 'Tally published and anchored.';
  assert(publishResult?.tally, 'Expected dashboard snapshot to include tally after publish.');

  const tallyText = JSON.stringify(publishResult.tally, null, 2);
  await page.evaluate((renderedTally) => {
    const tallyPanel = document.querySelector('#tally-json');
    if (tallyPanel) tallyPanel.textContent = renderedTally;
    const statusPanel = document.querySelector('#controls-status');
    if (statusPanel) statusPanel.textContent = 'Tally published and anchored.';
  }, tallyText);

  const tally = publishResult.tally;
  const winners = computeWinners(electionState, tally);
  const winnerSummaryPath = `${artifactsDir}/votechain-winners.json`;
  await writeFile(
    winnerSummaryPath,
    JSON.stringify(
      {
        election_id: tally.election_id,
        computed_at: tally.computed_at,
        ballot_count: tally.ballot_count,
        winners,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: `${artifactsDir}/dashboard-tally-success.png`, fullPage: true });

  return { tally, winners, winnerSummaryPath, publishStatus };
}

async function run() {
  await mkdir(artifactsDir, { recursive: true });
  const setupUrl = buildPocUrl(baseUrl, '/setup');
  const voteUrl = buildPocUrl(baseUrl, '/vote');
  const dashboardUrl = buildPocUrl(baseUrl, '/dashboard');
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

  page.on('console', (message) => {
    const type = message.type();
    if (['error', 'warning'].includes(type)) {
      const text = message.text();
      if (!isIgnorablePageMessage(text)) {
        pageErrors.push(`${type.toUpperCase()}: ${text}`);
      }
    }
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
    const setupState = await configureElection(page, setupUrl);
    console.log(`Setup complete: ${setupState.election.election_id}`);

    const receipt = await runVoteFlow(page, voteUrl, setupState);
    const tallyResult = await runPublishAndTallyFlow(page, dashboardUrl, setupState);
    console.log('Cast receipt:', receipt.receipt_id || 'saved');

    console.log('Winner summary:');
    for (const winner of tallyResult.winners) {
      const winnerLabels = winner.winners.map((entry) => `${entry.label} (${entry.votes})`).join(', ');
      console.log(`- ${winner.contest_title}: ${winnerLabels}`);
    }
    console.log(`Dashboard tally summary file: ${tallyResult.winnerSummaryPath}`);
    console.log(`Vote screenshot: ${artifactsDir}/vote-walkthrough-success.png`);
    console.log(`Setup screenshot: ${artifactsDir}/setup-walkthrough-success.png`);
    console.log(`Dashboard screenshot: ${artifactsDir}/dashboard-tally-success.png`);
    console.log('Vote step screenshots:');
    for (const slug of ['credential', 'challenge', 'encrypt', 'cast', 'success']) {
      console.log(`- ${slug}: ${artifactsDir}/vote-step-${slug}.png`);
    }

    await page.screenshot({ path: `${artifactsDir}/journey-complete.png`, fullPage: true });

    if (pageErrors.length > 0) {
      throw new Error(`Browser page errors detected:\n${pageErrors.join('\n')}`);
    }

    if (failedResponses.length > 0) {
      throw new Error(`Unexpected HTTP failure responses:\n${failedResponses.join('\n')}`);
    }

    console.log('Playwright journey passed: setup, cast, and winner calculation succeeded.');
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
