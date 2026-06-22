import { getCollection, type CollectionEntry } from "astro:content";

export type PoetryEntry = CollectionEntry<"poetry">;

export function isPublishedPoetry(entry: PoetryEntry) {
  return import.meta.env.DEV || !entry.data.draft;
}

export function sortPoetryByDateDesc<T extends PoetryEntry>(entries: T[]) {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedPoetry() {
  const entries = await getCollection("poetry");
  return sortPoetryByDateDesc(entries.filter(isPublishedPoetry));
}
