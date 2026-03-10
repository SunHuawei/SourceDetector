# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Added `docs/robots.txt` and `docs/sitemap.xml` for crawl/index baseline on GitHub Pages.
- Added `docs/404.html` with links back to home, language entries, docs, and FAQ.
- Added GitHub issue forms: bug report, feature request, and issue config routing.
- Added `docs/faq.md` (English FAQ) and `docs/assets/README.md` (screenshot/video asset plan).

### Changed

- Added consistent `Docs` and `FAQ` links on English, Chinese, and Japanese landing pages.
- Added `CHANGELOG` / `FAQ` / `screenshot-plan` entries in multilingual README files.
- Updated privacy page metadata with canonical and hreflang tags, and refined wording for verifiable privacy statements.

## [2026-03-10] - Pages and multilingual baseline documented

### Added (documented existing baseline)

- GitHub Pages site structure in `docs/` with:
  - English home (`/`)
  - Chinese page (`/zh/`)
  - Japanese page (`/ja/`)
  - Privacy page (`/privacy/`)
- Documentation pages for Pages maintenance and growth roadmap:
  - `docs/README.md`
  - `docs/roadmap.md`

### Workflow (documented existing baseline)

- GitHub Pages deployment workflow: `.github/workflows/pages.yml`.
- Release packaging workflow: `.github/workflows/release.yml`.
