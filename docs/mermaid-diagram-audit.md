# VoteChain Mermaid Diagram Audit

Last updated: 2026-02-13

## 1. Diagram Inventory

20 Mermaid diagrams across 9 files in the VoteChain repo.

### Markdown Files (10 diagrams)

#### File: `PRD-VOTER-VERIFICATION-CHAIN.md`

| # | Line | Type | Name | Description |
|---|------|------|------|-------------|
| 1 | 176 | flowchart LR | System Overview | Three-phase flow (Enrollment → Election Day → Oversight) into blockchain layer + fraud engine |
| 2 | 445 | flowchart TB | Node Architecture | 74 nodes across 4 operator categories → category-quorum consensus → block finalization |
| 3 | 667 | flowchart TD | Voter Experience | Poll arrival → 3 verification steps → decision → VERIFIED / FLAGGED / CRYPTO-CONFLICT |
| 4 | 847 | flowchart LR | Fraud Flag Lifecycle | Detected → Triaged → Investigated → Resolved, each backed by on-chain records |
| 5 | 1500 | sequenceDiagram | Election Day Sequence | Voter ↔ Poll Device ↔ Blockchain ↔ Fraud Engine message flow |

#### File: `PRD-VOTECHAIN-ELECTION-WEB-PROTOCOL.md`

| # | Line | Type | Name | Description |
|---|------|------|------|-------------|
| 6 | 339 | sequenceDiagram | EWP Happy Path | Full cast-to-receipt flow: manifest fetch, challenge, Benaloh challenge, cast, inclusion proof |

#### File: `docs/votechain-architecture.md`

| # | Line | Type | Name | Description |
|---|------|------|------|-------------|
| 7 | 99 | flowchart LR | 4A Ownership Map | High-level trust-boundary view: Voters, EA, VoteChain, EWP, BB, Trustees, Monitors |
| 8 | 158 | flowchart TB | 4B VoteChain Consortium | 74 nodes → consensus → ledger → read API |
| 9 | 183 | sequenceDiagram | 4C EWP Cast-to-Tally | Sequence: Voter Client through Gateway, BB, VoteChain, Monitors, Trustees, Tally |
| 10 | 216 | flowchart LR | 4D Full Alignment Map | Dense view of all components with trust boundaries and data flows |

### Astro Evidence Boards (10 diagrams)

#### File: `src/pages/votechain/evidence/pi-integration-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 11 | pi-lab-topology | Pi Lab Topology | Full lab layout: Polling → Transfer → Airgap → Central boundaries with 17 nodes |
| 12 | pi-machine-wiring | Pi Machine Wiring | Single booth Pi peripherals: display, scanner, printer, tamper, UPS (11 nodes) |
| 13 | pi-network-segmentation | Pi Network Segmentation | VLAN isolation: VLAN10 polling, VLAN20 airgap, VLAN30 central (16 nodes) |
| 14 | pi-compose-placement | Pi Compose Placement | Docker Compose container allocation across polling/airgap/central runtimes (13 nodes) |
| 15 | pi-test-cycle | Pi Test Cycle | End-to-end test flow: voter session → booth → transfer → airgap → central (12 nodes) |

#### File: `src/pages/votechain/evidence/fraud-detection-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 16 | fraud-state-machine | Fraud State Machine | Flag lifecycle states: pending_review → triaged → investigating → resolved (10 nodes) |

#### File: `src/pages/votechain/evidence/crypto-ceremony-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 17 | blind-schnorr-protocol | Blind Schnorr Protocol | Issuer ↔ Voter ↔ Verification boundaries for anonymous credential signing (9 nodes) |

#### File: `src/pages/votechain/evidence/poc-engine-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 18 | poc-module-graph | POC Module Graph | Browser UI → Core engine → Crypto primitives → Edge workers (19 nodes) |

#### File: `src/pages/votechain/evidence/bulletin-board-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 19 | bb-merkle-tree | BB Merkle Tree | Ballot ingress → leaf hashing → Merkle tree → root hash → STH/audit proof (15 nodes) |

#### File: `src/pages/votechain/evidence/worker-ledger-board.astro`

| # | diagram-id | Name | Description |
|---|------------|------|-------------|
| 20 | worker-topology | Worker Topology | Edge → Pages Functions → Cloudflare Workers (federal/state/oversight) → ACK (8 nodes) |

---

## 2. Visual Encoding System

Each flowchart node uses **three visual cues** to encode domain information:

### 2.1 Shape = Component Type

| Shape | Mermaid Syntax | Meaning |
|-------|---------------|---------|
| Stadium (rounded rect) | `(["text"])` | Services, APIs, human entry points |
| Cylinder | `[("text")]` | Data stores (blockchain, bulletin board, on-chain records) |
| Hexagon | `{{"text"}}` | Processing engines (gateways, consensus, fraud detection) |
| Subroutine (double border) | `[["text"]]` | Institutional operators, hardware modules (HSM, trustees, nodes) |
| Double circle | `(("text"))` | Monitoring/observation nodes |
| Diamond | `{"text"}` | Decision/branching points |
| Rectangle | `["text"]` | Generic process steps, sub-items |

### 2.2 Color = Trust Boundary (classDef)

| Class | Fill | Stroke | Trust Domain |
|-------|------|--------|-------------|
| `voter` | `#d4edda` | `#28a745` | Citizen-controlled endpoints, success outcomes |
| `ea` | `#cce5ff` | `#0d6efd` | Election Authority operations and services |
| `vchain` | `#e8daef` | `#6f42c1` | VoteChain Consortium (ledger, nodes, APIs) |
| `ewp` | `#fff3cd` | `#fd7e14` | EWP gateways, bulletin board |
| `trustee` | `#fdebd0` | `#d68910` | Trustees/guardians, HSM signers |
| `monitor` | `#f8d7da` | `#dc3545` | Independent watchdog monitors |
| `fraud` | `#fce4ec` | `#e53935` | Fraud detection engine and related components |
| `warn` | `#fff3cd` | `#fd7e14` | Warning/flagged outcomes |
| `danger` | `#fce4ec` | `#e53935` | High-severity conflict outcomes |

### 2.3 SVG Icon = Domain Concept

Each node label includes an inline SVG `<img>` tag that represents its domain role. Icons are 24×24 Tabler/Lucide-style SVGs rendered at 14×14 within node labels.

**Pattern:** `<img src='/votechain/evidence/icons/NAME.svg' width='14' height='14'/>`

**Requires:** Mermaid `securityLevel: 'loose'` to render HTML in node labels (set in `MermaidClient.astro`).

| SVG Icon | Domain Concept | Used In |
|----------|---------------|---------|
| `building.svg` | Election Authority / government ops | Diagrams 1, 7, 10 |
| `vote.svg` | Voter/citizen action | Diagrams 1, 3, 7, 10 |
| `scale.svg` | Oversight/justice/review | Diagrams 1, 10 |
| `id-card.svg` | Identity verification / enrollment | Diagrams 1, 3 |
| `lock.svg` | Verification protocol / ZK proof | Diagrams 1, 3, 10 |
| `shield-check.svg` | Fraud detection / security / verified | Diagrams 1, 4, 7, 10–17, 19 |
| `shield-x.svg` | Security failure / tamper / fraud confirmed | Diagrams 12, 16 |
| `database.svg` | Data stores / blockchain / ledger | Diagrams 1, 2, 4, 7, 8, 10–15, 18, 19 |
| `server.svg` | Node operators / infrastructure | Diagrams 1, 2, 8, 11, 13, 14, 18, 19 |
| `alert-triangle.svg` | Warning / individual fraud checks | Diagrams 1, 3 |
| `alert-octagon.svg` | High-severity conflict / detected fraud | Diagrams 3, 4 |
| `handshake.svg` | Consensus mechanism / agreement | Diagrams 2, 8 |
| `circle-check.svg` | Verified / resolved outcome | Diagrams 3, 4 |
| `search.svg` | Investigation | Diagram 4 |
| `transfer.svg` | Data routing / gateway / transfer | Diagrams 7, 8, 10–15, 18, 19 |
| `radio.svg` | Read API / broadcast | Diagrams 7, 8, 10 |
| `clipboard.svg` | Bulletin board / public record | Diagrams 7, 10, 19 |
| `key.svg` | Cryptographic keys / HSM / signing | Diagrams 7, 10, 12, 16–20 |
| `eye.svg` | Monitor / observer | Diagram 7 |
| `refresh-cw.svg` | Recovery service | Diagram 10 |
| `bar-chart.svg` | Tally / results / statistics | Diagram 10 |
| `router.svg` | Network boundary / routing | Diagrams 11–16, 19, 20 |
| `raspberry-pi.svg` | Raspberry Pi hardware | Diagrams 11–15 |
| `device-desktop.svg` | Display / browser client | Diagrams 12, 15, 17, 18, 20 |
| `qrcode.svg` | QR scanner | Diagram 12 |
| `printer.svg` | Receipt printer | Diagram 12 |
| `scan.svg` | Import scanner | Diagrams 11, 13, 15 |
| `cloudflare.svg` | Cloudflare Workers / edge compute | Diagrams 18, 20 |

### 2.4 Sequence Diagram Participants

Sequence diagrams (#5, #6, #9) use `actor` for human participants (stick figure) and `participant` for system components. No SVG icons are applied — sequence diagram participants render as header boxes where `<img>` tags are not supported.

---

## 3. Per-Diagram Node Audit

### Diagram 1: System Overview (PRD line 176) — 18 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| A | Enrollment (One-Time) | stadium | ea | `building.svg` | DONE |
| B | Election Day Verification | stadium | ea | `vote.svg` | DONE |
| C | Oversight & Audit | stadium | ea | `scale.svg` | DONE |
| A1 | Multi-Source Identity Verification | rectangle | ea | `id-card.svg` | DONE |
| B1 | Five-Pillar Verification Protocol | rectangle | ea | `lock.svg` | DONE |
| C1 | Real-Time Fraud Dashboard | rectangle | fraud | `shield-check.svg` | DONE |
| D | Permissioned Blockchain Layer | cylinder | vchain | `database.svg` | DONE |
| N1 | Federal Nodes | subroutine | vchain | `server.svg` | DONE |
| N2 | State Nodes | subroutine | vchain | `server.svg` | DONE |
| N3 | Auditor Nodes | subroutine | vchain | `server.svg` | DONE |
| N4 | Oversight Nodes | subroutine | vchain | `server.svg` | DONE |
| E | Fraud Detection Engine | hexagon | fraud | `shield-check.svg` | DONE |
| E1–E6 | Individual fraud checks (×6) | rectangle | fraud | `alert-triangle.svg` | DONE |

### Diagram 2: Node Architecture (PRD line 445) — 6 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| F | Federal (6) | subroutine | vchain | `server.svg` | DONE |
| S | State (50) | subroutine | vchain | `server.svg` | DONE |
| A | Auditor (12) | subroutine | vchain | `server.svg` | DONE |
| O | Oversight (6) | subroutine | vchain | `server.svg` | DONE |
| CQ | Category-Quorum Consensus | hexagon | vchain | `handshake.svg` | DONE |
| BF | Block Finalization | cylinder | vchain | `database.svg` | DONE |

### Diagram 3: Voter Experience (PRD line 667) — 7 nodes + 1 decision

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| A | Voter Arrives at Polls | stadium | voter | `vote.svg` | DONE |
| B | Step 1: Present Credential | rectangle | ea | `id-card.svg` | DONE |
| C | Step 2: Liveness Check | rectangle | ea | `lock.svg` | DONE |
| D | Step 3: Five-Pillar Verification | rectangle | ea | `lock.svg` | DONE |
| E | Result | diamond | — | — | N/A (decision) |
| V | VERIFIED | stadium | voter | `circle-check.svg` | DONE |
| F | FLAGGED | rectangle | warn | `alert-triangle.svg` | DONE |
| X | CRYPTO-CONFLICT | subroutine | danger | `alert-octagon.svg` | DONE |

### Diagram 4: Fraud Flag Lifecycle (PRD line 847) — 8 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| A | Detected | stadium | fraud | `alert-octagon.svg` | DONE |
| B | Triaged | stadium | fraud | `shield-check.svg` | DONE |
| C | Investigated | stadium | fraud | `search.svg` | DONE |
| D | Resolved | stadium | fraud | `circle-check.svg` | DONE |
| A1 | On-chain record created | cylinder | vchain | `database.svg` | DONE |
| B1 | On-chain assignment | cylinder | vchain | `database.svg` | DONE |
| C1 | On-chain evidence linkage | cylinder | vchain | `database.svg` | DONE |
| D1 | On-chain resolution | cylinder | vchain | `database.svg` | DONE |

### Diagram 5: Election Day Sequence (PRD line 1500) — no icons

| Participant | Type | Status |
|------------|------|--------|
| V (Voter) | actor | DONE |
| P (Poll Device) | participant | DONE |
| B (Blockchain) | participant | DONE |
| F (Fraud Engine) | participant | DONE |

### Diagram 6: EWP Happy Path (EWP PRD line 339) — no icons

| Participant | Type | Status |
|------------|------|--------|
| VC (Voter Client) | participant | DONE |
| EWG (Election Web Gateway) | participant | DONE |
| BB (Bulletin Board) | participant | DONE |
| VCL (VoteChain Ledger) | participant | DONE |

### Diagram 7: 4A Ownership Map (Architecture line 99) — 10 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| VC | Voter Client(s) | stadium | voter | `vote.svg` | DONE |
| EAOPS | EA Ops | stadium | ea | `building.svg` | DONE |
| VCLW | Write Gateway/SDK | hexagon | vchain | `transfer.svg` | DONE |
| VCLN | Permissioned ledger | cylinder | vchain | `database.svg` | DONE |
| VCLR | Read API | stadium | vchain | `radio.svg` | DONE |
| GW | EWP Gateways | hexagon | ewp | `router.svg` | DONE |
| BLOG | Append-only log | cylinder | ewp | `clipboard.svg` | DONE |
| STH | STH signer (HSM) | subroutine | trustee | `key.svg` | DONE |
| TS | Threshold trustees | subroutine | trustee | `key.svg` | DONE |
| M | Monitors | double circle | monitor | `eye.svg` | DONE |

### Diagram 8: 4B VoteChain Consortium (Architecture line 158) — 8 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| F | Federal (6) | subroutine | vchain | `server.svg` | DONE |
| S | State (50) | subroutine | vchain | `server.svg` | DONE |
| A | Auditor (12) | subroutine | vchain | `server.svg` | DONE |
| O | Oversight (6) | subroutine | vchain | `server.svg` | DONE |
| CQ | Category-quorum consensus | hexagon | vchain | `handshake.svg` | DONE |
| LEDGER | VoteChain ledger | cylinder | vchain | `database.svg` | DONE |
| WG | Write Gateway/SDK | hexagon | vchain | `transfer.svg` | DONE |
| RA | Read API | stadium | vchain | `radio.svg` | DONE |

### Diagram 9: 4C EWP Cast-to-Tally Sequence (Architecture line 183) — no icons

| Participant | Type | Status |
|------------|------|--------|
| VC (Voter Client) | participant | DONE |
| EWG (EWP Gateway) | participant | DONE |
| VCL (VoteChain) | participant | DONE |
| BB (Bulletin Board Log) | participant | DONE |
| STH (STH Signer) | participant | DONE |
| MON (Monitor) | participant | DONE |
| TS (Trustees) | participant | DONE |
| TP (Tally Publisher) | participant | DONE |

### Diagram 10: 4D Full Alignment Map (Architecture line 216) — 19 nodes

| Node ID | Label | Shape | Color | SVG Icon | Status |
|---------|-------|-------|-------|----------|--------|
| VC1 | Voter Client (Mode 1) | stadium | voter | `vote.svg` | DONE |
| VC2 | Voter Client (Mode 2) | stadium | voter | `vote.svg` | DONE |
| VC3 | Voter Client (Mode 3) | stadium | voter | `vote.svg` | DONE |
| ENR | Enrollment Service | stadium | ea | `building.svg` | DONE |
| ISS | Attestation Issuer (HSM) | subroutine | ea | `lock.svg` | DONE |
| REC | Recovery Service | stadium | ea | `refresh-cw.svg` | DONE |
| FE | Fraud Detection Engine | hexagon | fraud | `shield-check.svg` | DONE |
| OP | Oversight Portal | stadium | ea | `scale.svg` | DONE |
| TP | Tally Publisher | stadium | ea | `bar-chart.svg` | DONE |
| VCLW | Write Gateway/SDK | hexagon | vchain | `transfer.svg` | DONE |
| VCLN | VoteChain Nodes | cylinder | vchain | `database.svg` | DONE |
| VCLR | Read API | stadium | vchain | `radio.svg` | DONE |
| G1 | EWP Gateway A | hexagon | ewp | `router.svg` | DONE |
| G2 | EWP Gateway B | hexagon | ewp | `router.svg` | DONE |
| G3 | EWP Gateway C | hexagon | ewp | `router.svg` | DONE |
| BLOG | BB Log | cylinder | ewp | `clipboard.svg` | DONE |
| STH | STH Signer (HSM) | subroutine | trustee | `key.svg` | DONE |
| TS | Trustee Service | subroutine | trustee | `key.svg` | DONE |
| M | Monitor | double circle | monitor | `eye.svg` | DONE |

### Diagram 11: Pi Lab Topology (pi-integration-board) — 17 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| PMETA | Polling Boundary | subgraph | `router.svg` | DONE |
| B1–B5 | Booth Pi 1–5 | rectangle | `raspberry-pi.svg` | DONE |
| OPS | Ops Pi | rectangle | `raspberry-pi.svg` | DONE |
| PSW | Polling Switch | rectangle | `router.svg` | DONE |
| XMETA | Transfer Boundary | subgraph | `transfer.svg` | DONE |
| EK | Export Kiosk Pi | rectangle | `transfer.svg` | DONE |
| SCAN | Import Scan Pi | rectangle | `scan.svg` | DONE |
| AMETA | Airgap Boundary | subgraph | `router.svg` | DONE |
| ING | Airgap Ingest | rectangle | `raspberry-pi.svg` | DONE |
| REL | Airgap Relay | rectangle | `raspberry-pi.svg` | DONE |
| OBS | Observer Pi | rectangle | `shield-check.svg` | DONE |
| AL | Airgap Ledger Cluster | rectangle | `database.svg` | DONE |
| CMETA | Central Boundary | subgraph | `router.svg` | DONE |
| CING | Central Ingest | rectangle | `server.svg` | DONE |
| CREL | Central Relay | rectangle | `server.svg` | DONE |
| CMON | Oversight Monitor | rectangle | `shield-check.svg` | DONE |
| CL | Central Ledger Cluster | rectangle | `database.svg` | DONE |

### Diagram 12: Pi Machine Wiring (pi-integration-board) — 11 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| PMETA | Peripheral Boundary | subgraph | `router.svg` | DONE |
| TD | Touch Display | rectangle | `device-desktop.svg` | DONE |
| QR | QR Scanner | rectangle | `qrcode.svg` | DONE |
| PR | Receipt Printer | rectangle | `printer.svg` | DONE |
| KEY | Poll Worker Key | rectangle | `key.svg` | DONE |
| UPS | UPS HAT | rectangle | `shield-check.svg` | DONE |
| TMP | Tamper Switch | rectangle | `shield-x.svg` | DONE |
| LAN | Booth LAN Switch | rectangle | `router.svg` | DONE |
| SEAL | Security Seal Sensor | rectangle | `shield-check.svg` | DONE |
| HMETA | Host Boundary | subgraph | `raspberry-pi.svg` | DONE |
| PI | Booth Pi Controller | rectangle | `raspberry-pi.svg` | DONE |

### Diagram 13: Pi Network Segmentation (pi-integration-board) — 16 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| V10META | VLAN10 Boundary | subgraph | `router.svg` | DONE |
| BP | Booth + Ops Cluster | rectangle | `raspberry-pi.svg` | DONE |
| PSW | Polling Switch | rectangle | `router.svg` | DONE |
| XMETA | Transfer Boundary | subgraph | `transfer.svg` | DONE |
| EK | Export Kiosk | rectangle | `transfer.svg` | DONE |
| SCAN | Import Scan | rectangle | `scan.svg` | DONE |
| V20META | VLAN20 Boundary | subgraph | `router.svg` | DONE |
| ING | Airgap Ingest | rectangle | `raspberry-pi.svg` | DONE |
| REL | Airgap Relay | rectangle | `raspberry-pi.svg` | DONE |
| OBS | Observer Pi | rectangle | `shield-check.svg` | DONE |
| AL | Airgap Ledger | rectangle | `database.svg` | DONE |
| V30META | VLAN30 Boundary | subgraph | `router.svg` | DONE |
| CING | Central Ingest | rectangle | `server.svg` | DONE |
| CREL | Central Relay | rectangle | `server.svg` | DONE |
| CMON | Oversight Monitor | rectangle | `shield-check.svg` | DONE |
| CL | Central Ledger | rectangle | `database.svg` | DONE |

### Diagram 14: Pi Compose Placement (pi-integration-board) — 13 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| PMETA | Polling Runtime | subgraph | `router.svg` | DONE |
| P1 | booth-pi-[1..5] | rectangle | `raspberry-pi.svg` | DONE |
| P2 | ops-pi | rectangle | `raspberry-pi.svg` | DONE |
| AMETA | Airgap Runtime | subgraph | `router.svg` | DONE |
| A1 | airgap-ingest | rectangle | `raspberry-pi.svg` | DONE |
| A2 | airgap-relay | rectangle | `raspberry-pi.svg` | DONE |
| A3 | airgap-ledger-a1-a2-a3 | rectangle | `database.svg` | DONE |
| A4 | observer-pi | rectangle | `shield-check.svg` | DONE |
| CMETA | Central Runtime | subgraph | `router.svg` | DONE |
| C1 | central-ingest | rectangle | `server.svg` | DONE |
| C2 | central-relay | rectangle | `server.svg` | DONE |
| C3 | central-ledger-1-2-3 | rectangle | `database.svg` | DONE |
| C4 | audit-verifier | rectangle | `shield-check.svg` | DONE |

### Diagram 15: Pi Test Cycle (pi-integration-board) — 12 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| VMETA | Session Boundary | subgraph | `device-desktop.svg` | DONE |
| V | Voter Session | rectangle | `device-desktop.svg` | DONE |
| BMETA | Booth Boundary | subgraph | `raspberry-pi.svg` | DONE |
| B | Booth Pi Service | rectangle | `raspberry-pi.svg` | DONE |
| TMETA | Transfer Boundary | subgraph | `transfer.svg` | DONE |
| T | Transfer Validation | rectangle | `scan.svg` | DONE |
| AMETA | Airgap Boundary | subgraph | `raspberry-pi.svg` | DONE |
| A | Airgap Ingest Ledger | rectangle | `database.svg` | DONE |
| CMETA | Central Boundary | subgraph | `server.svg` | DONE |
| C | Central Verify Service | rectangle | `shield-check.svg` | DONE |
| H1 | Harness Controller | rectangle | `shield-check.svg` | DONE |
| H2 | Integrity Monitor | rectangle | `shield-check.svg` | DONE |

### Diagram 16: Fraud State Machine (fraud-detection-board) — 10 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| OMETA | Oversight Boundary | subgraph | `router.svg` | DONE |
| PR | pending_review | rectangle | `shield-x.svg` | DONE |
| TR | triaged | rectangle | `shield-check.svg` | DONE |
| IN | investigating | rectangle | `shield-check.svg` | DONE |
| ES | escalated | rectangle | `shield-x.svg` | DONE |
| RC | resolved_cleared | rectangle | `shield-check.svg` | DONE |
| RF | resolved_confirmed_fraud | rectangle | `shield-x.svg` | DONE |
| RE | resolved_system_error | rectangle | `shield-check.svg` | DONE |
| AMETA | Action Boundary | subgraph | `key.svg` | DONE |
| NOTE | note action | rectangle | `key.svg` | DONE |

### Diagram 17: Blind Schnorr Protocol (crypto-ceremony-board) — 9 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| IMETA | Issuer Boundary | subgraph | `router.svg` | DONE |
| I1 | Nonce Generator | rectangle | `key.svg` | DONE |
| I2 | Challenge Signer | rectangle | `key.svg` | DONE |
| VMETA | Voter Boundary | subgraph | `device-desktop.svg` | DONE |
| V1 | Blinding Step | rectangle | `key.svg` | DONE |
| V2 | Unblinding Step | rectangle | `key.svg` | DONE |
| XMETA | Verification Boundary | subgraph | `shield-check.svg` | DONE |
| VER | Equation Verifier | rectangle | `shield-check.svg` | DONE |
| DOM | Domain Separator Policy | rectangle | `key.svg` | DONE |

### Diagram 18: POC Module Graph (poc-engine-board) — 19 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| BMETA | Browser Boundary | subgraph | `device-desktop.svg` | DONE |
| UI | UI Controller Group | rectangle | `device-desktop.svg` | DONE |
| JOURNEY | Voter Journey Orchestrator | rectangle | `transfer.svg` | DONE |
| STATE | State Store | rectangle | `database.svg` | DONE |
| AUDIT | Audit Surface | rectangle | `shield-check.svg` | DONE |
| CMETA | Core Boundary | subgraph | `server.svg` | DONE |
| ENGINE | Engine Core | rectangle | `server.svg` | DONE |
| CRED | Credential Service | rectangle | `key.svg` | DONE |
| CAST | Ballot Cast Service | rectangle | `transfer.svg` | DONE |
| BB | Bulletin Board Service | rectangle | `database.svg` | DONE |
| VCL | Replication Client | rectangle | `transfer.svg` | DONE |
| XMETA | Crypto Boundary | subgraph | `key.svg` | DONE |
| P1 | Blind Schnorr Primitive | rectangle | `key.svg` | DONE |
| P2 | ECIES Primitive | rectangle | `key.svg` | DONE |
| P3 | Shamir Primitive | rectangle | `key.svg` | DONE |
| P4 | ECDSA Primitive | rectangle | `key.svg` | DONE |
| P5 | BigInt Arithmetic | rectangle | `key.svg` | DONE |
| EMETA | Edge Boundary | subgraph | `cloudflare.svg` | DONE |
| EDGEAPI | Replication Endpoint | rectangle | `cloudflare.svg` | DONE |

### Diagram 19: BB Merkle Tree (bulletin-board-board) — 15 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| IMETA | Ingress Boundary | subgraph | `router.svg` | DONE |
| PAY | Ballot Payload | rectangle | `transfer.svg` | DONE |
| LHASH | Leaf Hash Builder | rectangle | `key.svg` | DONE |
| TMETA | Merkle Boundary | subgraph | `database.svg` | DONE |
| L0–L3 | Leaf 0–3 | rectangle | `database.svg` | DONE |
| N01 | Node 0-1 | rectangle | `server.svg` | DONE |
| N23 | Node 2-3 | rectangle | `server.svg` | DONE |
| RH | Root Hash | rectangle | `key.svg` | DONE |
| AMETA | Audit Boundary | subgraph | `shield-check.svg` | DONE |
| DS | Domain Separator Policy | rectangle | `key.svg` | DONE |
| STH | Signed Tree Head | rectangle | `key.svg` | DONE |
| PROOF | Inclusion Verifier | rectangle | `shield-check.svg` | DONE |

### Diagram 20: Worker Topology (worker-ledger-board) — 8 nodes

| Node ID | Label | Shape | SVG Icon | Status |
|---------|-------|-------|----------|--------|
| EMETA | Edge Boundary | subgraph | `router.svg` | DONE |
| BR | Browser Client | rectangle | `device-desktop.svg` | DONE |
| PF | Pages Function Router | rectangle | `cloudflare.svg` | DONE |
| WMETA | Worker Boundary | subgraph | `cloudflare.svg` | DONE |
| WFED | Federal Worker | rectangle | `cloudflare.svg` | DONE |
| WSTATE | State Worker | rectangle | `cloudflare.svg` | DONE |
| WOBS | Oversight Worker | rectangle | `cloudflare.svg` | DONE |
| ACK | Signed ACK Packet | rectangle | `key.svg` | DONE |

---

## 4. Verification Results

All 20 diagrams verified via MCP Mermaid Chart cloud renderer and code audit.

| # | Diagram | Syntax Valid | Renders | Icon Coverage | Notes |
|---|---------|-------------|---------|---------------|-------|
| 1 | System Overview | YES | YES | 18/18 | Shapes + colors correct |
| 2 | Node Architecture | YES | YES | 6/6 | Shapes + colors correct |
| 3 | Voter Experience | YES | YES | 7/7 + 1 decision | Shapes + colors correct |
| 4 | Fraud Flag Lifecycle | YES | YES | 8/8 | Shapes + colors correct |
| 5 | Election Day Sequence | YES | YES | N/A | Sequence diagram, no icons |
| 6 | EWP Happy Path | YES | YES | N/A | Sequence diagram, no icons |
| 7 | 4A Ownership Map | YES | YES | 10/10 | Shapes + colors correct |
| 8 | 4B VoteChain Consortium | YES | YES | 8/8 | Shapes + colors correct |
| 9 | 4C EWP Cast-to-Tally | YES | YES | N/A | Sequence diagram, no icons |
| 10 | 4D Full Alignment Map | YES | YES | 19/19 | Shapes + colors correct |
| 11 | pi-lab-topology | YES | YES | 17/17 | All Pi/network icons correct |
| 12 | pi-machine-wiring | YES | YES | 11/11 | Hardware peripheral icons |
| 13 | pi-network-segmentation | YES | YES | 16/16 | VLAN boundary icons |
| 14 | pi-compose-placement | YES | YES | 13/13 | Container placement icons |
| 15 | pi-test-cycle | YES | YES | 12/12 | E2E test flow icons |
| 16 | fraud-state-machine | YES | YES | 10/10 | State transition icons |
| 17 | blind-schnorr-protocol | YES | YES | 9/9 | Crypto ceremony icons |
| 18 | poc-module-graph | YES | YES | 19/19 | Module dependency icons |
| 19 | bb-merkle-tree | YES | YES | 15/15 | Merkle tree structure icons |
| 20 | worker-topology | YES | YES | 8/8 | Cloudflare edge icons |

> **Note:** The MCP cloud renderer validates syntax and renders shapes/colors correctly, but `<img>` SVG tags appear as empty boxes (cloud service cannot fetch local file paths). SVG icons render correctly on the Astro site with `securityLevel: 'loose'`.

---

## 5. SVG Icon Library

28 SVG icons at `public/votechain/evidence/icons/`. All are 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"` — consistent Tabler/Lucide style.

### Original Icons (13)

| Icon | Description |
|------|-------------|
| `router.svg` | Network router/boundary |
| `raspberry-pi.svg` | Raspberry Pi hardware |
| `database.svg` | Data store / ledger |
| `server.svg` | Server infrastructure |
| `key.svg` | Cryptographic key / signing |
| `shield-check.svg` | Security verified |
| `shield-x.svg` | Security failure / tamper |
| `device-desktop.svg` | Display / desktop client |
| `transfer.svg` | Data transfer / routing |
| `scan.svg` | Import scanner |
| `printer.svg` | Receipt printer |
| `qrcode.svg` | QR code scanner |
| `cloudflare.svg` | Cloudflare Workers edge |

### Created Icons (15)

| Icon | Description |
|------|-------------|
| `building.svg` | Government / Election Authority |
| `vote.svg` | Voter / ballot action |
| `scale.svg` | Oversight / justice |
| `id-card.svg` | Identity verification |
| `lock.svg` | Verification protocol / ZK proof |
| `alert-triangle.svg` | Warning / fraud check |
| `handshake.svg` | Consensus / agreement |
| `circle-check.svg` | Verified / success outcome |
| `alert-octagon.svg` | High-severity alert |
| `eye.svg` | Monitor / observer |
| `radio.svg` | Read API / broadcast |
| `clipboard.svg` | Bulletin board / public record |
| `search.svg` | Investigation |
| `refresh-cw.svg` | Recovery service |
| `bar-chart.svg` | Tally / statistics |

---

## 6. Technical Notes

### Why SVG `<img>` tags instead of Unicode emoji or Font Awesome

- **Unicode emoji** were initially tested but render inconsistently across Mermaid renderers — some strip them, others display platform-specific glyphs that break visual consistency.
- **Font Awesome** (`fa:fa-*` prefix) was tested but icons don't render as glyphs — the prefix is silently stripped in most renderers.
- **Mermaid v11 icon shapes** (`@{ shape: icon }`) are not supported by the current rendering environment.
- **Mermaid architecture-beta** diagram type has native icon support but is too limited for the complex layouts needed.
- **SVG `<img>` tags** render correctly with Mermaid's `securityLevel: 'loose'` setting, providing consistent, high-quality domain icons that work in the Astro site.

### Icon rendering requirements

- Mermaid must be configured with `securityLevel: 'loose'` to allow HTML `<img>` tags in node labels
- This is set in `MermaidClient.astro` component
- Icons are served from `public/votechain/evidence/icons/` as static assets
- Pattern: `<img src='/votechain/evidence/icons/NAME.svg' width='14' height='14'/>`

### Rendering tool

All diagrams are validated and rendered via the `mcp__claude_ai_Mermaid_Chart__validate_and_render_mermaid_diagram` MCP tool, which uses the Mermaid Chart cloud rendering service.
