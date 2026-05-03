import { defineCollection, z } from "astro:content";

const category = z.enum(["book", "movie", "daily", "article"]);
const tags = z.preprocess((value) => {
  if (value == null) {
    return [];
  }

  if (typeof value === "string") {
    return value.trim() ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }

  return value;
}, z.array(z.string()));

const postSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  pubDate: z.coerce.date().optional(),
  updatedDate: z.coerce.date().optional(),
  category: category.default("article"),
  column: z.string().optional(),
  tags: tags.default([]),
  categories: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  draft: z.boolean().default(false)
});

const blog = defineCollection({
  type: "content",
  schema: postSchema
});

const drafts = defineCollection({
  type: "content",
  schema: postSchema
});

export const collections = { blog, drafts };
