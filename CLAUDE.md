# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev      # Start dev server (telemetry disabled)
bun run build    # Production build to dist/
bun run preview  # Preview production build locally
bun run check    # Type-check with astro check
```

No test framework is configured.

## Architecture

Pure Astro static site — no JS framework runtime. Content is Markdown in `src/content/`, rendered at build time to static HTML. Small inline scripts are used for search, tab switching, sticky header state, and audio controls.

**Content layer** (`src/content.config.ts`): Collections include `blog`, `drafts`, `daily`, `poems`, and `poetryNotes`. Blog category enum: `article | daily | book | movie`. `tags` accepts string or array and is normalised via `z.preprocess`. `draft: true` hides publishable entries from production builds where helper functions filter by `import.meta.env.DEV`.

**Templates**: Shared layouts plus static and dynamic Astro pages.
- `BaseLayout.astro` — HTML shell, nav, search modal, footer, global CSS
- `BlogPost.astro` — wraps a single post's rendered `<Content />`, reads `post.render()` for MDX/Markdown body
- `pages/index.astro` — home page with category counts, recent posts, daily entries, book wall, and movie wall
- `pages/blog/[slug].astro`, `pages/categories/[category].astro`, `pages/tags/[tag].astro`, `pages/columns/[column].astro`, `pages/poems/[slug].astro` — dynamic routes via `getStaticPaths()`
- `pages/memos.astro`, `pages/memos-v2.astro`, `pages/poetry.astro`, `pages/archive.astro` — generated listing pages

**Styling** (`src/styles/global.css`): Warm paper-like palette (cream background, dark brown ink, rust accent), system Chinese font stack, reusable custom properties at `:root`, and responsive breakpoints.

**Markdown handling** (`astro.config.mjs`): `remark-breaks` preserves single line breaks in Markdown output.

**Deployment** (`.github/workflows/deploy.yml`): GitHub Actions builds on push to `main`, deploys to GitHub Pages. The `base` path in astro.config auto-detects repo name for project pages vs user pages.

## Adding content

Drop a `.md` file in `src/content/blog/` with required frontmatter: `title`, `pubDate`, `category`, `tags`. Optional: `description`, `column`, `draft`.

## 写作工作流

当需要协助写 Markdown 文章、校核文章，并转换为微信公众号 HTML 时，按下面流程执行。

### 1. Markdown 草稿写作

- 工作草稿写在 `src/content/drafts/`。
- 可发布的博客文章放在 `src/content/blog/`。
- 如果草稿后续可能发布到博客，建议保留 Markdown frontmatter。
- 代码块必须尽量显式标注语言，即使只是普通文本也建议使用 `text`：

````markdown
```text
这是代码 test.py
```
````

不要留下未标注语言的围栏代码块，尤其是在文章后续会经过 Markdown lint 工具处理时。

### 2. 文章校核

校核分两层执行：

1. 中文校对使用 `typo-check`
   - 使用 `.claude/skills/typo-check/SKILL.md`。
   - 输出勘误表，包含行号、原文、建议修改、错误类型和说明。
   - 检查错别字、音近字、形近字、的地得、成语、术语、量词、语法和标点。
   - 跳过 YAML frontmatter、URL、HTML 标签、行内代码和围栏代码块。

2. Markdown 格式检查使用 lint
   - lint 只作为格式检查工具，用于检查中英文空格、标点和 Markdown 排版。
   - 可以使用 `42md tools lint --check <file>` 查看问题。
   - 谨慎使用 `42md tools lint <file>` 自动修复；接受修改前必须检查生成的 `_lint.md` diff。
   - 本地已验证的 42md 风险：
     - `......` 可能被错误改成 `。....。`。
     - 未标注语言的围栏代码块中，`test.py` 可能被改成 `test. py`。
     - 未标注语言的围栏代码块可能被从多行合并成一行。
   - 规避方式：代码块显式标注语言，例如 `text`、`bash`、`python`、`js` 等。

推荐顺序：

```bash
42md tools lint --check src/content/drafts/<article>.md
```

然后运行 `typo-check`，人工审阅勘误表。不要盲目接受 lint 自动修复结果。

### 3. 转换为微信公众号 HTML

当用户需要微信公众号发布、微信排版，或 Markdown 转微信公众号 HTML 时，使用 `.claude/skills/md2wechat/SKILL.md`。

执行流程：

1. 按微信公众号发布要求整理 Markdown：
   - 需要时将中文引号统一为直角引号 `「」`。
   - 按 md2wechat 工作流执行 Markdown lint。
   - lint 可能修改文件，执行后必须重新读取 Markdown。
   - 可以少量添加 `**加粗**`，每段最多强调 1-2 个关˙˙键˙˙点。

2. 转换为 HTML：
   - 嵌入 `.claude/skills/md2wechat/assets/wechat.css` 中的 CSS。
   - HTML 输出到 Markdown 同目录，文件名保持一致，仅扩展名改为 `.html`。
   - Markdown 的 `# h1` 不渲染到 HTML 正文中；微信公众号编辑器有独立标题字段。
   - 标题、段落、列表、引用、链接和加粗文本按 md2wechat skill 的规则转换。

3. 发布默认方式：
   - 默认只生成本地 HTML，供复制粘贴到微信公众号编辑器。
   - 只有用户明确要求，并且环境变量可用时，才使用微信公众号 API 发布到草稿箱。

### 4. 发布前最终检查

发送到微信公众号前必须检查：

- 对比最终 Markdown 和生成的 HTML。
- 确认代码块和文件名没有被破坏，例如 `test.py`、`app/main.py`、`debug.log`。
- 确认标点修复没有引入异常文本。
- 确认文章标题、摘要和首屏排版在微信公众号编辑器中正确。
