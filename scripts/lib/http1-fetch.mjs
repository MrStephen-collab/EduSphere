import https from "node:https";

const SOCKET_TIMEOUT_MS = Number(process.env.VERIFY_HTTP_TIMEOUT_MS ?? 30_000);
const MAX_ATTEMPTS = 3;
const NEEDS_HTTP1 = /\.supabase\.co$/i;

function performOnce(url, method, headerMap, body, signal) {
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
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          const bodiless = status === 204 || status === 205 || status === 304;
          resolve(
            new Response(bodiless ? null : text, {
              status,
              statusText: res.statusMessage ?? "",
              headers: Object.entries(res.headers).flatMap(([key, value]) =>
                Array.isArray(value)
                  ? value.map((v) => [key, String(v)])
                  : [[key, String(value ?? "")]],
              ),
            }),
          );
        });
      },
    );

    req.on("error", reject);
    if (signal) {
      if (signal.aborted) req.destroy(new Error("aborted"));
      else
        signal.addEventListener("abort", () => req.destroy(new Error("aborted")), {
          once: true,
        });
    }
    req.setTimeout(SOCKET_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timed out after ${SOCKET_TIMEOUT_MS}ms`));
    });
    if (body) req.write(body);
    req.end();
  });
}

function once(url, method, headerMap, body, signal) {
  const attempt = () => performOnce(url, method, headerMap, body, signal);
  return attempt().catch((error) => {
    console.warn(`[http1] ${method} ${url.pathname} failed (${error.message}); retrying on a fresh connection`);
    return attempt();
  });
}

function bodyBuffer(body) {
  if (body === null || body === undefined) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body));
  if (body instanceof URLSearchParams) return Buffer.from(body.toString(), "utf8");
  return Buffer.from(String(body), "utf8");
}

function http1Fetch(passthrough, input, init) {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let url;
  try {
    url = new URL(href);
  } catch {
    return passthrough(input, init);
  }
  if (url.protocol !== "https:" || !NEEDS_HTTP1.test(url.hostname)) {
    return passthrough(input, init);
  }

  const headers = new Headers(init?.headers);
  const headerMap = {};
  headers.forEach((value, key) => {
    headerMap[key] = value;
  });

  const method = init?.method ?? "GET";
  const body = bodyBuffer(init?.body);

  delete headerMap.connection;
  delete headerMap.Connection;
  headerMap.Connection = "close";
  if (body) headerMap["Content-Length"] = String(body.length);

  return once(url, method, headerMap, body, init?.signal ?? undefined);
}

export function installHttp1Fetch() {
  const passthrough = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await http1Fetch(passthrough, input, init);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };
}
