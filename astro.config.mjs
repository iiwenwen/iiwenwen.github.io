import { defineConfig } from "astro/config";
import remarkBreaks from "remark-breaks";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPage = repository.endsWith(".github.io");
const base = process.env.GITHUB_ACTIONS && repository && !isUserOrOrgPage
  ? `/${repository}`
  : "/";

export default defineConfig({
  site: process.env.SITE_URL || "https://iiwenwen.github.io",
  base,
  trailingSlash: "always",
  markdown: {
    remarkPlugins: [remarkBreaks]
  }
});
