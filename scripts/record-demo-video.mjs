/**
 * record-demo-video.mjs
 *
 * Records a ~25s native video of the VoteChain POC demo flow
 * in focus mode (no site chrome) with in-page caption overlays.
 *
 * Usage:
 *   BASE_URL=http://localhost:4321 node scripts/record-demo-video.mjs
 *
 * Output: playwright-artifacts/votechain-demo.mp4
 */

import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

// ── Config ────────────────────────────────────────────────────────────
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const artifactsDir = 'playwright-artifacts'
const rawVideoPath = path.join(artifactsDir, 'votechain-demo-raw.webm')
const finalVideoPath = path.join(artifactsDir, 'votechain-demo.mp4')

const VIEWPORT = { width: 1280, height: 720 }
const STEP_MS = 1400     // pause between major steps
const ACTION_MS = 600    // pause after actions
const CAPTION_MS = 1800  // how long captions with checkmarks stay visible

// ── Election setup config ────────────────────────────────────────────
const setupConfig = {
  electionId: 'demo-2026-local',
  jurisdictionId: 'jurisdiction-local-001',
  scopes: ['local'],
  voterRoll: 15000,
  durationDays: 10,
  pools: [
    { name: 'Local Leadership', kind: 'who', scope: 'local', options: ['Alex Rivera', 'Morgan Hall', 'Sam Patel'] },
    { name: 'Referendum', kind: 'what', scope: 'local', options: ['Yes', 'No'] },
  ],
  questions: [
    { title: 'City Mayor', scope: 'local', type: 'candidate', poolLabelIncludes: 'Local Leadership' },
    { title: 'Proposition 1: Library Bond', scope: 'local', type: 'referendum', poolLabelIncludes: 'Referendum' },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function buildUrl(suffixPath = '') {
  const parsed = new URL(baseUrl)
  return new URL(`/votechain/poc${suffixPath}?focus`, parsed.origin).toString()
}

async function canReach(url, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'manual' })
    return res.ok || res.status < 500
  } catch { return false }
  finally { clearTimeout(timer) }
}

async function ensureServer() {
  if (await canReach(buildUrl())) return null
  const parsed = new URL(baseUrl)
  const logPath = path.join(artifactsDir, 'demo-dev-server.log')
  const logStream = createWriteStream(logPath, { flags: 'a' })
  const child = spawn('npm', ['run', 'dev', '--', '--host', parsed.hostname, '--port', parsed.port || '4321'], {
    env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.pipe(logStream)
  child.stderr?.pipe(logStream)
  const start = Date.now()
  while (Date.now() - start < 60000) {
    if (await canReach(buildUrl())) return () => { child.kill('SIGTERM') }
    await wait(500)
  }
  child.kill('SIGTERM')
  throw new Error(`Server not ready at ${buildUrl()} after 60s`)
}

async function selectPoolByLabel(page, includes) {
  const value = await page.$eval('#question-pool', (sel, needle) => {
    const opt = Array.from(sel.options).find((o) => o.textContent?.includes(needle))
    return opt?.value ?? ''
  }, includes)
  await page.selectOption('#question-pool', value)
}

// ── Page helpers ─────────────────────────────────────────────────────
async function dismissViteOverlay(page) {
  await page.evaluate(() => {
    document.querySelector('vite-error-overlay')?.remove()
  }).catch(() => {})
}

async function scrollToCenter(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, selector)
  await wait(300)
}

async function highlight(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return
    el.style.transition = 'box-shadow 0.3s ease, outline 0.3s ease'
    el.style.outline = '2px solid #d4a843'
    el.style.outlineOffset = '3px'
    el.style.boxShadow = '0 0 20px rgba(212, 168, 67, 0.35)'
  }, selector)
}

async function clearHighlight(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return
    el.style.outline = ''
    el.style.outlineOffset = ''
    el.style.boxShadow = ''
  }, selector).catch(() => {})
}

// ── In-page caption overlay ──────────────────────────────────────────
async function showCaption(page, text) {
  await page.evaluate((t) => {
    let bar = document.getElementById('demo-caption-bar')
    let txt = document.getElementById('demo-caption-text')
    if (!bar || !txt) {
      bar = document.createElement('div')
      bar.id = 'demo-caption-bar'
      Object.assign(bar.style, {
        position: 'fixed', bottom: '0', left: '0', width: '100%', height: '56px',
        background: 'linear-gradient(to right, rgba(10,15,30,0.92), rgba(26,45,77,0.92))',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '999999', transition: 'opacity 0.25s ease', opacity: '0',
        pointerEvents: 'none', borderTop: '1px solid rgba(212,168,67,0.3)',
      })
      txt = document.createElement('span')
      txt.id = 'demo-caption-text'
      Object.assign(txt.style, {
        color: '#e8e0d0', fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px', fontWeight: '500', letterSpacing: '0.03em',
      })
      bar.appendChild(txt)
      document.body.appendChild(bar)
    }
    txt.textContent = t
    bar.style.opacity = '1'
  }, text)
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const bar = document.getElementById('demo-caption-bar')
    if (bar) bar.style.opacity = '0'
  }).catch(() => {})
}

async function showEndCard(page) {
  await page.evaluate(() => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'linear-gradient(135deg, rgba(10,15,30,0.92), rgba(26,45,77,0.92))',
      backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: '999999', animation: 'fadeIn 0.5s ease',
    })
    const style = document.createElement('style')
    style.textContent = '@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }'
    overlay.appendChild(style)
    const title = document.createElement('div')
    Object.assign(title.style, {
      color: '#d4a843', fontFamily: 'Georgia, serif', fontSize: '42px',
      fontWeight: '700', marginBottom: '8px',
    })
    title.textContent = 'VoteChain'
    const rule = document.createElement('div')
    Object.assign(rule.style, { width: '60px', height: '2px', background: '#d4a843', margin: '8px 0 16px' })
    const subtitle = document.createElement('div')
    Object.assign(subtitle.style, {
      color: '#e8e0d0', fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '18px', fontWeight: '400', opacity: '0.9',
    })
    subtitle.textContent = 'Replace trust with math'
    const url = document.createElement('div')
    Object.assign(url.style, {
      color: '#d4a843', fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px', fontWeight: '500', marginTop: '20px', opacity: '0.8',
    })
    url.textContent = 'absurdityindex.org/votechain'
    overlay.append(title, rule, subtitle, url)
    document.body.appendChild(overlay)
  })
}

// Hide the focus mode toggle button during recording
async function hideFocusToggle(page) {
  await page.evaluate(() => {
    const btn = document.getElementById('poc-focus-toggle')
    if (btn) btn.style.display = 'none'
  }).catch(() => {})
}

// ── Recording flow ───────────────────────────────────────────────────
async function run() {
  await mkdir(artifactsDir, { recursive: true })
  const stopServer = await ensureServer()

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: artifactsDir, size: VIEWPORT },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  })

  const page = await context.newPage()
  page.on('console', () => {})
  page.on('pageerror', () => {})

  try {
    console.log('Recording started (focus mode)...')

    // ── Scene 1: Setup election (quick) ─────────────────────────────
    await page.goto(buildUrl('/setup'), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('#setup-form', { timeout: 15000 })
    await dismissViteOverlay(page)
    await hideFocusToggle(page)
    await showCaption(page, 'Configuring a fresh election...')
    await scrollToCenter(page, '#setup-form')

    await page.fill('#election-id', setupConfig.electionId)
    await page.fill('#jurisdiction-id', setupConfig.jurisdictionId)
    await page.fill('#scope-list', setupConfig.scopes.join('\n'))
    await page.fill('#voter-roll', String(setupConfig.voterRoll))
    await page.fill('#duration-days', String(setupConfig.durationDays))
    for (const pool of setupConfig.pools) {
      await dismissViteOverlay(page)
      await page.fill('#pool-name', pool.name)
      await page.selectOption('#pool-kind', pool.kind)
      await page.selectOption('#pool-scope', pool.scope)
      await page.fill('#pool-options', pool.options.join('\n'))
      await page.click('#add-pool')
    }
    for (const q of setupConfig.questions) {
      await dismissViteOverlay(page)
      await page.fill('#question-title', q.title)
      await page.selectOption('#question-scope', q.scope)
      await page.selectOption('#question-type', q.type)
      await selectPoolByLabel(page, q.poolLabelIncludes)
      await page.click('#add-question')
    }
    await dismissViteOverlay(page)
    await page.click('#run-setup')
    await page.waitForSelector('#setup-result:not(.hidden)', { timeout: 20000 })
    await scrollToCenter(page, '#setup-result')
    await highlight(page, '#setup-result')
    await wait(STEP_MS)
    await clearHighlight(page, '#setup-result')

    // ── Scene 2: Vote page ──────────────────────────────────────────
    await showCaption(page, 'Step 1 \u2014 Cast a vote')
    await wait(ACTION_MS)
    await page.goto(buildUrl('/vote'), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('#wizard-controls', { timeout: 15000 })
    await dismissViteOverlay(page)
    await hideFocusToggle(page)
    await showCaption(page, 'Step 1 \u2014 Cast a vote')
    await wait(STEP_MS)

    // ── Scene 3: Generate credential ────────────────────────────────
    await showCaption(page, 'Generating cryptographic credential')
    await page.click('#wizard-next')
    await page.waitForSelector('#challenge:not(.hidden)', { timeout: 15000 })
    await showCaption(page, 'Generating cryptographic credential')
    await scrollToCenter(page, '#credential')
    await highlight(page, '#credential')
    await wait(STEP_MS)
    await clearHighlight(page, '#credential')

    // ── Scene 4: Request challenge ──────────────────────────────────
    await showCaption(page, 'Blind signature challenge issued')
    await page.click('#wizard-next')
    await page.waitForSelector('#encrypt-review:not(.hidden)', { timeout: 15000 })
    await showCaption(page, 'Blind signature challenge issued')
    await scrollToCenter(page, '#challenge')
    await highlight(page, '#challenge')
    await wait(STEP_MS)
    await clearHighlight(page, '#challenge')

    // ── Scene 5: Select ballot options ──────────────────────────────
    await showCaption(page, 'Selecting candidates on the ballot')
    await scrollToCenter(page, '#ballot-options')
    await highlight(page, '#ballot-options')
    await wait(ACTION_MS)
    await page.evaluate(() => {
      const radios = document.querySelectorAll('#ballot-options input[type="radio"]')
      const seen = new Set()
      for (const r of radios) {
        const name = r.getAttribute('name')
        if (!seen.has(name)) { r.click(); seen.add(name) }
      }
    })
    await wait(STEP_MS)
    await clearHighlight(page, '#ballot-options')

    // ── Scene 6: Encrypt ballot ─────────────────────────────────────
    await showCaption(page, 'Encrypting ballot \u2014 ECIES + blind signature')
    await page.click('#wizard-next')
    await page.waitForFunction(() => {
      const label = document.querySelector('#wizard-next-label')?.textContent?.trim()
      return label === 'Continue to Cast'
    }, { timeout: 20000 })
    await showCaption(page, 'Encrypting ballot \u2014 ECIES + blind signature')
    // Scroll to the review panel to show the ballot hash
    await scrollToCenter(page, '#encrypt-review')
    await highlight(page, '#encrypt-review')
    await wait(STEP_MS)
    await clearHighlight(page, '#encrypt-review')

    // ── Scene 7: Cast ballot ────────────────────────────────────────
    await showCaption(page, 'Casting ballot to the network...')
    await page.click('#wizard-next')
    await page.waitForSelector('#cast-step:not(.hidden)', { timeout: 20000 })
    await wait(ACTION_MS)
    await page.click('#wizard-next')
    await page.waitForSelector('#cast-success:not(.hidden)', { timeout: 30000 })
    await scrollToCenter(page, '#cast-success')
    await highlight(page, '#cast-success')
    await showCaption(page, '\u2705  Ballot cast \u2014 receipt generated')
    await wait(CAPTION_MS)
    await clearHighlight(page, '#cast-success')

    // ── Scene 8: Verify receipt ─────────────────────────────────────
    await showCaption(page, 'Step 2 \u2014 Verify the receipt')
    await wait(ACTION_MS)
    await page.goto(buildUrl('/verify'), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissViteOverlay(page)
    await hideFocusToggle(page)
    await showCaption(page, 'Step 2 \u2014 Verify the receipt')
    await wait(1800) // auto-verify runs

    await showCaption(page, '\u2705  All cryptographic checks passed')
    // Try to scroll to and highlight the verification result
    await scrollToCenter(page, '#verify-result').catch(() => {})
    await highlight(page, '#verify-result').catch(() => {})
    await wait(CAPTION_MS)

    // ── Scene 9: Dashboard + tally ──────────────────────────────────
    await showCaption(page, 'Step 3 \u2014 Publish the tally')
    await wait(ACTION_MS)
    await page.goto(buildUrl('/dashboard'), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dismissViteOverlay(page)
    await hideFocusToggle(page)
    await showCaption(page, 'Step 3 \u2014 Publish the tally')
    await page.waitForSelector('#publish-tally', { timeout: 15000 })
    await scrollToCenter(page, '#publish-tally')
    await highlight(page, '#publish-tally')
    await wait(ACTION_MS)

    await page.evaluate(async () => {
      const { publishTally } = await import('/src/votechain-poc/index.ts')
      await publishTally()
    })
    await wait(ACTION_MS)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await dismissViteOverlay(page)
    await hideFocusToggle(page)

    await showCaption(page, '\u2705  Election results verified \u2014 zero trust required')
    // Scroll to tally results
    await scrollToCenter(page, '#tally-json').catch(() =>
      scrollToCenter(page, '#publish-tally').catch(() => {})
    )
    await wait(CAPTION_MS)

    // ── End card ────────────────────────────────────────────────────
    await hideCaption(page)
    await wait(200)
    await showEndCard(page)
    await wait(3500)

    console.log('Recording flow complete.')
  } finally {
    await page.close()
    const video = page.video()
    const videoPath = video ? await video.path() : null
    await context.close()
    await browser.close()
    if (stopServer) await stopServer()

    if (videoPath) {
      await rename(videoPath, rawVideoPath)
      console.log(`Raw video saved: ${rawVideoPath}`)
    }
  }

  await convertToMp4()
}

async function convertToMp4() {
  console.log('Converting to mp4...')
  const ffmpegArgs = [
    '-y', '-i', rawVideoPath,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    finalVideoPath,
  ]
  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: 'inherit' })
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))
    proc.on('error', reject)
  })
  try { await unlink(rawVideoPath) } catch {}
  console.log(`\nDone! Upload to X as native video:\n  ${finalVideoPath}`)
}

run().catch((err) => { console.error(err); process.exitCode = 1 })
