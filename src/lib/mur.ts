import { getCollection, type CollectionEntry } from "astro:content";

export type MurEntry = CollectionEntry<"mur">;

export function getMurDate(entry: MurEntry) {
  return entry.data.pubDate;
}

export function getMurTitle(entry: MurEntry) {
  return entry.data.title;
}

export function getMurExcerpt(entry: MurEntry, maxLength = 80) {
  const source = entry.data.description ?? entry.body;
  const text = source
    .replace(/^#\s+.+$/m, "")
    .replace(/[#*~>`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function isPublishedMurEntry(entry: MurEntry) {
  return import.meta.env.DEV || !entry.data.draft;
}

export function sortMurByDateDesc<T extends MurEntry>(entries: T[]) {
  return [...entries].sort((a, b) => getMurDate(b).valueOf() - getMurDate(a).valueOf());
}

export async function getPublishedMurEntries() {
  const entries = await getCollection("mur");
  return sortMurByDateDesc(entries.filter(isPublishedMurEntry));
}
