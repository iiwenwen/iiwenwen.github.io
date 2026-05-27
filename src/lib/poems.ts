import { getCollection, type CollectionEntry } from "astro:content";

export type Poem = CollectionEntry<"poems">;

export function getPoemDate(poem: Poem) {
  return poem.data.recordedDate ?? poem.data.pubDate ?? new Date(0);
}

export function isPublishedPoem(poem: Poem) {
  return import.meta.env.DEV || !poem.data.draft;
}

export function sortPoemsByDateDesc<T extends Poem>(poems: T[]) {
  return [...poems].sort((a, b) => getPoemDate(b).valueOf() - getPoemDate(a).valueOf());
}

export async function getPublishedPoems() {
  const poems = await getCollection("poems");
  return sortPoemsByDateDesc(poems.filter(isPublishedPoem));
}
