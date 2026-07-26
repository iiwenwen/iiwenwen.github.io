import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, extname, relative, resolve } from "node:path";

const BUCKET = "syaoran-poetry-audio";
const PUBLIC_BASE_URL = "https://videos.syaoran.me/poetry";
const POETRY_DIR = resolve("src/content/poetry");

const contentTypes = {
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm"
};

function fail(message) {
  console.error(`错误：${message}`);
  console.error("用法：bun run audio:publish <音频文件> <src/content/poetry/诗歌.md> [时长] [--force]");
  process.exit(1);
}

function setFrontmatterField(frontmatter, field, value) {
  const line = `${field}: ${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${field}:.*$`, "m");
  return pattern.test(frontmatter) ? frontmatter.replace(pattern, line) : `${frontmatter}\n${line}`;
}

const rawArguments = process.argv.slice(2);
const force = rawArguments.includes("--force");
const positionalArguments = rawArguments.filter((argument) => argument !== "--force");
const [audioArgument, poetryArgument, duration, ...extraArguments] = positionalArguments;
if (!audioArgument || !poetryArgument) fail("缺少音频文件或诗歌 Markdown 路径");
if (extraArguments.length > 0) fail(`无法识别的参数：${extraArguments.join(" ")}`);
if (duration && !/^(?:\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(duration)) {
  fail(`时长格式无效：${duration}；应使用 MM:SS 或 HH:MM:SS`);
}

const audioPath = resolve(audioArgument);
const poetryPath = resolve(poetryArgument);
if (!existsSync(audioPath) || !statSync(audioPath).isFile()) fail(`找不到音频文件：${audioPath}`);
if (!existsSync(poetryPath) || !statSync(poetryPath).isFile()) fail(`找不到诗歌文件：${poetryPath}`);
const poetryDirectoryRealPath = realpathSync(POETRY_DIR);
const poetryRealPath = realpathSync(poetryPath);
if (poetryRealPath !== poetryDirectoryRealPath && !poetryRealPath.startsWith(`${poetryDirectoryRealPath}/`)) {
  fail("诗歌文件必须位于 src/content/poetry/ 中");
}
try {
  accessSync(poetryRealPath, constants.W_OK);
} catch {
  fail(`诗歌文件不可写：${relative(process.cwd(), poetryRealPath)}`);
}

const extension = extname(audioPath).toLowerCase();
const contentType = contentTypes[extension];
if (!contentType) fail(`不支持的音频格式：${extension || "无扩展名"}`);

const slug = basename(poetryRealPath, extname(poetryRealPath));
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) fail(`诗歌文件名不能安全地用作音频键：${slug}`);

const objectName = `${slug}${extension}`;
const objectPath = `${BUCKET}/poetry/${objectName}`;
const audioUrl = `${PUBLIC_BASE_URL}/${encodeURIComponent(objectName)}`;
const { CLOUDFLARE_API_TOKEN: _ignoredToken, ...wranglerEnvironment } = process.env;

const markdown = readFileSync(poetryRealPath, "utf8");
const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
if (!frontmatterMatch) fail("诗歌 Markdown 没有有效的 YAML frontmatter");

let frontmatter = frontmatterMatch[1];
frontmatter = setFrontmatterField(frontmatter, "audioUrl", audioUrl);
frontmatter = setFrontmatterField(frontmatter, "audioType", contentType);
if (duration) frontmatter = setFrontmatterField(frontmatter, "duration", duration);
const updatedMarkdown = markdown.replace(frontmatterMatch[0], `---\n${frontmatter}\n---`);

console.log(`上传：${basename(audioPath)}`);
console.log(`目标：r2://${objectPath}`);

let existingResponse;
try {
  existingResponse = await fetch(audioUrl, {
    method: "HEAD",
    headers: { Referer: "https://blog.syaoran.me/" }
  });
} catch (error) {
  fail(`无法检查远端对象是否存在：${error instanceof Error ? error.message : String(error)}`);
}

if (existingResponse.status === 200 && !force) {
  fail(`R2 对象已存在：${audioUrl}；确认替换后追加 --force`);
}
if (existingResponse.status !== 200 && existingResponse.status !== 404) {
  fail(`检查远端对象时返回意外状态：HTTP ${existingResponse.status}`);
}
if (existingResponse.status === 200) console.log("已确认替换现有 R2 对象。");

const upload = Bun.spawn(
  [
    "bunx", "wrangler@latest", "r2", "object", "put", objectPath,
    "--file", audioPath,
    "--content-type", contentType,
    "--cache-control", "public, max-age=86400",
    "--remote"
  ],
  { env: wranglerEnvironment, stdin: "inherit", stdout: "inherit", stderr: "inherit" }
);

if (await upload.exited !== 0) {
  fail("R2 上传失败；请先运行 env -u CLOUDFLARE_API_TOKEN bunx wrangler@latest login");
}

const temporaryDirectory = mkdtempSync(`${poetryRealPath}.audio-update-`);
const temporaryMarkdownPath = resolve(temporaryDirectory, basename(poetryRealPath));
try {
  writeFileSync(temporaryMarkdownPath, updatedMarkdown);
  renameSync(temporaryMarkdownPath, poetryRealPath);
  rmSync(temporaryDirectory, { recursive: true, force: true });
} catch (error) {
  rmSync(temporaryDirectory, { recursive: true, force: true });
  console.error(`音频已经上传：${audioUrl}`);
  fail(`写入诗歌 Markdown 失败：${error instanceof Error ? error.message : String(error)}`);
}

console.log(`已更新：${relative(process.cwd(), poetryRealPath)}`);
console.log(`音频地址：${audioUrl}`);
