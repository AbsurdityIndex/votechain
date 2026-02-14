# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Astro dev server (localhost:4321)
npm run build             # Static build → dist/
npm run preview           # Preview production build
npm test                  # Vitest (187 tests, 15s timeout)
npm run test:watch        # Vitest watch mode
npm run typecheck         # astro check --minimumFailingSeverity hint
npm run deploy            # Build + deploy to Cloudflare Pages (votechain project)
npm run deploy:workers    # Deploy all 3 Workers
```

Run a single test file:
```bash
npx vitest run tests/poc/crypto/blind-schnorr.test.ts
```

Workers (optional, not needed for POC):
```bash
npx wrangler dev --config workers/votechain-nodes/federal/wrangler.toml
```

## Architecture

**Astro 5 static site** with Tailwind CSS v4 and TypeScript. No CMS — all content is in `.astro` pages and `.ts` data files.

### Key directories

| Path | Purpose |
|---|---|
| `src/pages/votechain/` | VoteChain section: landing, specs, FAQ, assurance playbooks |
| `src/pages/votechain/poc/` | 7 POC tool pages (vote, verify, dashboard, trust-portal, lookup, monitor) |
| `src/votechain-poc/` | Browser-based POC engine (20 modules) — all crypto runs client-side |
| `src/votechain-poc/crypto/` | Primitives: blind Schnorr, ECIES, ECDSA, Shamir secret sharing (uses `@noble/curves`) |
| `workers/votechain-nodes/` | 3 Cloudflare Workers (federal, state, oversight) with Durable Objects |
| `functions/api/votechain/poc/` | Cloudflare Pages Functions (Turnstile gate, replication proxy) |
| `tests/poc/` | Vitest tests — crypto primitives + integration flows |

### Layout coordination (CSS custom properties)

Components self-report their height via ResizeObserver. No component queries another's DOM.

```
Header         → publishes --layout-header-h
FundTheIndex   → publishes --layout-fund-bar-h  (0px when >430px or drawer open)
VoteChainSubnav → publishes --layout-subnav-h   (0px on non-votechain routes)

Derived (CSS calc, no JS):
  --layout-sticky-top  = header + fund-bar
  --layout-content-top = header + fund-bar + subnav
```

Sticky elements use `top: var(--layout-content-top)`. Defined in `src/styles/global.css:58`.

### Theme system

- Single layout: `src/layouts/BaseLayout.astro`
- 4 theme variants: light (default), dark (`html.dark`), solarized-light, solarized-dark
- `data-theme-fixed` forces light variables (used on header/footer/drawers that stay dark)
- `data-theme-dynamic` re-enables current theme inside fixed regions
- Color scales: navy, gold, cream, parchment
- Fonts: Libre Caslon Text (serif/display), Inter (sans/UI), JetBrains Mono (mono)

### POC data flow

The POC runs entirely in the browser with localStorage state. No server required.

Optional server path: Browser → Pages Function → Workers (authenticated replication).

### VoteChain subnav

Only renders on `/votechain/*` routes (guard at top of component). `BaseLayout.astro` has an inline script that resets `--layout-subnav-h` to `0px` for non-votechain pages.

## Conventions

- **Tailwind v4**: `@import 'tailwindcss'` + `@theme` block in `global.css` (no separate tailwind.config)
- **Astro components**: Props interface → destructure → template → `<script>` → `<style>`
- **Conditional classes**: Use Astro's `class:list={[...]}` syntax
- **Client scripts**: `<script>` (bundled by Astro) for most; `<script is:inline>` only when avoiding module scope
- **Icons — no emoji**: Never use Unicode emoji. Use Lucide icons via `src/components/ui/Icon.astro` (inline SVGs, 100+ icons, zero JS)
- **Code style**: TypeScript, single quotes, trailing commas, no semicolons in imports, minimal comments
- **Evidence standard**: Every factual claim in content MUST include a proof link to an authoritative source (congress.gov, law.cornell.edu, .gov press releases). If a source cannot be found, do not make the claim
- **Functions are Workers runtime**: Files in `functions/` run on Cloudflare Workers (V8 isolate) — no `fs`, `path`, `process`, or Node built-ins. Use `context.request.cf` for Cloudflare-specific APIs

## Crypto changes

Changes to `src/votechain-poc/crypto/` require:
- Cryptographic rationale in the PR description
- Added/updated test vectors
- Note any deviation from PRD or EWP spec

## Testing

- Test setup (`tests/poc/setup.ts`) mocks only `localStorage` — Node 20+ provides `crypto.subtle`, `atob`/`btoa`, `TextEncoder`/`TextDecoder` natively
- Tests reset localStorage between each test via `beforeEach`
- Crypto tests have a 15s timeout (elliptic curve operations can be slow)
- Run `npm test && npm run typecheck && npm run build` before submitting PRs

## Related repos

| Repo | Purpose |
|---|---|
| `not-congress.io` | Main Absurdity Index site (parent project) — shares styling, components, deployment |
| `absurdity-index-cli` | CLI for auto-posting to X, bill discovery, engagement |
| `absurdity-index-extension` | Chrome/Firefox extension for Congress.gov |

## Deployment

### Production (merged build)

The parent repo (`not-congress.io`) clones votechain at build time, runs `npm run build`, and merges `dist/` into the main site's output. That combined build deploys to the `absurdity-index` Cloudflare Pages project at `absurdityindex.org`. Push to `main` in the parent repo auto-deploys via Argo Workflows on self-hosted K8s (polls every 60s).

### Standalone preview / staging

VoteChain has its own Cloudflare Pages project (`votechain`) for independent preview deploys:

```bash
npm run deploy            # Build + deploy to votechain.pages.dev
npm run deploy:workers    # Deploy all 3 Workers (federal, state, oversight)
```

To set up the Pages project for the first time:
1. Create a Pages project in Cloudflare dashboard (or via `npx wrangler pages project create votechain`)
2. Connect the GitHub repo for automatic preview deploys per PR
3. Set build command: `npm run build`, output directory: `dist`
4. Add environment variables (see `.env.example`) in the dashboard under Settings > Environment Variables

### Workers deployment

```bash
npm run deploy:federal    # Deploy federal node Worker
npm run deploy:state      # Deploy state node Worker
npm run deploy:oversight  # Deploy oversight node Worker
```

Workers use Durable Objects with SQLite storage. First deploy creates the migration automatically.

### Environment variables

See `.env.example` for the full list. Key groups:
- **Pages Functions (runtime)**: `TURNSTILE_SECRET_KEY`, `POC_ACCESS_COOKIE_SECRET`, `VOTECHAIN_*_NODE_URL`, `VOTECHAIN_*_WRITE_TOKEN` — set via dashboard or `wrangler pages secret put`
- **Build-time**: `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_VOTECHAIN_WORKERS_BASE` — set in dashboard under Environment Variables
- **CI/CD**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — set in CI secrets

## Gotchas

- **Vite dep cache**: If `@noble/curves` or other deps fail to load in dev, delete `node_modules/.vite` and restart
- **Node version**: Requires Node >= 20 (< 23) for native Web Crypto API
- **POC API routes**: The 404s for `/api/votechain/poc/*` in dev are expected — Pages Functions only run on Cloudflare
