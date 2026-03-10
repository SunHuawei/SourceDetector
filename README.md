# Source Detector

English | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

Source Detector is a Chrome extension for discovering source maps, collecting client-side artifacts, and detecting potential secret leakage in web assets.

- Install: [Chrome Web Store](https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn)
- Website: [English (Home)](https://sunhuawei.github.io/SourceDetector/) · [简体中文](https://sunhuawei.github.io/SourceDetector/zh/) · [日本語](https://sunhuawei.github.io/SourceDetector/ja/)
- Privacy Policy: [Online](https://sunhuawei.github.io/SourceDetector/privacy/) · [Repo file](./PRIVACY.md)
- Issues: [GitHub Issues](https://github.com/SunHuawei/SourceDetector/issues)
- Docs: [Pages Guide](./docs/README.md) · [Growth Roadmap](./docs/roadmap.md)

## What it does

- Detects source map files on visited pages
- Detects potential API/AI key leakage via built-in and custom rules
- Shows popup risk summaries with drill-down evidence
- Provides a unified Source Explorer for domains, pages, versions, and code evidence
- Supports ZIP export for selected versions or domain batches
- Lets you manage built-in and custom scanner rules from Settings

## Who it is for

- Security researchers
- Bug bounty hunters
- Front-end engineers
- Developers auditing client-side exposure

## How it works

1. Visit a website in Chrome.
2. Source Detector watches relevant client-side assets and source map references.
3. The extension stores findings locally on your device.
4. Built-in and custom rules scan collected assets for risky patterns.
5. You review evidence in the popup / explorer and export artifacts when needed.

## Privacy and permissions

Source Detector is designed to work locally on your device.

- Local-first storage for collected artifacts and settings
- No account required
- No remote backend required for core functionality
- Permissions are used for source map discovery, local storage, and analysis workflows

Read the full policy here:
- [Privacy Policy](https://sunhuawei.github.io/SourceDetector/privacy/)

## Install

### Chrome Web Store

Install here:
- https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn

### Local development

1. Clone the repository
2. Install dependencies
3. Start watch build:

```bash
npm run dev:chrome
```

4. Load extension in Chrome:
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select `dist/chrome`

## Build

```bash
npm run build:chrome
```

Artifacts:

- Unpacked extension: `dist/chrome`
- Packed zip: `dist/source-detector-chrome.zip`

## Automated GitHub Release

This repo includes `.github/workflows/release.yml`.

### Trigger

- Push a semver tag: `v*.*.*` (example: `v1.3.1`)
- Or run manually from **Actions → Release Extension → Run workflow**

### What it does

1. `npm ci`
2. `npm run build:chrome`
3. Verifies `dist/source-detector-chrome.zip`
4. Creates or updates a GitHub Release and uploads the zip artifact

## Feedback

- Website (English home): https://sunhuawei.github.io/SourceDetector/
- Website (简体中文): https://sunhuawei.github.io/SourceDetector/zh/
- Website (日本語): https://sunhuawei.github.io/SourceDetector/ja/
- Issues: https://github.com/SunHuawei/SourceDetector/issues

## License

MIT
