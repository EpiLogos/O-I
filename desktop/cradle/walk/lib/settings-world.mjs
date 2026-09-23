/**
 * A disposable Settings world for the 12-SETTINGS walks: every write a walk
 * makes lands here, never in the owner's real state.
 *
 *   root         a fresh Central ground (ctrl central.init + one project),
 *                also the directory AIKit binds as the walk project
 *   OI_HOME      the O:I desired store / profiles / receipts (empty)
 *   AIKIT_HOME   a fresh AIKit home with one local skill source of three
 *                walk skills, promoted and trusted, bound at the root
 *   OI_CRADLE_STATE  the desktop-held new-chat connection
 *   vault        a varlock-readable .env holding ONE dummy key under a name
 *                no real environment carries — a stored secret for the
 *                credential walks (the owner's keychain is never touched)
 *
 * The owners themselves are the installed suite (`oi`, `aikit` on PATH);
 * only their state is isolated. When the walk names an AIKit build
 * (OI_AIKIT_BIN), the world's PATH leads with it as `aikit`, so the app's
 * configuration reads (oi → aikit) and the walk's own `oi config` reads
 * answer from the same AIKit.
 */
import {execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

export const WALK_SKILLS = ["walk-alpha", "walk-beta", "walk-gamma"];
export const DUMMY_KEY_NAME = "OI_SETTINGS_WALK_DUMMY_KEY";
/** A dummy, key-shaped value that is not a real key for any provider. */
export const DUMMY_KEY = "sk-oi-walk-DUMMY-0000000000000000000000";

export function settingsWorld() {
  const root = mkdtempSync(join(tmpdir(), "oi-settings-ground-"));
  const home = mkdtempSync(join(tmpdir(), "oi-settings-home-"));
  const aikitHome = mkdtempSync(join(tmpdir(), "oi-settings-aikit-"));
  const scratch = mkdtempSync(join(tmpdir(), "oi-settings-scratch-"));
  const cleanup = () => { for (const dir of [root, home, aikitHome, scratch]) rmSync(dir, {recursive: true, force: true}); };
  try {
    const ctrl = process.env.OI_CENTRAL_CTRL_BIN ?? "ctrl";
    const call = (action, input = {}) => {
      const reply = JSON.parse(execFileSync(ctrl, ["--root", root, "--json", "action", "run", action, JSON.stringify(input)], {encoding: "utf8"}));
      if (!reply.ok) throw new Error(JSON.stringify(reply));
      return reply.data;
    };
    call("central.init");
    // The standing Central project the encounter providers are read through
    // (harnessSource.ts reads them "through the standing Central project").
    mkdirSync(join(root, "Work", "Central"));
    call("projectcentral.init", {project: "Central", project_id: "central-walk"});
    const skills = join(scratch, "skills");
    for (const name of WALK_SKILLS) {
      mkdirSync(join(skills, name), {recursive: true});
      writeFileSync(join(skills, name, "SKILL.md"), `---\nname: ${name}\ndescription: A settings-walk skill (${name}) that exists only in this disposable world.\n---\n\n# ${name}\n`);
    }
    const vault = join(scratch, "vault");
    mkdirSync(vault);
    writeFileSync(join(vault, ".env"), `${DUMMY_KEY_NAME}=${DUMMY_KEY}\n`);
    const env = {
      OI_CENTRAL_ROOT: root,
      OI_CENTRAL_PROJECT_QUERY: "Central",
      OI_HOME: home,
      AIKIT_HOME: aikitHome,
      OI_CRADLE_STATE: join(scratch, "chat-defaults.json"),
    };
    if (process.env.OI_AIKIT_BIN) {
      const bin = join(scratch, "bin");
      mkdirSync(bin);
      symlinkSync(process.env.OI_AIKIT_BIN, join(bin, "aikit"));
      env.PATH = `${bin}:${process.env.PATH ?? ""}`;
    }
    const aikitBin = process.env.OI_AIKIT_BIN ?? "aikit";
    const aikit = (...args) => JSON.parse(execFileSync(aikitBin, ["--json", "-C", root, ...args], {encoding: "utf8", env: {...process.env, ...env}}));
    const oi = (...args) => execFileSync(process.env.OI_BIN ?? "oi", args, {encoding: "utf8", cwd: root, env: {...process.env, ...env}});
    for (const step of [["source", "add-directory", "walkskills", skills], ["source", "sync", "walkskills"], ["source", "promote", "walkskills"], ["project", "bind", "settings-walk", "--directory", root, "--no-default-skill-sets"]]) {
      const reply = aikit(...step);
      if (!reply.ok) throw new Error(`aikit ${step.join(" ")}: ${JSON.stringify(reply.error)}`);
    }
    // One skill on at the machine scope so the page has an on and an off.
    const enabled = aikit("enable", "skill/walkskills/walk-alpha", "--scope", "global", "--apply");
    if (!enabled.ok) throw new Error(`aikit enable: ${JSON.stringify(enabled.error)}`);
    // Two connections for new chats (never launched by these walks) and the
    // isolated resident that answers the providers read.
    const central = join(root, "Work", "Central");
    for (const provider of [{id: "walk-pi", label: "Pi · walk", protocol: "pi-rpc", argv: ["/usr/bin/false"]}, {id: "walk-hermes", label: "Hermes · walk", argv: ["/usr/bin/false"]}]) {
      execFileSync(aikitBin, ["--json", "session-space", "-C", central, "encounter-configure", "--provider-json", JSON.stringify(provider)], {encoding: "utf8", env: {...process.env, ...env}});
    }
    const resident = JSON.parse(execFileSync(aikitBin, ["--json", "session-space", "-C", central, "encounter-start"], {encoding: "utf8", env: {...process.env, ...env}}));
    const stop = () => { try { process.kill(-resident.data.pid, "SIGTERM"); } catch { try { process.kill(resident.data.pid, "SIGTERM"); } catch { /* gone */ } } };
    return {root, env, bridgeCwd: root, vault, dummyRef: `varlock://${join(vault, ".env")}/${DUMMY_KEY_NAME}`, aikit, oi, cleanup: () => { stop(); cleanup(); }};
  } catch (error) {
    cleanup();
    throw error;
  }
}
