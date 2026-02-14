# VoteChain

Cryptographic voter verification and ballot integrity for U.S. elections — replacing trust assumptions with mathematical proofs.

VoteChain is a two-layer open protocol. The **verification layer** answers "is this voter eligible?" using cryptographic credentials on a permissioned ledger (no PII on-chain, no biometric mandates). The **ballot integrity layer** ([Election Web Protocol](https://absurdityindex.org/votechain/ewp)) provides the chain of custody from cast to tally — encrypted ballots, append-only logs, and verifiable decryption proofs.

Everything is published for transparency and critique.

## Architecture

```
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Layer 1: Verification           │  │  Layer 2: Ballot Integrity       │
│  (VoteChain PRD)                 │  │  (Election Web Protocol — EWP)   │
│                                  │  │                                  │
│  • Permissioned verification ledger │  │  • Encrypted ballots (ElGamal)   │
│  • ZK eligibility proofs         │  │  • Append-only bulletin board    │
│  • Nullifier-based uniqueness    │  │  • Threshold decryption (t-of-n) │
│  • Fraud detection pipeline      │  │  • Verifiable tally proofs       │
└──────────────────────────────────┘  └──────────────────────────────────┘
         │                                        │
         └──────── Audit anchors (hash) ──────────┘
```

- **Layer 1** checks four things: citizen, eligible, alive, not already voted — all via zero-knowledge proofs that never reveal identity.
- **Layer 2** ensures cast-as-intended (Benaloh challenge), recorded-as-cast (Merkle inclusion proof), and counted-as-recorded (verifiable decryption).

## What's in this repo

| Path | Description |
|---|---|
| `src/pages/votechain/` | Astro pages: landing, PRD, EWP spec, architecture, FAQ, assurance playbooks |
| `src/votechain-poc/` | Browser-based proof of concept (credential issuance, ballot encryption, cast, verify, tally) |
| `src/votechain-poc/crypto/` | Cryptographic primitives: blind Schnorr, ECIES, ECDSA, Shamir secret sharing |
| `workers/votechain-nodes/` | Cloudflare Workers — three independent ledger nodes (federal, state, oversight) |
| `functions/` | Cloudflare Pages Functions (Turnstile gate, session, replication proxy) |
| `tests/` | Vitest test suite (13 files; run with `npm test`) |
| `docs/` | Internal assurance playbooks |
| `docs/poc-physical-demo-hardware.md` | Physical-only demo topology, node layout, and budget planning |
| `PRD-VOTER-VERIFICATION-CHAIN.md` | Full VoteChain PRD (voter verification specification) |
| `PRD-VOTECHAIN-ELECTION-WEB-PROTOCOL.md` | Full EWP specification (ballot integrity) |
| `PLAN-VOTECHAIN-ASSURANCE.md` | Assurance planning document |

## Getting started

### Prerequisites

- Node.js >= 20 (< 23)
- npm >= 10

### Install and run

```bash
npm install
# Optional local config:
cp .env.example .env
# Ensure Git LFS is active for binary assets
git lfs install
git lfs pull
npm run dev          # Start Astro dev server
```

Open `http://localhost:4321/votechain/` in your browser.

### Run tests

```bash
npm test             # Run once
npm run test:watch   # Watch mode
```

### Playwright setup walkthrough

```bash
npm run e2e:setup
```

The walkthrough now auto-starts a local Astro dev server (if needed), creates a local-scope election with multiple positions plus a referendum, and writes screenshots/logs under `playwright-artifacts/`.
`playwright-artifacts/` is intentionally gitignored so test PNGs and logs from this flow are never accidentally committed.

To target a remote deployment instead of local:

```bash
BASE_URL=https://absurdityindex.org/votechain/poc npm run e2e:setup
```

Notes:

- Production may require Turnstile/session unlock before `/setup` can be used.
- Set `AUTO_START_DEV_SERVER=0` if you want the script to fail instead of auto-starting local dev.

### Build

```bash
npm run build        # Static build → dist/
npm run preview      # Preview production build
```

### Deploy (Pages)

```bash
# Deploy to test project
npm run deploy:test

# Deploy to production project
npm run deploy:prod
```

Pages projects:

- Test: `votechain-test`
- Production: `votechain` (`votechain-dap.pages.dev`)

Automated deploy pipeline: `.github/workflows/pages-deploy.yml` (GitHub Actions).

### Type checking

```bash
npm run typecheck
```

### Workers (optional)

The three VoteChain ledger nodes are Cloudflare Workers. To run locally:

```bash
npx wrangler dev --config workers/votechain-nodes/federal/wrangler.toml
npx wrangler dev --config workers/votechain-nodes/state/wrangler.toml
npx wrangler dev --config workers/votechain-nodes/oversight/wrangler.toml
```

See [`workers/votechain-nodes/README.md`](workers/votechain-nodes/README.md) for API details and deployment instructions.

### Optional configuration (node URLs + replication)

By default, the POC runs entirely in the browser and does not require any live nodes.

If you want the Monitor/Trust pages to read from Workers nodes by default, set one of:

- `PUBLIC_VOTECHAIN_WORKERS_BASE` (template with `{role}` placeholder)
- `PUBLIC_VOTECHAIN_FEDERAL_NODE_URL`, `PUBLIC_VOTECHAIN_STATE_NODE_URL`, `PUBLIC_VOTECHAIN_OVERSIGHT_NODE_URL`

If you deploy on Cloudflare Pages and want the browser POC to replicate events into your Workers ledger, configure Pages env/secrets:

- `VOTECHAIN_FEDERAL_NODE_URL`, `VOTECHAIN_STATE_NODE_URL`, `VOTECHAIN_OVERSIGHT_NODE_URL`
- `VOTECHAIN_FEDERAL_WRITE_TOKEN`, `VOTECHAIN_STATE_WRITE_TOKEN`, `VOTECHAIN_OVERSIGHT_WRITE_TOKEN`

## Proof of concept

The POC runs entirely in the browser (localStorage state, no server required). It implements simplified versions of the protocols:

- **Setup** — Configure a new election bundle with a guided form builder (option pools -> bound questions) and anchor both manifest + form definition to the ledger
- **Vote** — Generate credentials, encrypt a ballot, cast it
- **Verify** — Check your receipt (signature + Merkle inclusion + anchor)
- **Dashboard** — Inspect the bulletin board, VCL events, fraud flags, and tally
- **Trust Portal** — Independently verify all public keys and proofs
- **Lookup** — Find a ballot by its hash
- **Monitor** — Watch the bulletin board for equivocation

### Physical demo planning

For fully physical demos where every role is on a separate device, use:

- [`docs/poc-physical-demo-hardware.md`](docs/poc-physical-demo-hardware.md)

It includes:

- Required node roles for compact (15-node) and full-fidelity (20-node) physical layouts.
- Exact board layout narrative with VLAN boundaries.
- USD estimate ranges by hardware option (refurb/new Raspberry Pi vs x86 mini-PC).

POC setup flow and ledger anchoring notes are documented in `docs/votechain-poc-setup-ledger-flow.md`.

### Screenshots

| Experience VoteChain | Voting Kiosk |
|:---:|:---:|
| ![POC Landing](docs/screenshots/poc-landing.png) | ![Voting Kiosk](docs/screenshots/poc-vote.png) |
| **Oversight Dashboard** | **Receipt Verification** |
| ![Dashboard](docs/screenshots/poc-dashboard.png) | ![Verify](docs/screenshots/poc-verify.png) |

## Tech stack

- [Astro](https://astro.build/) — static site generation
- [Tailwind CSS v4](https://tailwindcss.com/) — styling
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [@noble/curves](https://github.com/paulmillr/noble-curves) — secp256k1 elliptic curve operations
- [Cloudflare Workers](https://workers.cloudflare.com/) + Durable Objects — ledger nodes
- [Vitest](https://vitest.dev/) — test runner

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [CHANGELOG.md](CHANGELOG.md), and the issue templates under
[`./.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE) for contribution entry points.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## Releasing

See [RELEASING.md](RELEASING.md) for test and production deployment workflow.

## License

[MIT](LICENSE)
