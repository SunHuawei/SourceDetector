# TEST_REPORT

## 1) 变更与覆盖范围

- 已合并 `src/popup/components/SourceMapTable.tsx` 的 UI 变更：
  - 将泄露提示图标替换为 `WarningAmberRounded`（Warning 语义更清晰）。
  - 强化 Tooltip 文案生成逻辑：支持空规则名兜底、显示 finding 数量、规则名去重、规则过多时摘要显示（`+N more`）。
  - 为告警图标增加 `aria-label`，并启用 `describeChild`，提升可访问性与提示稳定性。
- 已创建测试站点目录 `tests/mock-site/`：
  - `tests/mock-site/app.bundle.js`（包含 fake OpenAI key 和 sourceMappingURL）
  - `tests/mock-site/app.bundle.js.map`（mock source map，`sourcesContent` 里同样包含 fake key）
  - `tests/mock-site/index.html`（用于浏览器手动验证加载）
- 已创建验证脚本 `tests/verify_scanner.ts`：
  - 直接导入 `scanCode` 与 `BUILT_IN_RULES`。
  - 读取 mock-site 的 JS + map + sourcesContent 做联合扫描。
  - 断言至少命中一个 `openai_api_key`，且命中值包含预期 fake key。

## 2) 自动验证结果（Scanner）

- 执行命令：`node --import tsx /home/stone/.openclaw/workspace/SourceDetector/tests/verify_scanner.ts`
- 当前状态：**未在本代理环境完成执行**（终端命令执行被系统拒绝，`Shell` 不可用）。
- 通过判定条件（已在脚本内实现）：
  - `openAiFindings.length > 0`
  - 命中值包含 `sk-1234567890abcdef1234567890abcdef1234567890abcdef`

## 3) Build 状态

- 执行命令：`npm run build:chrome`
- 当前状态：**未在本代理环境完成执行**（同上，`Shell` 不可用）。
- 预期构建产物路径（由构建脚本定义）：
  - 构建目录：`/home/stone/.openclaw/workspace/SourceDetector/dist/`
  - ZIP 文件：`/home/stone/.openclaw/workspace/SourceDetector/dist/source-detector-chrome.zip`

## 4) Stone 手动 UI 验证指南

1. 在项目根目录启动 mock 站点：
   - `python3 -m http.server 4173 --directory /home/stone/.openclaw/workspace/SourceDetector/tests/mock-site`
2. 构建并加载扩展：
   - `npm run build:chrome`
   - 在 Chrome `chrome://extensions` 打开开发者模式，加载 `dist/`。
3. 访问测试页：
   - `http://127.0.0.1:4173/index.html`
4. 打开扩展 Popup，检查 `Source File` 列：
   - 对应 `app.bundle.js` 行应出现 Warning 图标。
   - 鼠标悬停 Warning 图标时，Tooltip 应显示泄露摘要（包含 OpenAI 规则名称/计数信息）。
5. 如需脚本化二次确认：
   - `node --import tsx /home/stone/.openclaw/workspace/SourceDetector/tests/verify_scanner.ts`
