# Source Detector

Source Detector is a Chrome extension that automatically discovers, stores, and analyzes source maps.

## Features

- Detects source map files on visited pages
- Detects potential API/AI key leakage via built-in + custom rules
- Popup risk summary (hover details + click-through to full evidence)
- **Source Explorer** (three-pane unified view)
  - Domains / pages list
  - Source file versions list
  - Code evidence + leak findings
- Download actions
  - Single selected version ZIP
  - Domain batch ZIP
- Settings page for scanner rule management (built-in toggle + custom regex CRUD)

## Local Development

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

## Automated GitHub Release (GitHub Actions)

This repo includes `.github/workflows/release.yml`.

### Trigger

- Push a semver tag: `v*.*.*` (example: `v1.3.1`)
- Or run manually from **Actions → Release Extension → Run workflow**

### What it does

1. `npm ci`
2. `npm run build:chrome`
3. Verifies `dist/source-detector-chrome.zip`
4. Creates/updates a GitHub Release and uploads the zip artifact

### Release command example

```bash
git tag v1.3.1
git push origin v1.3.1
```

## Feedback

- GitHub issues: https://github.com/SunHuawei/SourceDetector/issues

## License

MIT
