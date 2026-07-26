import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import siteConfig from "../data/site.json";
import { isPublishedPost, sortPostsByDateDesc, getPostDate, getPostExcerpt, getPostFileSlug } from "../lib/posts";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(context: { site: URL }) {
  const posts = await getCollection("posts");
  const published = sortPostsByDateDesc(posts.filter(isPublishedPost)).slice(0, 20);

  return rss({
    title: siteConfig.author,
    description: siteConfig.description || `${siteConfig.author} 的个人博客`,
    site: context.site,
    items: published.map((post) => {
      const excerpt = getPostExcerpt(post, 240);
      return {
        title: post.data.title,
        description: excerpt,
        link: `/blog/${getPostFileSlug(post)}/`,
        pubDate: getPostDate(post),
        content: `<p>${escapeHtml(excerpt)}</p>`,
        categories: post.data.tags,
      };
    }),
    customData: `<language>zh-CN</language>`,
  });
}
