#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("../src/app", import.meta.url));
const port = process.env.PORT || "3000";
const base = `http://localhost:${port}`;
const r = (code) => process.exit(code);

const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [nextCli, "dev", "--webpack", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function collectPageDirs(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!(entry.name.startsWith("@") || entry.name.startsWith("_"))) {
        out.push(...(await collectPageDirs(full)));
      }
    } else if (entry.name.startsWith("page.")) {
      out.push(dir);
    }
  }
  return out;
}

function toRoute(dir) {
  let relative = dir.slice(appDir.length).split(sep).filter(Boolean);
  relative = relative.filter((segment) => !(segment.startsWith("(") || segment.startsWith("@") || segment.startsWith("_")));
  const parts = relative.map((segment) => {
    if (segment.startsWith("[[...")) return null;
    if (segment.startsWith("[...")) return "demo";
    if (segment.startsWith("[") && segment.endsWith("]")) return "demo";
    return segment;
  });
  const joined = parts.filter((p) => p != null).join("/");
  return "/" + joined;
}

async function warm() {
  const pageDirs = await collectPageDirs(appDir);
  const allRoutes = [...new Set(pageDirs.map(toRoute).filter(Boolean))];
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/pricing"];

  for (let i = 0; i < 300; i++) {
    try {
      const res = await fetch(base + "/favicon.ico", { redirect: "manual", signal: AbortSignal.timeout(5000) });
      if (res.ok || res.status >= 400) break;
    } catch {
      /* not ready yet */
    }
    await sleep(1000);
  }

  const hit = async (route) => {
    try {
      const status = await fetch(base + route, { redirect: "manual", signal: AbortSignal.timeout(60000) }).then((res) => res.status);
      console.log(`[dev-warm] ${route} -> ${status}`);
    } catch {
      console.log(`[dev-warm] ${route} -> skip`);
    }
  };

  console.log(`[dev-warm] warming ${publicRoutes.length} public + ${allRoutes.length} routes…`);

  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < allRoutes.length) {
      const route = allRoutes[cursor++];
      await hit(route);
    }
  });

  for (const route of publicRoutes) await hit(route);
  await Promise.allSettled(workers);
  console.log("[dev-warm] done — core routes are pre-compiled.");
}

warm();

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
child.on("exit", r);