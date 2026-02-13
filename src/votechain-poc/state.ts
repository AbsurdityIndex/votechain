/**
 * VoteChain POC - State Management
 *
 * localStorage-backed state persistence, initialization of the POC
 * election (keys, manifest, trustees, contests), and state accessors.
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';

import type {
  PocStateV2,
  PocContest,
  PocVclEvent,
  PocTrusteeShareRecord,
  PocElectionManifest,
  PocCredential,
  PocElectionScope,
  PocElectionSetupInput,
  PocElectionSetupContestInput,
} from './types.js';
import { sha256, sha256B64u, canonicalJson, concatBytes, utf8, nowIso, bytesToB64u } from './encoding.js';
import { bytesToBigIntBE, bigIntToBytesBE } from './crypto/bigint.js';
import { shamirSplit } from './crypto/shamir.js';
import { generateEcdsaKeyPair, exportKeyPair } from './crypto/ecdsa.js';
import { signManifest } from './manifest.js';
import { vclSignEvent } from './vcl.js';
import { replicateViaProxy } from './vcl-client.js';

const STORAGE_KEY = 'votechain_poc_state_v2';

const DEFAULT_BOOTSTRAP_SETUP: PocElectionSetupInput = {
  election_id: 'poc-2026-demo',
  jurisdiction_id: 'poc_jurisdiction_hash_0x9c1d',
  scopes: ['federal', 'state'],
  contests: [
    {
      scope: 'federal',
      contest_id: 'us-senate-ny-2026',
      title: 'U.S. Senate - New York',
      type: 'candidate',
      options: [
        { id: 'gutierrez-d', label: 'Maria Gutierrez (D)' },
        { id: 'chen-r', label: 'James Chen (R)' },
        { id: 'okafor-i', label: 'Adaeze Okafor (I)' },
      ],
    },
    {
      scope: 'state',
      contest_id: 'prop-12-infrastructure',
      title: 'Proposition 12 - Infrastructure Bond',
      type: 'referendum',
      options: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ],
    },
  ],
  voter_roll_size: 50_000,
  duration_days: 7,
};

const KNOWN_SCOPE_TEMPLATES: Record<
  string,
  Array<{ title: string; type: 'candidate' | 'referendum'; options: string[] }>
> = {
  local: [
    {
      title: 'City Mayor',
      type: 'candidate',
      options: ['Jordan Ames', 'Parker Wells', 'Taylor Reed'],
    },
    {
      title: 'School Board At-Large',
      type: 'candidate',
      options: ['Morgan Park', 'Jamie Flores', 'Avery Blake'],
    },
  ],
  state: [
    {
      title: 'Governor',
      type: 'candidate',
      options: ['Casey Monroe', 'Riley Shah', 'Logan Ortiz'],
    },
    {
      title: 'State Proposition - Clean Water Bond',
      type: 'referendum',
      options: ['Yes', 'No'],
    },
  ],
  federal: [
    {
      title: 'U.S. President',
      type: 'candidate',
      options: ['Alex Carter', 'Morgan Ellis', 'Sam Rivera'],
    },
    {
      title: 'U.S. Senate',
      type: 'candidate',
      options: ['Dana Kim', 'Blake Foster', 'Rae Patel'],
    },
  ],
};

interface NormalizedSetup {
  election_id: string;
  jurisdiction_id: string;
  scopes: PocElectionScope[];
  contests: PocContest[];
  voter_roll_size: number;
  duration_days: number;
}

function canonicalScope(scope: string): string {
  return scope.trim().toLowerCase();
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function normalizeScopes(scopes: PocElectionScope[] | undefined): PocElectionScope[] {
  const result: PocElectionScope[] = [];
  const seen = new Set<string>();

  for (const rawScope of scopes ?? []) {
    const scope = (rawScope ?? '').trim();
    if (!scope) continue;
    const key = canonicalScope(scope);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(scope);
  }

  if (result.length === 0) {
    return ['General'];
  }

  return result;
}

function ensureScopeInList(scopes: PocElectionScope[], scope: PocElectionScope): void {
  const key = canonicalScope(scope);
  if (!scopes.some((existing) => canonicalScope(existing) === key)) {
    scopes.push(scope);
  }
}

function normalizeOptions(
  options: Array<{ id?: string; label: string }>,
): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const normalized: Array<{ id: string; label: string }> = [];

  for (const [idx, option] of options.entries()) {
    const label = (option.label ?? '').trim();
    if (!label) continue;

    let id = (option.id ?? '').trim();
    if (!id) {
      const base = slugify(label);
      id = base;
      let suffix = 2;
      while (seen.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
    }

    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push({ id, label });
    if (idx > 24) break;
  }

  return normalized;
}

function templatesForScope(scope: PocElectionScope): Array<{
  title: string;
  type: 'candidate' | 'referendum';
  options: string[];
}> {
  const key = canonicalScope(scope);
  const known = KNOWN_SCOPE_TEMPLATES[key];
  if (known) return known;

  const titleScope = toTitleCase(scope);
  return [
    {
      title: `${titleScope} Representative`,
      type: 'candidate',
      options: ['Candidate A', 'Candidate B', 'Candidate C'],
    },
    {
      title: `${titleScope} Policy Question`,
      type: 'referendum',
      options: ['Yes', 'No'],
    },
  ];
}

function buildDefaultContestsForScopes(scopes: PocElectionScope[]): PocContest[] {
  const contests: PocContest[] = [];

  for (const scope of scopes) {
    const templates = templatesForScope(scope);
    templates.forEach((template, index) => {
      contests.push({
        contest_id: `${slugify(scope)}-${slugify(template.title)}-${index + 1}`,
        scope,
        title: template.title,
        type: template.type,
        options: normalizeOptions(template.options.map((label) => ({ label }))),
      });
    });
  }

  return contests;
}

function nextUniqueContestId(base: string, used: Set<string>): string {
  const normalizedBase = base.trim() || 'contest';
  if (!used.has(normalizedBase)) {
    used.add(normalizedBase);
    return normalizedBase;
  }

  let suffix = 2;
  while (used.has(`${normalizedBase}-${suffix}`)) suffix += 1;
  const unique = `${normalizedBase}-${suffix}`;
  used.add(unique);
  return unique;
}

function ensureUniqueContestIds(contests: PocContest[]): PocContest[] {
  const used = new Set<string>();
  return contests.map((contest, index) => {
    const baseId =
      (contest.contest_id ?? '').trim() ||
      `${slugify(contest.scope ?? 'general')}-${slugify(contest.title)}-${index + 1}`;
    const contest_id = nextUniqueContestId(baseId, used);
    return { ...contest, contest_id };
  });
}

function normalizeContestInputs(
  contestInputs: PocElectionSetupContestInput[] | undefined,
  baseScopes: PocElectionScope[],
): { contests: PocContest[]; scopes: PocElectionScope[] } {
  const scopes = [...baseScopes];
  const fallback = ensureUniqueContestIds(buildDefaultContestsForScopes(scopes));
  if (!contestInputs || contestInputs.length === 0) return { contests: fallback, scopes };

  const usedContestIds = new Set<string>();
  const normalized: PocContest[] = [];

  for (const [index, input] of contestInputs.entries()) {
    const rawScope = (input.scope ?? '').trim();
    const scope = rawScope || scopes[index % scopes.length] || 'General';
    ensureScopeInList(scopes, scope);

    const title = (input.title ?? '').trim();
    if (!title) continue;

    const options = normalizeOptions(input.options ?? []);
    if (options.length < 2) continue;

    let contest_id = (input.contest_id ?? '').trim();
    if (!contest_id) {
      contest_id = `${slugify(scope)}-${slugify(title)}-${index + 1}`;
    }

    contest_id = nextUniqueContestId(contest_id, usedContestIds);
    normalized.push({
      contest_id,
      scope,
      title,
      type: input.type,
      options,
    });
  }

  // Guarantee at least one contest per selected scope.
  for (const scope of scopes) {
    if (!normalized.some((contest) => canonicalScope(contest.scope ?? '') === canonicalScope(scope))) {
      const scopedFallback = buildDefaultContestsForScopes([scope]).map((contest) => ({
        ...contest,
        contest_id: nextUniqueContestId(contest.contest_id, usedContestIds),
      }));
      normalized.push(...scopedFallback);
    }
  }

  return {
    contests: normalized.length > 0 ? normalized : fallback,
    scopes,
  };
}

function normalizeSetupInput(input: PocElectionSetupInput): NormalizedSetup {
  const scopes = normalizeScopes(input.scopes);
  const election_id = (input.election_id ?? '').trim() || `poc-${new Date().getUTCFullYear()}-bundle`;
  const jurisdiction_id = (input.jurisdiction_id ?? '').trim() || 'poc_jurisdiction_hash_bundle';
  const voter_roll_size = clampInt(input.voter_roll_size, 50_000, 1_000, 5_000_000);
  const duration_days = clampInt(input.duration_days, 7, 1, 90);
  const { contests, scopes: allScopes } = normalizeContestInputs(input.contests, scopes);

  return {
    election_id,
    jurisdiction_id,
    scopes: allScopes,
    contests,
    voter_roll_size,
    duration_days,
  };
}

function defaultSetupLabel(scopes: PocElectionScope[]): string {
  return scopes.map((scope) => toTitleCase(scope)).join(' + ');
}

function buildFormDefinitionPayload(contests: PocContest[]): {
  schema: string;
  contests: Array<{
    contest_id: string;
    scope: string;
    title: string;
    type: 'candidate' | 'referendum';
    options: Array<{ id: string; label: string }>;
  }>;
} {
  const normalized = contests
    .map((contest) => ({
      contest_id: contest.contest_id,
      scope: contest.scope ?? 'General',
      title: contest.title,
      type: contest.type,
      options: contest.options
        .map((option) => ({ id: option.id, label: option.label }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.contest_id.localeCompare(b.contest_id));

  return {
    schema: 'votechain_poc_form_definition_v1',
    contests: normalized,
  };
}

async function replicateSetupEvent(event: PocVclEvent): Promise<void> {
  if (typeof window === 'undefined') return;

  const replication = await replicateViaProxy({
    type: event.type,
    payload: event.payload,
    tx_id: event.tx_id,
    recorded_at: event.recorded_at,
  });
  if (replication.ok) {
    console.info(`[VCL] Replicated ${event.type} to federal node (index=${replication.entry?.index})`);
  } else {
    console.warn(`[VCL] Replication failed for ${event.type}: ${replication.error}`);
  }
}

async function initializeFromSetup(input: PocElectionSetupInput): Promise<PocStateV2> {
  const setup = normalizeSetupInput(input);

  const [manifestKeyPair, ewgKeyPair, bbKeyPair, vclKeyPair] = await Promise.all([
    generateEcdsaKeyPair(),
    generateEcdsaKeyPair(),
    generateEcdsaKeyPair(),
    generateEcdsaKeyPair(),
  ]);

  const keys = {
    manifest: await exportKeyPair(manifestKeyPair, 'poc-manifest-kid-1'),
    ewg: await exportKeyPair(ewgKeyPair, 'poc-ewg-kid-1'),
    bb: await exportKeyPair(bbKeyPair, 'poc-bb-kid-1'),
    vcl: await exportKeyPair(vclKeyPair, 'poc-vcl-kid-1'),
  };

  const threshold = { t: 2, n: 3 };

  // Election secret is a scalar x in Z_q. Only the public key is published.
  const electionSkBytes = secp256k1.utils.randomSecretKey();
  const electionSecret = bytesToBigIntBE(electionSkBytes);
  const pkElectionBytes = secp256k1.getPublicKey(electionSkBytes, true);
  const pk_election = bytesToB64u(pkElectionBytes);

  // Threshold registration authorities for blind Schnorr credential issuance.
  const ISSUER_COUNT = 3;
  const issuerThreshold = { t: 2, n: ISSUER_COUNT };
  const issuers: Array<{ sk: string; pk: string }> = [];
  const pk_issuers: string[] = [];
  for (let i = 0; i < ISSUER_COUNT; i++) {
    const sk = secp256k1.utils.randomSecretKey();
    const pk = secp256k1.getPublicKey(sk, true);
    issuers.push({ sk: bytesToB64u(sk), pk: bytesToB64u(pk) });
    pk_issuers.push(bytesToB64u(pk));
  }

  // Voter roll commitment.
  const voterRollRoot = await sha256(
    concatBytes(utf8('votechain:voter_roll:v1:'), utf8(`${setup.election_id}:${setup.voter_roll_size}`)),
  );
  const voter_roll_commitment = {
    merkle_root: bytesToB64u(voterRollRoot),
    total_eligible: setup.voter_roll_size,
  };

  // POC-only trustee shares.
  const shares = shamirSplit(electionSecret, threshold.t, threshold.n);
  const trusteeShares: PocTrusteeShareRecord[] = shares.map((share, idx) => ({
    id: `T${idx + 1}`,
    x: Number(share.x),
    share: bytesToB64u(bigIntToBytesBE(share.y, 32)),
  }));

  const trustees = Array.from({ length: threshold.n }).map((_, i) => {
    const tSk = secp256k1.utils.randomSecretKey();
    const tPk = secp256k1.getPublicKey(tSk, true);
    return { id: `T${i + 1}`, pubkey: bytesToB64u(tPk) };
  });

  const endpoints = {
    challenge: `/votechain/poc/vote#challenge`,
    cast: `/votechain/poc/vote#cast`,
    bb: `/votechain/poc/dashboard#bb`,
  };

  const not_before = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const not_after = new Date(Date.now() + setup.duration_days * 24 * 60 * 60 * 1000).toISOString();

  const unsignedManifest: Omit<PocElectionManifest, 'manifest_id' | 'signing'> = {
    election_id: setup.election_id,
    jurisdiction_id: setup.jurisdiction_id,
    not_before,
    not_after,
    crypto: {
      suite: 'ewp_suite_poc_threshold_blind_schnorr_ecies_aesgcm_v2',
      pk_election,
      pk_issuers,
      issuer_threshold: issuerThreshold,
      voter_roll_commitment,
      trustees,
      threshold,
    },
    endpoints,
  };

  const manifest = await signManifest(unsignedManifest, keys.manifest);
  const formDefinition = buildFormDefinitionPayload(setup.contests);
  const formDefinitionHash = await sha256B64u(utf8(canonicalJson(formDefinition)));

  const initialState: PocStateV2 = {
    version: 2,
    setup: {
      created_at: nowIso(),
      scopes: setup.scopes,
      label: defaultSetupLabel(setup.scopes),
      form_definition_hash: formDefinitionHash,
    },
    election: {
      election_id: setup.election_id,
      jurisdiction_id: setup.jurisdiction_id,
      contests: setup.contests,
    },
    keys,
    manifest,
    trustees: {
      threshold,
      shares: trusteeShares,
    },
    issuers,
    issuer_threshold: issuerThreshold,
    credential_issuance_count: 0,
    challenges: {},
    idempotency: {},
    bb: { leaves: [], sth_history: [] },
    vcl: { events: [] },
    spoiled_ballots: [],
  };

  // Anchor the manifest on the simulated VoteChain ledger.
  const manifestPublish: Omit<PocVclEvent, 'sig' | 'tx_id'> = {
    type: 'election_manifest_published',
    recorded_at: nowIso(),
    payload: {
      election_id: setup.election_id,
      jurisdiction_id: setup.jurisdiction_id,
      manifest_id: manifest.manifest_id,
      signer_kid: manifest.signing.kid,
      voter_roll_ceiling: setup.voter_roll_size,
      election_scopes: setup.scopes,
    },
    kid: keys.vcl.kid,
  };

  const formDefinitionPublish: Omit<PocVclEvent, 'sig' | 'tx_id'> = {
    type: 'form_definition_published',
    recorded_at: nowIso(),
    payload: {
      election_id: setup.election_id,
      jurisdiction_id: setup.jurisdiction_id,
      manifest_id: manifest.manifest_id,
      form_definition_hash: formDefinitionHash,
      form_definition: formDefinition,
      contest_count: setup.contests.length,
    },
    kid: keys.vcl.kid,
  };

  const manifestPublishSig = await vclSignEvent(manifestPublish, keys.vcl);
  const manifestEvent = { ...manifestPublish, ...manifestPublishSig };
  initialState.vcl.events.push(manifestEvent);

  const formDefinitionSig = await vclSignEvent(formDefinitionPublish, keys.vcl);
  const formDefinitionEvent = { ...formDefinitionPublish, ...formDefinitionSig };
  initialState.vcl.events.push(formDefinitionEvent);

  if (initialState.setup) {
    initialState.setup.form_definition_tx_id = formDefinitionEvent.tx_id;
  }

  saveState(initialState);
  await replicateSetupEvent(manifestEvent);
  await replicateSetupEvent(formDefinitionEvent);

  return initialState;
}

export function loadState(): PocStateV2 | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PocStateV2;
  } catch {
    return null;
  }
}

export function saveState(state: PocStateV2): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetPocState(): void {
  localStorage.removeItem('votechain_poc_state_v1');
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('votechain_poc_last_receipt');
}

/**
 * Invalidate the current voter credential without destroying the election.
 *
 * Clears: credential, challenges, idempotency, spoiled ballots, last receipt.
 * Preserves: manifest, keys, trustees, issuers, BB, VCL events,
 * credential_issuance_count (so the monitor's issuance counter keeps climbing).
 */
export function invalidateCredential(): void {
  const state = loadState();
  if (!state) return;

  delete state.credential;
  state.challenges = {};
  state.idempotency = {};
  state.spoiled_ballots = [];

  saveState(state);
  localStorage.removeItem('votechain_poc_last_receipt');
}

function isStateUsable(s: PocStateV2): boolean {
  if (s.manifest?.crypto?.suite !== 'ewp_suite_poc_threshold_blind_schnorr_ecies_aesgcm_v2') return false;
  if (!Array.isArray(s.trustees?.shares)) return false;
  if (s.credential && typeof s.credential.pk !== 'string') return false;
  if (!Array.isArray(s.issuers) || s.issuers.length === 0) return false;
  if (!Array.isArray(s.manifest?.crypto?.pk_issuers)) return false;
  if (!s.manifest?.crypto?.voter_roll_commitment) return false;
  if (!Array.isArray(s.election?.contests) || s.election.contests.length === 0) return false;
  return true;
}

export function getDefaultContestsForScopes(scopes: PocElectionScope[]): PocContest[] {
  return buildDefaultContestsForScopes(normalizeScopes(scopes));
}

export function buildScopeBundleSetupConfig(args?: {
  election_id?: string;
  jurisdiction_id?: string;
  scopes?: PocElectionScope[];
  voter_roll_size?: number;
  duration_days?: number;
}): PocElectionSetupInput {
  return {
    election_id: args?.election_id ?? `poc-${new Date().getUTCFullYear()}-bundle`,
    jurisdiction_id: args?.jurisdiction_id ?? 'poc_jurisdiction_hash_bundle',
    scopes: normalizeScopes(args?.scopes ?? ['local', 'state', 'federal']),
    voter_roll_size: args?.voter_roll_size ?? 50_000,
    duration_days: args?.duration_days ?? 7,
  };
}

// Backward-compatible alias retained for existing callers.
export const buildMultiLevelSetupConfig = buildScopeBundleSetupConfig;

export async function setupPocElection(input: PocElectionSetupInput): Promise<PocStateV2> {
  resetPocState();
  return initializeFromSetup(input);
}

export async function ensureInitialized(): Promise<PocStateV2> {
  const existing = loadState();
  if (existing?.version === 2 && isStateUsable(existing)) return existing;

  resetPocState();
  return initializeFromSetup(DEFAULT_BOOTSTRAP_SETUP);
}

// - Public accessors ---------------------------------------------------------

export async function getPocState(): Promise<PocStateV2> {
  return ensureInitialized();
}

export async function getManifest(): Promise<PocElectionManifest> {
  const state = await ensureInitialized();
  return state.manifest;
}

export async function getTrusteeShares(): Promise<{
  threshold: { t: number; n: number };
  shares: PocTrusteeShareRecord[];
}> {
  const state = await ensureInitialized();
  return { threshold: state.trustees.threshold, shares: state.trustees.shares };
}

export async function getCredential(): Promise<PocCredential | null> {
  const state = await ensureInitialized();
  return state.credential ?? null;
}
