# Source Detector plan: rating, feedback, and Source Explorer code browsing

Date: 2026-03-19

## Scope

This work delivers three user-facing improvements:

1. Add a visible `Rate us` entry that sends users to the Chrome Web Store review surface.
2. Add a clearer `Feedback` entry that guides users to submit product feedback.
3. Upgrade Source Explorer so it can browse real source code:
   - source-map original sources by directory
   - CRX / extension package files by directory
   - file content viewer with lightweight syntax highlighting
   - keep current leak-finding flow intact

## Current gaps

- Popup and Source Explorer currently expose only a small GitHub icon for feedback.
- There is no explicit review / rating CTA.
- Source Explorer supports `source-files` only.
- Source Explorer code viewer mainly shows compiled bundle preview or finding context, not full original-source browsing.

## Architecture changes

### 1. Shared product links

Add constants for:
- GitHub feedback URL
- Chrome Web Store listing URL
- Chrome Web Store review URL

### 2. Source browsing helpers

Add a small helper module for:
- building directory trees from source map `sources` + `sourcesContent`
- building directory trees from parsed CRX zip files
- selecting text-viewable files
- lightweight syntax highlighting metadata / token rendering

This keeps Source Explorer UI simpler and testable.

### 3. Source Explorer expansion

Extend desktop page to support two resource types:
- `source-files`
- `crx-files`

For `source-files`:
- keep domain/page/file navigation
- add a second-level source tree for original sources extracted from source maps
- allow switching between compiled view and original source view
- preserve leak findings and finding-context behavior

For `crx-files`:
- load CRX from background/local cache path already used by popup
- render directory tree + file viewer in Source Explorer
- allow browsing extension package source/content directly

### 4. UX entries

Add visible actions in popup and Source Explorer header area:
- `Rate us`
- `Feedback`

Feedback will continue to route to GitHub Issues for now because that is already the repo-supported intake path.

## Highlighting strategy

Goal is VS Code-like readability, not a full editor clone.

Chosen approach:
- lightweight local tokenizer/highlighter for common text/code files
- line numbers
- dark code-view theme
- minimal token classes for keywords, strings, numbers, comments

Tradeoff:
- much smaller and lower-risk than introducing a heavy editor dependency
- not language-perfect, but maintainable and good enough for browse/review workflows

## Test plan

### Unit tests

Add tests for:
- source tree building from source maps
- CRX tree building from zip-like paths
- source explorer selection for CRX/source flows where applicable
- syntax highlighting / text-file detection helpers where practical
- review URL constants

### Regression validation

Required before push:
- `npm run test:unit`
- `npm run build:chrome`

Optional/non-blocking:
- existing E2E remains informational because repo already documents local extension-runtime flakiness

## TDD phases

1. Add failing tests for source tree building and text/code helper behavior.
2. Implement helpers until unit tests pass.
3. Integrate Source Explorer UI for source-map original-source browsing.
4. Integrate CRX browsing into Source Explorer.
5. Add rating / feedback entries in popup and Source Explorer.
6. Run full validation, inspect diff, commit, push.

## Acceptance criteria

- Users can click `Rate us` from popup and Source Explorer.
- Users can click a clear `Feedback` action from popup and Source Explorer.
- Source Explorer opens for CRX pages and supports directory-based browsing.
- Source Explorer lets users inspect original source-map sources, not just compiled code.
- Code viewer is substantially more readable than plain text preview.
- Existing source-file and leak-finding flows still work.
