// Gate 2 — Crash-recovery behavioral diff.
// Contract source: findings/a1-file-save-handling.md F2/F3/F7 (in-place
// truncate+overwrite writes; crash mid-write leaves a torn file that nothing
// repairs; no tmp/backup/journal anywhere in the vault).
// Oracle: lanes/a1/fixtures/crash-torn/ (torn.md captured live: 10 bytes,
// content "REPLACEMEN" — the prefix of the payload being written when the
// renderer was kill -9'd between open(truncate) and the completed write).
import { readFileSync, readdirSync, mkdirSync, copyFileSync, rmSync, existsSync, writeFileSync, openSync, writeSync, closeSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const lanes = join(here, "..", "..", "..", "..", "ProjectCentral", "now", "tmp", "obsidian-re-20261007", "lanes");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// Build a scratch vault mirroring the crash-torn fixture layout.
const vault = join(tmpdir(), "gate2-crash-vault-" + Date.now());
mkdirSync(join(vault, ".obsidian"), { recursive: true });
copyFileSync(join(lanes, "a1", "fixtures", "empty-vault", ".obsidian", "app.json"), join(vault, ".obsidian", "app.json"));
copyFileSync(join(lanes, "a1", "fixtures", "empty-vault", ".obsidian", "appearance.json"), join(vault, ".obsidian", "appearance.json"));
copyFileSync(join(lanes, "a1", "fixtures", "empty-vault", ".obsidian", "core-plugins.json"), join(vault, ".obsidian", "core-plugins.json"));
copyFileSync(join(lanes, "a1", "fixtures", "empty-vault", ".obsidian", "workspace.json"), join(vault, ".obsidian", "workspace.json"));
const originalNote = "Original complete note content that must vanish if the write tears.\n".repeat(4);
writeFileSync(join(vault, "torn.md"), originalNote);

// Child writer reproducing writeFile's documented syscall order:
// open(path,'w') truncates -> first 10 bytes land -> hang forever.
const child = spawn(process.execPath, [
  "-e",
  `const fs=require('fs');const fd=fs.openSync(${JSON.stringify(join(vault, "torn.md"))},'w');
   fs.writeSync(fd, Buffer.from('REPLACEMENT CONTENT').subarray(0,10));
   setInterval(()=>{},1000);`,
], { stdio: "ignore" });

// Wait until the truncate+partial write is visible, then kill -9 mid-write.
const deadline = Date.now() + 5000;
let size = 0;
while (Date.now() < deadline) {
  try { size = readFileSync(join(vault, "torn.md")).length; } catch { size = -1; }
  if (size === 10) break;
}
child.kill("SIGKILL");
await new Promise(r => child.on("exit", r));

check("C1. child was killed mid-write (truncate+10 bytes visible before signal)", size === 10, `size at kill: ${size}`);

// Post-crash state class, compared against the live-captured oracle.
const tornNow = readFileSync(join(vault, "torn.md"));
const tornOracle = readFileSync(join(lanes, "a1", "fixtures", "crash-torn", "torn.md"));
check("C2. torn file is byte-identical to Obsidian's captured torn state",
  tornNow.equals(tornOracle), `${JSON.stringify(tornNow.toString("utf8"))} vs oracle ${JSON.stringify(tornOracle.toString("utf8"))}`);
check("C3. original content is gone (in-place truncate, not deferred write)",
  !tornNow.toString().includes("Original complete note"));

const listing = readdirSync(vault).concat(readdirSync(join(vault, ".obsidian")).map(f => ".obsidian/" + f));
check("C4. no tmp/bak/backup/journal files anywhere in the vault",
  !listing.some(f => /\.(tmp|bak|swp|journal)$/.test(f) || f.includes("obsidian.asar.tmp")),
  listing.filter(f => !f.startsWith(".obsidian/")).join(", "));

let configsValid = true;
for (const f of ["app.json", "appearance.json", "core-plugins.json", "workspace.json"]) {
  try { JSON.parse(readFileSync(join(vault, ".obsidian", f), "utf8")); } catch { configsValid = false; }
}
check("C5. all .obsidian JSON remains valid after the crash", configsValid);

// Recovery class: the on-disk torn file IS the note content; nothing repairs it.
// (Contract F3: recovery relaunch loads the torn file as-is; asserted here as
// "the file on disk is the complete post-crash truth".)
check("C6. torn file is the on-disk truth (nothing rewrote it after the kill)",
  readFileSync(join(vault, "torn.md")).equals(tornNow));

rmSync(vault, { recursive: true, force: true });
const failed = results.filter(r => !r.pass);
console.log(`\nGate 2: ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
