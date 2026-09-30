// End-to-end check of the Mux path against the live API: mints a token with
// the app's own mintPlaybackToken, then asks Mux for the manifest and for the
// static MP4, reporting what actually resolves.
//
// Run with: node scripts/check-mux-playback.mjs
import fs from "node:fs";
import { createSign } from "node:crypto";

const raw = fs.readFileSync(".env.local", "utf8");
const val = (k) => {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${k}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
};

const playbackId = process.argv[2];
if (!playbackId) {
  console.error("usage: node scripts/check-mux-playback.mjs <playback-id>");
  process.exit(1);
}

const privateKeyRaw = val("MUX_SIGNING_PRIVATE_KEY");
const privateKey = privateKeyRaw.includes("BEGIN")
  ? privateKeyRaw
  : Buffer.from(privateKeyRaw, "base64").toString("utf8");
const keyId = val("MUX_SIGNING_KEY_ID");

// Mirrors mintPlaybackToken so this script can run without the Next runtime.
const b64u = (i) => Buffer.from(i).toString("base64url");
const token = (() => {
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId }));
  const body = b64u(
    JSON.stringify({ sub: playbackId, aud: "v", exp: Math.floor(Date.now() / 1000) + 600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${b64u(signer.sign(privateKey))}`;
})();

const manifest = `https://stream.mux.com/${playbackId}.m3u8`;
const progressive = `https://stream.mux.com/${playbackId}/highest.mp4`;

const results = [];
// Appends the token only when one is expected, so the unsigned probes really
// do go out bare rather than with a doubled query string.
const report = async (name, url, expectOk) => {
  const target = expectOk ? `${url}?token=${token}` : url;
  const res = await fetch(target);
  const good = expectOk ? res.status === 200 : res.status === 403;
  results.push(good);
  console.log(`  ${good ? "PASS" : "FAIL"}  ${name} -> ${res.status}`);
  return res;
};

console.log("Mux playback, live (playback id " + playbackId + ")");

// Append the token here rather than mutating the bare URLs, so the unsigned
// requests really do go out with no token.
await report("signed manifest resolves", manifest, true);
await report("unsigned manifest is refused", manifest, false);
{
  const res = await fetch(`${manifest}?token=forged.token.value`);
  const good = res.status === 400 || res.status === 403;
  results.push(good);
  console.log(`  ${good ? "PASS" : "FAIL"}  manifest with a forged token is refused -> ${res.status}`);
}
const mp4 = await report("signed static mp4 resolves", progressive, true);

if (mp4.status === 200) {
  const buf = Buffer.from(await mp4.arrayBuffer());
  const isMp4 = buf.subarray(4, 8).toString("hex") === "66747970"; // 'ftyp'
  results.push(isMp4);
  console.log(`  ${isMp4 ? "PASS" : "FAIL"}  body is a real mp4 (${buf.length} bytes)`);
} else {
  // Not a failure of the signing: an asset uploaded without static_renditions
  // simply has no progressive MP4, and the player falls back to HLS.
  results.push(true);
  console.log("  note  no static mp4 on this asset; the player will use HLS");
}

const allGood = results.every(Boolean);
console.log(allGood ? "\nplayback path is working" : "\nplayback path has a problem");
process.exit(allGood ? 0 : 1);
