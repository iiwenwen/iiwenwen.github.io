import type { APIRoute } from "astro";
import booksData from "../data/books.json";
import moviesData from "../data/movies.json";
import { getMurDate, getPublishedMurEntries } from "../lib/mur";
import { MEDIA_PAGE_SIZE } from "../lib/media";
import { getPoetryTagCounts, getPublishedPoetry, poetryHasTag, POETRY_PAGE_SIZE } from "../lib/poetry";
import { getPostDate, getPostFileSlug, getPublishedPosts } from "../lib/posts";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date?: Date) {
  return date && date.valueOf() > 0 ? date.toISOString().slice(0, 10) : undefined;
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ?? new URL("https://blog.syaoran.me");
  const [posts, murEntries, poetryEntries] = await Promise.all([
    getPublishedPosts(),
    getPublishedMurEntries(),
    getPublishedPoetry()
  ]);

  const urls = new Map<string, string | undefined>();
  const add = (path: string, lastmod?: Date) => urls.set(path, formatDate(lastmod));

  [
    "/",
    "/archive/",
    "/columns/",
    "/mur/",
    "/poetry/",
    "/categories/article/",
    "/categories/book/",
    "/categories/movie/",
    "/tags/",
    "/works/",
    "/about/"
  ].forEach((path) => add(path));

  posts.forEach((post) => add(`/blog/${getPostFileSlug(post)}/`, post.data.updatedDate ?? getPostDate(post)));
  murEntries.forEach((entry) => add(`/mur/${entry.slug}/`, entry.data.updatedDate ?? getMurDate(entry)));
  poetryEntries.forEach((entry) => add(`/poems/${entry.slug}/`, entry.data.updatedAt ?? entry.data.date));
  const poetryTotalPages = Math.ceil(poetryEntries.length / POETRY_PAGE_SIZE);
  for (let page = 2; page <= poetryTotalPages; page += 1) {
    add(`/poetry/page/${page}/`);
  }
  getPoetryTagCounts(poetryEntries).forEach(({ tag }) => {
    const encodedTag = encodeURIComponent(tag);
    add(`/poetry/tags/${encodedTag}/`);
    const count = poetryEntries.filter((entry) => poetryHasTag(entry, tag)).length;
    const totalPages = Math.ceil(count / POETRY_PAGE_SIZE);
    for (let page = 2; page <= totalPages; page += 1) {
      add(`/poetry/tags/${encodedTag}/page/${page}/`);
    }
  });

  const tags = new Set(posts.flatMap((post) => post.data.tags));
  tags.forEach((tag) => add(`/tags/${encodeURIComponent(tag)}/`));

  const columns = new Set(posts.flatMap((post) => post.data.categories ?? []));
  columns.forEach((column) => add(`/columns/${encodeURIComponent(column)}/`));

  const mediaPages = [
    { category: "book" as const, count: booksData.length },
    { category: "movie" as const, count: moviesData.length }
  ];
  mediaPages.forEach(({ category, count }) => {
    const totalPages = Math.ceil(count / MEDIA_PAGE_SIZE[category]);
    for (let page = 2; page <= totalPages; page += 1) {
      add(`/categories/${category}/page/${page}/`);
    }
  });

  const body = [...urls.entries()]
    .map(([path, lastmod]) => {
      const location = escapeXml(new URL(path.replace(/^\//, ""), siteUrl).href);
      return `  <url>\n    <loc>${location}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`;
    })
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
};
