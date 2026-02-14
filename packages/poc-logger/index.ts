/**
 * VoteChain POC — Structured wide-event logger
 *
 * Provides a single entry point (`loggerWideEvent`) that enforces the canonical
 * schema, hashes sensitive identifiers, redacts PII, and emits a ready-to-log
 * payload for downstream ingestion.
 */

const LOGGER_SCHEMA = 'votechain.poc.loggerWideEvent@v1';

const OUTCOME_VALUES = new Set([
  'success',
  'failure',
  'error',
  'timeout',
  'canceled',
  'retry',
]);

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const COMMIT_SHA_ENV_KEYS = [
  'VC_COMMIT_SHA',
  'CF_PAGES_COMMIT_SHA',
  'CI_COMMIT_SHA',
  'GITHUB_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_COMMIT_SHA',
  'COMMIT_SHA',
];

const REGION_ENV_KEYS = [
  'VC_REGION',
  'CF_REGION',
  'VERCEL_REGION',
  'REGION',
];

const SENSITIVE_FIELD_NAMES = new Set([
  'voterId',
  'sessionId',
  'session_id',
  'voter_id',
  'email',
  'phone',
  'phoneNumber',
  'address',
  'firstName',
  'lastName',
  'fullName',
  'ssn',
  'dob',
  'ip',
  'ipAddress',
  'postalCode',
]);

const encoder = new TextEncoder();

export type LoggerWideEventOutcome =
  | 'success'
  | 'failure'
  | 'error'
  | 'timeout'
  | 'canceled'
  | 'retry';

export type LoggerFeatureFlagValue = string | number | boolean | null;
export type LoggerFeatureFlags = Record<string, LoggerFeatureFlagValue>;

export interface LoggerWideEventInput {
  requestId?: string;
  voterId?: string | null;
  sessionId?: string | null;
  durationMs: number;
  statusCode: number;
  outcome: LoggerWideEventOutcome;
  featureFlags?: Record<string, unknown>;
  commitSha?: string;
  region?: string;
  timestamp?: string;
  context?: Record<string, unknown>;
  pii?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface LoggerWideEventPayload {
  schema: string;
  request_id: string;
  timestamp: string;
  duration_ms: number;
  status_code: number;
  outcome: LoggerWideEventOutcome;
  commit_sha: string;
  region: string;
  feature_flags: LoggerFeatureFlags;
  hashed_voter_id?: string;
  hashed_session_id?: string;
  pii_redactions?: string[];
  context?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export type LoggerWideEventEmitter = (event: LoggerWideEventPayload) => void | Promise<void>;

/**
 * Emit a canonical wide event with automatic hashing + redactions applied.
 */
export async function loggerWideEvent(
  input: LoggerWideEventInput,
  emit: LoggerWideEventEmitter = defaultEmitter,
): Promise<LoggerWideEventPayload> {
  const requestId = normalizeRequestId(input.requestId);
  const timestamp = sanitizeTimestamp(input.timestamp);
  const durationMs = sanitizeDuration(input.durationMs);
  const statusCode = sanitizeStatusCode(input.statusCode);
  const outcome = sanitizeOutcome(input.outcome);
  const commitSha = detectCommitSha(input.commitSha);
  const region = detectRegion(input.region);
  const featureFlags = sanitizeFeatureFlags(input.featureFlags);
  const redactions = new Set<string>();

  const [hashedVoterId, hashedSessionId] = await Promise.all([
    input.voterId ? hashIdentifier(input.voterId) : Promise.resolve(undefined),
    input.sessionId ? hashIdentifier(input.sessionId) : Promise.resolve(undefined),
  ]);

  if (input.voterId) redactions.add('voterId');
  if (input.sessionId) redactions.add('sessionId');

  if (input.pii) {
    for (const key of Object.keys(input.pii)) {
      redactions.add(key);
    }
  }

  const context = sanitizeContext(input.context, redactions);
  const meta = sanitizeContext(input.meta, redactions);

  const event: LoggerWideEventPayload = {
    schema: LOGGER_SCHEMA,
    request_id: requestId,
    timestamp,
    duration_ms: durationMs,
    status_code: statusCode,
    outcome,
    commit_sha: commitSha,
    region,
    feature_flags: featureFlags,
  };

  if (hashedVoterId) event.hashed_voter_id = hashedVoterId;
  if (hashedSessionId) event.hashed_session_id = hashedSessionId;
  if (context) event.context = context;
  if (meta) event.meta = meta;
  if (redactions.size) event.pii_redactions = Array.from(redactions).sort();

  await Promise.resolve(emit(event));
  return event;
}

const defaultEmitter: LoggerWideEventEmitter = (event) => {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info(JSON.stringify(event));
  }
};

function normalizeRequestId(requestId?: string): string {
  const trimmed = requestId?.trim();
  if (trimmed) return trimmed;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function sanitizeTimestamp(timestamp?: string): string {
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function sanitizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs)) throw new Error('durationMs must be finite.');
  if (durationMs < 0) throw new Error('durationMs must be non-negative.');
  return Math.round(durationMs * 1000) / 1000;
}

function sanitizeStatusCode(statusCode: number): number {
  if (!Number.isFinite(statusCode)) throw new Error('statusCode must be finite.');
  const normalized = Math.trunc(statusCode);
  if (normalized < 100 || normalized > 599) {
    throw new Error('statusCode must be within the HTTP range (100-599).');
  }
  return normalized;
}

function sanitizeOutcome(outcome: LoggerWideEventOutcome): LoggerWideEventOutcome {
  if (!OUTCOME_VALUES.has(outcome)) {
    throw new Error(`outcome must be one of: ${Array.from(OUTCOME_VALUES).join(', ')}`);
  }
  return outcome;
}

function sanitizeFeatureFlags(flags?: Record<string, unknown>): LoggerFeatureFlags {
  if (!flags) return {};
  const safeEntries = Object.entries(flags)
    .map(([key, value]) => [key, normalizePrimitive(value)] as const)
    .filter(([, value]) => value !== undefined);

  const ordered = safeEntries.sort(([a], [b]) => a.localeCompare(b));
  const output: LoggerFeatureFlags = {};
  for (const [key, value] of ordered) {
    output[key] = value!;
  }
  return output;
}

function normalizePrimitive(value: unknown): LoggerFeatureFlagValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function sanitizeContext(
  context?: Record<string, unknown>,
  redactions?: Set<string>,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      redactions?.add(key);
      continue;
    }
    const sanitized = sanitizeContextValue(value);
    if (sanitized !== undefined) safe[key] = sanitized;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function sanitizeContextValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    const items = value.map((item) => sanitizeContextValue(item)).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const nested: Record<string, unknown> = {};
    for (const [key, nestedValue] of entries) {
      const sanitized = sanitizeContextValue(nestedValue);
      if (sanitized !== undefined) nested[key] = sanitized;
    }
    return Object.keys(nested).length ? nested : undefined;
  }
  return undefined;
}

async function hashIdentifier(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) return '';
  const cryptoRef = ensureCrypto();
  const digest = await cryptoRef.subtle.digest('SHA-256', encoder.encode(normalized));
  return bytesToBase64Url(new Uint8Array(digest));
}

function ensureCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('crypto.subtle is required for hashing.');
  }
  return crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    output += BASE64_ALPHABET[b1 >> 2];
    output += BASE64_ALPHABET[((b1 & 0b11) << 4) | (b2 >> 4)];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[((b2 & 0b1111) << 2) | (b3 >> 6)] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[b3 & 0b111111] : '=';
  }
  return output.replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '');
}

function detectCommitSha(explicit?: string): string {
  const normalized = explicit?.trim();
  if (normalized) return normalized;
  for (const key of COMMIT_SHA_ENV_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return 'local-dev';
}

function detectRegion(explicit?: string): string {
  const normalized = explicit?.trim();
  if (normalized) return normalized;
  for (const key of REGION_ENV_KEYS) {
    const value = readEnv(key);
    if (value) return value;
  }
  return 'local';
}

function readEnv(key: string): string | undefined {
  const globalProcess = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process;
  const fromProcess = globalProcess?.env?.[key];
  if (fromProcess && fromProcess.trim()) return fromProcess;
  const fromGlobal = (globalThis as Record<string, unknown>)[key];
  if (typeof fromGlobal === 'string' && fromGlobal.trim()) return fromGlobal;
  return undefined;
}

export const __TESTING__ = {
  bytesToBase64Url,
  hashIdentifier,
  sanitizeContextValue,
  sanitizeFeatureFlags,
  detectCommitSha,
  detectRegion,
  sanitizeOutcome,
};
