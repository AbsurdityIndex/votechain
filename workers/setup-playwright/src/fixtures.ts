import { z } from 'zod';

const FIXTURE_ASSET_KEY = 'tests/playwright/fixtures/credential-bundles.json';
const LOG_SALT = 'setup-playwright-fixture-log-v1';

export const FIXTURE_BUNDLE_IDS = ['valid_castable', 'used_duplicate', 'invalid_signature'] as const;
export type FixtureBundleId = (typeof FIXTURE_BUNDLE_IDS)[number];

export type BundleStatus = 'ready' | 'consumed' | 'invalid';
export type ReceiptKind = 'expected' | 'recorded' | 'rejected';

type BlindSig = {
  issuer_index: number;
  R: string;
  s: string;
};

export interface FixtureCredential {
  did: string;
  curve: 'secp256k1';
  pk: string;
  sk: string;
  blind_sigs: BlindSig[];
  created_at: string;
}

export interface FixtureReceipt {
  receipt_id: string;
  election_id: string;
  manifest_id: string;
  ballot_hash: string;
  bb_leaf_hash: string;
  bb_sth: {
    tree_size: number;
    root_hash: string;
    timestamp: string;
    kid: string;
    sig: string;
  };
  votechain_anchor: {
    tx_id: string;
    event_type: string;
    sth_root_hash: string;
  };
  ledger_acks: Array<{
    node_role: string;
    entry_index: number;
    entry_hash: string;
    ack: {
      alg: string;
      kid: string;
      sig: string;
    };
  }>;
  kid: string;
  sig: string;
}

export interface FixtureMetadata {
  title: string;
  summary: string;
  frRefs: string[];
  tags: string[];
  notes: string[];
  expectation: string;
}

export interface FixtureAudit {
  createdBy: string;
  reason: string;
  lastVerifiedAt: string;
}

export interface CredentialBundle {
  bundleId: FixtureBundleId;
  shortCode: string;
  status: BundleStatus;
  receiptKind: ReceiptKind;
  nullifier: string;
  credential: FixtureCredential;
  receipt: FixtureReceipt;
  metadata: FixtureMetadata;
  audit: FixtureAudit;
  consumedAt?: string;
  invalidReason?: string;
  expectedErrorCode?: string;
  hash: {
    credential: string;
    receipt: string;
    metadata: string;
    audit: string;
    credentialJson: string;
    receiptJson: string;
    metadataJson: string;
    auditJson: string;
  };
  logRef: string;
}

export interface CredentialFixtures {
  version: number;
  generatedAt: string;
  bundles: Record<FixtureBundleId, CredentialBundle>;
  bundleList: CredentialBundle[];
}

export interface StaticContentNamespace {
  get(key: string, options?: { type: 'text' | 'arrayBuffer' | 'stream' }): Promise<string | ArrayBuffer | null>;
}

export interface FixtureEnv {
  __STATIC_CONTENT?: StaticContentNamespace;
}

export interface StoredBundleRow {
  bundle_id: string;
  short_code?: string | null;
  status: BundleStatus;
  receipt_kind: ReceiptKind;
  nullifier: string;
  credential_hash?: string | null;
  credential_json?: string | null;
  receipt_json?: string | null;
  metadata_json?: string | null;
  audit_json?: string | null;
}

export type DirtyFindingIssue =
  | 'missing_bundle'
  | 'unexpected_bundle'
  | 'status_mismatch'
  | 'receipt_kind_mismatch'
  | 'nullifier_mismatch'
  | 'credential_hash_missing'
  | 'credential_hash_mismatch'
  | 'credential_json_mismatch'
  | 'receipt_json_mismatch'
  | 'metadata_json_mismatch'
  | 'audit_json_mismatch';

export interface DirtyStateFinding {
  bundle_id: string;
  hashed_ref: string;
  issue: DirtyFindingIssue;
  details: string;
  expected?: string;
  actual?: string;
}

export interface DirtyStateReport {
  dirty: boolean;
  findings: DirtyStateFinding[];
}

const isoStringSchema = z.string().datetime();
const hexBytes64Schema = z.string().regex(/^0x[a-f0-9]{64}$/);

const blindSigSchema = z.object({
  issuer_index: z.number().int().nonnegative(),
  R: z.string().min(10),
  s: z.string().min(10),
});

const credentialSchema = z.object({
  did: z.string().min(10),
  curve: z.literal('secp256k1'),
  pk: z.string().min(10),
  sk: z.string().min(10),
  blind_sigs: z.array(blindSigSchema).min(1),
  created_at: isoStringSchema,
});

const receiptSchema = z.object({
  receipt_id: z.string().min(5),
  election_id: z.string().min(3),
  manifest_id: z.string().min(3),
  ballot_hash: hexBytes64Schema,
  bb_leaf_hash: hexBytes64Schema,
  bb_sth: z.object({
    tree_size: z.number().int().nonnegative(),
    root_hash: hexBytes64Schema,
    timestamp: isoStringSchema,
    kid: z.string().min(3),
    sig: z.string().min(20),
  }),
  votechain_anchor: z.object({
    tx_id: hexBytes64Schema,
    event_type: z.string().min(3),
    sth_root_hash: hexBytes64Schema,
  }),
  ledger_acks: z.array(
    z.object({
      node_role: z.string().min(3),
      entry_index: z.number().int().nonnegative(),
      entry_hash: hexBytes64Schema,
      ack: z.object({
        alg: z.string().min(3),
        kid: z.string().min(3),
        sig: z.string().min(20),
      }),
    }),
  ),
  kid: z.string().min(3),
  sig: z.string().min(20),
});

const metadataSchema = z.object({
  title: z.string().min(5),
  summary: z.string().min(10),
  fr_refs: z.array(z.string().min(3)).min(1),
  tags: z.array(z.string().min(2)).default([]),
  notes: z.array(z.string().min(5)).default([]),
  expectation: z.string().min(5),
});

const auditSchema = z.object({
  created_by: z.string().min(3),
  reason: z.string().min(3),
  last_verified_at: isoStringSchema,
});

const bundleSchema = z
  .object({
    bundle_id: z.enum(FIXTURE_BUNDLE_IDS),
    short_code: z.string().min(3),
    status: z.enum(['ready', 'consumed', 'invalid']),
    receipt_kind: z.enum(['expected', 'recorded', 'rejected']),
    nullifier: hexBytes64Schema,
    credential: credentialSchema,
    receipt: receiptSchema,
    metadata: metadataSchema,
    audit: auditSchema,
    consumed_at: isoStringSchema.optional(),
    invalid_reason: z.string().min(5).optional(),
    expected_error_code: z.string().min(3).optional(),
  })
  .superRefine((bundle, ctx) => {
    const expectedReceiptKind: Record<BundleStatus, ReceiptKind> = {
      ready: 'expected',
      consumed: 'recorded',
      invalid: 'rejected',
    };
    if (bundle.receipt_kind !== expectedReceiptKind[bundle.status]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `receipt_kind must be "${expectedReceiptKind[bundle.status]}" when status=${bundle.status}`,
        path: ['receipt_kind'],
      });
    }
    if (bundle.status === 'consumed' && !bundle.consumed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'consumed_at is required when status=consumed',
        path: ['consumed_at'],
      });
    }
    if (bundle.status !== 'consumed' && bundle.consumed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'consumed_at must be omitted unless status=consumed',
        path: ['consumed_at'],
      });
    }
    if (bundle.status === 'invalid' && !bundle.invalid_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid_reason is required when status=invalid',
        path: ['invalid_reason'],
      });
    }
    if (bundle.status !== 'invalid' && bundle.invalid_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid_reason must be omitted unless status=invalid',
        path: ['invalid_reason'],
      });
    }
    if (bundle.status !== 'invalid' && bundle.expected_error_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expected_error_code only applies to invalid bundles',
        path: ['expected_error_code'],
      });
    }
  });

const fixturesSchema = z.object({
  version: z.literal(1),
  generated_at: isoStringSchema,
  bundles: z.array(bundleSchema).length(FIXTURE_BUNDLE_IDS.length),
});

let cachedFixtures: CredentialFixtures | null = null;

export class FixtureLoadError extends Error {
  readonly code = 'FIXTURE_LOAD_FAIL';
  readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'FixtureLoadError';
    this.context = context;
  }
}

export async function loadCredentialFixtures(env: FixtureEnv, assetKey = FIXTURE_ASSET_KEY): Promise<CredentialFixtures> {
  if (cachedFixtures) return cachedFixtures;
  const namespace = env.__STATIC_CONTENT;
  if (!namespace) {
    throw new FixtureLoadError('Missing __STATIC_CONTENT binding in worker environment');
  }

  const raw = await namespace.get(assetKey, { type: 'text' });
  if (typeof raw !== 'string') {
    throw new FixtureLoadError('Fixture asset not found or not readable', { assetKey });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new FixtureLoadError('Fixture asset contains invalid JSON', { assetKey }, error);
  }

  const validation = fixturesSchema.safeParse(parsed);
  if (!validation.success) {
    throw new FixtureLoadError('Fixture schema validation failed', { assetKey, issues: validation.error.issues });
  }

  const hydrated = await hydrateFixtures(validation.data);
  cachedFixtures = hydrated;
  return hydrated;
}

export function getBundle(fixtures: CredentialFixtures, bundleId: FixtureBundleId): CredentialBundle {
  const bundle = fixtures.bundles[bundleId];
  if (!bundle) {
    throw new Error(`Unknown credential bundle: ${bundleId}`);
  }
  return bundle;
}

export async function detectDirtyState(rows: StoredBundleRow[], fixtures: CredentialFixtures): Promise<DirtyStateReport> {
  const findings: DirtyStateFinding[] = [];
  const expectedIds = new Set<FixtureBundleId>(FIXTURE_BUNDLE_IDS);
  const seen = new Set<string>();

  for (const row of rows) {
    const bundleId = row.bundle_id as FixtureBundleId;
    if (!expectedIds.has(bundleId)) {
      findings.push(await formatFinding({
        bundleId: row.bundle_id,
        issue: 'unexpected_bundle',
        details: 'Row exists for bundle_id not present in fixture set.',
      }));
      continue;
    }

    seen.add(bundleId);
    const bundle = fixtures.bundles[bundleId];

    if (row.status !== bundle.status) {
      findings.push(
        await formatFinding({
          bundleId,
          issue: 'status_mismatch',
          details: 'Stored status differs from deterministic fixture.',
          expected: bundle.status,
          actual: row.status,
        }),
      );
    }

    if (row.receipt_kind !== bundle.receiptKind) {
      findings.push(
        await formatFinding({
          bundleId,
          issue: 'receipt_kind_mismatch',
          details: 'receipt_kind must match fixture definition.',
          expected: bundle.receiptKind,
          actual: row.receipt_kind,
        }),
      );
    }

    if (!row.nullifier || row.nullifier.toLowerCase() !== bundle.nullifier) {
      findings.push(
        await formatFinding({
          bundleId,
          issue: 'nullifier_mismatch',
          details: 'Stored nullifier does not match deterministic fixture.',
          expected: bundle.nullifier,
          actual: row.nullifier,
        }),
      );
    }

    if (!row.credential_hash) {
      findings.push(
        await formatFinding({
          bundleId,
          issue: 'credential_hash_missing',
          details: 'credential_hash column is required for drift detection.',
        }),
      );
    } else if (row.credential_hash !== bundle.hash.credential) {
      findings.push(
        await formatFinding({
          bundleId,
          issue: 'credential_hash_mismatch',
          details: 'credential_hash differs from expected hash.',
          expected: bundle.hash.credential,
          actual: row.credential_hash,
        }),
      );
    }

    await compareJsonColumn(bundleId, 'credential_json_mismatch', row.credential_json, bundle.hash.credentialJson, findings);
    await compareJsonColumn(bundleId, 'receipt_json_mismatch', row.receipt_json, bundle.hash.receiptJson, findings);
    await compareJsonColumn(bundleId, 'metadata_json_mismatch', row.metadata_json, bundle.hash.metadataJson, findings);
    await compareJsonColumn(bundleId, 'audit_json_mismatch', row.audit_json, bundle.hash.auditJson, findings);
  }

  for (const expectedId of expectedIds) {
    if (!seen.has(expectedId)) {
      findings.push(
        await formatFinding({
          bundleId: expectedId,
          issue: 'missing_bundle',
          details: 'No D1 row found for deterministic credential bundle.',
        }),
      );
    }
  }

  return { dirty: findings.length > 0, findings };
}

async function compareJsonColumn(
  bundleId: FixtureBundleId,
  issue: Extract<DirtyFindingIssue, `${string}_json_mismatch`>,
  storedJson: string | null | undefined,
  expectedStableJson: string,
  findings: DirtyStateFinding[],
) {
  if (!storedJson || storedJson.trim().length === 0) {
    findings.push(
      await formatFinding({
        bundleId,
        issue,
        details: 'JSON column is empty; fixtures require full payload.',
      }),
    );
    return;
  }

  const parsed = safeJsonParse(storedJson);
  if (!parsed.ok) {
    findings.push(
      await formatFinding({
        bundleId,
        issue,
        details: 'JSON column is not valid JSON.',
        actual: parsed.error.message,
      }),
    );
    return;
  }

  const stable = stableJson(parsed.value);
  if (stable !== expectedStableJson) {
    findings.push(
      await formatFinding({
        bundleId,
        issue,
        details: 'JSON payload does not match deterministic fixture.',
      }),
    );
  }
}

async function hydrateFixtures(data: z.infer<typeof fixturesSchema>): Promise<CredentialFixtures> {
  const bundlesRecord = {} as Record<FixtureBundleId, CredentialBundle>;
  const list: CredentialBundle[] = [];

  for (const bundle of data.bundles) {
    const credentialJson = stableJson(bundle.credential);
    const receiptJson = stableJson(bundle.receipt);
    const metadataJson = stableJson(bundle.metadata);
    const auditJson = stableJson(bundle.audit);
    const [credentialHash, receiptHash, metadataHash, auditHash, logRef] = await Promise.all([
      sha256Hex(credentialJson),
      sha256Hex(receiptJson),
      sha256Hex(metadataJson),
      sha256Hex(auditJson),
      saltedBundleRef(bundle.bundle_id),
    ]);

    const normalized: CredentialBundle = {
      bundleId: bundle.bundle_id,
      shortCode: bundle.short_code,
      status: bundle.status,
      receiptKind: bundle.receipt_kind,
      nullifier: bundle.nullifier,
      credential: bundle.credential,
      receipt: bundle.receipt,
      metadata: {
        title: bundle.metadata.title,
        summary: bundle.metadata.summary,
        frRefs: bundle.metadata.fr_refs,
        tags: bundle.metadata.tags,
        notes: bundle.metadata.notes,
        expectation: bundle.metadata.expectation,
      },
      audit: {
        createdBy: bundle.audit.created_by,
        reason: bundle.audit.reason,
        lastVerifiedAt: bundle.audit.last_verified_at,
      },
      consumedAt: bundle.consumed_at,
      invalidReason: bundle.invalid_reason,
      expectedErrorCode: bundle.expected_error_code,
      hash: {
        credential: credentialHash,
        receipt: receiptHash,
        metadata: metadataHash,
        audit: auditHash,
        credentialJson,
        receiptJson,
        metadataJson,
        auditJson,
      },
      logRef,
    };

    bundlesRecord[bundle.bundle_id] = normalized;
    list.push(normalized);
  }

  return {
    version: data.version,
    generatedAt: data.generated_at,
    bundles: bundlesRecord,
    bundleList: list,
  };
}

function safeJsonParse(value: string): { ok: true; value: unknown } | { ok: false; error: Error } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(',')}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function saltedBundleRef(bundleId: string): Promise<string> {
  const hash = await sha256Hex(`${LOG_SALT}:${bundleId}`);
  return hash.slice(0, 16);
}

async function formatFinding(input: {
  bundleId: string;
  issue: DirtyFindingIssue;
  details: string;
  expected?: string;
  actual?: string;
}): Promise<DirtyStateFinding> {
  return {
    bundle_id: input.bundleId,
    hashed_ref: await saltedBundleRef(input.bundleId),
    issue: input.issue,
    details: input.details,
    expected: input.expected,
    actual: input.actual,
  };
}
