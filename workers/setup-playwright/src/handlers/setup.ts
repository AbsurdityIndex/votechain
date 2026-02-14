import type { SetupPlaywrightErrorBody, SetupPlaywrightResponseBody } from '../types';

export interface SetupWorkerEnv {
  VOTECHAIN_POC_STATE: D1Database;
  PLAYWRIGHT_ARTIFACTS: R2Bucket;
  PLAYWRIGHT_RATE_LIMIT: KVNamespace;
  __STATIC_CONTENT?: KVNamespace;
  __STATIC_CONTENT_MANIFEST?: string;
  EWP_VERSION?: string;
  PLAYWRIGHT_ALLOWED_ORIGINS?: string;
  PLAYWRIGHT_AUTOMATION_MODE?: string;
  MODE3_GATE_STATE?: string;
  STAGING_ACCESS_WINDOW?: string;
}

export interface SetupRequestContext {
  request: Request;
  env: SetupWorkerEnv;
  ctx: ExecutionContext;
}

export interface SetupHandlerResult {
  status: number;
  body: SetupPlaywrightResponseBody;
  headers?: HeadersInit;
}

export async function handleSetupRequest({ env }: SetupRequestContext): Promise<SetupHandlerResult> {
  const responseBody: SetupPlaywrightErrorBody = {
    ok: false,
    error: {
      code: 'EWP_GATEWAY_OVERLOADED',
      message: 'Setup automation handler is not wired up yet.',
      retryable: true,
      reference: 'setup-playwright:not-ready',
      details: {
        automationMode: env.PLAYWRIGHT_AUTOMATION_MODE ?? 'disabled',
        gate: env.MODE3_GATE_STATE ?? 'gated',
        stagingWindow: env.STAGING_ACCESS_WINDOW ?? 'n/a',
      },
    },
  };

  return {
    status: 503,
    body: responseBody,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  };
}
