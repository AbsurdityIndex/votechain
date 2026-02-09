# Security Policy

## Scope

VoteChain is a research project and proof of concept. The POC is **not** production election software. That said, we take security seriously — the cryptographic protocols, specifications, and reference code should be as correct as possible.

## Supported versions

| Version | Supported |
|---|---|
| `main` branch (latest) | Yes |
| Older commits | No |

## Reporting a vulnerability

If you discover a security vulnerability, please report it responsibly. **Do not open a public GitHub issue.**

1. Email **security@absurdityindex.org** with:
   - A description of the vulnerability
   - Steps to reproduce or a proof of concept
   - The affected component (POC, Workers, PRD spec, EWP spec, etc.)
   - Your assessment of severity and impact

2. You will receive an acknowledgment within 72 hours.

3. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## What qualifies

- Cryptographic flaws in the protocol specifications (PRD, EWP)
- Bugs in the POC crypto implementations (`src/votechain-poc/crypto/`)
- Authentication or authorization bypasses in the Cloudflare Workers
- Information leakage (PII, private keys, secrets)
- Any issue that would undermine the integrity claims of the protocol

## What does not qualify

- Issues that only affect the local browser POC demo (e.g., localStorage tampering by the same user)
- Denial of service against the static site
- Issues in third-party dependencies (report those upstream, but feel free to let us know)

## Disclosure timeline

We aim to resolve confirmed vulnerabilities within 90 days. If a fix requires a specification change, we will publish an advisory explaining the issue and the planned remediation.

## Acknowledgments

We are happy to credit reporters in release notes and advisories (with your permission).
