# 工作日志 (Work Log)

## 2026-05-27: 新增 RSS 订阅功能

### 背景
博客缺少 RSS 订阅功能，读者无法通过 RSS 阅读器订阅。v0.2.0 里程碑中计划了此项。

### RCSW 流程

- **Real**: 新增 C5 约束 — RSS 必须提供全文内容，遵循 RSS 2.0 标准，通过 link 标签自动发现
- **Cog**: 新增 F5 信息流 — RSS 订阅流程（构建 → 过滤草稿 → 生成 XML → 部署）
- **Spec**: 生成 `spec-rss-feed.md`，定义技术方案和验收标准
- **Work**: 实现以下变更

### 变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.42cog/real.md` | 修改 | 新增 C5 约束，更新版本号 1.0.0 → 1.1.0 |
| `.42cog/cog.md` | 修改 | 新增 F5 信息流 |
| `.42cog/spec/spec-rss-feed.md` | 新建 | RSS 功能规约 |
| `src/pages/rss.xml.ts` | 新建 | RSS 端点，使用 @astrojs/rss |
| `src/layouts/BaseLayout.astro` | 修改 | 添加 RSS 自动发现 link 标签 |
| `package.json` | 修改 | 新增 @astrojs/rss 依赖 |

### 验证

- [x] `bun run build` 成功
- [x] `/rss.xml` 生成，格式为 RSS 2.0
- [x] feed 包含全文内容（`<content:encoded>`）
- [x] 草稿文章不出现在 feed 中
- [x] 每页 `<head>` 中有 `<link rel="alternate" type="application/rss+xml">`
- [x] 未引入 SSR/API 路由（纯静态生成）
- [ ] W3C Feed Validator 验证（部署后验证）

---

## 2026-05-27: 内容目录重构 — 5 collections 缩减为 4

### 背景
原有 5 个 content collection（blog/daily/drafts/poems/poetryNotes），存在以下问题：
- `blog/` 命名不标准（主流都用 `posts/`）
- `daily/` 独立 collection 仅有 5 个文件，且与 blog 中 `category: daily` 的文章概念重叠
- `drafts/` 和 `draft: true` 字段是双重机制
- `poetryNotes/` 名字太长
- `src/content/blog/` 3 层目录过深

### RCSW 流程

- **Real**: 新增 C6 约束 — 内容目录固定为 4 个：posts/drafts/poems/notes
- **Cog**: 重命名实体，新增 Poem(E6)/Note(E7) 实体，新增 F6 信息流（笔记同步）
- **Work**: 执行以下变更

### 变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 重命名 | `src/content/blog/` → `src/content/posts/` | 对齐主流命名 |
| 重命名 | `src/content/poetryNotes/` → `src/content/notes/` | 简短命名 |
| 删除 | `src/content/daily/` | 合并入 posts/，用 category 区分 |
| 修改 | `src/content.config.ts` | blog→posts, poetryNotes→notes, 移除 daily collection |
| 修改 | `src/lib/posts.ts` | 更新 collection 引用 |
| 重命名 | `src/lib/poetryNotes.ts` → `src/lib/notes.ts` | 更新所有导出名 |
| 修改 | `src/layouts/BlogPost.astro` | CollectionEntry<"blog"> → <"posts"> |
| 修改 | `src/pages/index.astro` | getCollection("daily") → getPostsByCategory("daily") |
| 修改 | `src/pages/rss.xml.ts` | getCollection("blog") → ("posts") |
| 修改 | `src/pages/memos-v2.astro` | 同上，private→draft |
| 修改 | `src/pages/poetry.astro` | import 更新 |
| 修改 | `.42cog/real.md` | 新增 C6 约束，v1.1.0→v1.2.0 |
| 修改 | `.42cog/cog.md` | 更新实体/信息流/权重，v1.0.0→v1.1.0 |
| 迁移 | 5 个 daily/*.md | 移入 posts/，添加 title 和 category: daily 字段 |

### 最终结构

```
src/content/
├── posts/   (94)  ← 89 blog + 5 daily 合并
├── drafts/  (3)   ← 物理隔离 + gitignore
├── poems/   (2)   ← 诗歌 + 音频
└── notes/   (50)  ← Memos 同步诗词笔记
```

### 验证

- [x] `bun run build` 成功
- [x] 4 个子目录，无 daily/
- [x] posts/ 共 94 个文件
- [x] RSS feed 正常（含迁移后的 daily 文章）
- [x] /categories/daily/ 页面正常
- [x] /poetry/ 页面正常
- [x] 私密内容（draft: true）不出现在生产构建

---

## 2026-05-27: 跨平台随记工具 — 去掉 Memos API 依赖

### 背景
- `/memos/` 依赖 Memos API (`memos.syaoran.me`)，API 经常变更导致页面不可用
- 手机发布 Memos 需要 VPN，极大降低写作意愿
- 已有替代基础设施：`/write/` 页面 + GitHub API + 本地 posts/

### RCSW 流程
- **Real**: 新增 C7 约束 — 跨平台随记工具零外部依赖，纯 GitHub API 认证
- **Cog**: 新增 F7 信息流 — 跨平台随记发布流程（浏览器 → GitHub API → posts/ → 部署 → /memos/）
- **Work**: 实现以下变更

### 变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 重写 | `src/pages/memos.astro` | 去掉 Memos API，改为静态渲染本地 posts (category: daily) |
| 重写 | `public/write/index.html` | 修复路径 daily/→posts/，补齐 title + category frontmatter |
| 修复 | `scripts/daily.py` | 路径 + frontmatter 格式更新 |
| 修复 | `scripts/sync-daily.py` | 路径 daily/→posts/ |
| 删除 | `src/pages/memos-v2.astro` | 功能合并进 memos.astro |
| 修正 | 5 篇长文 category: daily→article | 年终总结类文章不应出现在随记中 |
| 修改 | `.42cog/real.md` | 新增 C7 约束，v1.2.0→v1.3.0 |
| 修改 | `.42cog/cog.md` | 新增 F7 信息流 |

### 新架构

```
手机/电脑 → /write/ (浏览器) → GitHub API → src/content/posts/{ts}.md → GitHub Actions → /memos/
命令行   → daily.py (终端)    → 本地文件 → git push → GitHub Actions → /memos/
```

- 零外部 API 依赖（仅 GitHub API，国内可访问）
- 无需 VPN
- 跨平台（任何有浏览器的设备）
- /memos/ 纯静态渲染，构建时生成

### 验证
- [x] `bun run build` 成功
- [x] /memos/ 静态渲染 4 条可见随记，1 条草稿正确过滤
- [x] /write/ 页面生成正常
- [x] daily.py 路径指向 posts/
- [x] 5 篇长文已修正为 category: article
