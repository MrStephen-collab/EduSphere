import https from "node:https";

// The Supabase API endpoints on this network kill TLS / HTTP/2 sessions after
// a handful of requests (OpenSSL alert 47 / ERR_HTTP2_INVALID_SESSION). Reused
// connections are also blackholed mid-flight or silently hung, so connection
// pooling in ANY form is unreliable here. Fresh HTTP/1.1 connections always
// work: each request opens its own TLS connection and closes it afterwards.
// That costs a handshake (~500ms) per request, so the number of Supabase round
// trips per page load is kept small (React cache() dedupes the auth chain and
// page queries run in parallel). A transport failure is retried on a brand new
// connection up to three times with a short pause, because the failure rate
// here is high enough that a single retry still dropped whole page renders.
//
// To stop every page render from paying a fresh ~500ms-onwards trip, GET/HEAD
// responses to the PostgREST tables are memoized here for a few seconds
// (keyed by URL + auth header). Any write to a table clears its cached reads,
// so reads never go stale for more than a mutation cycle. Reads that change
// are rare within 15s, and this keeps repeated navigation effectively local.

const SOCKET_TIMEOUT_MS = 20000;
const HTTP_CACHE_TTL_MS = 15_000;
const MAX_HTTP_CACHE_ENTRIES = 400;
const MAX_ATTEMPTS = 3;

type HttpCacheEntry = {
  table: string | null;
  response: Response;
  expiresAt: number;
};

const httpCache = new Map<string, HttpCacheEntry>();

function tableFromPath(pathname: string): string | null {
  const match = /^\/rest\/v1\/([a-zA-Z_]+)/.exec(pathname);
  return match ? match[1] : null;
}

class H1Response {
  readonly status: number;
  readonly statusText: string;
  private readonly headerEntries: Array<[string, string]>;
  private readonly bodyText: string;

  constructor(
    status: number,
    statusText: string,
    headerEntries: Array<[string, string]>,
    bodyText: string,
  ) {
    this.status = status;
    this.statusText = statusText;
    this.headerEntries = headerEntries;
    this.bodyText = bodyText;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  get headers() {
    return {
      get: (name: string) => {
        const lower = name.toLowerCase();
        const entry = this.headerEntries.find(([k]) => k.toLowerCase() === lower);
        return entry ? entry[1] : null;
      },
    };
  }

  async text() {
    return this.bodyText;
  }

  async json() {
    return JSON.parse(this.bodyText);
  }

  clone() {
    return new H1Response(this.status, this.statusText, this.headerEntries, this.bodyText);
  }
}

function performOnce(
  url: URL,
  method: string,
  headerMap: Record<string, string>,
  body: Buffer | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        method,
        path: url.pathname + url.search,
        headers: headerMap,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve(
            new H1Response(
              res.statusCode ?? -1,
              res.statusMessage ?? "",
              Object.entries(res.headers).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(", ") : String(v ?? ""),
              ]),
              text,
            ) as unknown as Response,
          );
        });
      },
    );

    req.on("error", reject);
    if (signal) {
      if (signal.aborted) {
        req.destroy(new Error("aborted"));
      } else {
        signal.addEventListener(
          "abort",
          () => req.destroy(new Error("aborted")),
          { once: true },
        );
      }
    }
    req.setTimeout(SOCKET_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timed out after ${SOCKET_TIMEOUT_MS}ms`));
    });
    if (body) req.write(body);
    req.end();
  });
}

function http1Fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const href =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const url = new URL(href);

  const headers = new Headers(init?.headers);
  const headerMap: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerMap[key] = value;
  });

  const method = init?.method ?? "GET";
  let body: Buffer | undefined = undefined;
  if (init?.body !== null && init?.body !== undefined) {
    if (typeof init.body === "string") {
      body = Buffer.from(init.body, "utf8");
    } else if (init.body instanceof Uint8Array) {
      body = Buffer.from(init.body);
    } else if (init.body instanceof ArrayBuffer) {
      body = Buffer.from(new Uint8Array(init.body));
    } else if (init.body instanceof URLSearchParams) {
      body = Buffer.from(init.body.toString(), "utf8");
    } else {
      body = Buffer.from(String(init.body), "utf8");
    }
  }
  delete headerMap["connection"];
  delete headerMap["Connection"];
  headerMap["Connection"] = "close";
  if (body) {
    headerMap["Content-Length"] = String(body.length);
  }

  const startMs = Date.now();
  const table = tableFromPath(url.pathname);
  const authToken = headerMap["Authorization"] ?? "anon";
  const cacheKey = `${url.pathname}${url.search}|${authToken}`;

  const now = Date.now();

  if (table !== null) {
    if (method === "GET" || method === "HEAD") {
      const hit = httpCache.get(cacheKey);
      if (hit && hit.expiresAt > now) {
        return Promise.resolve(hit.response.clone());
      }
    } else {
      // A write to a table invalidates every cached read of that table.
      for (const [key, entry] of httpCache) {
        if (entry.table === table) {
          httpCache.delete(key);
        }
      }
    }
  }

  if (httpCache.size >= MAX_HTTP_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of httpCache) {
      if (entry.expiresAt < oldestAt) {
        oldestAt = entry.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey) httpCache.delete(oldestKey);
  }

  const attempt = async () => {
    let lastError: unknown;
    for (let tries = 1; tries <= MAX_ATTEMPTS; tries += 1) {
      try {
        return await performOnce(
          url,
          method,
          headerMap,
          body,
          init?.signal ?? undefined,
        );
      } catch (err) {
        lastError = err;
        if (tries < MAX_ATTEMPTS) {
          console.error(
            `[http1] request failed; retrying on a fresh connection (attempt ${tries} of ${MAX_ATTEMPTS})`,
            err,
          );
          await new Promise((resolve) => setTimeout(resolve, 250 * tries));
        }
      }
    }
    throw lastError;
  };

  return attempt()
    .then((response) => {
      if (table !== null && (method === "GET" || method === "HEAD") && response.ok) {
        httpCache.set(cacheKey, {
          table,
          response,
          expiresAt: Date.now() + HTTP_CACHE_TTL_MS,
        });
      }
      return response;
    })
    .finally(() => {
      const ms = Date.now() - startMs;
      if (ms >= 400) {
        console.log(`[trip] ${method} ${url.pathname.padEnd(28)} ${ms}ms`);
      }
    });
}

export { http1Fetch };