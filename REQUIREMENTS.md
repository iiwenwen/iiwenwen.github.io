# 个人博客系统需求文档

## 目标

构建一个基于 Markdown 的个人静态博客系统，主要部署到 GitHub Pages。站点应保持轻量、易维护，内容通过 Git 管理，构建后输出纯静态文件。

## 技术要求

- 使用 Astro 生成静态网页。
- 使用 Markdown 管理内容。
- 使用 GitHub Actions 自动构建并部署到 GitHub Pages。
- 支持 GitHub 用户页和项目页部署路径。
- 本地开发命令为 `npm run dev`，生产构建命令为 `npm run build`。

## 视觉要求

- 全站中文正文字体使用霞鹜文楷。
- 页面需兼容桌面端和移动端。
- 风格偏纸质阅读感，突出文字内容。

## 内容分类

所有内容统一放在 `src/content/blog/` 目录下，通过 frontmatter 的 `category` 字段区分：

- `article`：文章
- `daily`：日常
- `book`：图书
- `movie`：电影

## 文章专栏

文章支持额外的 `column` 字段，用于标记所属专栏。该字段主要用于 `category: article` 的内容。

示例：

```md
---
title: "博客初始化"
description: "第一篇 Markdown 文章"
pubDate: 2026-05-02
category: article
column: "建站笔记"
tags: ["blog"]
draft: false
---
```

## 草稿规则

- `draft: true` 的内容在本地开发环境可见。
- `draft: true` 的内容在生产构建中不展示。
