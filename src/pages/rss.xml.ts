import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import siteConfig from "../data/site.json";
import { isPublishedPost, sortPostsByDateDesc, getPostDate } from "../lib/posts";

export async function GET(context: { site: URL }) {
  const posts = await getCollection("posts");
  const published = sortPostsByDateDesc(posts.filter(isPublishedPost)).slice(0, 20);

  return rss({
    title: siteConfig.author,
    description: siteConfig.description || `${siteConfig.author} 的个人博客`,
    site: context.site,
    items: published.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
      pubDate: getPostDate(post),
      content: post.body ?? "",
      categories: post.data.tags,
    })),
    customData: `<language>zh-CN</language>`,
  });
}
