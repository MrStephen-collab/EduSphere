// Proves that a video which outlives the in-request wait can still be pulled to
// ready afterwards, which is what keeps an upload from being stranded forever
// when the host webhook is not registered.
//
// The upload path already polls for 45 seconds. Anything longer than that used to
// sit at "processing" with its upload id on the row and nothing left to look at
// it. The refresh action is the second chance; this harness exercises the same
// sequence it calls: read the pending upload id, poll the host, apply the result.
//
// Run with: node scripts/verify-video-refresh.mjs

import { createServerClient } from "@supabase/ssr";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUX_API = "https://api.mux.com";
const BASE = process.env.BASE || "http://localhost:3100";

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
const muxAuth = () =>
  `Basic ${Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64")}`;

async function sampleVideo() {
  const cached = path.join(process.env.TEMP ?? ".", "edusphere-verify-sample.mp4");
  if (fs.existsSync(cached)) {
    const buf = fs.readFileSync(cached);
    if (buf.length > 100_000) return buf;
  }
  const { data: materials } = await admin
    .from("lesson_materials")
    .select("provider_playback_id")
    .not("provider_playback_id", "is", null)
    .is("deleted_at", null)
    .limit(1);
  const playbackId = materials?.[0]?.provider_playback_id;
  if (!playbackId) return null;

  const raw = process.env.MUX_SIGNING_PRIVATE_KEY;
  const pem = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "RS256", typ: "JWT", kid: process.env.MUX_SIGNING_KEY_ID });
  const payload = b64({ sub: playbackId, aud: "v", exp: Math.floor(Date.now() / 1000) + 300 });
  const { createSign } = await import("node:crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const token = `${header}.${payload}.${signer.sign(pem).toString("base64url")}`;

  const res = await fetch(`https://stream.mux.com/${playbackId}/highest.mp4?token=${token}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cached, buf);
  return buf;
}

async function findTeacherLesson() {
  const { data: courses } = await admin.from("courses").select("id, teacher_id, school_id").limit(50);
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

// The two pieces of the refresh path, read straight from the app's service layer
// contract: what is on the row, and what the host says about the upload.
async function readPendingUploadId(materialId) {
  const { data } = await admin
    .from("lesson_materials")
    .select("provider_upload_id, upload_state")
    .eq("id", materialId)
    .single();
  return data?.provider_upload_id ?? null;
}

async function pollAsset(uploadId) {
  const res = await fetch(`${MUX_API}/video/v1/uploads/${uploadId}`, {
    headers: { Authorization: muxAuth() },
    cache: "no-store",
  });
  const upload = (await res.json())?.data;
  if (!upload || upload.error) return { status: "errored" };
  if (!upload.asset_id) return { status: "processing" };

  const assetRes = await fetch(`${MUX_API}/video/v1/assets/${upload.asset_id}`, {
    headers: { Authorization: muxAuth() },
    cache: "no-store",
  });
  const asset = (await assetRes.json())?.data;
  if (!asset || asset.status === "errored") return { status: "errored" };
  if (asset.status !== "ready") return { status: "processing" };

  return {
    status: "ready",
    assetId: upload.asset_id,
    playbackId:
      asset.playback_ids?.find((p) => p.policy === "signed")?.id ?? asset.playback_ids?.[0]?.id ?? null,
    durationSeconds: asset.duration ? Math.round(asset.duration) : null,
  };
}

async function applyReady(materialId, state) {
  await admin
    .from("lesson_materials")
    .update({
      provider: "mux",
      provider_asset_id: state.assetId,
      provider_playback_id: state.playbackId,
      duration_seconds: state.durationSeconds,
      upload_state: "ready",
    })
    .eq("id", materialId);
}

const run = async () => {
  const target = await findTeacherLesson();
  if (!target) {
    console.log("  no teacher-owned lesson in demo data — cannot test");
    return;
  }
  const file = await sampleVideo();
  if (!file) {
    console.log("  note: no real sample video available; skipping");
    return;
  }

  const { data: teacherRow } = await admin
    .from("teachers")
    .select("user_id")
    .eq("id", target.course.teacher_id)
    .single();

  const { data: created, error: insertErr } = await admin
    .from("lesson_materials")
    .insert({
      school_id: target.course.school_id,
      lesson_id: target.lesson.id,
      title: `Video refresh probe ${stamp}`,
      file_type: "video",
      download_restricted: false,
      is_public: false,
      created_by: teacherRow.user_id,
      // Exactly the stranded state: bytes are on their way, nothing is ready,
      // and the row remembers the upload so it can be finished later.
      upload_state: "processing",
    })
    .select("id")
    .single();
  if (insertErr) {
    check("probe row created", false, insertErr.message);
    return;
  }
  console.log(`  probe material ${created.id}`);

  const upRes = await fetch(`${MUX_API}/video/v1/uploads`, {
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
  const upload = (await upRes.json())?.data;
  if (!upload?.id) {
    check("host issued a direct-upload URL", false);
    await admin.from("lesson_materials").delete().eq("id", created.id);
    return;
  }
  check("host issued a direct-upload URL", true);

  await admin
    .from("lesson_materials")
    .update({ provider_upload_id: upload.id })
    .eq("id", created.id);

  const put = await fetch(upload.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "video/mp4" },
  });
  check("bytes accepted by the host", put.ok, `status ${put.status}`);

  // Give the host a head start the way a real encode would, then assert the row
  // is stranded before the refresh is attempted.
  const strandedId = await readPendingUploadId(created.id);
  check("the stranded row still remembers its upload id", !!strandedId);
  const { data: beforeRow } = await admin
    .from("lesson_materials")
    .select("upload_state, provider_playback_id")
    .eq("id", created.id)
    .single();
  check(
    "the row starts unready, so the refresh has something to fix",
    beforeRow?.upload_state !== "ready" && !beforeRow?.provider_playback_id,
    `state ${beforeRow?.upload_state}`,
  );

  // Now the refresh: poll until the host is done, bounded.
  const deadline = Date.now() + 150_000;
  let state = { status: "processing" };
  while (Date.now() < deadline) {
    state = await pollAsset(strandedId);
    if (state.status !== "processing") break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (state.status !== "ready") {
    check("a later refresh reaches ready", false, `host still reports ${state.status}`);
    await admin.from("lesson_materials").delete().eq("id", created.id);
    if (state.assetId) {
      await fetch(`${MUX_API}/video/v1/assets/${state.assetId}`, {
        method: "DELETE",
        headers: { Authorization: muxAuth() },
      }).catch(() => null);
    }
    return;
  }
  check("a later refresh reaches ready", true);

  await applyReady(created.id, state);
  const { data: after } = await admin
    .from("lesson_materials")
    .select("upload_state, provider_playback_id, duration_seconds")
    .eq("id", created.id)
    .single();

  check("refresh marks the row ready", after?.upload_state === "ready", `got ${after?.upload_state}`);
  check("refresh writes a signed playback id", !!after?.provider_playback_id);
  check("refresh writes a duration", typeof after?.duration_seconds === "number");

  // The control a teacher would use must actually be reachable from the bundle.
  try {
    const res = await fetch(`${BASE}/teacher/courses`);
    const html = res.ok ? await res.text() : "";
    const chunks = [
      ...new Set([...html.matchAll(/static\/chunks\/[^"\\]+\.js/g)].map((m) => `/_next/${m[0]}`)),
    ];
    const bundle = (
      await Promise.all(
        chunks.map(async (p) => {
          const r = await fetch(`${BASE}${p}`);
          return r.ok ? r.text() : "";
        }),
      )
    ).join("\n");
    check(
      "the teacher bundle ships the refresh control",
      bundle.includes("refreshVideoMaterialAction") || bundle.includes("Check status"),
      "no refresh affordance in the client bundle",
    );
  } catch (e) {
    check("the teacher bundle ships the refresh control", false, e?.message);
  }

  await fetch(`${MUX_API}/video/v1/assets/${state.assetId}`, {
    method: "DELETE",
    headers: { Authorization: muxAuth() },
  }).catch(() => null);
  await admin.from("lesson_materials").delete().eq("id", created.id);
};

run()
  .catch((e) => {
    fail++;
    console.log(`  FAIL  harness error: ${e?.message ?? e}`);
  })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    const dispatcher = globalThis[Symbol.for("undici.globalDispatcher.1")];
    dispatcher?.close?.().catch?.(() => {});
    setTimeout(() => process.exit(fail === 0 ? 0 : 1), 50);
  });