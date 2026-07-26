import { beforeEach, describe, expect, test } from "bun:test";
import worker from "./audio-proxy.js";

const AUDIO_BYTES = new TextEncoder().encode("0123456789");

function parseTestRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return { invalid: true };

  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (start >= size || end < start) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async put(request, response) {
    this.entries.set(request.url, {
      bytes: new Uint8Array(await response.arrayBuffer()),
      headers: [...response.headers],
      status: response.status
    });
  }

  async match(request) {
    const entry = this.entries.get(request.url);
    if (!entry) return undefined;

    const headers = new Headers(entry.headers);
    const range = parseTestRange(request.headers.get("Range"), entry.bytes.length);
    if (range?.invalid) return new Response(null, { status: 416, headers });
    if (!range) return new Response(entry.bytes.slice(), { status: entry.status, headers });

    const body = entry.bytes.slice(range.start, range.end + 1);
    headers.set("Content-Length", String(body.length));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${entry.bytes.length}`);
    return new Response(body, { status: 206, headers });
  }
}

function createR2Object(bytes, range = null) {
  return {
    size: AUDIO_BYTES.length,
    range,
    httpEtag: '"test-etag"',
    body: new Blob([bytes]).stream(),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "audio/mp4");
    }
  };
}

function createEnv({ clientAllowed = true, coloAllowed = true } = {}) {
  const calls = { get: 0, clientLimit: 0, coloLimit: 0 };

  return {
    calls,
    env: {
      AUDIO_PREFIX: "poetry/",
      ALLOWED_HOSTS: "blog.syaoran.me,videos.syaoran.me",
      ALLOWED_ORIGINS:
        "https://blog.syaoran.me,https://videos.syaoran.me,https://iiwenwen.github.io",
      CACHE_TTL_SECONDS: "86400",
      AUDIO_CLIENT_RATE_LIMITER: {
        async limit() {
          calls.clientLimit += 1;
          return { success: clientAllowed };
        }
      },
      AUDIO_COLO_RATE_LIMITER: {
        async limit() {
          calls.coloLimit += 1;
          return { success: coloAllowed };
        }
      },
      POETRY_AUDIO: {
        async get(key, options) {
          calls.get += 1;
          if (key !== "poetry/2026-05-04-poem-1.m4a") return null;

          const range = options?.range || null;
          if (!range) return createR2Object(AUDIO_BYTES);

          const offset = range.offset ?? AUDIO_BYTES.length - range.suffix;
          const length = range.length ?? AUDIO_BYTES.length - offset;
          return createR2Object(AUDIO_BYTES.slice(offset, offset + length), { offset, length });
        }
      }
    }
  };
}

function audioRequest(path = "/poetry/2026-05-04-poem-1.m4a", headers = {}) {
  return new Request(`https://videos.syaoran.me${path}`, {
    headers: {
      Referer: "https://blog.syaoran.me/poetry/",
      "CF-Connecting-IP": "203.0.113.10",
      ...headers
    }
  });
}

beforeEach(() => {
  globalThis.caches = { default: new MemoryCache() };
});

describe("audio proxy abuse protection", () => {
  test("rejects Sec-Fetch-Site without an allowed origin or referer", async () => {
    const { env, calls } = createEnv();
    const request = new Request("https://videos.syaoran.me/poetry/2026-05-04-poem-1.m4a", {
      headers: { "Sec-Fetch-Site": "same-site" }
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
    expect(calls.get).toBe(0);
  });

  test("does not let an allowed referer rescue a forged origin", async () => {
    const { env, calls } = createEnv();
    const request = audioRequest(undefined, { Origin: "https://evil.example" });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(403);
    expect(calls.get).toBe(0);
  });

  test("rejects the workers.dev host", async () => {
    const { env, calls } = createEnv();
    const request = new Request(
      "https://syaoran-poetry-audio.example.workers.dev/poetry/2026-05-04-poem-1.m4a",
      { headers: { Referer: "https://blog.syaoran.me/" } }
    );

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(404);
    expect(calls.get).toBe(0);
  });

  test("returns 429 before reading R2 when the client limit is exceeded", async () => {
    const { env, calls } = createEnv({ clientAllowed: false });

    const response = await worker.fetch(audioRequest(), env);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(calls.get).toBe(0);
    expect(calls.coloLimit).toBe(0);
  });

  test("rejects malformed and multi-part ranges before reading R2", async () => {
    const { env, calls } = createEnv();

    const response = await worker.fetch(
      audioRequest(undefined, { Range: "bytes=0-1,4-5" }),
      env
    );

    expect(response.status).toBe(416);
    expect(calls.get).toBe(0);
    expect(calls.clientLimit).toBe(0);
  });

  test("canonicalizes query strings and serves later ranges without another R2 read", async () => {
    const { env, calls } = createEnv();

    const first = await worker.fetch(
      audioRequest("/poetry/2026-05-04-poem-1.m4a?cache-bust=one", { Range: "bytes=0-1" }),
      env
    );
    const second = await worker.fetch(
      audioRequest("/poetry/2026-05-04-poem-1.m4a?cache-bust=two", { Range: "bytes=2-3" }),
      env
    );

    expect(first.status).toBe(206);
    expect(first.headers.get("X-Audio-Cache")).toBe("MISS");
    expect(first.headers.get("Vary")).toBe("Origin, Referer");
    expect(await first.text()).toBe("01");
    expect(second.status).toBe(206);
    expect(second.headers.get("X-Audio-Cache")).toBe("HIT");
    expect(await second.text()).toBe("23");
    expect(calls.get).toBe(1);
  });

  test("rejects nested or unsupported object keys before reading R2", async () => {
    const { env, calls } = createEnv();

    const response = await worker.fetch(audioRequest("/poetry/nested/file.exe"), env);

    expect(response.status).toBe(404);
    expect(calls.get).toBe(0);
  });
});
