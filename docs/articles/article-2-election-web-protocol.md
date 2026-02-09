# The Election Web Protocol: Cryptographic Ballot Integrity From Cast to Tally

What happens to your ballot after you cast it? Today, the answer runs on trust. EWP replaces that with math.

---

## The Back Door Problem

VoteChain verifies voters cryptographically — proving citizenship, eligibility, liveness, and uniqueness with zero-knowledge proofs on a permissioned blockchain. The front door is mathematically sealed.

But a verified voter's ballot still has to go somewhere. Today, that "somewhere" is a physical chain of custody: sealed boxes, transport vans, counting rooms, certified machines. Every link in that chain is a trust assumption, not a mathematical proof.

The front door is cryptographically sealed. The back door runs on honor.

The Election Web Protocol (EWP) is the back door. It provides the cryptographic chain of custody from the moment a ballot is cast to the final published tally — ensuring every ballot is encrypted, recorded on a public append-only log, provably included in the tally set, and counted correctly via verifiable decryption proofs.

## Three Verifiable Links, Zero Trust Gaps

EWP provides end-to-end verifiability through three links, each cryptographically provable:

**Cast-as-intended** — How do you know the machine recorded what you actually selected? EWP uses the Benaloh challenge: before casting, you can challenge the device to reveal its encryption randomness. You (or an independent verifier) recompute the expected ciphertext and check it matches. If it doesn't, the device is provably cheating. The device must commit to the encrypted ballot before knowing whether you'll challenge or cast — it can't selectively cheat.

Even if only 5% of voters challenge, a device that systematically manipulates ballots will be caught with near certainty at election scale.

**Recorded-as-cast** — After casting, you receive a receipt containing a hash of your encrypted ballot and a Merkle inclusion proof showing it was recorded on a public append-only bulletin board. The bulletin board's signed checkpoints are anchored to VoteChain's blockchain, so no one can rewrite history undetected.

**Counted-as-recorded** — At election close, threshold trustees jointly decrypt the aggregate tally and publish mathematical proofs that the tally corresponds exactly to the set of recorded encrypted ballots. Anyone — not just election officials — can verify these proofs.

No single device, operator, or authority needs to be trusted. Every link is independently verifiable.

## How A Vote Moves Through The Protocol

1. **Get the election manifest.** The voter client downloads a signed manifest containing election parameters, the election public key, and cryptographic configuration. The manifest's hash is anchored on VoteChain before voting begins.

2. **Get a challenge nonce.** The gateway issues a short-lived random challenge to prevent replay attacks. The voter's eligibility proof must bind to this challenge.

3. **Encrypt and (optionally) challenge.** The client encrypts ballot selections under the election public key using ElGamal encryption and generates a ballot validity proof (proving the ballot is well-formed without revealing selections). The voter may challenge the device (Benaloh challenge) before casting.

4. **Cast.** The client submits the encrypted ballot, ballot validity proof, eligibility zero-knowledge proof, and cryptographic nullifier to the gateway.

5. **Record.** The gateway verifies all proofs, appends the encrypted ballot to the bulletin board, and writes an audit anchor to VoteChain.

6. **Verify.** The voter receives a receipt and can independently verify their ballot's inclusion on the bulletin board and its anchoring on VoteChain.

7. **Tally.** After polls close, trustees jointly decrypt the aggregate result using threshold cryptography and publish verifiable decryption proofs.

## The Cryptography

EWP's baseline profile uses exponential ElGamal encryption — the same cryptosystem used by Microsoft's ElectionGuard, which has been deployed in real U.S. public elections in Wisconsin, California, Idaho, Utah, and Maryland.

**Ballot encryption:** Each selection is encrypted independently under the election public key. The private key is split among trustees using threshold secret sharing — no single party ever holds the full key.

**Ballot validity proofs:** Chaum-Pedersen zero-knowledge proofs demonstrate each selection is in-range and contest constraints are satisfied, without revealing the selections themselves.

**Homomorphic tallying:** Because ElGamal is additively homomorphic, encrypted ballots can be combined mathematically. Trustees decrypt only the aggregate sum, never individual ballots. They publish decryption proofs so anyone can verify the tally.

**Bulletin board transparency:** An append-only Merkle log where every submitted ballot becomes a leaf. Signed tree heads are periodically anchored to VoteChain. Independent monitors watch for equivocation — if the bulletin board tries to show different logs to different users, it's caught.

## Three Deployment Modes

The protocol primitives — encrypted ballots, bulletin board recording, threshold decryption, tally proofs — are identical across all modes. What changes is the trust model for the physical environment.

**Mode 1: In-Person (primary).** Institution-controlled devices at polling places with HSM attestation, code signing, and tamper-evident housing. Coercion resistance comes from the physical environment — privacy booths and poll worker oversight. This mode deploys first.

**Mode 2: Supervised.** Consulates, military installations, supervised kiosks. Same protocol, semi-controlled environment. Deploys alongside or shortly after Mode 1.

**Mode 3: Unsupervised Remote (future, gated).** Personal devices over the internet. The hardest mode. Deployment requires clearing hard gate criteria: coercion mitigation effectiveness, network privacy (OHTTP), client integrity for uncontrolled devices, phishing gateway defense, and equity parity. All gates must be independently certified before any Mode 3 deployment. Mode 3 must not block or delay Mode 1/2.

## What EWP Defends Against

- **Network attackers** — MITM, replay, traffic analysis (TLS 1.3 + challenge nonces)
- **Malicious gateways** — Can't learn vote content (threshold encryption), can't drop ballots without detection (bulletin board + monitors)
- **Insider operators** — No single operator can alter records; consensus requires multi-category agreement
- **Compromised voter clients** — Benaloh challenge catches cheating devices without trusting them
- **Physical chain-of-custody attackers** — The primary threat EWP eliminates. Sealed boxes and transport vans are replaced with cryptographic proof.
- **Trustee collusion** — Threshold model requires t-of-n trustees to decrypt; fewer than t colluding reveals nothing

## Receipt-Freeness

A critical design invariant: the voter never receives a receipt that proves their selections. The cast receipt contains only a hash of the encrypted ballot and inclusion proofs — nothing that reveals how you voted. Even if you share your receipt with a coercer, they cannot determine your vote from it.

## The Honest Boundaries

EWP does not claim to solve coercion in uncontrolled environments (Mode 3). It provides mitigations — revoting extensions, in-person override — not magic. That's why Mode 3 is gated behind hard requirements.

EWP does not eliminate the need for in-person voting. In-person voting with EWP ballot integrity is the primary and most robust deployment mode. Remote modes extend reach; they don't replace the default.

This is a preview specification intended for controlled pilots, red teaming, and standards work. It has not been certified for production elections.

---

**Read the full specification:** [Election Web Protocol](https://absurdityindex.org/votechain/ewp)

**Read the companion spec:** [VoteChain PRD — Voter Verification](https://absurdityindex.org/votechain/prd)

**Try the browser-based proof of concept:** [VoteChain POC](https://absurdityindex.org/votechain/poc/)

**Source code:** [github.com/AbsurdityIndex/votechain](https://github.com/AbsurdityIndex/votechain)

*This is a good-faith technical blueprint from the Absurdity Index project. It is not affiliated with any political party, candidate, or government agency.*
