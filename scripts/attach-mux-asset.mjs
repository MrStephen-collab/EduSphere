/**
 * Attaches a Mux asset that was uploaded outside EduSphere to a lesson material.
 *
 * The app's own upload path links an asset to its material through the
 * `passthrough` claim, which only exists on uploads we initiate. A video
 * uploaded straight from the Mux dashboard has no passthrough, so the
 * asset.ready webhook cannot tell which lesson it belongs to. This script does
 * that binding by hand:
 *
 *   node scripts/attach-mux-asset.mjs                        # list assets
 *   node scripts/attach-mux-asset.mjs <asset-id> <material-id>
 *   node scripts/attach-mux-asset.mjs <asset-id> --lesson=<lesson-id> --title="..."
 *
 * It also upgrades the asset to a signed playback policy first if needed.
 * A public asset cannot be played through the app: requestMaterialAccess
 * refuses to hand out a playback id whose policy is not `signed`, because
 * every video in EduSphere is meant to be unplayable without a fresh token.
 */
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env.local" });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const MUX_API = "https://api.mux.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tokenId = process.env.MUX_TOKEN_ID;
const tokenSecret = process.env.MUX_TOKEN_SECRET;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!tokenId || !tokenSecret) {
  console.error(
    "Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET. Fill them in .env.local first.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const muxHeaders = {
  Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`,
  "Content-Type": "application/json",
};

async function mux(path, init = {}) {
  const response = await fetch(`${MUX_API}${path}`, {
    ...init,
    headers: { ...muxHeaders, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mux ${init.method ?? "GET"} ${path} -> ${response.status}: ${detail}`);
  }
  return response;
}

const args = process.argv.slice(2);
const assetId = args.find((a) => !a.startsWith("--") && /^[a-z0-9]{8,}$/i.test(a));
const lessonArg = args.find((a) => a.startsWith("--lesson="));
const titleArg = args.find((a) => a.startsWith("--title="));

async function listAssets() {
  const response = await mux("/video/v1/assets?limit=25");
  const { data } = await response.json();
  if (!data.length) {
    console.log("No assets in this Mux environment yet.");
    return;
  }
  console.log("id                       status    signed  duration  passthrough        created");
  for (const asset of data) {
    const signed = asset.playback_ids?.find((p) => p.policy === "signed");
    const minutes = asset.duration ? `${Math.round(asset.duration)}s` : "-";
    console.log(
      [
        asset.id.padEnd(25),
        String(asset.status).padEnd(9),
        signed ? "yes" : "no ",
        minutes.padEnd(9),
        String(asset.passthrough ?? "-").padEnd(20),
        asset.created_at,
      ].join("  "),
    );
    if (signed) console.log(`${" ".repeat(26)}playback id: ${signed.id}`);
  }
  console.log("\nAttach one with:\n  node scripts/attach-mux-asset.mjs <asset-id> <material-id>");
}

/** Adds a signed playback id, which is what the app's player authorises against. */
async function ensureSignedPolicy(id) {
  const response = await mux(`/video/v1/assets/${id}`);
  const { data: asset } = await response.json();

  const existing = asset.playback_ids?.find((p) => p.policy === "signed");
  if (existing) return existing.id;

  console.log("No signed playback id on this asset yet, adding one...");
  await mux(`/video/v1/assets/${id}/playback-ids`, {
    method: "POST",
    body: JSON.stringify({ policy: "signed" }),
  });

  // The id is available immediately even while the asset is still encoding, so
  // there is nothing to poll for here.
  const after = await mux(`/video/v1/assets/${id}`);
  const { data: refreshed } = await after.json();
  const added = refreshed.playback_ids?.find((p) => p.policy === "signed");
  if (!added) throw new Error("Mux accepted the request but returned no signed playback id.");
  return added.id;
}

async function findOrCreateMaterial(playbackId) {
  if (args.length > 1 && !args[1].startsWith("--")) return args[1];

  const lessonId = lessonArg?.split("=")[1];
  if (!lessonId) {
    console.error(
      "Give a material id, or --lesson=<lesson-id> to create a material row for that lesson.",
    );
    process.exit(1);
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, school_id, title")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) {
    console.error(`No lesson with id ${lessonId}.`);
    process.exit(1);
  }

  const { data: created, error } = await supabase
    .from("lesson_materials")
    .insert({
      school_id: lesson.school_id,
      lesson_id: lesson.id,
      title: titleArg?.split("=")[1] ?? "Sample video",
      file_type: "video",
      mime_type: "video/mp4",
      download_restricted: true,
      is_public: false,
      provider: "mux",
      provider_playback_id: playbackId,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Could not create the material row: ${error.message}`);
    process.exit(1);
  }

  console.log(`Created material ${created.id} on lesson "${lesson.title}".`);
  return created.id;
}

async function main() {
  if (!assetId) {
    await listAssets();
    return;
  }

  const playbackId = await ensureSignedPolicy(assetId);

  const materialId = await findOrCreateMaterial(playbackId);

  const { error } = await supabase
    .from("lesson_materials")
    .update({
      provider: "mux",
      provider_asset_id: assetId,
      provider_playback_id: playbackId,
    })
    .eq("id", materialId);

  if (error) {
    console.error(`Could not update the material: ${error.message}`);
    process.exit(1);
  }

  console.log(`\nAttached asset ${assetId} to material ${materialId} (playback ${playbackId}).`);
  console.log("Open the lesson as a student to watch it.");
}

await main();
