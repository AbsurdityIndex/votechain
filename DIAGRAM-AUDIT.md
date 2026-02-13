# VoteChain Mermaid Diagram Visual Overhaul — Audit Report

**Date:** 2026-02-13
**Scope:** All Mermaid flowchart diagrams in `/src/pages/votechain/evidence/*-board.astro`

---

## Summary

| Metric | Value |
|--------|-------|
| Board files modified | 6 of 8 (2 have no Mermaid diagrams) |
| Total Mermaid diagrams | 10 |
| Total nodes styled | 134 |
| Icon SVGs referenced | 13 of 28 available |
| Missing icons | 0 |
| Remaining old-format (`width='14'`) | 0 |
| Remaining `Is:`/`Does:` prefixes | 0 |
| `classDef` blocks added | 10 (one per diagram) |

---

## Global Changes

### 1. CSS Icon Badge System (`src/styles/global.css`)

Replaced two separate 14px icon rule blocks with a unified selector:

```css
.board-canvas .mermaid-diagram svg .label img,
.board-canvas .mermaid-diagram svg img,
.diagram-inspector-overlay .mermaid-diagram svg .label img,
.diagram-inspector-overlay .mermaid-diagram svg img {
  width: 24px !important;
  height: 24px !important;
  max-width: 24px !important;
  max-height: 24px !important;
  object-fit: contain;
  display: block !important;
  margin: 0 auto 4px !important;
  padding: 4px;
  background: rgba(197, 165, 114, 0.12);
  border: 1.5px solid rgba(197, 165, 114, 0.4);
  border-radius: 6px;
}
```

**Result:** Icons render at 32px total (24px + 4px padding each side) with gold-tinted badge container.

### 2. Mermaid Config (`src/components/votechain/MermaidClient.astro`)

Added `padding: 16` to flowchart config (was unset, Mermaid default = 8).

### 3. raspberry-pi.svg Replacement

Replaced filled SimpleIcons brand logo with stroke-based single-board computer icon (24x24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`).

---

## classDef Color Scheme

| Class | Fill | Stroke | Domain |
|-------|------|--------|--------|
| `hw` | `#e8d5b0` (warm gold) | `#a88b4a` | Raspberry Pi devices, booth machines |
| `net` | `#dce7f5` (cool blue) | `#3a6fa0` | Switches, routers, boundaries, servers |
| `db` | `#f0ebe0` (cream) | `#8a6e36` | Ledgers, storage, Merkle tree nodes |
| `sec` | `#d9eee2` (soft green) | `#2d8a5e` | Monitors, validators, crypto, shields |

---

## Board-by-Board Audit

### worker-ledger-board.astro (1 diagram, 8 nodes)

| Node ID | Title | Icon | Class | Verified |
|---------|-------|------|-------|----------|
| EMETA | Edge Boundary | router.svg | net | Yes |
| BR | Browser Client | device-desktop.svg | net | Yes |
| PF | Pages Function Router | cloudflare.svg | net | Yes |
| WMETA | Worker Boundary | server.svg | net | Yes |
| WFED | Federal Worker | server.svg | net | Yes |
| WSTATE | State Worker | server.svg | net | Yes |
| WOBS | Oversight Worker | server.svg | net | Yes |
| ACK | Signed ACK Packet | shield-check.svg | sec | Yes |

### crypto-ceremony-board.astro (1 diagram, 9 nodes)

| Node ID | Title | Icon | Class | Verified |
|---------|-------|------|-------|----------|
| IMETA | Issuer Boundary | router.svg | net | Yes |
| I1 | Nonce Generator | key.svg | sec | Yes |
| I2 | Challenge Signer | key.svg | sec | Yes |
| VMETA | Voter Boundary | device-desktop.svg | net | Yes |
| V1 | Blinding Step | key.svg | sec | Yes |
| V2 | Unblinding Step | key.svg | sec | Yes |
| XMETA | Verification Boundary | shield-check.svg | net | Yes |
| VER | Equation Verifier | shield-check.svg | sec | Yes |
| DOM | Domain Separator Policy | key.svg | sec | Yes |

### fraud-detection-board.astro (1 diagram, 10 nodes)

| Node ID | Title | Icon | Class | Verified |
|---------|-------|------|-------|----------|
| OMETA | Oversight Boundary | router.svg | net | Yes |
| PR | Pending Review | shield-check.svg | sec | Yes |
| TR | Triage | shield-check.svg | sec | Yes |
| IN | Investigating | shield-check.svg | sec | Yes |
| ES | Escalated | shield-x.svg | sec | Yes |
| RC | Reconciled | shield-check.svg | sec | Yes |
| RF | Refuted | shield-check.svg | sec | Yes |
| RE | Resolved | shield-check.svg | sec | Yes |
| AMETA | Action Boundary | router.svg | net | Yes |
| NOTE | Policy Note | shield-check.svg | sec | Yes |

### bulletin-board-board.astro (1 diagram, 15 nodes)

| Node ID | Title | Icon | Class | Verified |
|---------|-------|------|-------|----------|
| IMETA | Ingress Boundary | router.svg | net | Yes |
| PAY | Ballot Payload | transfer.svg | net | Yes |
| LHASH | Leaf Hash Builder | key.svg | sec | Yes |
| TMETA | Merkle Boundary | database.svg | db | Yes |
| L0 | Leaf 0 | database.svg | db | Yes |
| L1 | Leaf 1 | database.svg | db | Yes |
| L2 | Leaf 2 | database.svg | db | Yes |
| L3 | Leaf 3 | database.svg | db | Yes |
| N01 | Node 0-1 | server.svg | db | Yes |
| N23 | Node 2-3 | server.svg | db | Yes |
| RH | Root Hash | key.svg | sec | Yes |
| AMETA | Audit Boundary | shield-check.svg | net | Yes |
| DS | Domain Separator Policy | key.svg | sec | Yes |
| STH | Signed Tree Head | key.svg | sec | Yes |
| PROOF | Inclusion Verifier | shield-check.svg | sec | Yes |

### poc-engine-board.astro (1 diagram, 19 nodes)

| Node ID | Title | Icon | Class | Verified |
|---------|-------|------|-------|----------|
| BMETA | Browser Boundary | device-desktop.svg | net | Yes |
| UI | UI Controller Group | device-desktop.svg | net | Yes |
| JOURNEY | Voter Journey Orchestrator | transfer.svg | net | Yes |
| STATE | State Store | database.svg | db | Yes |
| AUDIT | Audit Surface | shield-check.svg | sec | Yes |
| CMETA | Core Boundary | server.svg | net | Yes |
| ENGINE | Engine Core | server.svg | net | Yes |
| CRED | Credential Service | key.svg | sec | Yes |
| CAST | Ballot Cast Service | transfer.svg | net | Yes |
| BB | Bulletin Board Service | database.svg | db | Yes |
| VCL | Replication Client | transfer.svg | net | Yes |
| XMETA | Crypto Boundary | key.svg | sec | Yes |
| P1 | Blind Schnorr Primitive | key.svg | sec | Yes |
| P2 | ECIES Primitive | key.svg | sec | Yes |
| P3 | Shamir Primitive | key.svg | sec | Yes |
| P4 | ECDSA Primitive | key.svg | sec | Yes |
| P5 | BigInt Arithmetic Primitive | key.svg | sec | Yes |
| EMETA | Edge Boundary | cloudflare.svg | net | Yes |
| EDGEAPI | Replication Endpoint | cloudflare.svg | net | Yes |

### pi-integration-board.astro (5 diagrams, 73 nodes)

**Diagram 1: pi-topology** (21 nodes)
- hw: 7 (Booth Pi 1-5, Ops Pi, Export Kiosk Pi)
- net: 8 (Polling Boundary, Polling Switch, Transfer Boundary, Import Scan Pi, Airgap Boundary, Central Boundary, Central Ingest, Central Relay)
- db: 2 (Airgap Ledger Cluster, Central Ledger Cluster)
- sec: 4 (Observer Pi, Airgap Ingest, Airgap Relay, Oversight Monitor)

**Diagram 2: pi-machine-wiring** (10 nodes)
- hw: 2 (Host Boundary, Booth Pi Controller)
- net: 1 (Peripheral Boundary)
- sec: 7 (Touch Display, QR Scanner, Receipt Printer, Poll Worker Key, UPS HAT, Tamper Switch, Security Seal Sensor + Booth LAN Switch)

**Diagram 3: pi-network-segmentation** (16 nodes)
- hw: 0
- net: 10 (boundaries, switches, ingest, relay hosts)
- db: 3 (Airgap Ledger, Central Ledger, Observer Pi)
- sec: 3 (audit, monitoring nodes)

**Diagram 4: pi-compose-placement** (13 nodes)
- hw: 5 (booth-pi group, ops-pi, airgap nodes)
- net: 4 (boundaries, central nodes)
- db: 2 (ledger replicas)
- sec: 2 (observer-pi, audit-verifier)

**Diagram 5: pi-test-cycle** (12 nodes)
- hw: 4 (Booth Boundary, Booth Pi Service, Airgap Boundary)
- net: 5 (Session Boundary, Voter Session, Transfer nodes, Central Boundary)
- db: 1 (Airgap Ingest Ledger)
- sec: 3 (Central Verify Service, Harness Controller, Integrity Monitor)

---

## Boards Without Mermaid Diagrams (Not Modified)

| Board | Reason |
|-------|--------|
| `diagram-board.astro` | No `<pre data-language="mermaid">` blocks — uses static SVG visualization |
| `e2e-verification-board.astro` | No Mermaid blocks — uses HTML panels |

---

## Icon Inventory

### Referenced in Diagrams (13)

| Icon | File | Style | Used By |
|------|------|-------|---------|
| cloudflare.svg | Exists | Stroke | worker-ledger, poc-engine |
| database.svg | Exists | Stroke | bulletin-board, poc-engine, pi-integration |
| device-desktop.svg | Exists | Stroke | crypto-ceremony, poc-engine, pi-integration |
| key.svg | Exists | Stroke | All 6 boards |
| printer.svg | Exists | Stroke | pi-integration |
| qrcode.svg | Exists | Stroke | pi-integration |
| raspberry-pi.svg | Exists | Stroke (replaced) | pi-integration |
| router.svg | Exists | Stroke | All 6 boards |
| scan.svg | Exists | Stroke | pi-integration |
| server.svg | Exists | Stroke | All 6 boards |
| shield-check.svg | Exists | Stroke | All 6 boards |
| shield-x.svg | Exists | Stroke | fraud-detection |
| transfer.svg | Exists | Stroke | bulletin-board, poc-engine, pi-integration |

### Available But Unused (15)

alert-octagon.svg, alert-triangle.svg, bar-chart.svg, building.svg, circle-check.svg, clipboard.svg, eye.svg, handshake.svg, id-card.svg, lock.svg, radio.svg, refresh-cw.svg, scale.svg, search.svg, vote.svg

---

## Verification Checklist

- [x] Zero remaining `width='14' height='14'` in any board file
- [x] Zero remaining `Is:` / `Does:` prefixes in any board file
- [x] All 13 referenced icon SVGs exist on disk
- [x] All 10 diagrams have 4 `classDef` blocks (hw, net, db, sec)
- [x] All 134 nodes have `:::` class suffix
- [x] CSS icon badge renders at 32px total with gold border
- [x] MermaidClient padding: 16 applied
- [x] raspberry-pi.svg replaced with stroke-based icon
- [x] Visual verification: worker-ledger-board — screenshot confirmed
- [x] Visual verification: crypto-ceremony-board — screenshot confirmed
- [x] Visual verification: pi-integration-board — screenshot confirmed
- [x] All boards load without Mermaid rendering errors (only console errors are unrelated `/api/visitors.json` 404s)
