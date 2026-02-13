#!/usr/bin/env node

import { mkdtemp, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const distDir = path.join(repoRoot, 'dist');
const PRE_MERMAID_RE = /<pre\b[^>]*\bdata-language=(["'])mermaid\1[^>]*>([\s\S]*?)<\/pre>/gi;
const ICON_ATTR_RE = /src=(["'])(\/?(?:votechain\/)?evidence\/icons\/[^"']+)\1/gi;

function toRoute(filePath) {
  const normalized = path.relative(distDir, filePath).replace(/\\/g, '/');
  const prefixed = '/' + normalized;
  return prefixed.replace(/index\.html$/, '');
}

function hasMermaidSourceBlocks(html) {
  PRE_MERMAID_RE.lastIndex = 0;
  return PRE_MERMAID_RE.test(html);
}

function decodeHtmlEntities(raw) {
  const value = String(raw || '');
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, token) => {
    if (token[0] === '#') {
      const parsed = token[1] === 'x' || token[1] === 'X'
        ? Number.parseInt(token.slice(2), 16)
        : Number.parseInt(token.slice(1), 10);
      if (Number.isFinite(parsed)) {
        return String.fromCodePoint(parsed);
      }
      return match;
    }

    const map = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };
    return map[token] ?? match;
  });
}

function stripPrismCodeMarkup(raw) {
  return String(raw || '')
    .replace(/<code\b[^>]*>/gi, '')
    .replace(/<\/code>/gi, '')
    .replace(/<span\b[^>]*>/gi, '')
    .replace(/<\/span>/gi, '');
}

function normalizeMermaidSourceIcons(sourceText) {
  return String(sourceText).replace(ICON_ATTR_RE, (match, quote, src) => {
    if (src.indexOf('/votechain/evidence/icons/') === 0) return match;
    if (src.indexOf('/evidence/icons/') === 0) {
      return `src=${quote}/votechain${src}${quote}`;
    }
    const normalized = src.replace(/^\/?votechain\//, '');
    if (normalized.indexOf('evidence/icons/') === 0) {
      return `src=${quote}/votechain/${normalized}${quote}`;
    }
    return match;
  });
}

function extractDiagramIdFromSource(sourceText) {
  const lines = String(sourceText || '').split('\n').slice(0, 10);
  for (const line of lines) {
    const match = String(line || '')
      .trim()
      .match(/^\s*%%\s*diagram-id:\s*([a-z0-9][a-z0-9_-]{1,80})\s*$/i);
    if (match && match[1]) return match[1];
  }
  return null;
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u0000/g, '');
}

function normalizeRenderedSvg(svgText) {
  let svg = String(svgText || '').trim();
  svg = svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
  svg = svg.replace(/<!DOCTYPE[^>]*>/i, '');

  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) return '';
  svg = svgMatch[0];

  svg = svg.replace(/\s+width="[^"]*"/g, '');
  svg = svg.replace(/\s+height="[^"]*"/g, '');
  svg = svg.replace(/<svg(\s[^>]*)?\s+style="[^"]*"/i, (full) => {
    return full.replace(/\s+style="[^"]*"/i, '');
  });

  return svg;
}

function renderDiagramContainer(sourceText, svg) {
  const diagramId = extractDiagramIdFromSource(sourceText);
  const sourceTextAttr = escapeHtmlAttribute(sourceText);
  const idAttr = diagramId ? ` data-diagram-id="${escapeHtmlAttribute(diagramId)}"` : '';
  return `<div class="mermaid-diagram my-6" data-mermaid-source="${sourceTextAttr}"${idAttr}>${svg}</div>`;
}

function createMmdcPath() {
  const bin = process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc';
  return path.join(repoRoot, 'node_modules', '.bin', bin);
}

function runMermaidCli(inputPath, outputPath, route, puppeteerConfigPath) {
  const mmdcPath = createMmdcPath();
  const args = ['-i', inputPath, '-o', outputPath, '--quiet'];
  if (puppeteerConfigPath) {
    args.push('--puppeteerConfigFile', puppeteerConfigPath);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(mmdcPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: repoRoot,
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    proc.on('error', (error) => {
      reject(
        new Error(`Failed to start Mermaid CLI for ${route}: ${error?.message || String(error)}`),
      );
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Mermaid CLI failed for ${route} (exit ${code}).\nstdout: ${stdout.trim() || '(empty)'}\nstderr: ${stderr.trim() || '(empty)'}`,
        ),
      );
    });
  });
}

async function renderMermaidSource(sourceText, sourceIndex, route, tmpDir, puppeteerConfigPath) {
  const normalizedSource = normalizeMermaidSourceIcons(
    stripPrismCodeMarkup(decodeHtmlEntities(sourceText)).trim(),
  );
  if (!normalizedSource) {
    throw new Error(`Diagram source is empty in ${route}`);
  }

  const inputPath = path.join(tmpDir, `diagram-${sourceIndex}.mmd`);
  const outputPath = path.join(tmpDir, `diagram-${sourceIndex}.svg`);
  await writeFile(inputPath, normalizedSource, 'utf8');
  await runMermaidCli(inputPath, outputPath, route, puppeteerConfigPath);

  const rawSvg = await readFile(outputPath, 'utf8');
  const svg = normalizeRenderedSvg(rawSvg);
  if (!svg.startsWith('<svg')) {
    throw new Error(`Mermaid CLI produced invalid SVG for diagram #${sourceIndex} in ${route}`);
  }
  return renderDiagramContainer(normalizedSource, svg);
}

async function collectHtmlFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectHtmlFiles(entryPath);
      out.push(...nested);
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.html') {
      out.push(entryPath);
    }
  }
  return out;
}

async function transformPageHtml(filePath, route, nextDiagramIndexRef, tmpDir, puppeteerConfigPath) {
  const source = await readFile(filePath, 'utf8');
  if (!hasMermaidSourceBlocks(source)) return 0;

  let cursor = 0;
  let match;
  let renderedCount = 0;
  PRE_MERMAID_RE.lastIndex = 0;
  let output = '';

  while ((match = PRE_MERMAID_RE.exec(source)) !== null) {
    const encodedSource = match[2] || '';
    output += source.slice(cursor, match.index);
    const diagramHtml = await renderMermaidSource(
      encodedSource,
      nextDiagramIndexRef.value,
      route,
      tmpDir,
      puppeteerConfigPath,
    );
    nextDiagramIndexRef.value += 1;
    output += diagramHtml;
    cursor = match.index + match[0].length;
    renderedCount += 1;
  }

  if (renderedCount === 0) return 0;

  output += source.slice(cursor);
  await writeFile(filePath, output, 'utf8');
  return renderedCount;
}

async function dirExists(p) {
  try {
    const info = await stat(p);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function compileMermaidDiagrams() {
  if (!(await dirExists(distDir))) {
    console.log('[mermaid-build] No dist directory found.');
    return;
  }

  const files = await collectHtmlFiles(distDir);
  if (!files.length) {
    console.log('[mermaid-build] No HTML files found in dist.');
    return;
  }

  const mmdcPath = createMmdcPath();
  try {
    await stat(mmdcPath);
  } catch {
    throw new Error(
      'Mermaid CLI not found. Install @mermaid-js/mermaid-cli with `npm install --save-dev @mermaid-js/mermaid-cli`.',
    );
  }

  const candidateFiles = [];
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (hasMermaidSourceBlocks(html)) {
      candidateFiles.push(file);
    }
  }
  if (!candidateFiles.length) {
    console.log('[mermaid-build] No mermaid source blocks found.');
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'votechain-mermaid-cli-'));
  const puppeteerConfigPath = path.join(tmpDir, 'mmdc-puppeteer-config.json');
  const puppeteerConfig = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  await writeFile(puppeteerConfigPath, JSON.stringify(puppeteerConfig), 'utf8');
  let totalRenderedDiagrams = 0;
  let totalRenderedPages = 0;
  const nextDiagramIndexRef = { value: 1 };

  try {
    for (const file of candidateFiles) {
      const route = toRoute(file);
      const renderedCount = await transformPageHtml(
        file,
        route,
        nextDiagramIndexRef,
        tmpDir,
        puppeteerConfigPath,
      );
      if (renderedCount > 0) {
        totalRenderedPages += 1;
        totalRenderedDiagrams += renderedCount;
        console.log(`[mermaid-build] Rendered ${renderedCount} diagram(s) in ${route}`);
      }
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  if (totalRenderedDiagrams === 0) {
    console.log('[mermaid-build] No mermaid source blocks were rendered.');
    return;
  }

  console.log(
    `[mermaid-build] Rendered ${totalRenderedDiagrams} mermaid diagram(s) across ${totalRenderedPages} page(s).`,
  );
}

compileMermaidDiagrams().catch((error) => {
  console.error('[mermaid-build] Mermaid render failed.');
  console.error(error?.message || String(error));
  process.exit(1);
});
