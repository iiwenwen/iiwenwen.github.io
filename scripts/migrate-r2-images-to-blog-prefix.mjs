import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

await loadDotenv(".env");

const bucket = process.env.R2_BUCKET || "blog";
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const imageHost = process.env.IMAGE_HOST || "img.syaoran.me";
const targetPrefix = process.env.R2_TARGET_PREFIX || "blog";
const dryRun = process.argv.includes("--dry-run");
const verifyOnly = process.argv.includes("--verify");
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
const region = "auto";
const service = "s3";

const BLOG_GLOB = "src/content/posts";
const markdownFiles = await collectMarkdownFiles(BLOG_GLOB);
const keys = new Set();

for (const file of markdownFiles) {
  const text = await readFile(file, "utf8");
  const re = new RegExp(`https://${escapeRegExp(imageHost)}/${targetPrefix}/([^\\s)"'<>]+)`, "g");
  for (const match of text.matchAll(re)) {
    keys.add(decodeURIComponent(match[1]));
  }
}

if (only) {
  for (const key of [...keys]) {
    if (key !== only) {
      keys.delete(key);
    }
  }
}

if (keys.size === 0) {
  console.log("No migrated image URLs found.");
  process.exit(0);
}

console.log(`Found ${keys.size} image object(s).`);

if (dryRun) {
  for (const key of [...keys].sort()) {
    console.log(`${bucket}/${key} -> ${bucket}/${targetPrefix}/${key}`);
  }
  process.exit(0);
}

if (verifyOnly) {
  await verifyPublicUrls([...keys].sort());
  process.exit(0);
}

for (const [name, value] of Object.entries({
  R2_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: accessKeyId,
  R2_SECRET_ACCESS_KEY: secretAccessKey,
  R2_BUCKET: bucket,
})) {
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
}

for (const key of [...keys].sort()) {
  const sourceKey = key;
  const targetKey = `${targetPrefix}/${key}`;

  if (sourceKey === targetKey) {
    continue;
  }

  console.log(`${bucket}/${sourceKey} -> ${bucket}/${targetKey}`);
  await copyObject(sourceKey, targetKey);
}

await verifyPublicUrls([...keys].sort());

async function copyObject(sourceKey, targetKey) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${encodeKey(targetKey)}`;
  const url = `https://${host}${path}`;
  const source = `/${bucket}/${encodeKey(sourceKey)}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-copy-source": source,
    "x-amz-date": amzDate,
    "x-amz-metadata-directive": "COPY",
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const canonicalRequest = [
    "PUT",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(getSigningKey(secretAccessKey, dateStamp), stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      authorization,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Copy failed for ${sourceKey}: ${response.status} ${body}`);
  }

  const body = await response.text();
  console.log(`Copied ${sourceKey}: ${response.status} ${body.trim()}`);
}

async function verifyPublicUrls(keys) {
  let failed = 0;

  for (const key of keys) {
    const url = `https://${imageHost}/${targetPrefix}/${encodeKey(key)}`;
    const response = await fetch(url, { method: "HEAD" });
    const status = `${response.status}`.padEnd(3);

    if (response.ok) {
      console.log(`OK   ${status} ${url}`);
    } else {
      failed += 1;
      console.log(`FAIL ${status} ${url}`);
    }
  }

  if (failed > 0) {
    throw new Error(`${failed} public URL(s) failed verification.`);
  }
}

function getSigningKey(secret, dateStamp) {
  const kDate = hmacBuffer(`AWS4${secret}`, dateStamp);
  const kRegion = hmacBuffer(kDate, region);
  const kService = hmacBuffer(kRegion, service);
  return hmacBuffer(kService, "aws4_request");
}

function hmacBuffer(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodeKey(key) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function collectMarkdownFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => `${dir}/${entry.name}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadDotenv(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] != null) {
      continue;
    }

    process.env[key] = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}
