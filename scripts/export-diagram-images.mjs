#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const serveDir = path.join(repoRoot, 'dist');

const exportProfiles = {
  field: {
    boardRoute: '/votechain/evidence/diagram-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams'),
    fullFilename: 'diagram-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 2500 },
    pngTargets: [
      { selector: '[data-panel="stage-flow"]', filename: 'stage-flow.png' },
      { selector: '[data-panel="session-grid"]', filename: 'session-grid.png' },
      { selector: '[data-panel="test-coverage"]', filename: 'test-coverage.png' },
      { selector: '[data-panel="verification-chain"]', filename: 'verification-chain.png' },
      { selector: '[data-panel="run-outcomes"]', filename: 'run-outcomes.png' },
    ],
  },
  pi: {
    boardRoute: '/votechain/evidence/pi-integration-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'pi-integration'),
    fullFilename: 'pi-integration-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1900, height: 2800 },
    pngTargets: [
      { selector: '[data-panel="pi-lab-topology"]', filename: 'pi-lab-topology.png' },
      { selector: '[data-panel="pi-machine-wiring"]', filename: 'pi-machine-wiring.png' },
      { selector: '[data-panel="pi-network-segmentation"]', filename: 'pi-network-segmentation.png' },
      { selector: '[data-panel="pi-compose-placement"]', filename: 'pi-compose-placement.png' },
      { selector: '[data-panel="pi-test-cycle"]', filename: 'pi-test-cycle.png' },
    ],
  },
  crypto: {
    boardRoute: '/votechain/evidence/crypto-ceremony-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'crypto-ceremony'),
    fullFilename: 'crypto-ceremony-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 2800 },
    pngTargets: [
      { selector: '[data-panel="blind-schnorr"]', filename: 'blind-schnorr.png' },
      { selector: '[data-panel="threshold-issuance"]', filename: 'threshold-issuance.png' },
      { selector: '[data-panel="nullifier-derivation"]', filename: 'nullifier-derivation.png' },
      { selector: '[data-panel="ecies-encryption"]', filename: 'ecies-encryption.png' },
      { selector: '[data-panel="shamir-sharing"]', filename: 'shamir-sharing.png' },
    ],
  },
  poc: {
    boardRoute: '/votechain/evidence/poc-engine-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'poc-engine'),
    fullFilename: 'poc-engine-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 2800 },
    pngTargets: [
      { selector: '[data-panel="module-graph"]', filename: 'module-graph.png' },
      { selector: '[data-panel="state-schema"]', filename: 'state-schema.png' },
      { selector: '[data-panel="init-sequence"]', filename: 'init-sequence.png' },
      { selector: '[data-panel="voter-journey"]', filename: 'voter-journey.png' },
    ],
  },
  bb: {
    boardRoute: '/votechain/evidence/bulletin-board-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'bulletin-board'),
    fullFilename: 'bulletin-board-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 3000 },
    pngTargets: [
      { selector: '[data-panel="merkle-tree"]', filename: 'merkle-tree.png' },
      { selector: '[data-panel="signed-tree-head"]', filename: 'signed-tree-head.png' },
      { selector: '[data-panel="inclusion-proof"]', filename: 'inclusion-proof.png' },
      { selector: '[data-panel="sth-history"]', filename: 'sth-history.png' },
      { selector: '[data-panel="vcl-anchoring"]', filename: 'vcl-anchoring.png' },
    ],
  },
  workers: {
    boardRoute: '/votechain/evidence/worker-ledger-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'worker-ledger'),
    fullFilename: 'worker-ledger-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 2800 },
    pngTargets: [
      { selector: '[data-panel="worker-topology"]', filename: 'worker-topology.png' },
      { selector: '[data-panel="event-routing"]', filename: 'event-routing.png' },
      { selector: '[data-panel="do-ledger"]', filename: 'do-ledger.png' },
      { selector: '[data-panel="replication-flow"]', filename: 'replication-flow.png' },
      { selector: '[data-panel="auth-layers"]', filename: 'auth-layers.png' },
    ],
  },
  fraud: {
    boardRoute: '/votechain/evidence/fraud-detection-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'fraud-detection'),
    fullFilename: 'fraud-detection-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 3200 },
    pngTargets: [
      { selector: '[data-panel="fraud-state-machine"]', filename: 'fraud-state-machine.png' },
      { selector: '[data-panel="action-mapping"]', filename: 'action-mapping.png' },
      { selector: '[data-panel="vcl-fraud-events"]', filename: 'vcl-fraud-events.png' },
      { selector: '[data-panel="security-controls"]', filename: 'security-controls.png' },
      { selector: '[data-panel="evidence-chain"]', filename: 'evidence-chain.png' },
    ],
  },
  e2e: {
    boardRoute: '/votechain/evidence/e2e-verification-board/',
    outputDir: path.join(publicDir, 'votechain', 'evidence', 'diagrams', 'e2e-verification'),
    fullFilename: 'e2e-verification-board-full.png',
    fullSelector: '.board-canvas .page',
    viewport: { width: 1800, height: 3200 },
    pngTargets: [
      { selector: '[data-panel="e2e-properties"]', filename: 'e2e-properties.png' },
      { selector: '[data-panel="cast-flow"]', filename: 'cast-flow.png' },
      { selector: '[data-panel="tally-flow"]', filename: 'tally-flow.png' },
      { selector: '[data-panel="trust-model"]', filename: 'trust-model.png' },
    ],
  },
};

const mimeByExtension = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function contentTypeFor(filePath) {
  return mimeByExtension.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function resolvePathname(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = decoded === '/' ? '/index.html' : decoded;
  const absolute = path.normalize(path.join(serveDir, candidate));
  if (!absolute.startsWith(serveDir)) {
    return null;
  }
  return absolute;
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const resolved = resolvePathname(url.pathname);

      if (!resolved) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      let finalPath = resolved;
      const fileStat = await stat(finalPath).catch(() => null);
      if (fileStat?.isDirectory()) {
        finalPath = path.join(finalPath, 'index.html');
      }

      const data = await readFile(finalPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypeFor(finalPath));
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine static server port');
  }
  return { server, port: address.port };
}

function resolveProfileNames(profileArg) {
  if (!profileArg || profileArg === 'field') {
    return ['field'];
  }
  if (profileArg === 'all') {
    return Object.keys(exportProfiles);
  }
  if (profileArg in exportProfiles) {
    return [profileArg];
  }
  const validNames = Object.keys(exportProfiles).join(' | ');
  throw new Error(`Unknown export profile "${profileArg}". Use: ${validNames} | all`);
}

async function exportProfile(browser, port, profileName) {
  const profile = exportProfiles[profileName];
  if (!profile) {
    throw new Error(`Profile not found: ${profileName}`);
  }

  await mkdir(profile.outputDir, { recursive: true });
  const pageUrl = `http://127.0.0.1:${port}${profile.boardRoute}`;
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const fullLocator = page.locator(profile.fullSelector ?? 'body');
  const fullCount = await fullLocator.count();
  if (fullCount < 1) {
    throw new Error(`Missing full screenshot selector: ${profile.fullSelector}`);
  }

  const fullPath = path.join(profile.outputDir, profile.fullFilename);
  await fullLocator.first().screenshot({ path: fullPath });
  console.log(`wrote ${fullPath}`);

  for (const target of profile.pngTargets) {
    const locator = page.locator(target.selector);
    const count = await locator.count();
    if (count < 1) {
      throw new Error(`Missing screenshot target selector: ${target.selector}`);
    }
    const outPath = path.join(profile.outputDir, target.filename);
    await locator.first().screenshot({ path: outPath });
    console.log(`wrote ${outPath}`);
  }

  await context.close();
}

async function exportScreenshots() {
  const profileArg = process.argv[2];
  const profileNames = resolveProfileNames(profileArg);
  const distStat = await stat(serveDir).catch(() => null);
  if (!distStat?.isDirectory()) {
    throw new Error('Missing dist/. Run `npm run build` before exporting diagrams.');
  }

  const { server, port } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const profileName of profileNames) {
      console.log(`exporting profile: ${profileName}`);
      await exportProfile(browser, port, profileName);
    }
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

exportScreenshots().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
