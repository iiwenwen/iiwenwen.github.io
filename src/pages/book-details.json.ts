import type { APIRoute } from "astro";
import booksData from "../data/books.json";
import { formatDate } from "../lib/date";

function previewText(value?: string, limit = 420) {
  if (!value) return "";
  const normalized = value.replace(/\r/g, "").replace(/\n-{3,}\n/g, "\n").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized;
}

export const GET: APIRoute = () => {
  const details = Object.fromEntries(booksData.map((item) => {
    const key = item.douban_id ?? item.isbn ?? item.url ?? item.title;
    const rating = Math.min(5, Math.max(0, Math.round(item.rating ?? 0)));

    return [key, {
      title: item.title,
      author: item.author ?? "",
      publisher: item.publisher ?? "",
      publishedAt: formatDate(item.date),
      pages: item.pages ?? "",
      isbn: item.isbn ?? "",
      rating,
      remark: previewText(item.remark, 220),
      summary: previewText(item.summary)
    }];
  }));

  return new Response(JSON.stringify(details), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400"
    }
  });
};
