# NewBlog - 现实约束文档

<meta>
  <document-id>newblog-real</document-id>
  <version>1.0.0</version>
  <project>NewBlog</project>
  <type>Reality Constraints</type>
  <created>2026-05-03</created>
</meta>

## 文档用途

定义 NewBlog 个人博客项目的硬性约束，确保 AI 不会因缺乏领域知识而做出破坏性改动。

<constraints>

## 必需约束

<constraint required="true" id="C1">
<title>内容归作者所有，AI 不得生成或修改文章正文</title>
<description>src/content/blog/ 下的 .md 文件是作者亲自撰写的文章。AI 只可修改元数据（frontmatter、标签、链接修复），不得修改正文内容，不得生成新文章。</description>
<rationale>博客是作者的个人表达，AI 生成的内容会破坏真实性和个人风格。</rationale>
<violation-consequence>文章失去真实性，作者信任崩溃。</violation-consequence>
</constraint>

<constraint required="true" id="C2">
<title>草稿不得出现在生产构建中</title>
<description>draft: true 的文章和 src/content/drafts/ 下的文件仅开发模式可见，生产构建必须排除。模板中的 draft 过滤逻辑（import.meta.env.DEV 检查）不可删除。</description>
<rationale>草稿未完成或未审查，公开发布会损害作者形象。</rationale>
<violation-consequence>未完成文章被公开访问，读者看到半成品内容。</violation-consequence>
</constraint>

<constraint required="true" id="C3">
<title>豆瓣 API 密钥不可提交到仓库</title>
<description>scripts/download_covers.py 中的豆瓣 apikey 硬编码是临时方案，未来需移入环境变量。当前确保该密钥不会在其他文件中泄露。</description>
<rationale>API 密钥泄露会导致配额被盗用或被豆瓣封禁。</rationale>
<violation-consequence>密钥泄露 → 豆瓣封禁 → 封面下载功能不可用。</violation-consequence>
</constraint>

<constraint required="true" id="C4">
<title>静态构建，无服务端运行时</title>
<description>博客是纯静态 HTML 站点，不支持 SSR、API 路由、数据库连接。所有数据必须在构建时确定。搜索通过 Pagefind 客户端索引实现。</description>
<rationale>GitHub Pages 只托管静态文件，不支持服务端代码。</rationale>
<violation-consequence>添加服务端功能会导致生产环境 404 或构建失败。</violation-consequence>
</constraint>

</constraints>

## 技术环境

<environment>
<stack>
- 框架：Astro 5.x，输出模式 static
- 模板：.astro 文件，零 JS 运行时
- 内容：Markdown + Zod frontmatter schema
- 样式：纯 CSS（无 Tailwind），霞鹜文楷中文字体
- 搜索：Pagefind 1.5（构建时索引）
- 部署：GitHub Pages（GitHub Actions）
- 数据：src/data/books.json + movies.json（Zotero 导出 + 转换）
</stack>
</environment>

## 约束检查清单

- [ ] 未修改文章正文内容
- [ ] 草稿过滤逻辑未被删除
- [ ] 豆瓣 apikey 未泄露到其他文件
- [ ] 未引入 SSR/API 路由
