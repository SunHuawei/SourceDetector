# Source Detector FAQ (English)

This FAQ covers common questions about privacy, permissions, leak detection, export, and feedback.

## 1) Does Source Detector upload website data to a remote backend?

Source Detector is designed for a local-first workflow. Core analysis and storage are intended to run on your device, and no account is required for core usage.

For the latest implementation details and policy wording, see:
- [Privacy Policy](https://sunhuawei.github.io/SourceDetector/privacy/)
- [Repository](https://github.com/SunHuawei/SourceDetector)

## 2) Why does the extension request these permissions?

Permissions are used for specific extension workflows:
- `storage`: store settings and collected artifacts locally.
- `webRequest`: detect source map references and related network signals.
- host permissions: access target assets for analysis that you initiate in browser context.

See policy details:
- [Privacy Policy](https://sunhuawei.github.io/SourceDetector/privacy/)

## 3) Can Source Detector prove that a key is leaked?

No. It helps surface potentially risky patterns (for example API/AI key-like strings) using rules and evidence views. Findings should be validated manually before any disclosure or remediation decision.

## 4) What can I export?

You can export collected artifacts as ZIP bundles (for selected versions or domain-level batches), then review offline or attach evidence to internal reports.

## 5) How should I report bugs or request features?

Use GitHub Issues:
- [Bug report form](https://github.com/SunHuawei/SourceDetector/issues/new?template=bug_report.yml)
- [Feature request form](https://github.com/SunHuawei/SourceDetector/issues/new?template=feature_request.yml)

For general discussion:
- [GitHub Discussions](https://github.com/SunHuawei/SourceDetector/discussions)

## 6) Is Source Detector a replacement for a full security assessment?

No. It is a focused client-side analysis and evidence collection tool. Treat its output as input to a broader review process, not a complete security guarantee.
