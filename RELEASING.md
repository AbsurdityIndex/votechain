# Releasing VoteChain

Cloudflare Pages projects used by this repo:

- Test: `votechain-test`
- Production: `votechain` (`votechain-dap.pages.dev`)

## 1. Validate Locally

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## 2. Test Deploy

Deploy to the test Pages project first:

```bash
npm run deploy:test
```

Smoke-check test URLs:

1. `https://votechain-test.pages.dev/votechain/`
2. `https://votechain-test.pages.dev/votechain/poc/`
3. `https://votechain-test.pages.dev/api/votechain/poc/config`
4. `https://votechain-test.pages.dev/api/votechain/poc/session`

## 3. Production Deploy

After test validation:

```bash
npm run deploy:prod
```

Smoke-check production URLs:

1. `https://votechain-dap.pages.dev/votechain/`
2. `https://votechain-dap.pages.dev/votechain/poc/`
3. `https://votechain-dap.pages.dev/api/votechain/poc/config`
4. `https://votechain-dap.pages.dev/api/votechain/poc/session`

## 4. CI Behavior

Pushes to `main` run `.github/workflows/pages-deploy.yml` and automatically deploy to `votechain-test`.

Production deploys also run automatically on push to `main`. For manual runs (`workflow_dispatch`), production deploy requires `deploy_production=true`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
