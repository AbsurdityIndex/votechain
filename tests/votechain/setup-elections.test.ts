import { describe, expect, it } from 'vitest';
import {
  buildScopeBundleSetupConfig,
  getDefaultContestsForScopes,
  setupPocElection,
} from '../../src/votechain-poc/state.js';

describe('VoteChain POC setup', () => {
  it('creates a generic multi-scope election bundle', async () => {
    const config = buildScopeBundleSetupConfig({
      election_id: 'poc-custom-bundle',
      jurisdiction_id: 'jurisdiction-custom-001',
      scopes: ['college', 'apartment', 'mock'],
      voter_roll_size: 12000,
      duration_days: 5,
    });

    const state = await setupPocElection(config);

    expect(state.election.election_id).toBe('poc-custom-bundle');
    expect(state.setup?.scopes).toEqual(['college', 'apartment', 'mock']);
    expect(state.election.contests.length).toBeGreaterThanOrEqual(3);
    expect(state.manifest.election_id).toBe('poc-custom-bundle');

    const scopeSet = new Set(state.setup?.scopes);
    for (const contest of state.election.contests) {
      expect(contest.scope).toBeDefined();
      expect(scopeSet.has(contest.scope!)).toBe(true);
      expect(contest.options.length).toBeGreaterThanOrEqual(2);
    }

    const manifestEvent = state.vcl.events.find((event) => event.type === 'election_manifest_published');
    expect(manifestEvent).toBeDefined();
    expect((manifestEvent?.payload.election_scopes as string[]) ?? []).toEqual(['college', 'apartment', 'mock']);

    const formDefinitionEvent = state.vcl.events.find((event) => event.type === 'form_definition_published');
    expect(formDefinitionEvent).toBeDefined();
    expect(typeof formDefinitionEvent?.payload.form_definition_hash).toBe('string');
    expect(state.setup?.form_definition_hash).toBe(formDefinitionEvent?.payload.form_definition_hash);
    expect(state.setup?.form_definition_tx_id).toBe(formDefinitionEvent?.tx_id);
  });

  it('supports custom scopes that are not in the initial scope list', async () => {
    const state = await setupPocElection({
      election_id: 'poc-extra-scope',
      jurisdiction_id: 'jurisdiction-02',
      scopes: ['federal'],
      contests: [
        {
          scope: 'tenant-council',
          title: 'Tenant Council Chair',
          type: 'candidate',
          options: [{ label: 'Candidate A' }, { label: 'Candidate B' }],
        },
      ],
      voter_roll_size: 2000,
      duration_days: 3,
    });

    expect(state.setup?.scopes).toContain('tenant-council');
    expect(state.election.contests.some((contest) => contest.scope === 'tenant-council')).toBe(true);
  });

  it('builds default contests for arbitrary scopes', () => {
    const contests = getDefaultContestsForScopes(['district-7']);
    expect(contests.length).toBeGreaterThanOrEqual(2);
    expect(contests.every((contest) => contest.scope === 'district-7')).toBe(true);
  });

  it('keeps contest IDs unique when duplicate IDs are provided across scopes', async () => {
    const state = await setupPocElection({
      election_id: 'poc-duplicate-contest-ids',
      jurisdiction_id: 'jurisdiction-03',
      scopes: ['local', 'federal'],
      contests: [
        {
          scope: 'local',
          contest_id: 'shared-race',
          title: 'Local Council',
          type: 'candidate',
          options: [{ label: 'A' }, { label: 'B' }],
        },
        {
          scope: 'federal',
          contest_id: 'shared-race',
          title: 'Federal Council',
          type: 'candidate',
          options: [{ label: 'A' }, { label: 'B' }],
        },
      ],
      voter_roll_size: 5000,
      duration_days: 2,
    });

    const contestIds = state.election.contests.map((contest) => contest.contest_id);
    expect(new Set(contestIds).size).toBe(contestIds.length);

    const localContest = state.election.contests.find((contest) => contest.scope === 'local');
    const federalContest = state.election.contests.find((contest) => contest.scope === 'federal');
    expect(localContest?.contest_id).toBeDefined();
    expect(federalContest?.contest_id).toBeDefined();
    expect(localContest?.contest_id).not.toBe(federalContest?.contest_id);
  });

  it('keeps default contest IDs unique even when scope slugs collide', async () => {
    const state = await setupPocElection({
      election_id: 'poc-scope-slug-collision',
      jurisdiction_id: 'jurisdiction-04',
      scopes: ['District 7', 'district-7'],
      voter_roll_size: 5000,
      duration_days: 2,
    });

    const contestIds = state.election.contests.map((contest) => contest.contest_id);
    expect(new Set(contestIds).size).toBe(contestIds.length);
  });
});
