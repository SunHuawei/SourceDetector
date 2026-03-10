# Source Detector

[English](./README.md) | 简体中文 | [日本語](./README.ja.md)

Source Detector 是一个 Chrome 扩展，用于发现 source map、收集前端客户端资产，并检测 Web 资源中的潜在密钥泄漏风险。

- 安装地址：[Chrome Web Store](https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn)
- 站点页面：[English 首页](https://sunhuawei.github.io/SourceDetector/) · [简体中文](https://sunhuawei.github.io/SourceDetector/zh/) · [日本語](https://sunhuawei.github.io/SourceDetector/ja/)
- 隐私政策：[在线版](https://sunhuawei.github.io/SourceDetector/privacy/) · [仓库文件](./PRIVACY.md)
- 问题反馈：[GitHub Issues](https://github.com/SunHuawei/SourceDetector/issues)
- 站点文档：[Pages 说明](./docs/README.md) · [增长规划](./docs/roadmap.md)

## 功能概览

- 自动发现访问页面中的 source map 文件
- 通过内置规则和自定义规则检测 API Key / AI Key 等潜在泄漏
- 在弹窗中展示风险摘要，并支持查看证据
- 提供 Source Explorer 统一视图，查看域名、页面、版本和代码证据
- 支持导出单个版本 ZIP 或按域名批量导出
- 支持在设置页管理内置规则和自定义规则

## 适合谁用

- 安全研究员
- 漏洞赏金研究者
- 前端工程师
- 需要审计前端暴露面的开发者

## 工作方式

1. 在 Chrome 中访问目标网站
2. Source Detector 监听相关前端资产和 source map 引用
3. 扩展将结果保存在本地设备中
4. 使用内置或自定义规则扫描高风险模式
5. 你可以在弹窗或 Explorer 中查看证据并导出材料

## 隐私与权限

Source Detector 采用本地优先设计：

- 收集结果和设置默认保存在本地
- 不需要账号
- 核心功能不依赖远程后端
- 所申请权限仅用于 source map 发现、本地存储和分析流程

完整隐私政策：
- [Privacy Policy](https://sunhuawei.github.io/SourceDetector/privacy/)

## 安装

### 通过 Chrome 商店安装

- https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn

### 本地开发

```bash
npm run dev:chrome
```

然后在 Chrome 中：
- 打开 `chrome://extensions`
- 开启 **Developer mode**
- 点击 **Load unpacked**
- 选择 `dist/chrome`

## 构建

```bash
npm run build:chrome
```

构建产物：
- `dist/chrome`
- `dist/source-detector-chrome.zip`

## 反馈

- English 首页：https://sunhuawei.github.io/SourceDetector/
- 简体中文页面：https://sunhuawei.github.io/SourceDetector/zh/
- 日本語页面：https://sunhuawei.github.io/SourceDetector/ja/
- 问题反馈：https://github.com/SunHuawei/SourceDetector/issues

## License

MIT
