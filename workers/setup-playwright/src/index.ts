import { handleSetupRequest } from './handlers/setup';
import type { SetupHandlerResult, SetupWorkerEnv } from './handlers/setup';
import type { SetupPlaywrightErrorBody } from './types';

const ROUTE_PATH = '/setup/playwright';

export default {
  async fetch(request: Request, env: SetupWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);

    if (pathname !== ROUTE_PATH) {
      return buildNotFoundResponse(request, env);
    }

    if (request.method === 'OPTIONS') {
      return buildOptionsResponse(request, env);
    }

    if (request.method !== 'POST') {
      return buildMethodNotAllowedResponse(request, env);
    }

    const result = await handleSetupRequest({ request, env, ctx });
    return buildResponseFromHandler(result, request, env);
  },
} satisfies ExportedHandler<SetupWorkerEnv>;

function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function buildOptionsResponse(request: Request, env: SetupWorkerEnv): Response {
  const headers = defaultCorsHeaders(request, env);
  headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type,authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

function buildMethodNotAllowedResponse(request: Request, env: SetupWorkerEnv): Response {
  const headers = defaultCorsHeaders(request, env);
  headers.set('Allow', 'POST,OPTIONS');
  const body: SetupPlaywrightErrorBody = {
    ok: false,
    error: {
      code: 'EWP_BALLOT_INVALID',
      message: 'Method not allowed',
      retryable: false,
    },
  };
  return new Response(JSON.stringify(body), {
    status: 405,
    headers,
  });
}

function buildResponseFromHandler(result: SetupHandlerResult, request: Request, env: SetupWorkerEnv): Response {
  const headers = defaultCorsHeaders(request, env);
  const handlerHeaders = new Headers(result.headers ?? {});
  handlerHeaders.forEach((value, key) => headers.set(key, value));
  headers.set('Vary', appendVary(headers.get('Vary'), 'Origin'));

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  });
}

function defaultCorsHeaders(request: Request, env: SetupWorkerEnv): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  const origin = request.headers.get('Origin');
  const allowed = parseAllowedOrigins(env.PLAYWRIGHT_ALLOWED_ORIGINS);
  const allowAll = allowed.includes('*');

  if (allowAll) {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (origin && isOriginAllowed(origin, allowed)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', appendVary(headers.get('Vary'), 'Origin'));
  }

  headers.set('Access-Control-Allow-Credentials', 'false');
  return headers;
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function isOriginAllowed(origin: string, allowed: string[]): boolean {
  if (allowed.length === 0) return false;
  if (allowed.includes('*')) return true;
  return allowed.includes(origin);
}

function appendVary(existing: string | null, value: string): string {
  if (!existing) return value;
  const parts = existing.split(',').map((entry) => entry.trim());
  if (parts.includes(value)) return existing;
  return `${existing}, ${value}`;
}

function buildNotFoundResponse(request: Request, env: SetupWorkerEnv): Response {
  const headers = defaultCorsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  const body: SetupPlaywrightErrorBody = {
    ok: false,
    error: {
      code: 'EWP_BALLOT_INVALID',
      message: 'Route not found',
      retryable: false,
    },
  };
  return new Response(JSON.stringify(body), { status: 404, headers });
}
