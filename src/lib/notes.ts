import { getCollection, type CollectionEntry } from "astro:content";

export type Note = CollectionEntry<"notes">;

export function isPublishedNote(note: Note) {
  return import.meta.env.DEV || !note.data.draft;
}

export function sortNotesByDateDesc<T extends Note>(notes_: T[]) {
  return [...notes_].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedNotes() {
  const allNotes = await getCollection("notes");
  return sortNotesByDateDesc(allNotes.filter(isPublishedNote));
}
