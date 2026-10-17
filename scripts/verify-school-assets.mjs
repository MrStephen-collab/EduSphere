// Proves the school logo storage (spec section 34, branding) works against the
// real project.
//
// The logo form logic and its size/type rules are pure and unit-tested in
// src/lib/school-logo.ts. What can only break against the live project is the
// storage itself: the "school-assets" bucket's public flag, its size and mime
// limits, and the signed-upload → public-read → delete round trip that
// createSchoolLogoUpload (src/services/school-assets.ts) relies on.
//
// Run with: node scripts/verify-school-assets.mjs
// It uploads one object and removes it at the end.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
installHttp1Fetch();

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "school-assets";

if (!URL || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const run = async () => {
  const stamp = Date.now();
  const path = `verify-${stamp}/logo-${stamp}.png`;
  let uploaded = false;

  try {
    // --- bucket configuration ---------------------------------------------
    console.log("\nSchool assets bucket: exists and is public with the right limits");
    const bucket = await admin.storage.getBucket(BUCKET);
    check(
      "the school-assets bucket exists",
      !bucket.error && !!bucket.data,
      bucket.error?.message,
    );
    check(
      "it is public (logos are served straight from the CDN)",
      bucket.data?.public === true,
      `public=${bucket.data?.public}`,
    );

    const limitOk = bucket.data?.file_size_limit === 2097152;
    const mimes = (bucket.data?.allowed_mime_types ?? []).slice().sort();
    const mimesOk =
      JSON.stringify(mimes) === JSON.stringify(["image/jpeg", "image/png", "image/webp"]);
    check(
      "it caps uploads at 2 MB of PNG/JPG/WebP only",
      limitOk && mimesOk,
      `limit=${bucket.data?.file_size_limit} mimes=${JSON.stringify(bucket.data?.allowed_mime_types)}`,
    );

    // --- signed upload round trip -----------------------------------------
    console.log("\nUpload round trip: signed URL -> bytes land -> public read");
    const signed = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    check(
      "a signed upload URL can be minted for a school folder path",
      !signed.error && !!signed.data?.token,
      signed.error?.message,
    );

    // A 1x1 transparent PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    if (signed.data) {
      const up = await admin.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.data.path, signed.data.token, png, {
          contentType: "image/png",
        });
      uploaded = !up.error;
      check("the object is accepted by the bucket", uploaded, up.error?.message);
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;
    check(
      "the object is readable through its public URL",
      !!publicUrl &&
        (await fetch(publicUrl, { cache: "no-store" })
          .then((r) => r.ok)
          .catch(() => false)),
      publicUrl,
    );
  } catch (err) {
    failed++;
    console.log(`  FAIL  harness error: ${err?.message ?? err}`);
    if (err?.stack) console.log(err.stack);
  } finally {
    if (uploaded) {
      await admin.storage.from(BUCKET).remove([path]);
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
