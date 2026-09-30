// Mints a real playback token with the app's own key material and verifies the
// signature. Run with:
//   node scripts/check-mux-signing.mjs
//
// This exists because a signing key can be present and still be unusable: a
// PEM whose newlines were mangled in transit still "contains BEGIN", so the
// usual presence check passes, and the failure only shows up later as a 403
// from Mux at playback time.
import fs from "node:fs";
import { createVerify, createSign, createPublicKey } from "node:crypto";

const raw = fs.readFileSync(".env.local", "utf8");
const val = (k) => {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${k}=`));
  return line ? line.slice(line.indexOf("=") + 1) : "";
};

// Mux hands the key over either as a PEM with real newlines or base64-encoded.
// The app decodes the base64 form (see readConfig in video-hosting.ts), and
// that is what .env.local stores, because a literal \n in a dotenv value does
// not survive as a newline.
const stored = val("MUX_SIGNING_PRIVATE_KEY").trim();
const privateKey = stored.includes("BEGIN")
  ? stored
  : Buffer.from(stored, "base64").toString("utf8");
const keyId = val("MUX_SIGNING_KEY_ID").trim();

const results = [];
const ok = (name, condition) => {
  results.push(Boolean(condition));
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}`);
  return Boolean(condition);
};

console.log("Mux signing key from .env.local");

let parseable = false;
try {
  createPublicKey(privateKey);
  parseable = true;
} catch {
  parseable = false;
}
ok("key parses as an RSA private key", parseable);

if (parseable) {
  const b64u = (input) => Buffer.from(input).toString("base64url");
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId }));
  const claims = {
    sub: "TEST_PLAYBACK_ID",
    aud: "v",
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const body = b64u(JSON.stringify(claims));

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  const jwt = `${header}.${body}.${b64u(signer.sign(privateKey))}`;

  const parts = jwt.split(".");
  const decodedHeader = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const decodedClaims = JSON.parse(Buffer.from(parts[1], "base64url").toString());

  ok("token header carries the configured key id", decodedHeader.kid === keyId);

  // verify() takes (key, signature) in that order, and both must be the
  // decoded values -- not the base64url text.
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  let verifies = false;
  try {
    verifies = verifier.verify(privateKey, Buffer.from(parts[2], "base64url"));
  } catch {
    verifies = false;
  }
  ok("RS256 signature verifies against the key", verifies);
  ok("subject is the playback id, not a viewer id", decodedClaims.sub === "TEST_PLAYBACK_ID");
  ok("expiry is in the future", decodedClaims.exp > Math.floor(Date.now() / 1000));
}

const allGood = results.length > 0 && results.every(Boolean);
console.log(`\nkey id: ${keyId}`);
console.log(allGood ? "\nsigning is working" : "\nsigning is NOT working");
process.exit(allGood ? 0 : 1);
