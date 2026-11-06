import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
test("release archive refuses overwrite and detects a changed frozen document", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "arcade-release-"));
  try {
    await mkdir(path.join(dir, "docs/releases/v0.9.0"), { recursive: true });
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ version: "0.9.0" })
    );
    for (const name of ["PRODUCT", "ROADMAP", "QA"])
      await writeFile(path.join(dir, "docs", name + ".md"), name);
    await writeFile(
      path.join(dir, "docs/releases/v0.9.0/SUMMARY.md"),
      "Release evidence"
    );
    const script = path.resolve("scripts/releases.mjs");
    const run = (...args) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: dir,
        encoding: "utf8",
      });
    assert.equal(run("archive", "0.9.0").status, 0);
    assert.equal(run("verify").status, 0);
    const before = await readFile(
      path.join(dir, "docs/releases/v0.9.0/VERSION.json"),
      "utf8"
    );
    assert.notEqual(run("archive", "0.9.0").status, 0);
    assert.equal(
      await readFile(
        path.join(dir, "docs/releases/v0.9.0/VERSION.json"),
        "utf8"
      ),
      before
    );
    await writeFile(
      path.join(dir, "docs/releases/v0.9.0/QA.md"),
      "Changed after release"
    );
    const result = run("verify");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Frozen archive changed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
