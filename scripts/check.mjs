import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { verifyArchives } from "./releases.mjs";
async function check(dir) {
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name);
    if (/\.(js|mjs)$/.test(name)) {
      const r = spawnSync(process.execPath, ["--check", file], {
        stdio: "inherit",
      });
      if (r.status !== 0) process.exit(r.status || 1);
    }
  }
}
for (const dir of ["dist/js", "scripts", "tests"]) await check(dir);
const r = spawnSync(process.execPath, ["--check", "serve.js"], {
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status || 1);
await verifyArchives();
console.log("Source syntax and release integrity checks passed");
