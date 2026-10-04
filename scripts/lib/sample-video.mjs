import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MIN_BYTES = 5_000;

function synthesiseClip(target) {
  const probe = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=1", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", target], { stdio: "ignore", timeout: 60_000, windowsHide: true });
  if (probe.status !== 0 || !fs.existsSync(target)) return null;
  return fs.statSync(target).size >= MIN_BYTES ? target : null;
}

export async function sampleVideo(cachedPath, fallback) {
  if (fs.existsSync(cachedPath)) {
    const buf = fs.readFileSync(cachedPath);
    if (buf.length >= MIN_BYTES) return { bytes: buf, real: true, source: "cache" };
  }
  if (synthesiseClip(cachedPath)) {
    return { bytes: fs.readFileSync(cachedPath), real: true, source: "ffmpeg" };
  }
  if (fallback) {
    const bytes = await fallback();
    if (bytes?.length >= MIN_BYTES) {
      fs.writeFileSync(cachedPath, bytes);
      return { bytes, real: true, source: "stream" };
    }
  }
  return { bytes: Buffer.alloc(0), real: false, source: "none" };
}

export function sampleVideoPath() {
  return path.join(process.env.TEMP ?? ".", "edusphere-verify-sample.mp4");
}
