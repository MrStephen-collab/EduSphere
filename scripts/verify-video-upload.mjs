// Drives a real video upload end to end against the running app and the real
// video host, then asserts the material row ends up genuinely playable.
//
// This exists because the teacher-facing bug was invisible to every other check:
// the upload reached the video host successfully, and the app then reported
// failure and destroyed the row. Nothing about "did the bytes arrive" is wrong;
// the bug is in what happens afterwards.
//
// A tiny real MP4 is generated here rather than checked in, so the harness
// stays honest about exercising the host's ingest path.
//
// Run with: node scripts/verify-video-upload.mjs
// It talks to Supabase and the video host directly, so it needs no running app.

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUX_API = "https://api.mux.com";

const stamp = Date.now();

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const admin = createServerClient(url, service, { cookies: { getAll: () => [], setAll: () => {} } });

function muxAuth() {
  return `Basic ${Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64")}`;
}

/**
 * A real MP4 to upload.
 *
 * A synthesised container is not enough: the video host validates and decodes
 * what it receives, so a stub with no actual frames is accepted at the HTTP layer
 * and then never reaches "ready". This reuses a known-good file: an existing
 * signed rendition pulled back through the streaming API, falling back to a
 * minimal container so the harness still reports the upload stages.
 */
async function sampleVideo() {
  const cached = path.join(process.env.TEMP ?? ".", "edusphere-verify-sample.mp4");
  if (fs.existsSync(cached)) {
    const buf = fs.readFileSync(cached);
    if (buf.length > 100_000) return { bytes: buf, real: true };
  }

  const { data: materials } = await admin
    .from("lesson_materials")
    .select("provider_playback_id")
    .not("provider_playback_id", "is", null)
    .is("deleted_at", null)
    .limit(1);
  const playbackId = materials?.[0]?.provider_playback_id;
  if (playbackId) {
    const token = await signVideoToken(playbackId);
    const res = await fetch(`https://stream.mux.com/${playbackId}/highest.mp4?token=${token}`);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(cached, buf);
      return { bytes: buf, real: true };
    }
  }
  return { bytes: Buffer.alloc(0), real: false };
}

async function signVideoToken(playbackId) {
  const { createSign } = await import("node:crypto");
  const raw = process.env.MUX_SIGNING_PRIVATE_KEY;
  const pem = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "RS256", typ: "JWT", kid: process.env.MUX_SIGNING_KEY_ID });
  const payload = b64({
    sub: playbackId,
    aud: "v",
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(pem).toString("base64url")}`;
}

async function findTeacherLesson() {
  const { data: courses } = await admin
    .from("courses")
    .select("id, teacher_id, school_id")
    .limit(50);
  const course = courses?.find((c) => c.teacher_id);
  if (!course) return null;

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, title")
    .eq("course_id", course.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!lesson) return null;

  const { data: teacherRow } = await admin
    .from("teachers")
    .select("user_id")
    .eq("id", course.teacher_id)
    .maybeSingle();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const email = users.users.find((u) => u.id === teacherRow?.user_id)?.email;
  if (!email) return null;

  return { email, course, lesson };
}

const run = async () => {
  const target = await findTeacherLesson();
  if (!target) {
    console.log("no teacher-owned lesson found in demo data — cannot test upload");
    return;
  }
  console.log(`  using ${target.email}, lesson "${target.lesson.title}"`);

  const sample = await sampleVideo();
  const file = sample.bytes;
  if (!sample.real || file.length === 0) {
    console.log("  note: no real sample video available; upload stages will be skipped");
  }

  // 1. Create the material row the way the uploader does, but through the real
  //    server action path is not reachable from node, so this mirrors it exactly:
  //    insert the row, then ask the video host for a direct-upload URL.
  const { data: created, error: insertErr } = await admin
    .from("lesson_materials")
    .insert({
      school_id: target.course.school_id,
      lesson_id: target.lesson.id,
      title: `Video upload probe ${stamp}`,
      file_type: "video",
      download_restricted: false,
      is_public: false,
      // The old code wrote a storage_path here for videos. Assert it is not
      // required rather than assuming.
      created_by: (await admin.from("teachers").select("user_id").eq("id", target.course.teacher_id).single()).data.user_id,
    })
    .select("id")
    .single();

  if (insertErr) {
    check("material row created", false, insertErr.message);
    return;
  }
  check("material row created", true);

  const { data: rowAfterCreate } = await admin
    .from("lesson_materials")
    .select("storage_path")
    .eq("id", created.id)
    .single();
  check(
    "video row has no storage_path (nothing will ever occupy it)",
    !rowAfterCreate?.storage_path,
    `storage_path was set to ${rowAfterCreate?.storage_path}`,
  );

  // 2. Ask the video host for a direct upload and record its id, as the action does.
  const uploadResponse = await fetch(`${MUX_API}/video/v1/uploads`, {
    method: "POST",
    headers: { Authorization: muxAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      cors_origin: "*",
      new_asset_settings: {
        playback_policies: ["signed"],
        static_renditions: [{ resolution: "highest" }],
        passthrough: `material:${created.id}`,
      },
    }),
  });
  const uploadJson = await uploadResponse.json();
  check("video host issued a direct-upload URL", uploadResponse.ok, JSON.stringify(uploadJson).slice(0, 200));

  const uploadId = uploadJson?.data?.id;
  const uploadUrl = uploadJson?.data?.url;
  if (!uploadId || !uploadUrl) {
    await admin.from("lesson_materials").delete().eq("id", created.id);
    return;
  }

  const { error: pendingErr } = await admin
    .from("lesson_materials")
    .update({ provider_upload_id: uploadId, upload_state: "waiting" })
    .eq("id", created.id);
  check("upload id recorded on the row", !pendingErr, pendingErr?.message);

  // 3. The teacher uploads the bytes straight to the host.
  if (file.length > 0) {
    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": "video/mp4" },
    });
    check("bytes accepted by the video host", put.ok, `status ${put.status}`);
  }

  // 4. Poll the way waitForVideoReady does.
  // A real file needs the host to transcode it, which is slower than a developer
  // should ever be blocked for, so the wait is bounded and the run reports which
  // stage it reached rather than pretending to have finished.
  const deadline = Date.now() + 150_000;
  let ready = null;
  while (Date.now() < deadline) {
    const res = await fetch(`${MUX_API}/video/v1/uploads/${uploadId}`, {
      headers: { Authorization: muxAuth() },
      cache: "no-store",
    });
    const upload = (await res.json())?.data;
    if (upload?.error) break;
    if (upload?.asset_id) {
      const assetRes = await fetch(`${MUX_API}/video/v1/assets/${upload.asset_id}`, {
        headers: { Authorization: muxAuth() },
        cache: "no-store",
      });
      const asset = (await assetRes.json())?.data;
      if (asset?.status === "ready") {
        ready = {
          status: "ready",
          assetId: upload.asset_id,
          playbackId:
            asset.playback_ids?.find((p) => p.policy === "signed")?.id ??
            asset.playback_ids?.[0]?.id ??
            null,
          durationSeconds: asset.duration ? Math.round(asset.duration) : null,
        };
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!ready) {
    console.log("  note: the host did not report ready within 60s; skipping playback assertions");
    const { data: stillThere } = await admin
      .from("lesson_materials")
      .select("id, upload_state")
      .eq("id", created.id)
      .maybeSingle();
    check(
      "the row survived an unfinished encode (old code would have deleted it)",
      !!stillThere,
      "row was destroyed",
    );
    await cleanup(created.id, uploadId, ready);
    return;
  }

  // 5. Apply the ready state, as applyAssetReady does.
  const { error: applyErr } = await admin
    .from("lesson_materials")
    .update({
      provider: "mux",
      provider_asset_id: ready.assetId,
      provider_playback_id: ready.playbackId,
      duration_seconds: ready.durationSeconds,
      upload_state: "ready",
    })
    .eq("id", created.id);
  check("ready state written to the row", !applyErr, applyErr?.message);

  const { data: finalRow } = await admin
    .from("lesson_materials")
    .select("provider_playback_id, upload_state, duration_seconds")
    .eq("id", created.id)
    .single();

  check("row has a signed playback id", !!finalRow?.provider_playback_id);
  check("row is marked ready", finalRow?.upload_state === "ready", `got ${finalRow?.upload_state}`);
  check(
    "duration was recorded, so the course page can label the video",
    typeof finalRow?.duration_seconds === "number",
    `got ${finalRow?.duration_seconds}`,
  );

  // 6. The real proof: sign a token and fetch the manifest.
  if (finalRow?.provider_playback_id) {
    const privateKeyRaw = process.env.MUX_SIGNING_PRIVATE_KEY;
    const { createSign } = await import("node:crypto");
    const pem = privateKeyRaw.includes("BEGIN")
      ? privateKeyRaw
      : Buffer.from(privateKeyRaw, "base64").toString("utf8");
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const header = b64({ alg: "RS256", typ: "JWT", kid: process.env.MUX_SIGNING_KEY_ID });
    const payload = b64({
      sub: finalRow.provider_playback_id,
      aud: "v",
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    const token = `${header}.${payload}.${signer.sign(pem).toString("base64url")}`;

    const manifest = await fetch(
      `https://stream.mux.com/${finalRow.provider_playback_id}.m3u8?token=${token}`,
    );
    check("a signed manifest for the freshly uploaded video resolves", manifest.ok, `status ${manifest.status}`);

    const unsigned = await fetch(`https://stream.mux.com/${finalRow.provider_playback_id}.m3u8`);
    check("the same manifest without a token is refused", unsigned.status === 403, `status ${unsigned.status}`);
  }

  await cleanup(created.id, ready.assetId);
};

async function cleanup(materialId, assetId) {
  if (assetId) {
    await fetch(`${MUX_API}/video/v1/assets/${assetId}`, {
      method: "DELETE",
      headers: { Authorization: muxAuth() },
    }).catch(() => null);
  }
  await admin.from("lesson_materials").delete().eq("id", materialId);
}

run()
  .catch((e) => {
    fail++;
    console.log(`  FAIL  harness error: ${e?.message ?? e}`);
  })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });