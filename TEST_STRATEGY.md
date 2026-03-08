# Source Detector Test Strategy (Current + Scale-up Plan)

_Last updated: 2026-03-09_

## 1) Why this strategy

Current feature set is still small, so we optimize for **fast iteration + stable confidence**:

- Use **Unit/logic tests as the main safety net**
- Keep **E2E minimal and high-value**
- Explicitly maintain a **manual checklist** for browser/runtime behaviors that are not reliably automatable yet

At the same time, we keep a clear rule: **as feature surface grows, automation ratio must increase**.

---

## 2) Testing split (current baseline)

Target ratio now:

- **Unit + pure logic:** 70%
- **Integration-like logic verification (non-UI):** 20%
- **E2E (Playwright):** 10%

### 2.1 Unit / pure logic (main force)

**Covered now:**
- `src/utils/leakScanner.test.ts`
  - multi-rule detection (OpenAI/AWS/Gemini/Anthropic)
  - false-positive boundaries
  - disabled/invalid rule behavior
  - repeated finding indexing
- `src/pages/desktop/sourceExplorerData.test.ts`
  - domain grouping
  - file version grouping
  - deep-link selection resolution

**Should continue expanding in Unit:**
- source map trailer extraction (`extractSourceMapUrlFromContent`)
- URL/file-type helpers (`isPageUrlCandidate`, `getFileTypeFromUrl`)
- rules storage behavior (`src/storage/rules.ts`)
- DB relation correctness/versioning (`src/storage/database.ts`, via fake-indexeddb-style harness)

### 2.2 Integration-like logic verification

**Covered now:**
- `tests/verify_scanner.ts`
  - scans mock JS + map + `sourcesContent`
  - validates expected OpenAI fake key hit

Purpose: verify real scanner wiring without browser UI flakiness.

### 2.3 E2E (Playwright, minimal but critical)

**Keep only high-value flows:**
1. Core detection happy path: detection signal enters extension → popup shows warning evidence
2. Settings rule toggle flow: disable a built-in rule and verify finding behavior changes
3. Custom rule add flow: add regex rule and verify detection appears

**Current known issue:** local E2E can fail due to browser/extension runtime instability (service worker / localhost routing / webRequest timing). This is expected and should not block feature delivery by itself.

---

## 3) Manual test responsibilities (explicit)

The following are currently manual-first due to runtime variance:

1. **Badge consistency** under tab/window switching
2. **webRequest capture reliability** on real browsing sessions
3. **CRX page parse/download** behavior under real extension-store/CSP contexts
4. **Large bundle UX/perf** (responsiveness, memory pressure)
5. **Cross-page state correctness** (no stale badge/leak carryover)

Manual checklist should be run before release tags.

---

## 4) Scale-up triggers (when to increase automation)

Increase automation investment when **any** trigger is hit:

1. Feature modules become materially larger (scanner + explorer + settings + CRX flows all active in one release)
2. Release cadence targets same-day / rapid hotfix loops
3. Manual regression list exceeds ~20 minutes per release
4. Bugs escape to production from paths that were previously “manual-only”

When triggered, do this in order:

1. Convert repeated manual checks into deterministic Unit/integration tests first
2. Add one E2E only if it validates cross-layer behavior impossible to prove in lower layers
3. Move stable E2E subset to CI gate for release tags

---

## 5) Execution commands

```bash
npm run test:unit
node --import tsx tests/verify_scanner.ts
npm run test:e2e
```

Interpretation:
- `test:unit` + `verify_scanner` are required for day-to-day merge confidence
- `test:e2e` is high-value but currently non-blocking in local unstable environments; use as signal, not single source of truth

---

## 6) Decision log (today)

- We explicitly keep a pragmatic split for current small scope.
- We also set a hard guardrail: **do not keep automation static while product scope grows**.
- Test automation depth is now treated as a scaling lever, not a one-time setup.
