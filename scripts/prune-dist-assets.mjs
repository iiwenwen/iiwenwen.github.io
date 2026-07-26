import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt", ".xml"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const allFiles = await walk(distDir);
const textFiles = allFiles.filter((file) => textExtensions.has(extname(file).toLowerCase()));
const documentText = (await Promise.all(textFiles.map((file) => readFile(file, "utf8")))).join("\n");

let removedFiles = 0;
let removedBytes = 0;

for (const directoryName of ["covers", "fonts"]) {
  const directory = join(distDir, directoryName);
  let assets = [];
  try {
    assets = await walk(directory);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }

  for (const asset of assets) {
    const relativePath = relative(directory, asset).split(sep).join("/");
    const path = `/${directoryName}/${relativePath}`;
    const isReferenced = documentText.includes(path) || documentText.includes(encodeURI(path));
    if (isReferenced) continue;

    removedBytes += (await stat(asset)).size;
    removedFiles += 1;
    await unlink(asset);
  }
}

const megabytes = (removedBytes / 1024 / 1024).toFixed(2);
console.log(`Pruned ${removedFiles} unused built assets (${megabytes} MB).`);
