import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MEMOS_ORIGIN = process.env.MEMOS_ORIGIN || "https://memos.syaoran.me";
const CREATOR_ID = process.env.MEMOS_CREATOR_ID || "1";
const OUTPUT_DIR = path.resolve("src/content/poetryNotes");
const PAGE_SIZE = Number(process.env.MEMOS_PAGE_SIZE || 100);

const targets = [
  { tag: "来写首俳句吧", kind: "haiku" },
  { tag: "来写首诗吧", kind: "poem" }
];

function escapeYaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function memoId(memo) {
  return String(memo.name || "").split("/").pop() || slugify(memo.createTime || Date.now());
}

function parseOriginalDate(content) {
  const match = content.match(/Day\s+(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function cleanContent(content) {
  return content
    .replace(/#来写首俳句吧(\s*\d+\/\d+)?/g, "")
    .replace(/#来写首诗吧(\s*\d+\/\d+)?/g, "")
    .replace(/Day\s+\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{1,2}:\d{1,2})?/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromContent(content, kind) {
  const firstLine = content.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return kind === "haiku" ? "未题俳句" : "未题诗";
  return firstLine.length > 18 ? `${firstLine.slice(0, 18)}...` : firstLine;
}

async function fetchMemos(tag) {
  const memos = [];
  let pageToken = "";

  do {
    const filter = encodeURIComponent(`tag in ["${tag}"]`);
    const url = new URL("/api/v1/memos", MEMOS_ORIGIN);
    url.searchParams.set("creatorId", CREATOR_ID);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("filter", decodeURIComponent(filter));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${tag}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    memos.push(...(data.memos ?? (Array.isArray(data) ? data : [])));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return memos;
}

function memoToMarkdown(memo, target) {
  const content = cleanContent(memo.content || "");
  if (!content) return null;

  const id = memoId(memo);
  const originalDate = parseOriginalDate(memo.content || "");
  const displayDate = memo.displayTime ? new Date(memo.displayTime) : null;
  const createDate = memo.createTime ? new Date(memo.createTime) : null;
  const date = originalDate || displayDate || createDate || new Date();
  const filename = `${formatDate(date)}-${slugify(id)}.md`;
  const frontmatter = [
    "---",
    `title: ${escapeYaml(titleFromContent(content, target.kind))}`,
    `kind: ${escapeYaml(target.kind)}`,
    `date: ${formatDate(date)}`,
    `source: "memos"`,
    `sourceId: ${escapeYaml(memo.name || id)}`,
    `sourceUrl: ${escapeYaml(`${MEMOS_ORIGIN}/m/${id}`)}`,
    memo.createTime ? `createdAt: ${escapeYaml(memo.createTime)}` : "",
    memo.updateTime ? `updatedAt: ${escapeYaml(memo.updateTime)}` : "",
    `tags: [${escapeYaml(target.tag)}]`,
    "draft: false",
    "---"
  ].filter(Boolean).join("\n");

  return {
    filename,
    body: `${frontmatter}\n\n${content}\n`
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const entry of await readdir(OUTPUT_DIR, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".md")) {
    await rm(path.join(OUTPUT_DIR, entry.name));
  }
}

let written = 0;
for (const target of targets) {
  const memos = await fetchMemos(target.tag);
  for (const memo of memos) {
    const file = memoToMarkdown(memo, target);
    if (!file) continue;
    await writeFile(path.join(OUTPUT_DIR, file.filename), file.body, "utf8");
    written += 1;
  }
}

console.log(`Synced ${written} poetry notes to ${OUTPUT_DIR}`);
