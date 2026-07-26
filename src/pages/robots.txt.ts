import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site ?? new URL("https://blog.syaoran.me");
  const sitemapUrl = new URL("sitemap.xml", siteUrl);

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
};
