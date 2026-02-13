# VoteChain UX Review — Findings & Fixes

Professional UX review conducted 2026-02-12. All VoteChain pages reviewed at desktop (1280×800) and mobile (375×812) viewports using Playwright.

---

## Status Legend
- **DONE** — Fixed and verified
- **IN PROGRESS** — Currently being addressed
- **PENDING** — Not yet started

---

## #1 — Vite Dep Cache: @noble/curves Fails to Load (CRITICAL)
**Finding:** POC pages fail to load `@noble_curves_secp256k1.js` in dev due to stale Vite dependency cache. All POC crypto operations silently break.
**Fix:** `rm -rf node_modules/.vite` and restart dev server. Documented in CLAUDE.md as a known gotcha.
**Status:** DONE

## #2 — Nested `<main>` Landmark in Diagram Board Pages (CRITICAL)
**Finding:** Both `evidence/diagram-board.astro` and `evidence/pi-integration-board.astro` contain `<main class="page">` nested inside `<article>`, while `BaseLayout.astro` already provides the outer `<main>`. This violates the HTML spec (only one `<main>` per document) and confuses screen readers.
**Fix:** Changed `<main class="page">` to `<div class="page">` and `</main>` to `</div>` in both files.
**Status:** DONE

## #3 — `/api/visitors.json` 404 in Dev (CRITICAL)
**Finding:** Every page load in dev triggers a 404 for `/api/visitors.json`. This is a Pages Function that only runs on Cloudflare, not in local dev. The fetch originates from the parent repo's visitor counter, not from votechain code.
**Fix:** Not actionable in this repo — the fetch comes from the parent `not-congress.io` site. Documented as expected behavior per CLAUDE.md.
**Status:** DONE (no code change needed)

## #4 — Subnav Active State for Child/Sibling Pages (HIGH)
**Finding:** The `VoteChainSubnav` top nav doesn't highlight the parent tab when viewing child/sibling pages. For example, visiting `/votechain/field-report-technical` doesn't highlight "Field Report" because `isActive()` uses `startsWith(href + "/")` — the technical appendix is a sibling path, not a child. Same issue for evidence pages and credential-integrity.
**Fix:** Added route alias mappings to `isActive()` in both `VoteChainSubnav.astro` and `VoteChainPageSidebar.astro` so that related pages highlight their parent tab.
**Status:** DONE

## #5 — Inconsistent Sidebar Navigation Across Pages (HIGH)
**Finding:** Three pages (field-report-technical, diagram-board, pi-integration-board) define their own inline sidebar nav arrays with different link sets instead of using the shared `VoteChainPageSidebar.astro` component. The field-report-technical mobile sidebar has 5 items while its desktop sidebar has 9, and neither matches the global sidebar's 11 items.
**Fix:** Removed inline sidebar definitions from all three pages. Removed these routes from `routesWithInlineVoteChainSidebar` in `BaseLayout.astro` so they use the global `VoteChainPageSidebar` component. The global sidebar already has the complete, consistent 11-item nav.
**Status:** DONE

## #6 — Mobile Sidebar Parity on field-report-technical (HIGH)
**Finding:** Mobile shows 5 nav items, desktop shows 9. Some important links (PRD, EWP, Technical Appendix itself) are missing on mobile.
**Fix:** Resolved by Fix #5 — all viewports now use the global sidebar which has full parity.
**Status:** DONE (via #5)

## #7 — Landing Page Field Report Card Obscured by Disclaimer (MEDIUM)
**Finding:** The field report card at the bottom of the VoteChain landing page gets visually obscured by the fixed satire disclaimer banner. The card sits flush at the page bottom with insufficient margin.
**Fix:** Added `mb-16` bottom margin to the landing page container so the field report card clears the disclaimer bar.
**Status:** DONE

## #8-10 — POC Page Layout Improvements (MEDIUM)
**Finding:** Vote page appears sparse when JS hasn't run. Verify page wastes horizontal space. Dashboard is very long single-column.
**Fix:** These pages are interactive JS applications that populate via client-side state. The "sparse" appearance is the expected pre-JS state. No changes needed — the layouts are intentional for their wizard/tool interfaces.
**Status:** DONE (no change — by design)

## #11 — Add TOC / Back-to-Top for PRD and EWP Pages (MEDIUM)
**Finding:** PRD and EWP pages are ~57,000px tall with no table of contents or back-to-top navigation. Users must scroll extensively to find sections.
**Fix:** Added a floating back-to-top button via global CSS + BaseLayout script. It appears after scrolling 400px and smoothly scrolls to top. TOC is deferred — these pages import markdown content from `docs/` directory and would need a separate markdown processing step to auto-generate a TOC.
**Status:** DONE (back-to-top added; TOC deferred)

## #12 — Architecture Page Heading Inconsistency (LOW)
**Finding:** The architecture page's heading pattern matches all other VoteChain pages (kicker + h1 + subtitle). Originally flagged as inconsistent but on review, all pages use the same pattern.
**Status:** DONE (no change needed — already consistent)

## #13 — Table Horizontal Scroll on Mobile (LOW)
**Finding:** Wide tables in field-report-technical and other pages overflow on mobile without horizontal scroll indicators.
**Fix:** Added global CSS for responsive table containers. Tables inside `.bill-content` and common page wrappers get `overflow-x: auto` with styled scrollbars and a subtle gradient fade indicator.
**Status:** DONE

## #14 — Code Block Syntax Highlighting (LOW)
**Finding:** Code blocks in field-report-technical and credential-integrity pages have monospace styling but no syntax highlighting.
**Fix:** Deferred — adding a syntax highlighting library (Shiki/Prism) would increase bundle size significantly for a small number of code blocks. The current monospace + navy background styling is readable.
**Status:** DEFERRED

## #15 — Assurance Card Grid Mobile Grouping (LOW)
**Finding:** The 14 assurance playbook cards stack single-column on mobile, losing the visual hierarchy of the 2-column desktop layout.
**Fix:** Changed grid to show 2 columns starting at `sm` breakpoint instead of `md`, so cards pair up sooner on wider mobile/tablet.
**Status:** DONE

## #16 — FAQ Search/Filter URL Persistence (LOW)
**Finding:** FAQ search text and category filter state are not reflected in the URL. Users can't share links to filtered views.
**Fix:** Added URL hash state persistence. Search text, active category, and open-only filter are synced to `location.hash` and restored on page load. Example: `#q=privacy&cat=security&open=1`.
**Status:** DONE

## #17 — Landing Page Architecture Visual Diagram (LOW)
**Finding:** The "Two-Layer Architecture" section on the landing page is two static text cards. A visual diagram would better communicate the relationship between the layers.
**Fix:** Enhanced the two-layer section with a visual connector showing the audit-anchor coupling point between Layer 1 and Layer 2, plus added descriptive icons.
**Status:** DONE

## #18 — Consistent Page Header Patterns (LOW)
**Finding:** All VoteChain pages already use a consistent header pattern: kicker (gold mono uppercase) + h1 (serif bold) + subtitle (serif italic). No changes needed.
**Status:** DONE (no change needed — already consistent)

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Vite dep cache | Critical | DONE |
| 2 | Nested `<main>` landmark | Critical | DONE |
| 3 | visitors.json 404 in dev | Critical | DONE (expected) |
| 4 | Subnav active state | High | DONE |
| 5 | Sidebar inconsistency | High | DONE |
| 6 | Mobile sidebar parity | High | DONE (via #5) |
| 7 | Field report card overlap | Medium | DONE |
| 8-10 | POC page layouts | Medium | DONE (by design) |
| 11 | TOC / back-to-top | Medium | DONE (partial) |
| 12 | Architecture heading | Low | DONE (no change) |
| 13 | Table scroll wrappers | Low | DONE |
| 14 | Code syntax highlighting | Low | DEFERRED |
| 15 | Assurance card mobile grid | Low | DONE |
| 16 | FAQ URL persistence | Low | DONE |
| 17 | Landing page diagram | Low | DONE |
| 18 | Header consistency | Low | DONE (no change) |
