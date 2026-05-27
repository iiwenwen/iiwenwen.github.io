import { getCollection, type CollectionEntry } from "astro:content";

export type PoetryNote = CollectionEntry<"poetryNotes">;

export function isPublishedPoetryNote(note: PoetryNote) {
  return import.meta.env.DEV || !note.data.draft;
}

export function sortPoetryNotesByDateDesc<T extends PoetryNote>(notes: T[]) {
  return [...notes].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedPoetryNotes() {
  const notes = await getCollection("poetryNotes");
  return sortPoetryNotesByDateDesc(notes.filter(isPublishedPoetryNote));
}
