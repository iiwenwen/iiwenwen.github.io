import { defineConfig } from "astro/config";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPage = repository.endsWith(".github.io");
const base = process.env.GITHUB_ACTIONS && repository && !isUserOrOrgPage
  ? `/${repository}`
  : "/";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://example.com",
  base,
  trailingSlash: "always",
  vite: {
    plugins: [
      {
        name: "lxgw-wenkai-font-display",
        transform(code, id) {
          if (!id.includes("lxgw-wenkai-webfont") || !id.endsWith(".css")) {
            return null;
          }

          return code.replaceAll("font-display: swap", "font-display: optional");
        }
      }
    ]
  }
});
