# VoteChain Nodes (Cloudflare Workers)

Three independently deployable Cloudflare Worker "nodes" (plus a shared Durable Object)
to represent:

- Federal node
- State node
- Oversight node

Each node exposes the same minimal HTTP API backed by an append-only ledger stored in a
Durable Object.

## API (All Nodes)

- `GET /health`
- `GET /v1/node`
- `GET /v1/node/key`
- `GET /v1/ledger/head`
- `GET /v1/ledger/stats`
- `GET /v1/ledger/entries?from=1&limit=50`
- `GET /v1/ledger/entries/:index`
- `POST /v1/ledger/append` (role-gated)

### Append Body

```json
{
  "type": "ewp_ballot_cast",
  "payload": {
    "example": "data"
  }
}
```

Fields `tx_id` and `recorded_at` are optional; the node will generate them if missing.

## Local Dev

From the repo root:

```bash
npx wrangler dev --config workers/votechain-nodes/federal/wrangler.toml
npx wrangler dev --config workers/votechain-nodes/state/wrangler.toml
npx wrangler dev --config workers/votechain-nodes/oversight/wrangler.toml
```

## Deploy

```bash
npx wrangler deploy --config workers/votechain-nodes/federal/wrangler.toml
npx wrangler deploy --config workers/votechain-nodes/state/wrangler.toml
npx wrangler deploy --config workers/votechain-nodes/oversight/wrangler.toml
```

## CORS

If you are calling these Workers from a browser (e.g., the VoteChain POC Monitor/Trust pages), configure CORS:

- `CORS_ORIGINS` (comma-separated allowlist), or `CORS_ORIGIN` (single origin)

If neither is set, the Worker responds with `Access-Control-Allow-Origin: null` (blocked by browsers).

## Auth (Required)

By default, `POST /v1/ledger/append` requires a write token:

`Authorization: Bearer <WRITE_TOKEN>`

Set via Wrangler secrets:

```bash
npx wrangler secret put WRITE_TOKEN --config workers/votechain-nodes/federal/wrangler.toml
```

### Local Dev Override (Not Recommended)

For local-only experiments, you can disable write auth by setting:

- `ALLOW_INSECURE_WRITES=true`

Do not use this in production.
