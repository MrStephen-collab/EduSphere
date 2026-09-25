import https from "node:https";

// The Supabase API endpoints on this network kill TLS / HTTP/2 sessions after
// a handful of requests (OpenSSL alert 47 / ERR_HTTP2_INVALID_SESSION). Reused
// connections are also blackholed mid-flight or silently hung, so connection
// pooling in ANY form is unreliable here. Fresh HTTP/1.1 connections always
// work: each request opens its own TLS connection and closes it afterwards.
// That costs a handshake (~500ms) per request, so the number of Supabase round
// trips per page load is kept small (React cache() dedupes the auth chain and
// page queries run in parallel). A single direct retry covers a one-off
// transport failure without ever reusing a poisoned socket.

const SOCKET_TIMEOUT_MS = 20000;

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
  body: string | undefined,
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
  let body: string | undefined = undefined;
  if (init?.body !== null && init?.body !== undefined) {
    if (typeof init.body === "string") {
      body = init.body;
    } else if (init.body instanceof Uint8Array) {
      body = Buffer.from(init.body).toString("utf8");
    } else if (init.body instanceof ArrayBuffer) {
      body = Buffer.from(init.body).toString("utf8");
    } else {
      body = String(init.body);
    }
  }
  delete headerMap["connection"];
  delete headerMap["Connection"];
  headerMap["Connection"] = "close";
  if (body) {
    headerMap["Content-Length"] = String(Buffer.byteLength(body));
  }

  const startMs = Date.now();
  const attempt = () =>
    performOnce(url, method, headerMap, body, init?.signal ?? undefined);

  return attempt()
    .catch((err: unknown) => {
      console.error("[http1] request failed; retrying once on a fresh connection", err);
      return attempt();
    })
    .finally(() => {
      const ms = Date.now() - startMs;
      if (ms >= 400) {
        console.log(`[trip] ${method} ${url.pathname.padEnd(28)} ${ms}ms`);
      }
    });
}

export { http1Fetch };