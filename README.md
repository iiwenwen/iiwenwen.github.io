# New Blog

基于 Astro 和 Markdown 的个人静态博客，适合部署到 GitHub Pages。

## 本地开发

```bash
npm install
npm run dev
```

## 写文章

在 `src/content/blog/` 下新增 Markdown 文件：

```md
---
title: "文章标题"
description: "文章摘要"
pubDate: 2026-05-02
category: article
column: "专栏名称"
tags: ["notes"]
draft: false
---

正文内容。
```

`draft: true` 的文章不会出现在生产构建中。

`category` 支持 `article`、`daily`、`book`、`movie`，分别对应文章、日常、图书、电影。`column` 用于文章专栏，可省略。

## 构建

```bash
npm run build
npm run preview
```

## GitHub Pages 部署

仓库推送到 GitHub 后，在仓库设置中将 Pages 来源设置为 `GitHub Actions`。`.github/workflows/deploy.yml` 会在 `main` 分支推送后自动构建并发布。

如需设置站点绝对地址，可在 GitHub Actions 仓库变量中添加 `SITE_URL`，例如：

```text
https://username.github.io/repository
```
