# Contributing to VoteChain

Thank you for your interest in contributing. VoteChain is a research project exploring cryptographic election integrity — contributions of all kinds are welcome.

## Ways to contribute

- **Report bugs** — open an issue describing the problem, steps to reproduce, and expected behavior.
- **Suggest improvements** — open an issue with the `enhancement` label.
- **Submit code** — fork the repo, make your changes, and open a pull request.
- **Review the protocols** — the PRD and EWP specifications are open for critique. If you find a flaw, ambiguity, or missing threat, open an issue.
- **Improve documentation** — typos, unclear explanations, missing context — all fair game.

## Development setup

```bash
git clone https://github.com/AbsurdityIndex/votechain.git
cd votechain
git lfs install
npm install
npm test            # Verify everything passes
npm run dev         # Start the dev server
```

## Pull request guidelines

1. **Branch from `main`** and name your branch descriptively (e.g., `fix/nullifier-collision`, `feat/monitor-alerts`).
2. **Keep PRs focused.** One logical change per PR. If you're fixing a bug and also refactoring nearby code, split them into separate PRs.
3. **Add tests** for new functionality. The test suite lives in `tests/poc/`.
4. **Run the full check** before submitting:
   ```bash
   npm test
   npm run typecheck
   npm run build
   ```
5. **Write a clear PR description** explaining what changed and why.
6. **Respect code ownership.** Changes touching files in tracked ownership paths follow [CODEOWNERS](CODEOWNERS).

## Code style

- TypeScript for all source code.
- Follow the patterns already in the codebase (no semicolons in imports, trailing commas, single quotes).
- No need to add JSDoc or comments unless the logic is non-obvious.

## Crypto changes

Changes to anything in `src/votechain-poc/crypto/` require extra care:

- Explain the cryptographic rationale in the PR description.
- Add or update test vectors.
- Note any deviation from the PRD or EWP specification.

## Reporting security vulnerabilities

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.
