import booksData from "../data/books.json";

export type BookItem = (typeof booksData)[number];

const booksById = new Map(booksData.map((book) => [book.douban_id, book]));

export function getBooksByIds(ids: string[]) {
  return ids.flatMap((id) => {
    const book = booksById.get(id);
    if (!book) {
      console.warn(`Unknown book id "${id}". Use a douban_id from src/data/books.json.`);
      return [];
    }
    return [book];
  });
}
