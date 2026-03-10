# SourceDetector GitHub Pages 说明

本目录是 SourceDetector 的 GitHub Pages 静态站点源目录，默认英文首页位于 `docs/index.html`。

## 发布方式

仓库使用 `.github/workflows/pages.yml` 自动部署 Pages：

- 触发条件：`main` 分支 push，或手动触发 workflow
- 发布目录：`docs/`
- 发布动作：`actions/upload-pages-artifact` + `actions/deploy-pages`

### 一次性开启步骤（仓库管理员操作）

1. 进入仓库 `Settings` -> `Pages`
2. 在 `Build and deployment` 选择 **GitHub Actions**
3. 确认仓库 Actions 权限允许部署 Pages（默认工作流已配置 `pages: write`、`id-token: write`）
4. 合并到 `main` 后等待 `Deploy GitHub Pages` workflow 完成
5. 访问：
   - English: `https://sunhuawei.github.io/SourceDetector/`
   - 简体中文: `https://sunhuawei.github.io/SourceDetector/zh/`
   - 日本語: `https://sunhuawei.github.io/SourceDetector/ja/`

## 目录结构

```text
docs/
├── index.html             # 英文首页（默认首页）
├── privacy/
│   └── index.html         # 隐私政策（英文）
├── zh/
│   └── index.html         # 中文页面
├── ja/
│   └── index.html         # 日文页面
├── README.md              # 本文档（发布与维护说明）
└── roadmap.md             # 增长与发现优化规划
```

## 链接关系约定

- English 首页固定为 `docs/index.html`
- 中文页固定为 `docs/zh/index.html`
- 日文页固定为 `docs/ja/index.html`
- 三个页面都必须保留互链（English / 简体中文 / 日本語）
- README 多语言文件应统一指向：
  - 主页：English 根路径
  - 语言页：`/zh/` 与 `/ja/`
  - 隐私页：`/privacy/`

## 后续扩展方式

### 新增语言页面

1. 新建 `docs/<lang>/index.html`
2. 在三语页面中补上语言导航链接
3. 在页面 `<head>` 中更新 `canonical` 与 `hreflang`
4. 更新根目录 `README*.md` 的页面入口链接

### 新增站点内容页

1. 建议使用 `docs/<topic>/index.html` 形式，保持清晰 URL
2. 在首页和对应语言页补入口链接
3. 若为策略文档（如 roadmap），存放在 `docs/*.md` 并在 README 中维护索引

### 发布前自检

- 关键链接可访问（主页、语言页、隐私页、商店、GitHub）
- 三语页面互链正确
- 页面标题与描述已对应语言更新
- workflow 运行成功并生成 Pages URL
