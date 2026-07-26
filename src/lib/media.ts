export type MediaCategory = "book" | "movie";

export const MEDIA_PAGE_SIZE: Record<MediaCategory, number> = {
  book: 30,
  movie: 40
};

export const MEDIA_LABELS: Record<MediaCategory, { title: string; unit: string }> = {
  book: { title: "图书", unit: "本" },
  movie: { title: "电影", unit: "部" }
};

function mediaDateValue(item: { date?: string }) {
  const match = item.date?.match(/\d{4}(?:-\d{1,2})?(?:-\d{1,2})?/);
  if (!match) return 0;

  const [year = "1970", month = "1", day = "1"] = match[0].split("-");
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export function sortMediaItems<T extends { date?: string }>(items: T[]) {
  return [...items].sort((a, b) => mediaDateValue(b) - mediaDateValue(a));
}

export function getMediaPage<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    items: items.slice(start, start + pageSize)
  };
}

export function getMediaPageHref(baseUrl: string, category: MediaCategory, page: number) {
  return page <= 1
    ? `${baseUrl}categories/${category}/`
    : `${baseUrl}categories/${category}/page/${page}/`;
}
