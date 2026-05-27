const AUDIO_PATH_PREFIXES = ["/audio/", "/poetry/"];
const ONE_WEEK = 604800;

function splitCsv(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isLocalOrigin(value) {
  if (!value) return false;

  try {
    const { protocol, hostname } = new URL(value);
    return (
      protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function isConfiguredOrigin(value, allowedOrigins) {
  return allowedOrigins.has(value) || isLocalOrigin(value);
}

function isAllowedSource(request, env) {
  const allowedOrigins = new Set(splitCsv(env.ALLOWED_ORIGINS));
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const refererOrigin = originFromUrl(referer);

  if (origin && isConfiguredOrigin(origin, allowedOrigins)) return true;
  if (refererOrigin && isConfiguredOrigin(refererOrigin, allowedOrigins)) return true;

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return fetchSite === "same-origin" || fetchSite === "same-site";
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = new Set(splitCsv(env.ALLOWED_ORIGINS));

  if (!origin || !isConfiguredOrigin(origin, allowedOrigins)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, ETag",
    "Access-Control-Max-Age": "86400"
  };
}

function parseRangeHeader(rangeHeader) {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const start = match[1] ? Number(match[1]) : undefined;
  const end = match[2] ? Number(match[2]) : undefined;

  if (start === undefined && end === undefined) return null;
  if (start !== undefined && end !== undefined && end < start) return null;
  if (start === undefined) return { suffix: end };
  if (end === undefined) return { offset: start };

  return { offset: start, length: end - start + 1 };
}

function getObjectKey(url, env) {
  const pathPrefix = AUDIO_PATH_PREFIXES.find((prefix) => url.pathname.startsWith(prefix));
  if (!pathPrefix) return "";

  const rawKey = decodeURIComponent(url.pathname.slice(pathPrefix.length));
  const cleanKey = rawKey.replace(/^\/+/, "");
  if (!cleanKey || cleanKey.includes("..")) return "";

  return `${env.AUDIO_PREFIX || ""}${cleanKey}`;
}

function applyObjectHeaders(headers, object, env) {
  object.writeHttpMetadata(headers);

  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  headers.set("Vary", "Origin, Referer, Range");
  headers.set(
    "Cache-Control",
    `public, max-age=${env.CACHE_TTL_SECONDS || 86400}, s-maxage=${ONE_WEEK}`
  );

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "audio/mpeg");
  }
}

function applyRangeHeaders(headers, object) {
  if (!object.range) return 200;

  const offset = object.range.offset || 0;
  const length = object.range.length || object.size - offset;
  const end = offset + length - 1;

  headers.set("Content-Range", `bytes ${offset}-${end}/${object.size}`);
  headers.set("Content-Length", String(length));
  return 206;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS", ...cors }
      });
    }

    if (!isAllowedSource(request, env)) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }

    const key = getObjectKey(url, env);
    if (!key) {
      return new Response("Not Found", { status: 404, headers: cors });
    }

    if (request.method === "HEAD") {
      const object = await env.POETRY_AUDIO.head(key);
      if (!object) return new Response("Not Found", { status: 404, headers: cors });

      const headers = new Headers(cors);
      applyObjectHeaders(headers, object, env);
      headers.set("Content-Length", String(object.size));
      return new Response(null, { status: 200, headers });
    }

    const range = parseRangeHeader(request.headers.get("Range"));
    const object = await env.POETRY_AUDIO.get(key, range ? { range } : undefined);
    if (!object) return new Response("Not Found", { status: 404, headers: cors });

    const headers = new Headers(cors);
    applyObjectHeaders(headers, object, env);

    const status = range ? applyRangeHeaders(headers, object) : 200;
    if (status === 200) headers.set("Content-Length", String(object.size));

    return new Response(object.body, { status, headers });
  }
};
