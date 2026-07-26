import { defineCollection, z } from "astro:content";

const category = z.literal("article");
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
  image: z.string().optional(),
  column: z.string().optional(),
  category: category.default("article"),
  tags: tags.default([]),
  books: z.array(z.string()).default([]),
  categories: z.preprocess(
    (v) => (typeof v === "string" ? [v] : v ?? []),
    z.array(z.string()).default([])
  ),
  draft: z.boolean().default(false)
});

const posts = defineCollection({
  type: "content",
  schema: postSchema
});

const drafts = defineCollection({
  type: "content",
  schema: postSchema.partial()
});

const murSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  image: z.string().optional(),
  tags: tags.default([]),
  draft: z.boolean().default(false)
});

const mur = defineCollection({
  type: "content",
  schema: murSchema
});

const poetry = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    kind: z.enum(["haiku", "poem"]),
    date: z.coerce.date(),
    source: z.string().default("memos"),
    sourceId: z.string().optional(),
    sourceUrl: z.string().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    recordedDate: z.coerce.date().optional(),
    audioUrl: z.string().min(1).optional(),
    audioType: z.string().default("audio/mpeg"),
    duration: z.string().optional(),
    tags: tags.default([]),
    draft: z.boolean().default(false)
  })
});

export const collections = { posts, drafts, mur, poetry };
