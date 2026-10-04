// Confirms the webhook route accepts a correctly signed Mux event and refuses
// a forged one, using the secret now present in .env.local.
import crypto from "node:crypto";
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";

dotenv.config({ path: ".env.local" });
installHttp1Fetch();
const secret = process.env.MUX_WEBHOOK_SECRET;
const BASE = process.env.BASE || "http://localhost:3100";

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
};

console.log(`  secret present: ${Boolean(secret)} (${secret?.length ?? 0} chars)`);

function sign(rawBody, timestamp) {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

async function post(rawBody, headers) {
  const res = await fetch(`${BASE}/api/webhooks/video-host`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });
  let body = "";
  try {
    body = await res.text();
  } catch {}
  return { status: res.status, body };
}

// 1. An unknown-but-valid event must be accepted (200), proving the route is
//    no longer returning the 503 "not configured".
const ts = Math.floor(Date.now() / 1000);
const benign = JSON.stringify({
  type: "video.upload.asset_created",
  object: { id: "probe-upload", passthrough: null },
});
const okRes = await post(benign, { "mux-signature": sign(benign, ts) });
check(
  "the route is configured and accepts a signed event",
  okRes.status === 200,
  `status ${okRes.status} ${okRes.body}`,
);

// 2. A forged signature must be refused.
const forged = await post(benign, { "mux-signature": `t=${ts},v1=${"0".repeat(64)}` });
check(
  "a forged signature is refused",
  forged.status === 401,
  `status ${forged.status} ${forged.body}`,
);

// 3. No signature at all must be refused.
const none = await post(benign, {});
check("a missing signature is refused", none.status === 401, `status ${none.status} ${none.body}`);

// 4. A tampered body reusing a valid signature must be refused, which is the
//    case that breaks if the body is parsed before verification.
const tampered = await post(JSON.stringify({ ...JSON.parse(benign), hacked: true }), {
  "mux-signature": sign(benign, ts),
});
check(
  "a tampered body reusing a valid signature is refused",
  tampered.status === 401,
  `status ${tampered.status} ${tampered.body}`,
);

// 5. Malformed JSON with a correct signature must be a 400, not a 500.
const badJson = "not json at all";
const badRes = await post(badJson, { "mux-signature": sign(badJson, ts) });
check(
  "malformed JSON is a clean 400",
  badRes.status === 400,
  `status ${badRes.status} ${badRes.body}`,
);

console.log(`\n${pass} passed, ${fail} failed`);

// Node's bundled fetch keeps its pooled sockets alive, and letting them close
// during interpreter teardown trips a libuv assertion on Windows that makes the
// process exit nonzero even though every check passed. Close the dispatcher
// first so the exit code reflects the checks and nothing else.
const dispatcher = globalThis[Symbol.for("undici.globalDispatcher.1")];
await dispatcher?.close?.().catch?.(() => {});
await new Promise((r) => setTimeout(r, 50));
process.exit(fail === 0 ? 0 : 1);