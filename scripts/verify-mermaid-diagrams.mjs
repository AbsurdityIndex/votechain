#!/usr/bin/env node

import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

const mermaidPages = [
  '/votechain/evidence/crypto-ceremony-board/',
  '/votechain/pi-integration/',
];

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

const expectedIconPrefix = '/votechain/evidence/icons/';

function contentTypeFor(filePath) {
  return mimeByExtension.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream';
}

function resolveDistPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = decoded === '/' ? '/index.html' : decoded;
  const candidate = path.normalize(path.join(distDir, normalized.replace(/^\//, '')));
  if (!candidate.startsWith(distDir)) {
    return null;
  }
  return candidate;
}

async function startDistServer() {
  const { readFile, stat } = await import('node:fs/promises');
  const server = createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      const resolved = resolveDistPath(reqUrl.pathname);
      if (!resolved) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      let finalPath = resolved;
      const fileStat = await stat(finalPath).catch(() => null);
      if (!fileStat) {
        if (reqUrl.pathname !== '/') {
          // Support route-like request with no extension from static builds.
          const indexCandidate = resolveDistPath(`${reqUrl.pathname.replace(/\/$/, '')}/index.html`);
          if (indexCandidate) {
            finalPath = indexCandidate;
          } else {
            throw new Error('not found');
          }
        } else {
          throw new Error('not found');
        }
      } else if (fileStat.isDirectory()) {
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

async function validatePage(page) {
  const result = await page.evaluate((targetPrefix) => {
    const diagrams = Array.from(document.querySelectorAll('.mermaid-diagram'));
    const images = Array.from(document.querySelectorAll('.mermaid-diagram img'));
    const overflowed = diagrams.filter((el) => el.getBoundingClientRect().width > window.innerWidth + 2);
    const bad = [];
    const badPaths = [];

    for (const img of images) {
      const src = img.getAttribute('src') || '';
      const path = new URL(src, location.href).pathname;
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        bad.push({ src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      } else if (!path.startsWith(targetPrefix)) {
        badPaths.push({ src, path });
      }
    }

    return {
      route: location.pathname,
      diagramCount: diagrams.length,
      imageCount: images.length,
      badImageCount: bad.length,
      badPathCount: badPaths.length,
      overflowCount: overflowed.length,
      badImages: bad.slice(0, 20),
      badImagePaths: badPaths.slice(0, 20),
    };
  }, expectedIconPrefix);
  return result;
}

async function main() {
  try {
    await access(distDir, constants.F_OK);
  } catch {
    console.error('dist directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  const { server, port } = await startDistServer();
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    for (const route of mermaidPages) {
      const url = `http://127.0.0.1:${port}${route}`;
      await page.setViewportSize({ width: 1600, height: 1200 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('.mermaid-diagram', { timeout: 60000 });

      const report = await validatePage(page, url);
      console.log(`[mermaid-regression] ${route}`);
      console.log(
        JSON.stringify(
          {
            diagramCount: report.diagramCount,
            imageCount: report.imageCount,
            badImageCount: report.badImageCount,
            badPathCount: report.badPathCount,
            overflowCount: report.overflowCount,
          },
          null,
          2,
        ),
      );

      if (report.diagramCount === 0) {
        failures.push(`${route}: no mermaid-diagram elements found`);
      }
      if (report.imageCount === 0) {
        failures.push(`${route}: no mermaid node images found`);
      }
      if (report.badImageCount > 0) {
        failures.push(`${route}: ${report.badImageCount} broken node image(s)`);
      }
      if (report.badPathCount > 0) {
        failures.push(
          `${route}: ${report.badPathCount} node image(s) with non-` +
            `votechain icon path: ${JSON.stringify(report.badImagePaths)}`,
        );
      }
      if (report.overflowCount > 0) {
        failures.push(`${route}: ${report.overflowCount} diagram(s) overflow viewport`);
      }
    }
    await page.close();
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (failures.length > 0) {
    console.error('Mermaid regression failures:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('Mermaid regression checks passed.');
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
