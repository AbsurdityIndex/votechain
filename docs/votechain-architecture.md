# VoteChain Production Architecture (Servers, Trust Boundaries, and Why)

This page maps the production alignment for the complete system:

- **VoteChain** (verification + fraud review evidence layer)
- **EWP** (cast-to-tally ballot integrity layer)

It focuses on "what runs where" and "why", and is written to be concrete enough to critique.

Notes:

- **Mode 1 (in-person)** and **Mode 2 (supervised)** are the primary targets for early pilots.
- **Mode 3 (unsupervised remote)** is explicitly gated and should not be treated as a default.

## 1. Two Planes (Minimize Correlation)

Production separates the system into two logical planes:

- **Eligibility / verification plane (VoteChain):** eligibility ZK proofs, nullifier uniqueness, revocations, fraud flags, audit anchors.
- **Ballot content plane (EWP):** encrypted ballots, public bulletin board, non-equivocation monitoring, threshold decryption, tally proofs.

They are linked only by **audit anchors** (hashes/commitments), not by voter identity or ballot plaintext.

## 2. Operator Categories (Who Runs What)

These are the distinct operator categories the architecture assumes:

- **Election authority (state/local):** enrollment operations, voter services, election definition, gateways (some or all), incident response.
- **VoteChain consortium:** permissioned ledger operators (federal + state + auditor + oversight categories) and supporting read APIs.
- **Independent trustees/guardians:** hold threshold key shares; participate in key ceremony and tally decryption/proof publication.
- **Independent monitors:** continuously fetch BB checkpoints and VoteChain anchors; detect equivocation and suppression.
- **External data sources (government feeds):** SSA/vital records/USCIS/passport feeds used at enrollment and for post-enrollment revocation signals.

## 3. Production Component Map (The Servers)

The minimal production build (Mode 1/2 pilot) includes the following server-side components.
Names are descriptive; implementations can vary as long as the interfaces and invariants are preserved.

- `enrollment-service`
  - Where: state enrollment offices (DMV/SSA partner desks, county offices, mobile units).
  - Why: identity proofing and recovery are operational processes, not internet flows.

- `attestation-issuer`
  - Where: election authority secured environment, HSM-backed signing keys.
  - Why: produces signed attestations for the five verification pillars without storing PII on-chain.

- `recovery-service`
  - Where: enrollment offices; in-person only for early phases.
  - Why: handles lost device/card scenarios via identity re-verification + Shamir recovery governance.

- `fraud-detection-engine`
  - Where: election authority secured analytics environment.
  - Why: ingests external signals (death/judicial/move patterns), emits `fraud_flag` events, routes cases.

- `oversight-portal`
  - Where: election authority + oversight team environment (role-gated).
  - Why: case management, evidence bundles, reviewer actions, and audit exports.

- `votechain-ledger` (permissioned network)
  - Where: 74 permissioned nodes operated across categories (Federal 6, State 50, Auditor 12, Oversight 6), using a category-quorum consensus policy.
  - Why: no single party can unilaterally rewrite or suppress verification or audit anchors.

- `votechain-read-api`
  - Where: multiple operators; cached and distributed.
  - Why: lets clients/monitors verify anchors without trusting a single gateway.

- `ewp-gateway` (multiple operators)
  - Where: at least two operator categories; geographically redundant.
  - Why: availability and anti-disenfranchisement; no single gateway is a single point of failure.

- `bb-log` (public bulletin board)
  - Where: publicly reachable service; can be multi-operator or replicated; append-only.
  - Why: transparency log for encrypted ballots and election artifacts.

- `bb-sth-signer` (STH signing service)
  - Where: HSM-backed key service operated by the BB operator(s).
  - Why: signs checkpoints (STHs) so equivocation is detectable when monitors compare and verify anchors.

- `monitor` (independent)
  - Where: run by independent parties (academic/NGO/media/government).
  - Why: detects inconsistent BB views (equivocation), missing anchors, and suppression attempts.

- `trustee-service`
  - Where: used by trustees/guardians (often on dedicated hardware/HSM environments).
  - Why: supports key ceremony, partial decryptions, and publication of decryption/shuffle proofs at tally.

- `tally-publisher`
  - Where: election authority public publication service.
  - Why: publishes the final tally artifact and the proof bundle; anchors the tally hash to VoteChain.

## 4. Diagrams (Readable + Complete)

Tip: click the `Fullscreen` button on any diagram to pan and zoom. In fullscreen, click a box or line label to
isolate its connections; right-click a box (or focus it and use `Decompose`) to jump to a deeper diagram (when
available); click the background (or `Clear focus`) to reset.

### 4A Ownership Map (High-Level)

```mermaid
%% diagram-id: ownership-map-high-level
flowchart LR
  classDef voter fill:#d4edda,stroke:#28a745,color:#155724
  classDef ea fill:#cce5ff,stroke:#0d6efd,color:#004085
  classDef vchain fill:#e8daef,stroke:#6f42c1,color:#4a148c
  classDef ewp fill:#fff3cd,stroke:#fd7e14,color:#856404
  classDef trustee fill:#fdebd0,stroke:#d68910,color:#7e5109
  classDef monitor fill:#f8d7da,stroke:#dc3545,color:#721c24

  subgraph VOTERS["Voters"]
    VC(["<img src='/votechain/evidence/icons/vote.svg' width='14' height='14'/> Voter Client(s)"]):::voter
  end

  subgraph EA["Election Authority (State/Local)"]
    EAOPS(["<img src='/votechain/evidence/icons/building.svg' width='14' height='14'/> EA Ops: enroll, attest, recover, review, publish"]):::ea
  end

  subgraph VCL["VoteChain Consortium"]
    VCLW{{"<img src='/votechain/evidence/icons/transfer.svg' width='14' height='14'/> Write Gateway/SDK"}}:::vchain
    VCLN[("<img src='/votechain/evidence/icons/database.svg' width='14' height='14'/> Permissioned ledger (74 nodes)")]:::vchain
    VCLR(["<img src='/votechain/evidence/icons/radio.svg' width='14' height='14'/> Read API (public, replicated)"]):::vchain
    VCLW --> VCLN
    VCLN --> VCLR
  end

  subgraph EWP["EWP Operators"]
    GW{{"<img src='/votechain/evidence/icons/router.svg' width='14' height='14'/> EWP Gateways (A/B/C)"}}:::ewp
  end

  subgraph BB["Public Bulletin Board"]
    BLOG[("<img src='/votechain/evidence/icons/clipboard.svg' width='14' height='14'/> Append-only log")]:::ewp
    STH[["<img src='/votechain/evidence/icons/key.svg' width='14' height='14'/> STH signer (HSM)"]]:::trustee
    BLOG --> STH
  end

  subgraph TRUST["Trustees/Guardians"]
    TS[["<img src='/votechain/evidence/icons/key.svg' width='14' height='14'/> Threshold trustees"]]:::trustee
  end

  subgraph MON["Independent Monitors"]
    M(("<img src='/votechain/evidence/icons/eye.svg' width='14' height='14'/> Monitors")):::monitor
  end

  EAOPS -->|attestations + flags + review actions| VCLW
  VC -->|cast| GW
  GW -->|append encrypted ballot| BLOG
  STH -->|anchor checkpoint| VCLW
  GW -->|anchor receipt + nullifier used| VCLW
  VC -->|verify anchors| VCLR
  M -->|fetch + verify| BLOG
  M -->|cross-check| VCLR
  TS -->|decrypt proofs| EAOPS
  EAOPS -->|publish tally artifacts| BLOG
  EAOPS -->|anchor tally hash| VCLW
```

### 4B VoteChain Consortium (74 Nodes)

```mermaid
%% diagram-id: votechain-consortium-74
flowchart TB
  classDef vchain fill:#e8daef,stroke:#6f42c1,color:#4a148c

  subgraph OPS["Node Operators (74 total)"]
    F[["<img src='/votechain/evidence/icons/server.svg' width='14' height='14'/> Federal (6)"]]:::vchain
    S[["<img src='/votechain/evidence/icons/server.svg' width='14' height='14'/> State (50)"]]:::vchain
    A[["<img src='/votechain/evidence/icons/server.svg' width='14' height='14'/> Auditor (12)"]]:::vchain
    O[["<img src='/votechain/evidence/icons/server.svg' width='14' height='14'/> Oversight (6)"]]:::vchain
  end

  F --> CQ{{"<img src='/votechain/evidence/icons/handshake.svg' width='14' height='14'/> Category-quorum consensus"}}:::vchain
  S --> CQ
  A --> CQ
  O --> CQ

  CQ --> LEDGER[("<img src='/votechain/evidence/icons/database.svg' width='14' height='14'/> VoteChain ledger (74 nodes)")]:::vchain

  WG{{"<img src='/votechain/evidence/icons/transfer.svg' width='14' height='14'/> Write Gateway/SDK"}}:::vchain -->|submit tx| LEDGER
  LEDGER -->|serve queries| RA(["<img src='/votechain/evidence/icons/radio.svg' width='14' height='14'/> Read API (public, replicated)"]):::vchain
```

### 4C EWP Cast-to-Tally (Sequence)

```mermaid
%% diagram-id: ewp-cast-to-tally-sequence
sequenceDiagram
  participant VC as Voter Client
  participant EWG as EWP Gateway
  participant VCL as VoteChain
  participant BB as Bulletin Board Log
  participant STH as STH Signer
  participant MON as Monitor
  participant TS as Trustees
  participant TP as Tally Publisher

  VC->>EWG: GET manifest
  EWG-->>VC: signed manifest (manifest_id)
  VC->>VCL: verify manifest_id anchored

  VC->>EWG: POST cast (nullifier, ZK proof, ciphertext, validity proof)
  EWG->>BB: append ciphertext
  BB->>STH: issue checkpoint (STH)
  STH->>VCL: anchor STH hash
  EWG->>VCL: anchor cast receipt (nullifier + leaf_hash + sth_hash)
  EWG-->>VC: receipt (tx_id, leaf_hash, sth)

  MON->>BB: fetch STH + proofs
  MON->>VCL: cross-check anchors

  TS->>TP: publish decrypt proofs + tally bundle
  TP->>BB: publish tally artifacts
  TP->>VCL: anchor tally hash
```

### 4D Full Alignment Map (Dense)

```mermaid
%% diagram-id: full-alignment-dense
flowchart LR
  classDef voter fill:#d4edda,stroke:#28a745,color:#155724
  classDef ea fill:#cce5ff,stroke:#0d6efd,color:#004085
  classDef vchain fill:#e8daef,stroke:#6f42c1,color:#4a148c
  classDef ewp fill:#fff3cd,stroke:#fd7e14,color:#856404
  classDef trustee fill:#fdebd0,stroke:#d68910,color:#7e5109
  classDef monitor fill:#f8d7da,stroke:#dc3545,color:#721c24
  classDef fraud fill:#fce4ec,stroke:#e53935,color:#b71c1c

  %% Voter environments
  subgraph VOTERS["Voter Environments"]
    VC1(["<img src='/votechain/evidence/icons/vote.svg' width='14' height='14'/> Voter Client (Mode 1: Polling Place Device)"]):::voter
    VC2(["<img src='/votechain/evidence/icons/vote.svg' width='14' height='14'/> Voter Client (Mode 2: Supervised Kiosk)"]):::voter
    VC3(["<img src='/votechain/evidence/icons/vote.svg' width='14' height='14'/> Voter Client (Mode 3: Personal Device - Gated)"]):::voter
  end

  %% Election authority (state/local)
  subgraph EA["Election Authority (State/Local)"]
    ENR(["<img src='/votechain/evidence/icons/building.svg' width='14' height='14'/> Enrollment Service"]):::ea
    ISS[["<img src='/votechain/evidence/icons/lock.svg' width='14' height='14'/> Attestation Issuer (HSM)"]]:::ea
    REC(["<img src='/votechain/evidence/icons/refresh-cw.svg' width='14' height='14'/> Recovery Service (In-Person)"]):::ea
    FE{{"<img src='/votechain/evidence/icons/shield-check.svg' width='14' height='14'/> Fraud Detection Engine"}}:::fraud
    OP(["<img src='/votechain/evidence/icons/scale.svg' width='14' height='14'/> Oversight Portal (Case Review)"]):::ea
    TP(["<img src='/votechain/evidence/icons/bar-chart.svg' width='14' height='14'/> Tally Publisher (Public Artifacts)"]):::ea
  end

  %% VoteChain consortium
  subgraph VCL["VoteChain Consortium (Permissioned Ledger)"]
    VCLW{{"<img src='/votechain/evidence/icons/transfer.svg' width='14' height='14'/> VoteChain Write Gateway/SDK"}}:::vchain
    VCLN[("<img src='/votechain/evidence/icons/database.svg' width='14' height='14'/> VoteChain Nodes (74, category quorum)")]:::vchain
    VCLR(["<img src='/votechain/evidence/icons/radio.svg' width='14' height='14'/> VoteChain Read API (Public, Replicated)"]):::vchain
    VCLW -->|submit tx| VCLN
    VCLN -->|serve queries| VCLR
  end

  %% EWP services
  subgraph EWP["EWP Services (Multiple Operators)"]
    G1{{"<img src='/votechain/evidence/icons/router.svg' width='14' height='14'/> EWP Gateway A"}}:::ewp
    G2{{"<img src='/votechain/evidence/icons/router.svg' width='14' height='14'/> EWP Gateway B"}}:::ewp
    G3{{"<img src='/votechain/evidence/icons/router.svg' width='14' height='14'/> EWP Gateway C"}}:::ewp
  end

  subgraph BB["Bulletin Board (Public Append-Only Log)"]
    BLOG[("<img src='/votechain/evidence/icons/clipboard.svg' width='14' height='14'/> BB Log + Inclusion/Consistency APIs")]:::ewp
    STH[["<img src='/votechain/evidence/icons/key.svg' width='14' height='14'/> STH Signer (HSM)"]]:::trustee
  end

  subgraph TRUSTEES["Trustees / Guardians (Independent)"]
    TS[["<img src='/votechain/evidence/icons/key.svg' width='14' height='14'/> Trustee Service (Key Ceremony + Decrypt Proofs)"]]:::trustee
  end

  subgraph MON["Independent Monitors"]
    M(("<img src='/votechain/evidence/icons/eye.svg' width='14' height='14'/> Monitor")):::monitor
  end

  %% Enrollment and credential lifecycle
  ENR -->|identity checks| ISS
  ENR -->|lost device/card recovery| REC
  ISS -->|"pillar attestations (no PII)"| VCLW
  FE -->|fraud_flag events| VCLW
  OP -->|review actions| VCLW

  %% Client verification dependencies
  VC1 -->|verify manifest anchor, receipt anchors| VCLR
  VC2 -->|verify manifest anchor, receipt anchors| VCLR
  VC3 -->|verify manifest anchor, receipt anchors| VCLR

  %% EWP cast path (gateway diversity)
  VC1 -->|manifest/challenge/cast| G1
  VC1 -->|failover| G2
  VC2 -->|manifest/challenge/cast| G1
  VC3 -->|manifest/challenge/cast| G1

  %% Gateways write to BB and anchor to VoteChain
  G1 -->|append encrypted ballot| BLOG
  G2 -->|append encrypted ballot| BLOG
  G3 -->|append encrypted ballot| BLOG
  BLOG -->|issue STH| STH
  STH -->|anchor STH hash| VCLW
  G1 -->|anchor cast receipt + nullifier used| VCLW
  G2 -->|anchor cast receipt + nullifier used| VCLW
  G3 -->|anchor cast receipt + nullifier used| VCLW

  %% Monitors detect equivocation/suppression
  M -->|fetch STH + proofs| BLOG
  M -->|cross-check anchors| VCLR

  %% Trustees: tally (post-election)
  TS -->|tally decrypt proofs + tally bundle| TP
  TP -->|anchor tally hash| VCLW
  TP -->|publish artifacts| BLOG
```

## 5. Why These Pieces Live Where They Do

This alignment is designed to satisfy the core claims without adding new "trust me" gaps:

- **No single point can silently alter outcomes**
  - Multiple gateways, independent monitors, append-only BB, and VoteChain anchors.

- **No single operator can decrypt individual ballots**
  - Threshold trustees hold shares; decryption occurs at tally with published proofs.

- **Clients do not have to trust a gateway**
  - Manifest and anchors are cross-checked via VoteChain read APIs.

- **Non-equivocation is externally detectable**
  - BB checkpoints are signed and anchored; monitors compare views and demand consistency proofs.

- **Operations stay inside existing election legal guardrails**
  - Identity proofing and recovery remain in-person processes for early phases.
  - Flagged cases route to provisional handling and auditable reviewer workflows.

## 6. "What Is Public" vs "What Is Private"

Public artifacts (everyone can fetch and archive):

- Election manifest + signing keys (or their identifiers) and VoteChain manifest anchors
- BB leaves (encrypted ballots) + STH history + inclusion/consistency proofs
- Cast receipts (do not reveal vote selections)
- Tally artifact + proof bundle + VoteChain tally anchors

Private / restricted artifacts (role-gated, never on-chain):

- Enrollment PII and identity verification evidence
- Fraud investigation case files containing sensitive evidence
- Trustee private shares and HSM internals
