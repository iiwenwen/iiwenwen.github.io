# NewBlog - 认知模型文档

<meta>
  <document-id>newblog-cog</document-id>
  <version>1.0.0</version>
  <project>NewBlog</project>
  <type>Cognitive Model</type>
  <created>2026-05-03</created>
  <depends>real.md</depends>
</meta>

## 文档用途

基于"主体 + 信息 + 上下文"框架，描述 NewBlog 的核心实体及其关系，帮助 AI 理解项目信息架构。

---

## 1. 主体

<agents>

### 1.1 人类主体

<agent type="human" id="A1">
<name>作者（syaoran）</name>
<identifier>博客唯一作者，通过 git 提交（user.name: syaoran）识别</identifier>
<classification>
  <by-role>内容创作者 | 开发者</by-role>
</classification>
<capabilities>撰写 Markdown 文章，编辑 frontmatter，管理 Zotero 书库，配置博客功能</capabilities>
<goals>维护个人博客，记录阅读/观影/思考，保持内容真实和风格一致</goals>
</agent>

### 1.2 AI 主体

<agent type="ai" id="A2">
<name>Claude Code</name>
<identifier>Anthropic Claude，通过 CLI 交互，当前会话上下文</identifier>
<classification>
  <by-mode>开发助手 | 工具脚本编写者</by-mode>
</classification>
<interaction-pattern>接收用户指令 → 探索代码库 → 编辑文件 → 验证构建 → 反馈结果</interaction-pattern>
</agent>

</agents>

---

## 2. 信息

<information>

### 2.1 核心实体

<entity id="E1">
<name>Post（文章）</name>
<unique-code>按文件名 slug 唯一识别，格式 YYYY-MM-DD-slug，路由 /blog/{slug}/</unique-code>
<classification>
  <by-category>article（文章）| daily（日常）| book（图书）| movie（电影）</by-category>
  <by-tag>用户自定义标签，支持字符串或数组</by-tag>
  <by-column>可选，归入某个专栏</by-column>
  <by-status>草稿（draft: true）| 已发布</by-status>
</classification>
<attributes>title, description, pubDate, updatedDate, category, tags, column, draft</attributes>
<relations>一个 Post 可关联一本书（book category）或一部电影（movie category）</relations>
</entity>

<entity id="E2">
<name>Book（图书）</name>
<unique-code>按 ISBN 唯一识别（优先 isbn13），辅以 Zotero key</unique-code>
<classification>
  <by-status>/unread（未读）| /reading（在读）| /done（已读）</by-status>
</classification>
<attributes>title, author, cover, date, publisher, isbn, pages, rating, summary, slug, zotero_key</attributes>
<relations>图书数据来自 Zotero 导出 → convert_zotero.py 转换 → books.json</relations>
</entity>

<entity id="E3">
<name>Movie（电影）</name>
<unique-code>按标题 + 上映日期联合识别</unique-code>
<classification>
  <by-status>/want（想看）| /doing（在看）| /done（已看）</by-status>
</classification>
<attributes>title, director, cover, date, runningTime, rating, summary, slug, zotero_key</attributes>
<relations>电影数据来自 Zotero 导出 → convert_zotero.py 转换 → movies.json</relations>
</entity>

<entity id="E4">
<name>Cover（封面图片）</name>
<unique-code>按书名/电影名 slug 化后的 .webp 文件名识别</unique-code>
<classification>
  <by-source>douban（从豆瓣 API 下载）| manual（手动添加）</by-source>
</classification>
<attributes>文件路径 /covers/{slug}.webp，400px 宽，WebP 格式</attributes>
<relations>每本书/电影对应零或一个封面（cover 字段为空则用占位符）</relations>
</entity>

<entity id="E5">
<name>Draft（草稿）</name>
<unique-code>同 Post，但存放在 src/content/drafts/ 目录，不纳入生产构建</unique-code>
<classification>
  <by-status>草稿（始终，不受 draft frontmatter 控制）</by-status>
</classification>
<attributes>与 Post 相同 schema</attributes>
<relations>草稿可随时移入 src/content/blog/ 发布</relations>
</entity>

</information>

### 2.2 信息流

<information-flow>
<flow id="F1" name="文章发布流程">
  作者 → 写 .md 文件 → 放入 src/content/blog/ → Astro 构建 → 生成 /blog/{slug}/ → 读者访问
</flow>

<flow id="F2" name="Zotero 同步流程">
  Zotero → Better BibTeX Auto-Export → Zotero_books.json + Zotero_movies.json → convert_zotero.py → books.json/movies.json → Astro 构建 → 图书墙/电影墙
</flow>

<flow id="F3" name="封面下载流程">
  books.json ISBN → Douban API → 封面 URL → download_and_convert → /public/covers/{slug}.webp
</flow>

<flow id="F4" name="搜索流程">
  用户输入关键词 → Pagefind 客户端索引 → 返回匹配文章 → 弹窗展示结果
</flow>

</information-flow>

</information>

---

## 3. 上下文

<context>

### 3.1 应用上下文
个人博客，单一作者，纯静态，GitHub Pages 部署。无用户系统、无评论系统、无数据库。

### 3.2 技术上下文
Astro 5 静态模式 → 构建时渲染所有页面。内容集合通过 Zod 验证 frontmatter。搜索通过 Pagefind WASM 客户端索引实现。封面通过脚本离线下载。

### 3.3 用户体验上下文
暖色调纸张风格（cream + dark brown ink），霞鹜文楷中文字体，极简设计。读者可浏览文章/归档/标签/专栏/图书墙/电影墙，支持 Cmd+K 全文搜索。

</context>

---

## 4. 权重矩阵

<weights>
- Post：核心实体，全站围绕文章构建（权重 10）
- Book/Movie：内容辅助实体，通过 JSON 数据渲染独立页面（权重 6）
- Cover：视觉增强，加载失败有占位符兜底（权重 3）
- Draft：开发辅助，不影响生产（权重 2）
</weights>

---

## 5. 验证检查清单

- [ ] 所有 Post 实体有明确的 slug 和 category
- [ ] Book 实体有 ISBN 用于封面下载
- [ ] Movie 实体有标题用于搜索匹配
- [ ] Cover 文件格式为 .webp，路径为 /covers/
- [ ] Draft 未被生产构建包含
