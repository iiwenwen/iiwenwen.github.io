import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export function getPostDate(post: BlogPost) {
  return post.data.pubDate ?? post.data.date ?? new Date(0);
}

export function isPublishedPost(post: BlogPost) {
  return import.meta.env.DEV || !post.data.draft;
}

export function sortPostsByDateDesc<T extends BlogPost>(posts: T[]) {
  return [...posts].sort((a, b) => getPostDate(b).valueOf() - getPostDate(a).valueOf());
}

export async function getPublishedPosts() {
  const posts = await getCollection("blog");
  return sortPostsByDateDesc(posts.filter(isPublishedPost));
}

export async function getPostsByCategory(category: string) {
  return (await getPublishedPosts()).filter((post) => post.data.category === category);
}

export async function getPostsByTag(tag: string) {
  return (await getPublishedPosts()).filter((post) => post.data.tags.includes(tag));
}

export async function getPostsByColumn(column: string) {
  return (await getPublishedPosts()).filter((post) => post.data.categories.includes(column));
}
