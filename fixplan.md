# 项目优化修复计划

## 检查结果

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 项目结构 | 通过 | Astro 静态站点结构清晰，页面、布局、组件、内容数据分层基本合理。 |
| 构建 | 通过 | `npm run build` 成功，生成 147 个页面，Pagefind 索引成功。 |
| 类型检查 | 未通过 | `npm run check` 报 58 个错误，主要集中在 Astro 内联脚本和 content schema。 |
| 内容集合配置 | 需修复 | `daily` collection 未显式定义，Astro 提示自动生成集合已废弃。 |
| 内容 schema | 需修复 | `BlogPost.astro` 使用了 `post.data.column`，但 schema 未声明 `column`。 |
| 前端安全 | 需优化 | Memos、Poetry、BookWall、MovieWall 多处使用 `innerHTML` 拼接内容。 |
| 外部 API 依赖 | 需优化 | 首页构建时请求 Memos API，网络不稳定会影响首页内容完整性。 |
| 构建脚本 | 可优化 | `build` 脚本依赖 shell 命令和 `npx`，可维护性一般。 |
| 代码复用 | 可优化 | 多个页面重复 `getCollection("blog")`、过滤 draft、按日期排序逻辑。 |

## 主要问题

1. `npm run check` 不通过。

   当前构建可以成功，但类型检查失败说明代码里存在真实的不一致。典型问题是 `src/content.config.ts` 没有声明 `column`，但 `src/layouts/BlogPost.astro` 在读取 `post.data.column`。

2. `daily` 内容集合未显式定义。

   Astro 当前会自动生成 `src/content/daily` 对应的 collection，但这个行为已被标记为 deprecated，后续版本可能移除。

3. 远程内容存在 HTML 注入风险。

   `src/pages/memos.astro` 和 `src/pages/poetry.astro` 会把远程 Markdown 渲染成 HTML 后直接插入页面。`BookWall.astro` 和 `MovieWall.astro` 的加载更多逻辑也使用模板字符串拼接 HTML。

4. 首页内容依赖构建时外部 API。

   `src/pages/index.astro` 在构建时请求 Memos API。虽然失败时会降级为空列表，但首页内容会受网络状态影响。

5. 内容查询和排序逻辑重复。

   首页、归档、分类、标签、文章详情页都重复了获取已发布文章和按日期倒序排序的逻辑。

## 修复建议

### 1. 修复类型检查

- 在 `src/content.config.ts` 中补齐 `column` 字段。
- 显式定义 `daily` collection。
- 根据现有 `src/content/daily` frontmatter 添加 `date`、`private`、`tags` 等字段。
- 修复 Astro 内联脚本中的空值判断、隐式 `any`、全局 `marked` 类型问题。
- 清理未使用变量，例如 `USERNAME`、未使用的 `index`、未使用的 `baseUrl`。

验收标准：

- `npm run check` 通过。
- `npm run build` 继续通过。

### 2. 收敛 HTML 注入风险

- Memos 和 Poetry 如果继续支持 Markdown，建议引入 DOMPurify 或等价 HTML sanitizer。
- 对图书和电影加载更多逻辑，优先使用 `createElement`、`textContent`、`setAttribute` 构建 DOM。
- 避免将标题、简介、备注、URL 等数据直接插入模板字符串。

验收标准：

- 远程内容和 JSON 内容不会未经净化直接进入 `innerHTML`。
- Memos、Poetry、BookWall、MovieWall 的加载和交互行为保持一致。

### 3. 降低首页对远程 API 的依赖

- 将首页“日常”改为读取本地 `daily` collection。
- 保留 Memos API 作为同步来源，由同步脚本写入 `src/content/daily`。
- 首页日常数量也改为本地 collection 统计。

验收标准：

- 首页构建不依赖 `https://memos.syaoran.me`。
- 断网时 `npm run build` 仍能生成完整首页内容。

### 4. 抽取公共内容工具

- 新增 `src/lib/posts.ts` 或类似模块。
- 集中提供以下能力：
  - `getPostDate(post)`
  - `sortByDateDesc(posts)`
  - `getPublishedPosts()`
  - `getPostsByCategory(category)`
  - `getPostsByTag(tag)`
- 用公共工具替换首页、归档、分类、标签、文章详情页中的重复逻辑。

验收标准：

- 重复排序和 draft 过滤逻辑集中维护。
- 页面输出不发生非预期变化。

### 5. 优化构建脚本

- 将 `package.json` 中较长的 `build` 命令拆分为更明确的脚本。
- 可考虑增加：
  - `clean:pagefind`
  - `build:astro`
  - `build:pagefind`
  - `copy:pagefind`
- 如需更强跨平台能力，可改为 Node 脚本处理删除和复制。

验收标准：

- `npm run build` 行为不变。
- 构建步骤更容易单独调试。

## 分阶段修复计划

### 第一阶段：质量门禁

目标：让 `npm run check` 通过。

任务：

- [x] 补齐 `src/content.config.ts` 的 `column` 字段。
- [x] 显式定义 `daily` collection。
- [x] 修复 `src/layouts/BlogPost.astro` 的 schema 不一致问题。
- [x] 修复 `src/pages/memos.astro` 的空值、隐式类型和 `marked` 类型问题。
- [x] 修复 `src/pages/poetry.astro` 的空值、隐式类型和 `marked` 类型问题。
- [x] 修复 `BookWall.astro`、`MovieWall.astro` 的隐式 `any`。
- [x] 清理未使用变量和 Astro inline script 提示。
- [x] 运行 `npm run check`。
- [x] 运行 `npm run build`。

### 第二阶段：安全修复

目标：消除远程内容和动态数据直接注入 HTML 的风险。

任务：

- [x] 为 Memos Markdown 渲染增加 HTML 净化。
- [x] 为 Poetry Markdown 渲染增加 HTML 净化。
- [x] 改造 BookWall 加载更多逻辑，避免模板字符串拼接数据内容。
- [x] 改造 MovieWall 加载更多逻辑，避免模板字符串拼接数据内容。
- [x] 验证 Memos、Poetry、BookWall、MovieWall 页面构建。

### 第三阶段：数据稳定性

目标：首页不依赖构建时远程 API。

任务：

- [x] 梳理 `src/content/daily` 文件格式。
- [x] 将首页最近日常改为读取本地 `daily` collection。
- [x] 将首页日常数量改为本地统计。
- [ ] 确认同步脚本可以作为远程 Memos 到本地 Markdown 的导入流程。
- [ ] 断网或屏蔽 Memos API 后验证 `npm run build`。

### 第四阶段：维护性优化

目标：减少重复代码，降低后续修改成本。

任务：

- [x] 新增公共文章工具模块。
- [x] 替换首页文章查询逻辑。
- [x] 替换归档页文章查询逻辑。
- [x] 替换分类页文章查询逻辑。
- [x] 替换标签页文章查询逻辑。
- [x] 替换文章详情页上一篇/下一篇查询逻辑。
- [x] 拆分或脚本化 `package.json` 的构建命令。
- [x] 运行 `npm run check`。
- [x] 运行 `npm run build`。

## 建议执行顺序

1. 第一阶段：质量门禁。
2. 第二阶段：安全修复。
3. 第三阶段：数据稳定性。
4. 第四阶段：维护性优化。

优先修复 `npm run check`，因为它能作为后续改动的基础质量门禁，帮助及时发现回归。
