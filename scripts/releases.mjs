import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  copyFile,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve("docs/releases");
const required = ["PRODUCT.md", "ROADMAP.md", "QA.md", "SUMMARY.md"];
const hash = async file =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const exists = async file => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};
async function sourceFiles() {
  const result = {};
  async function walk(dir) {
    for (const name of (await readdir(dir)).sort()) {
      if ([".git", "node_modules", ".DS_Store"].includes(name)) continue;
      const file = path.join(dir, name),
        s = await stat(file);
      if (file === root) continue;
      if (s.isDirectory()) await walk(file);
      else if (!file.endsWith(".tar.gz"))
        result[path.relative(process.cwd(), file)] = await hash(file);
    }
  }
  await walk(process.cwd());
  return result;
}
export async function verifyArchives() {
  let count = 0;
  for (const folder of await readdir(root)) {
    if (!/^v\d+\.\d+\.\d+$/.test(folder)) continue;
    const dir = path.join(root, folder),
      file = path.join(dir, "VERSION.json");
    if (!(await exists(file))) throw Error(`${folder} has not been frozen`);
    const manifest = JSON.parse(await readFile(file, "utf8"));
    if (manifest.version !== folder.slice(1) || manifest.status !== "frozen")
      throw Error(`Invalid release identity: ${folder}`);
    for (const name of required)
      if (manifest.documents?.[name] !== (await hash(path.join(dir, name))))
        throw Error(`Frozen archive changed: ${folder}/${name}`);
    count++;
  }
  console.log(`Verified ${count} frozen release archives`);
}
export async function freeze(version, copyCurrent = false) {
  if (!/^\d+\.\d+\.\d+$/.test(version || ""))
    throw Error("Use a semantic version such as 0.2.0");
  const dir = path.join(root, "v" + version),
    file = path.join(dir, "VERSION.json");
  if (await exists(file))
    throw Error(
      `Refusing to overwrite frozen v${version}; create a new release`
    );
  if (copyCurrent) {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    if (pkg.version !== version)
      throw Error("Package version does not match release");
  }
  await mkdir(dir, { recursive: true });
  if (copyCurrent)
    for (const name of required.filter(n => n !== "SUMMARY.md"))
      await copyFile(path.join("docs", name), path.join(dir, name));
  const documents = {};
  for (const name of required)
    documents[name] = await hash(path.join(dir, name));
  const manifest = {
    version,
    status: "frozen",
    releaseDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
    }).format(new Date()),
    timezone: "Asia/Hong_Kong",
    documents,
    ...(copyCurrent
      ? { sourceFiles: await sourceFiles() }
      : {
          baselineSitesCommit: "dd65cd7b82ecc0ad69ad20f18315d664a3ebec0d",
          baselineGithubCommit: "69bf93c4e3354fb98b683a227141a14fb7489932",
          note: "Retrospective archive; original v0.1 documents preserved",
        }),
  };
  await writeFile(file, JSON.stringify(manifest, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(`Frozen v${version}: ${required.length} documents`);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  try {
    const [command, version] = process.argv.slice(2);
    if (command === "archive") await freeze(version, true);
    else if (command === "freeze") await freeze(version, false);
    else if (command === "verify") await verifyArchives();
    else throw Error("Use archive <version>, freeze <version>, or verify");
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
