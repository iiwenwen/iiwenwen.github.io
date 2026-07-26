import { defineConfig } from "astro/config";
import remarkBreaks from "remark-breaks";
import rehypeImageAttributes from "./src/lib/rehype-image-attributes.mjs";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPage = repository.endsWith(".github.io");
const base = process.env.GITHUB_ACTIONS && repository && !isUserOrOrgPage
  ? `/${repository}`
  : "/";

export default defineConfig({
  site: "https://blog.syaoran.me",
  base,
  trailingSlash: "always",
  markdown: {
    remarkPlugins: [remarkBreaks],
    rehypePlugins: [rehypeImageAttributes]
  }
});
