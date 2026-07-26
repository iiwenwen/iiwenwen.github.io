import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"posts">;

function cleanMarkdown(value: string) {
  return value
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPostExcerpt(post: BlogPost, limit = 150) {
  const explicit = post.data.description?.trim();
  if (explicit) return explicit;

  const text = cleanMarkdown(post.body ?? "");
  if (!text) return post.data.title;
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

export function getPostDate(post: BlogPost) {
  return post.data.pubDate ?? post.data.date ?? new Date(0);
}

export function getPostFileSlug(post: BlogPost) {
  const sourcePath = post.filePath ?? post.id;
  const fileName = sourcePath.split("/").pop() ?? sourcePath;
  return fileName.replace(/\.(md|mdx)$/i, "");
}

export function isPublishedPost(post: BlogPost) {
  return import.meta.env.DEV || !post.data.draft;
}

export function sortPostsByDateDesc<T extends BlogPost>(posts: T[]) {
  return [...posts].sort((a, b) => getPostDate(b).valueOf() - getPostDate(a).valueOf());
}

export async function getPublishedPosts() {
  const allPosts = await getCollection("posts");
  return sortPostsByDateDesc(allPosts.filter(isPublishedPost));
}

export async function getPostsByCategory(category: string) {
  return (await getPublishedPosts()).filter((post) => post.data.category === category);
}

export async function getPostsByTag(tag: string) {
  return (await getPublishedPosts()).filter((post) => post.data.tags.includes(tag));
}

export async function getPostsByColumn(column: string) {
  return (await getPublishedPosts()).filter((post) =>
    post.data.categories?.includes(column)
  );
}
