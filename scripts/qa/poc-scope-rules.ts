import { minimatch } from 'minimatch';

export type EvidenceKind = 'tests' | 'docs' | 'workflows';

export interface ScopeRequirement {
  id: string;
  description: string;
  globs: string[];
  evidenceType: EvidenceKind;
}

export interface ScopeDefinition {
  id: string;
  name: string;
  description: string;
  targetGlobs: string[];
  waiverGlobs: string[];
  requirements: ScopeRequirement[];
}

export interface RequirementEvaluation {
  requirement: ScopeRequirement;
  matchingFiles: string[];
  isSatisfied: boolean;
}

export interface ScopeEvaluation {
  scope: ScopeDefinition;
  matchedFiles: string[];
  waiverMatches: string[];
  requirements: RequirementEvaluation[];
  missingRequirements: RequirementEvaluation[];
}

function anyMatch(file: string, globs: string[]): boolean {
  if (!globs.length) return false;
  return globs.some((pattern) => minimatch(file, pattern, { dot: true }));
}

function collectMatches(files: string[], globs: string[]): string[] {
  if (!globs.length) return [];
  return files.filter((file) => anyMatch(file, globs));
}

export const scopeDefinitions: ScopeDefinition[] = [
  {
    id: 'poc-ui',
    name: 'VoteChain POC UI',
    description: 'Astro surfaces and static assets exposed under /votechain/poc.',
    targetGlobs: [
      'src/pages/votechain/poc/**/*',
      'src/pages/votechain/poc.*',
      'src/pages/votechain/evidence/poc-engine-board.astro',
      'src/components/votechain/poc/*',
      'src/components/votechain/poc/**/*',
      'public/votechain/poc/**/*',
    ],
    waiverGlobs: ['docs/votechain-assurance/waivers/poc-ui/**/*'],
    requirements: [
      {
        id: 'poc-ui-tests',
        description: 'Update VoteChain integration or workflow tests to capture the UI change.',
        globs: ['tests/poc/**/*.{test,spec}.ts', 'tests/poc/**/*.test.ts'],
        evidenceType: 'tests',
      },
      {
        id: 'poc-ui-docs',
        description:
          'Update VoteChain assurance docs or specs describing the proof-of-concept experience.',
        globs: [
          'docs/votechain-assurance/**/*.md',
          'PLAN-VOTECHAIN-ASSURANCE.md',
          'PRD-VOTECHAIN-ELECTION-WEB-PROTOCOL.md',
        ],
        evidenceType: 'docs',
      },
    ],
  },
  {
    id: 'poc-engine',
    name: 'POC Engine + Crypto',
    description: 'Core browser engine modules in src/votechain-poc (crypto, ballot, tally, etc).',
    targetGlobs: ['src/votechain-poc/**/*'],
    waiverGlobs: ['docs/votechain-assurance/waivers/poc-engine/**/*'],
    requirements: [
      {
        id: 'poc-engine-tests',
        description: 'Update Vitest suites covering the engine (ballot, tally, crypto primitives).',
        globs: [
          'tests/poc/**/*.test.ts',
          'tests/poc/crypto/**/*.test.ts',
          'tests/poc/vcl.test.ts',
        ],
        evidenceType: 'tests',
      },
      {
        id: 'poc-engine-docs',
        description: 'Document crypto or engine changes in the PRD/EWP or assurance playbooks.',
        globs: [
          'docs/votechain-assurance/**/*.md',
          'PRD-VOTER-VERIFICATION-CHAIN.md',
          'PRD-VOTECHAIN-ELECTION-WEB-PROTOCOL.md',
        ],
        evidenceType: 'docs',
      },
    ],
  },
  {
    id: 'logger',
    name: 'Wide Event Logger',
    description: 'Structured logging helpers housed under packages/poc-logger.',
    targetGlobs: ['packages/poc-logger/**/*'],
    waiverGlobs: ['docs/votechain-assurance/waivers/logger/**/*'],
    requirements: [
      {
        id: 'logger-tests',
        description: 'Update VCL and bulletin board tests that assert event logging output.',
        globs: ['tests/poc/vcl.test.ts', 'tests/poc/bulletin-board.test.ts'],
        evidenceType: 'tests',
      },
      {
        id: 'logger-docs',
        description: 'Update secure-code-review docs describing logger schemas and guardrails.',
        globs: ['docs/votechain-assurance/04-secure-code-review.md'],
        evidenceType: 'docs',
      },
    ],
  },
  {
    id: 'sanitizer',
    name: 'Session + Sanitizer Workers',
    description:
      'Turnstile gate + replication functions along with worker shared code that sanitizes payloads.',
    targetGlobs: ['functions/api/votechain/poc/**/*', 'workers/votechain-nodes/**/*'],
    waiverGlobs: ['docs/votechain-assurance/waivers/sanitizer/**/*'],
    requirements: [
      {
        id: 'sanitizer-tests',
        description: 'Update election setup or integration suites that exercise sanitizer logic.',
        globs: ['tests/poc/setup-elections.test.ts', 'tests/poc/integration.test.ts'],
        evidenceType: 'tests',
      },
      {
        id: 'sanitizer-docs',
        description: 'Capture sanitizer or replication changes inside the assurance program.',
        globs: ['docs/votechain-assurance/07-bug-bounty-vdp.md', 'docs/votechain-assurance/**/*.md'],
        evidenceType: 'docs',
      },
    ],
  },
  {
    id: 'workflows',
    name: 'Workflow Automation',
    description: 'GitHub Actions or other CI/CD workflows that gate the VoteChain release process.',
    targetGlobs: ['.github/workflows/**/*.yml', '.github/workflows/**/*.yaml'],
    waiverGlobs: ['docs/votechain-assurance/waivers/workflows/**/*'],
    requirements: [
      {
        id: 'workflow-tests',
        description: 'Add/update CI validation (npm scripts or supporting test harness updates).',
        globs: ['package.json', 'scripts/**/*.mjs', 'scripts/**/*.ts'],
        evidenceType: 'workflows',
      },
      {
        id: 'workflow-docs',
        description: 'Document CI/CD implications (operational assurance + release notes).',
        globs: ['docs/votechain-assurance/08-operational-audit.md', 'RELEASING.md'],
        evidenceType: 'docs',
      },
    ],
  },
];

export function evaluateScopes(changedFiles: string[]): ScopeEvaluation[] {
  const uniqueFiles = Array.from(new Set(changedFiles));

  return scopeDefinitions
    .map((scope) => {
      const matchedFiles = collectMatches(uniqueFiles, scope.targetGlobs);
      if (!matchedFiles.length) return null;

      const waiverMatches = collectMatches(uniqueFiles, scope.waiverGlobs);
      const requirements = scope.requirements.map((requirement) => {
        const matches = collectMatches(uniqueFiles, requirement.globs);
        return {
          requirement,
          matchingFiles: matches,
          isSatisfied: matches.length > 0,
        };
      });

      const missingRequirements = requirements.filter((req) => !req.isSatisfied);

      return {
        scope,
        matchedFiles,
        waiverMatches,
        requirements,
        missingRequirements,
      } satisfies ScopeEvaluation;
    })
    .filter((result): result is ScopeEvaluation => Boolean(result));
}
