# newblog

基于 [Astro](https://astro.build) 的纯静态个人博客，Markdown 写作，构建时渲染，GitHub Pages 部署。

## 功能

- **文章系统**：Markdown + frontmatter，支持分类（article/daily/book/movie）、专栏、标签
- **专栏**：多专栏归类，面包屑导航
- **图书墙**：封面网格展示，豆瓣链接跳转
- **电影墙**：票根式卡片，个人评语 + 五星评分
- **Memos 日常**：自建 Memos 实例数据，Markdown 渲染 + 标签筛选
- **诗歌**：俳句/诗歌双标签，票根卡片 + 背景图
- **全文搜索**：Pagefind 索引，Cmd+K 弹窗
- **草稿系统**：`src/content/drafts/` 独立集合，开发可见，生产排除
- **自动化**：GitHub Actions 定时同步豆瓣数据、下载封面、构建部署

## 目录结构

```
newblog/
├── src/
│   ├── content/blog/      # 文章
│   ├── content/drafts/    # 草稿（git 忽略）
│   ├── pages/             # 页面路由
│   ├── layouts/           # 布局组件
│   ├── components/        # BookWall / MovieWall
│   ├── data/              # books.json / movies.json / site.json
│   └── styles/global.css  # 全局样式
├── public/
│   ├── covers/            # 图书/电影封面
│   ├── poetry/            # 诗歌背景图
│   └── js/search.js       # 搜索逻辑
├── scripts/               # 工具脚本
├── .github/workflows/     # CI/CD
└── log/                   # 迭代记录
```

## 快速开始

```bash
npm install
npm run dev       # 开发服务器
npm run build     # 生产构建
npm run preview   # 预览生产构建
```

## 数据同步

```bash
# Zotero 同步（需 Zotero + Better BibTeX 运行中）
npm run zotero:sync

# 豆瓣同步（需设置 DOUBAN_ID 环境变量）
DOUBAN_ID=你的豆瓣ID npm run douban:sync

# 下载封面
python3 scripts/download_covers.py

# 一键同步
npm run sync
```

## 站点配置

`src/data/site.json`：

```json
{
  "author": "syaoran",
  "tagline": "练习写作，用写作改变自己",
  "quote": "也许多少年后在某个地方..."
}
```

## 添加文章

在 `src/content/blog/` 下创建 `.md` 文件：

```markdown
---
title: 文章标题
pubDate: 2026-05-04
category: article
categories:
  - 专栏名
tags:
  - 标签1
  - 标签2
---

文章正文...
```

## CI/CD

| 工作流 | 触发条件 | 功能 |
|--------|----------|------|
| `deploy.yml` | push main / 手动 | 构建 + 部署到 GitHub Pages |
| `douban-sync.yml` | 每日 3:17 / 手动 | 豆瓣数据同步 |
| `sync-covers.yml` | 每周日 / 手动 | 下载缺失封面 |

需配置 Secrets：`DOUBAN_ID`（Variables）、`DOUBAN_APIKEY`（Secrets）、`PAT`（Secrets）
