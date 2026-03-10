# Source Detector

[English](./README.md) | [简体中文](./README.zh-CN.md) | 日本語

Source Detector は、source map の発見、クライアントサイド資産の収集、Web 資産内の潜在的なシークレット漏えい検出を行う Chrome 拡張です。

- インストール: [Chrome Web Store](https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn)
- サイト: [English Home](https://sunhuawei.github.io/SourceDetector/) · [简体中文](https://sunhuawei.github.io/SourceDetector/zh/) · [日本語](https://sunhuawei.github.io/SourceDetector/ja/)
- プライバシーポリシー: [オンライン版](https://sunhuawei.github.io/SourceDetector/privacy/) · [リポジトリ版](./PRIVACY.md)
- フィードバック: [GitHub Issues](https://github.com/SunHuawei/SourceDetector/issues)
- ドキュメント: [Pages ガイド](./docs/README.md) · [成長ロードマップ](./docs/roadmap.md)
- 変更履歴: [CHANGELOG](./CHANGELOG.md)
- FAQ: [オンライン FAQ](https://sunhuawei.github.io/SourceDetector/faq.md) · [リポジトリ版](./docs/faq.md)
- スクリーンショット/動画計画: [docs/assets/README.md](./docs/assets/README.md)

## 主な機能

- 閲覧中ページの source map を自動検出
- 内蔵ルールとカスタムルールによる API Key / AI Key などの漏えい候補検出
- ポップアップでリスク概要を表示し、証拠を詳細確認可能
- Source Explorer でドメイン、ページ、バージョン、コード証拠を一元表示
- 単一バージョン ZIP / ドメイン単位 ZIP のエクスポート対応
- 設定ページで内蔵ルールとカスタムルールを管理可能

## 想定ユーザー

- セキュリティリサーチャー
- バグバウンティハンター
- フロントエンドエンジニア
- クライアントサイド露出を監査したい開発者

## 仕組み

1. Chrome で対象サイトを開きます。
2. Source Detector が関連資産と source map 参照を検出します。
3. 取得結果はローカル端末に保存されます。
4. 内蔵ルールやカスタムルールで危険なパターンをスキャンします。
5. ポップアップや Explorer で証拠を確認し、必要に応じてエクスポートできます。

## プライバシーと権限

Source Detector はローカルファースト設計です。

- 収集データと設定はローカル保存
- アカウント不要
- コア機能にリモートバックエンド不要
- 権限は source map 検出、ローカル保存、分析ワークフローに限定して使用

詳細はこちら：
- [Privacy Policy](https://sunhuawei.github.io/SourceDetector/privacy/)

## インストール

### Chrome Web Store

- https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn

### ローカル開発

```bash
npm run dev:chrome
```

その後 Chrome で：
- `chrome://extensions` を開く
- **Developer mode** を有効化
- **Load unpacked** をクリック
- `dist/chrome` を選択

## ビルド

```bash
npm run build:chrome
```

成果物：
- `dist/chrome`
- `dist/source-detector-chrome.zip`

## フィードバック

- English Home：https://sunhuawei.github.io/SourceDetector/
- 简体中文：https://sunhuawei.github.io/SourceDetector/zh/
- 日本語：https://sunhuawei.github.io/SourceDetector/ja/
- GitHub Issues：https://github.com/SunHuawei/SourceDetector/issues

## License

MIT
