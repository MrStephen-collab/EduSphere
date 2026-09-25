import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "branding");

const jobs = [
  { file: "edusphere-logo.svg", png: "edusphere-logo.png", width: 1600 },
  { file: "edusphere-logo-dark.svg", png: "edusphere-logo-dark.png", width: 1600 },
  { file: "edusphere-logo-stacked.svg", png: "edusphere-logo-stacked.png", width: 800 },
  { file: "edusphere-icon.svg", png: "edusphere-icon.png", width: 512 },
  { file: "edusphere-icon-dark.svg", png: "edusphere-icon-dark.png", width: 512 },
  { file: "edusphere-favicon.svg", png: "edusphere-favicon.png", width: 512 },
];

mkdirSync(outDir, { recursive: true });

for (const job of jobs) {
  const svg = readFileSync(join(outDir, job.file));
  const buffer = await sharp(svg).resize({ width: job.width }).png().toBuffer();
  writeFileSync(join(outDir, job.png), buffer);
  console.log(`wrote ${job.png} (${buffer.length} bytes)`);
}