# Today in Congress Worker

This worker provides a daily cached `/api/today-in-congress` payload for the `/today` page.

What it does:
- Fetches `SOURCE_URL` (default: `src/data/session-status.json` in this repo) once per day via cron.
- Generates satirical bullets from Workers AI when available.
- Falls back to deterministic satirical points if AI is unavailable.
- Stores the latest snapshot in KV and serves it on read with cache-friendly headers.

Deploy notes:
1. Create a KV namespace and put its `id` + `preview_id` in `wrangler.toml`.
2. Configure `SOURCE_URL`, optional `AI_MODEL`, and `ALLOWED_ORIGINS`.
3. Set `AI` binding via Wrangler if you want AI summaries.
4. If you want this endpoint on the main site domain, add a route mapping for
   `/api/today-in-congress` (and optional `/api/today`) to this worker.

   If your Pages app is served under `/votechain`, you can also route
   `/votechain/api/today-in-congress` and `/votechain/api/today` instead.

Local check:
- Route `https://<worker-subdomain>.workers.dev/api/today-in-congress`.
