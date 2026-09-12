#!/usr/bin/env python3
"""Exact owner source-cut evidence. A test cut is not an installed-suite selector."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
IDS = {"oi", "central", "actuation", "ai-kit", "software-factory", "workcell", "quaternal-logic"}

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def cut_owner(cut: Path, owner_id: str) -> dict:
    data = json.loads(cut.read_text())
    owners = data.get("owners", [])
    if data.get("schema") != "oi.development-field-cut/v1" or len(owners) != 7 or {x["id"] for x in owners} != IDS:
        raise ValueError("cut must contain exactly the seven distinct native owners")
    for owner in owners:
        if not re.fullmatch(r"[0-9a-f]{40}", owner["revision"]):
            raise ValueError("every owner needs an exact full commit SHA")
        if not re.fullmatch(r"EpiLogos/[A-Za-z0-9_.-]+", owner["repository"]):
            raise ValueError("invalid owner repository")
    return next(x for x in owners if x["id"] == owner_id)

def capture(command: list[str], cwd: Path | None = None) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True, stderr=subprocess.STDOUT).strip()

def api(path: str) -> object:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "oi-development-field-ci"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request("https://api.github.com/" + path, headers=headers), timeout=45) as response:
        return json.load(response)

def prepare(args: argparse.Namespace, owner: dict) -> None:
    source, out = args.source.resolve(), args.out.resolve()
    if source.exists():
        raise ValueError("prepare requires a new isolated checkout")
    source.mkdir(parents=True)
    for command in (["git", "init", "-q"], ["git", "remote", "add", "origin", "https://github.com/" + owner["repository"] + ".git"], ["git", "fetch", "--depth=1", "origin", owner["revision"]], ["git", "checkout", "--detach", "FETCH_HEAD"]):
        subprocess.run(command, cwd=source, check=True)
    actual = capture(["git", "rev-parse", "HEAD"], source)
    if actual != owner["revision"]:
        raise ValueError("checkout differs from the exact source cut")
    remote_main = capture(["git", "ls-remote", "--exit-code", "origin", "refs/heads/main"], source).split()[0]
    out.mkdir(parents=True, exist_ok=True)
    context = {"schema": "oi.development-field-source/v1", "owner": owner, "head": actual,
               "tree": capture(["git", "rev-parse", "HEAD^{tree}"], source),
               "remote_main_at_observation": remote_main, "still_current_main": remote_main == actual,
               "harness_revision": os.environ.get("GITHUB_SHA"), "cut_sha256": digest(args.cut), "evidence_grades_claimed": []}
    try:
        track = api(f"repos/{owner['repository']}/issues/{owner['track']}")
        context["track"] = {key: track.get(key) for key in ("number", "title", "state", "updated_at", "html_url")}
        runs, page = [], 1
        while True:
            response = api(f"repos/{owner['repository']}/actions/runs?head_sha={actual}&per_page=100&page={page}")
            batch = response.get("workflow_runs", [])
            runs.extend({key: run.get(key) for key in ("id", "name", "path", "head_sha", "event", "status", "conclusion", "run_attempt", "html_url")} for run in batch)
            if len(batch) < 100:
                break
            page += 1
        context["observed_owner_workflows"] = runs
    except Exception as error:
        context["metadata_observation_error"] = str(error)
    write(out / "source.json", context)
    write(out / "tracked-files.json", capture(["git", "ls-files"], source).splitlines())
    subprocess.run(["git", "archive", "--format=tar.gz", "--output", str(out / "source-context.tar.gz"), "HEAD"], cwd=source, check=True)

def native_commands(source: Path, owner_id: str) -> tuple[list[list[str]], list[str]]:
    if owner_id == "oi":
        commands = [["cargo", "fmt", "--manifest-path", "cli/Cargo.toml", "--", "--check"],
                    ["cargo", "check", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked"],
                    ["cargo", "clippy", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked", "--", "-D", "warnings"],
                    ["cargo", "test", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked", "--no-fail-fast"],
                    [sys.executable, "-m", "json.tool", "surfaces.json"]]
        return commands, [".github/workflows/verify.yml"]
    descriptor = json.loads((source / ".oi/product.json").read_text())
    if descriptor.get("id") != owner_id:
        raise ValueError("native descriptor identity differs from the selected owner")
    command = descriptor.get("verify", {}).get("source_command")
    if not isinstance(command, list) or not command or any(not isinstance(x, str) or not x for x in command):
        raise ValueError("native descriptor has no valid source_command")
    commands, authorities = [], [".oi/product.json"]
    # The owner's own declared build precedes its declared source verification.
    build = descriptor.get("build", {}).get("command")
    if isinstance(build, list) and build and all(isinstance(x, str) and x for x in build):
        commands.append(build)
    # Do not impose a new uniform lint regime. These are the owner's own gates.
    if owner_id in {"software-factory", "workcell", "quaternal-logic"}:
        commands.append(["cargo", "fmt", "--all", "--", "--check"])
    if owner_id in {"ai-kit", "software-factory", "workcell", "quaternal-logic"}:
        commands.append(["cargo", "clippy", "--workspace", "--all-targets", "--locked", "--", "-D", "warnings"])
        authorities.append({"ai-kit": "scripts/verify", "software-factory": ".github/workflows/factory-rust.yml", "workcell": "scripts/verify.sh", "quaternal-logic": ".github/workflows/ql-mef-rust.yml"}[owner_id])
    command = list(command)
    if command[:2] == ["cargo", "test"] and "--no-fail-fast" not in command:
        command.append("--no-fail-fast")
    commands.append(command)
    if owner_id in {"actuation", "workcell", "quaternal-logic"}:
        commands.append(["bash", "scripts/verify-native-skills.sh"])
        authorities.append(".github/workflows/native-skills.yml")
    if owner_id == "software-factory":
        for script in ["validate_agent_capability_intake.py", "validate_routine_continuation.py", "validate_self_hosting_commission.py", "validate_factory_skills.py"]:
            commands.append([sys.executable, "scripts/" + script])
            authorities.append("scripts/" + script)
    return commands, authorities

def native(args: argparse.Namespace, owner: dict) -> int:
    source, out = args.source.resolve(), args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    actual = capture(["git", "rev-parse", "HEAD"], source)
    if actual != owner["revision"]:
        raise ValueError("native gate refuses a different owner revision")
    record = {"schema": "oi.development-field-native-evidence/v1", "owner": owner, "head": actual,
              "harness_revision": os.environ.get("GITHUB_SHA"), "cut_sha256": digest(args.cut),
              "status": "failed", "scope": "native-declared-source-tests-and-owner-required-quality", "commands": [],
              "D": "not-established", "C": "not-established", "P": "not-exercised", "M": "not-exercised", "H": "not-exercised"}
    try:
        commands, authorities = native_commands(source, owner["id"])
        record["command_authorities"] = [{"path": path, "sha256": digest(source / path)} for path in authorities]
        if any(command[:2] in (["cargo", "fmt"], ["cargo", "clippy"]) for command in commands):
            toolchain = capture(["rustup", "show", "active-toolchain"], source).split()[0]
            components = ["clippy"] + (["rustfmt"] if any(c[:2] == ["cargo", "fmt"] for c in commands) else [])
            subprocess.run(["rustup", "component", "add", "--toolchain", toolchain, *components], cwd=source, check=True)
        record["toolchain"] = {}
        for name, command in {"rust": ["rustc", "-Vv"], "cargo": ["cargo", "-V"], "node": ["node", "--version"], "python": [sys.executable, "--version"], "git": ["git", "--version"]}.items():
            try:
                record["toolchain"][name] = capture(command, source)
            except (OSError, subprocess.CalledProcessError) as error:
                record["toolchain"][name] = str(error)
        for index, command in enumerate(commands):
            log = out / f"native-{index:02d}.log"
            print("+ " + " ".join(command), flush=True)
            with log.open("w") as handle:
                process = subprocess.run(command, cwd=source, stdout=handle, stderr=subprocess.STDOUT, check=False)
            record["commands"].append({"argv": command, "exit_code": process.returncode, "log": log.name, "sha256": digest(log)})
            print(log.read_text(errors="replace")[-16000:], flush=True)
        if all(x["exit_code"] == 0 for x in record["commands"]):
            record["status"], record["D"] = "passed", "passed-for-declared-scope"
            return 0
        return 1
    except Exception as error:
        record["error"] = str(error)
        return 1
    finally:
        write(out / "native.json", record)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prepare", "native"])
    parser.add_argument("--cut", type=Path, default=ROOT / "tests/development-field/cut.json")
    parser.add_argument("--owner", required=True, choices=sorted(IDS))
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    owner = cut_owner(args.cut, args.owner)
    if args.phase == "prepare":
        prepare(args, owner)
        return 0
    return native(args, owner)

if __name__ == "__main__":
    sys.exit(main())
