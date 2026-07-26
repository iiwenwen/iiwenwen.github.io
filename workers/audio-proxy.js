const AUDIO_PATH_PREFIXES = ["/audio/", "/poetry/"];
const AUDIO_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,180}\.(mp3|m4a|wav|ogg|oga|webm|flac)$/i;
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

function isAllowedHost(url, env) {
  const allowedHosts = new Set(splitCsv(env.ALLOWED_HOSTS));
  return (
    allowedHosts.has(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  );
}

function isAllowedSource(request, env) {
  const allowedOrigins = new Set(splitCsv(env.ALLOWED_ORIGINS));
  const origin = request.headers.get("Origin");
  const refererOrigin = originFromUrl(request.headers.get("Referer"));

  // When Origin is present it is authoritative; do not let an allowed Referer rescue a forged Origin.
  if (origin) return isConfiguredOrigin(origin, allowedOrigins);
  return Boolean(refererOrigin && isConfiguredOrigin(refererOrigin, allowedOrigins));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = new Set(splitCsv(env.ALLOWED_ORIGINS));

  if (!origin || !isConfiguredOrigin(origin, allowedOrigins)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Accept-Ranges, Content-Length, Content-Range, ETag, X-Audio-Cache",
    "Access-Control-Max-Age": "86400"
  };
}

function parseRangeHeader(rangeHeader) {
  if (!rangeHeader) return { valid: true, range: null };

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { valid: false, range: null };

  const start = match[1] ? Number(match[1]) : undefined;
  const end = match[2] ? Number(match[2]) : undefined;

  if (start === undefined && end === undefined) return { valid: false, range: null };
  if (start !== undefined && !Number.isSafeInteger(start)) return { valid: false, range: null };
  if (end !== undefined && !Number.isSafeInteger(end)) return { valid: false, range: null };
  if (start !== undefined && end !== undefined && end < start) {
    return { valid: false, range: null };
  }
  if (start === undefined) return { valid: true, range: { suffix: end } };
  if (end === undefined) return { valid: true, range: { offset: start } };

  return { valid: true, range: { offset: start, length: end - start + 1 } };
}

function getObjectKey(url, env) {
  const pathPrefix = AUDIO_PATH_PREFIXES.find((prefix) => url.pathname.startsWith(prefix));
  if (!pathPrefix) return "";

  let rawKey;
  try {
    rawKey = decodeURIComponent(url.pathname.slice(pathPrefix.length));
  } catch {
    return "";
  }

  const cleanKey = rawKey.replace(/^\/+/, "");
  if (!AUDIO_KEY_PATTERN.test(cleanKey)) return "";

  return `${env.AUDIO_PREFIX || ""}${cleanKey}`;
}

function applyObjectHeaders(headers, object, env) {
  object.writeHttpMetadata(headers);

  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Length", String(object.size));
  headers.set("X-Content-Type-Options", "nosniff");
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

function withClientHeaders(response, request, env, cacheStatus) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);

  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  // Workers Caching runs before this Worker. Vary by both authorization inputs so a cached
  // allowed response cannot be reused by a request that omits or changes its source headers.
  headers.set("Vary", "Origin, Referer");
  headers.set("X-Audio-Cache", cacheStatus);

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function errorResponse(message, status, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      ...extraHeaders
    }
  });
}

function canonicalCacheRequests(url, request, key, env) {
  const cacheUrl = new URL(url);
  const prefix = env.AUDIO_PREFIX || "";
  const objectName = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  cacheUrl.pathname = `/poetry/${objectName}`;
  cacheUrl.search = "";
  cacheUrl.hash = "";

  const cacheKey = new Request(cacheUrl, { method: "GET" });
  const lookupHeaders = new Headers();

  for (const name of ["Range", "If-None-Match", "If-Modified-Since"]) {
    const value = request.headers.get(name);
    if (value) lookupHeaders.set(name, value);
  }

  const lookupRequest = new Request(cacheUrl, { method: "GET", headers: lookupHeaders });
  return { cacheKey, lookupRequest };
}

async function enforceRateLimits(request, env) {
  const clientKey = request.headers.get("CF-Connecting-IP") || "unknown-client";
  const client = await env.AUDIO_CLIENT_RATE_LIMITER.limit({ key: clientKey });
  const colo = client.success
    ? await env.AUDIO_COLO_RATE_LIMITER.limit({ key: "all-audio" })
    : { success: true };

  if (client.success && colo.success) return null;

  console.warn(
    JSON.stringify({
      event: "audio_rate_limited",
      scope: client.success ? "colo" : "client",
      path: new URL(request.url).pathname,
      ray: request.headers.get("CF-Ray") || ""
    })
  );

  return errorResponse("Too Many Requests", 429, { "Retry-After": "60" });
}

async function fetchDirectFromR2(key, range, env) {
  const object = await env.POETRY_AUDIO.get(key, range ? { range } : undefined);
  if (!object) return null;

  const headers = new Headers();
  applyObjectHeaders(headers, object, env);
  const status = range ? applyRangeHeaders(headers, object) : 200;

  return new Response(object.body, { status, headers });
}

async function fetchThroughCache(request, url, key, env) {
  const cache = caches.default;
  const { cacheKey, lookupRequest } = canonicalCacheRequests(url, request, key, env);
  const cached = await cache.match(lookupRequest);
  if (cached) return { response: cached, cacheStatus: "HIT" };

  const object = await env.POETRY_AUDIO.get(key);
  if (!object) return { response: null, cacheStatus: "MISS" };

  const headers = new Headers();
  applyObjectHeaders(headers, object, env);
  const fullResponse = new Response(object.body, { status: 200, headers });

  try {
    // Cache only the full 200 response. Cloudflare slices later Range requests into 206 responses.
    await cache.put(cacheKey, fullResponse);
    const stored = await cache.match(lookupRequest);
    if (stored) return { response: stored, cacheStatus: "MISS" };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "audio_cache_put_failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }

  // Cache storage can reject oversized objects. Retry as a streamed R2 response instead of failing playback.
  const { range } = parseRangeHeader(request.headers.get("Range"));
  const fallback = await fetchDirectFromR2(key, range, env);
  return { response: fallback, cacheStatus: "BYPASS" };
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (!isAllowedHost(url, env)) return errorResponse("Not Found", 404);

  if (request.method === "OPTIONS") {
    if (!isAllowedSource(request, env)) return errorResponse("Forbidden", 403);
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse("Method Not Allowed", 405, { Allow: "GET, HEAD, OPTIONS" });
  }

  if (!isAllowedSource(request, env)) return errorResponse("Forbidden", 403);

  const key = getObjectKey(url, env);
  if (!key) return errorResponse("Not Found", 404);

  const parsedRange = parseRangeHeader(request.headers.get("Range"));
  if (!parsedRange.valid) return errorResponse("Range Not Satisfiable", 416);

  const rateLimited = await enforceRateLimits(request, env);
  if (rateLimited) return rateLimited;

  const { response, cacheStatus } = await fetchThroughCache(request, url, key, env);
  if (!response) return errorResponse("Not Found", 404);
  return withClientHeaders(response, request, env, cacheStatus);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "audio_proxy_failed",
          path: new URL(request.url).pathname,
          ray: request.headers.get("CF-Ray") || "",
          error: error instanceof Error ? error.message : String(error)
        })
      );
      return errorResponse("Internal Server Error", 500);
    }
  }
};
