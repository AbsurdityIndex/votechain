# Ralph Agent Instructions (Autonomous Backlog Mode)

You are an autonomous coding agent working on this software project.
You must execute against a self-evolving backlog in `prd.json`.

## Mandatory context load

1. Read `prd.json` in this same directory.
2. Read `progress.txt` (check `## Codebase Patterns` first).
3. Read factory domain prompts from `$RALPH_FACTORY_ROOT`:
   - `prompts/shared-rules.md`
   - `prompts/ux.md`
   - `prompts/qa.md`
   - `prompts/security.md`
   - `prompts/tech-advisor.md`
   - `prompts/solutions-architect.md`
   - `prompts/expert-consultation.md`
   - `prompts/experts/frontend.md`
   - `prompts/experts/security.md`
   - `prompts/experts/observability.md`
4. If any factory prompt file is missing, note it in `progress.txt` and continue.

## Iteration protocol

1. Ensure you are on PRD `branchName` (create/switch as needed).
2. Run a **gap scan** before picking a story:
   - Audit `/votechain/poc` launch UX and all route surfaces under `src/pages/votechain/poc/*`.
   - Audit shared client/harness components under `src/components/votechain/poc/*`.
   - If required work is missing from the backlog, append new stories to `prd.json` with `passes: false`.
3. Pick the highest-priority story with `passes: false`.
4. Implement exactly one story in this iteration.
5. Run required checks:
   - `npm run typecheck`
   - `npm run test`
6. For UI/UX changes, run Playwright flow verification.
7. If checks pass, commit all changes with:
   - `feat: [Story ID] - [Story Title]`
8. Mark that story `passes: true` in `prd.json`.
9. Append progress to `progress.txt`.

## PRD self-generation rules

1. You are required to add stories when you find gaps, regressions, or polish opportunities.
2. New stories must include:
   - clear title/description
   - acceptance criteria
   - priority
   - `passes: false`
3. Avoid duplicates by checking existing stories first.
4. Prefer IDs like `US-AUTO-###` for generated stories.

## Progress format (append only)

```text
## [Date/Time] - [Story ID or BACKLOG-AUDIT]
- Gap scan result (stories added or none)
- What was implemented
- Files changed
- Validation run (commands + result)
- Learnings for future iterations
---
```

## Stop condition

Output exactly `<promise>COMPLETE</promise>` only when all are true:

1. All stories in `prd.json` have `passes: true`.
2. Two consecutive gap scans add zero new stories.
3. Latest validation passes include code checks and Playwright coverage for primary POC journeys.
