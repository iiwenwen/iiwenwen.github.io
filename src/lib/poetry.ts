import { getCollection, type CollectionEntry } from "astro:content";

export type PoetryEntry = CollectionEntry<"poetry">;

export const POETRY_PAGE_SIZE = 12;

export function isPublishedPoetry(entry: PoetryEntry) {
  return import.meta.env.DEV || !entry.data.draft;
}

export function sortPoetryByDateDesc<T extends PoetryEntry>(entries: T[]) {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedPoetry() {
  const entries = await getCollection("poetry");
  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (!isPublishedPoetry(entry)) return false;
    const key = `${entry.data.date.toISOString()}\n${entry.data.title}\n${entry.body.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return sortPoetryByDateDesc(uniqueEntries);
}

export function hasPoetryAudio(entry: PoetryEntry) {
  return Boolean(entry.data.audioUrl);
}

export function poetryHasTag(entry: PoetryEntry, tag: string) {
  if (tag === "诗歌") return entry.data.kind === "poem";
  if (tag === "俳句") return entry.data.kind === "haiku";
  if (tag === "朗读") return hasPoetryAudio(entry);
  return false;
}

export function getPoetryTagCounts(entries: PoetryEntry[]) {
  return [
    { tag: "诗歌", count: entries.filter((entry) => entry.data.kind === "poem").length },
    { tag: "俳句", count: entries.filter((entry) => entry.data.kind === "haiku").length },
    { tag: "朗读", count: entries.filter(hasPoetryAudio).length }
  ];
}

export function getPoetryTagHref(baseUrl: string, tag: string, page = 1) {
  const tagBase = `${baseUrl}poetry/tags/${encodeURIComponent(tag)}/`;
  return page <= 1 ? tagBase : `${tagBase}page/${page}/`;
}

export function getPoetryPageHref(baseUrl: string, page: number, tag?: string) {
  if (tag) return getPoetryTagHref(baseUrl, tag, page);
  return page <= 1 ? `${baseUrl}poetry/` : `${baseUrl}poetry/page/${page}/`;
}
