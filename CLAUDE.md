# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (telemetry disabled)
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
npm run check    # Type-check with astro check
```

No test framework is configured.

## Architecture

Pure Astro static site — no JS framework, no client-side runtime. Content is Markdown in `src/content/blog/`, rendered at build time to static HTML.

**Content layer** (`src/content.config.ts`): Single `blog` collection with Zod schema. Category enum: `article | daily | book | movie`. `tags` field accepts string or array, normalised via `z.preprocess`. `draft: true` hides posts from production builds (filtered in templates via `import.meta.env.DEV`).

**Templates**: Two layouts and two pages.
- `BaseLayout.astro` — HTML shell, nav, footer, imports LXGW WenKai webfont + global CSS
- `BlogPost.astro` — wraps a single post's rendered `<Content />`, reads `post.render()` for MDX/Markdown body
- `pages/index.astro` — lists all posts grouped by category, with draft filtering
- `pages/blog/[slug].astro` — dynamic route via `getStaticPaths()`, passes entry as `Astro.props`

**Styling** (`src/styles/global.css`): Warm paper-like palette (cream background, dark brown ink, rust accent). LXGW WenKai for body, monospace for metadata. Custom properties at `:root`. Responsive breakpoint at 640px.

**Font handling** (`astro.config.mjs`): Custom Vite plugin replaces `font-display: swap` with `font-display: optional` in LXGW WenKai CSS to prevent layout shift from Chinese web font loading.

**Deployment** (`.github/workflows/deploy.yml`): GitHub Actions builds on push to `main`, deploys to GitHub Pages. The `base` path in astro.config auto-detects repo name for project pages vs user pages.

## Adding content

Drop a `.md` file in `src/content/blog/` with required frontmatter: `title`, `pubDate`, `category`, `tags`. Optional: `description`, `column`, `draft`.
