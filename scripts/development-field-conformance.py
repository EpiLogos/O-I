#!/usr/bin/env python3
"""Native-owner bounded conformance; never promotes incomplete work to whole-suite C."""
from __future__ import annotations
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MODULE = importlib.util.spec_from_file_location("native_ci", ROOT / "scripts/development-field-ci.py")
native = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(native)
CUT = ROOT / "tests/development-field/cut.json"
PROBE = ROOT / "tests/development-field/probe"
OWNERS = ROOT / ".development-field-owners"

def checked_source(owner: dict) -> Path:
    source = OWNERS / owner["id"]
    if native.capture(["git", "rev-parse", "HEAD"], source) != owner["revision"]:
        raise ValueError("owner HEAD differs from the single source cut")
    if native.capture(["git", "diff", "--name-only", "HEAD"], source):
        raise ValueError("tracked owner source was modified after checkout")
    return source

def command(argv: list[str], cwd: Path, out: Path, label: str, env: dict | None = None) -> dict:
    log = out / (label + ".log")
    print("+", " ".join(argv), flush=True)
    with log.open("w") as handle:
        result = subprocess.run(argv, cwd=cwd, env=env, stdout=handle, stderr=subprocess.STDOUT)
    record = {"argv": argv, "cwd": str(cwd), "exit_code": result.returncode, "log": log.name, "sha256": native.digest(log)}
    native.write(out / (label + ".json"), record)
    print(log.read_text(errors="replace")[-20000:], flush=True)
    if result.returncode:
        raise RuntimeError(f"{label} failed: {result.returncode}; see {log}")
    return record

def prepare(out: Path) -> None:
    for owner_id in sorted(native.IDS):
        owner = native.cut_owner(CUT, owner_id)
        args = argparse.Namespace(source=OWNERS / owner_id, out=out / "source" / owner_id, cut=CUT)
        native.prepare(args, owner)

def probe(out: Path, bootstrap_lock: bool) -> None:
    for owner_id in native.IDS:
        checked_source(native.cut_owner(CUT, owner_id))
    lock = PROBE / "Cargo.lock"
    existed = lock.is_file()
    if not existed and not bootstrap_lock:
        raise ValueError("conformance requires committed Cargo.lock; explicit bootstrap is evidence preparation only")
    if not existed:
        command(["cargo", "generate-lockfile", "--manifest-path", str(PROBE / "Cargo.toml")], ROOT, out, "probe-lock-bootstrap")
    native.write(out / "dependency-lock.json", {"sha256": native.digest(lock), "standing": "committed-lock" if existed else "bootstrap-candidate-lock", "whole_C": "not-established"})
    env = dict(os.environ, DF_HARNESS_ROOT=str(ROOT), DF_EVIDENCE_ROOT=str(out / "specimen"), DF_CUT_SHA256=native.digest(CUT))
    command(["cargo", "run", "--manifest-path", str(PROBE / "Cargo.toml"), "--locked"], ROOT, out, "bounded-native-probe", env)

# O:I's existing public explicit-source overrides, not a new binary resolver.
PRODUCTS = [
    ("central", "central", "ctrl", "OI_CENTRAL_CTRL_BIN", "Cargo.toml", "ctrl"),
    ("actuation", "actuation", "actuation", "OI_ACTUATION_BIN", None, None),
    ("ai-kit", "aikit", "aikit", "OI_AIKIT_BIN", "Cargo.toml", "aikit-cli"),
    ("software-factory", "factory", "factory", "OI_FACTORY_BIN", "Cargo.toml", "epilogos-factory"),
    ("workcell", "workcell", "workcell", "OI_WORKCELL_BIN", "Cargo.toml", "epilogos-workcell-cli"),
    ("quaternal-logic", "ql", "ql", "OI_QL_BIN", "Cargo.toml", "ql-cli"),
]

def dispatch(out: Path) -> None:
    oi_owner = native.cut_owner(CUT, "oi")
    oi_source = checked_source(oi_owner)
    command(["cargo", "build", "--manifest-path", "cli/Cargo.toml", "--bin", "oi", "--locked"], oi_source, out, "build-oi")
    oi = oi_source / "cli/target/debug/oi"
    home = out / "dispatch-home"
    home.mkdir(exist_ok=True)
    poison = out / "poisoned-path"
    poison.mkdir(exist_ok=True)
    env = dict(os.environ)
    for key in list(env):
        if key.startswith("OI_") or key in {"CENTRAL_ROOT", "AIKIT_HOME"}:
            del env[key]
    env.update(HOME=str(home), OI_HOME=str(home / ".config/oi"), OI_DATA_HOME=str(home / ".local/share/oi"), NO_COLOR="1")
    for _, _, name, _, _, _ in PRODUCTS:
        fake = poison / name
        fake.write_text("#!/bin/sh\necho 'POISONED-PATH-MUST-NOT-RUN' >&2\nexit 79\n")
        fake.chmod(0o755)
    env["PATH"] = str(poison) + os.pathsep + os.environ["PATH"]
    results = []
    record = {"schema": "oi.development-field-source-dispatch/v1", "modality": "explicit-source-binding", "status": "failed", "whole_C": "not-established", "oi": {"revision": oi_owner["revision"], "executable": str(oi), "sha256": native.digest(oi)}, "products": results}
    try:
        for owner_id, namespace, binary_name, variable, manifest, package in PRODUCTS:
            owner = native.cut_owner(CUT, owner_id)
            source = checked_source(owner)
            if manifest:
                command(["cargo", "build", "--manifest-path", manifest, "--package", package, "--bin", binary_name, "--locked"], source, out, "build-" + owner_id)
                executable = source / "target/debug" / binary_name
            else:
                executable = source / "bin" / binary_name
            native_env = dict(env, **{variable: str(executable)})
            direct = subprocess.run([str(executable), "--help"], cwd=home, env=native_env, capture_output=True)
            routed = subprocess.run([str(oi), namespace, "--help"], cwd=home, env=native_env, capture_output=True)
            (out / (owner_id + "-direct.stdout")).write_bytes(direct.stdout)
            (out / (owner_id + "-routed.stdout")).write_bytes(routed.stdout)
            (out / (owner_id + "-routed.stderr")).write_bytes(routed.stderr)
            if direct.returncode != 0 or routed.returncode != direct.returncode or routed.stdout != direct.stdout:
                raise AssertionError(f"native/source dispatch parity failed for {owner_id}: {routed.stderr.decode(errors='replace')}")
            bad_env = dict(native_env, **{variable: str(out / "missing-executable")})
            bad = subprocess.run([str(oi), namespace, "--help"], cwd=home, env=bad_env, capture_output=True)
            if bad.returncode == 0 or b"POISONED-PATH-MUST-NOT-RUN" in bad.stdout + bad.stderr:
                raise AssertionError(f"explicit missing binding fell through for {owner_id}")
            results.append({"owner": owner_id, "revision": owner["revision"], "namespace": namespace, "executable": str(executable), "sha256": native.digest(executable), "tree": native.capture(["git", "rev-parse", "HEAD^{tree}"], source), "lock_sha256": native.digest(source / "Cargo.lock") if (source / "Cargo.lock").exists() else None, "direct_exit": direct.returncode, "routed_exit": routed.returncode, "stdout_sha256": native.digest(out / (owner_id + "-direct.stdout")), "missing_binding_exit": bad.returncode, "poisoned_path_bypassed": True})
        record["status"] = "passed"
    finally:
        native.write(out / "source-dispatch.json", record)

def full_gate(out: Path) -> None:
    # A passing smaller seam is useful C evidence, not a completion certificate.
    # Replace pending claims only with executed native proofs, not closed issues.
    native.write(out / "whole-development-field.json", {
        "schema": "oi.development-field-whole-conformance/v1", "status": "incomplete", "cut_sha256": native.digest(CUT),
        "bounded_specimen": "passed" if (out / "specimen/bounded-conformance.json").exists() else "not-established",
        "source_dispatch": json.loads((out / "source-dispatch.json").read_text()).get("status") if (out / "source-dispatch.json").exists() else "not-established",
        "deterministic_remaining": ["S0 active candidate/receipt install-update-repair-rollback on accepted main", "S1 root/Project self aperture and tier/UX/EX owner contract through this specimen", "S3 bounded Development Field packet plus accepted QL carrier consumption through this specimen"],
        "blocked_on_QL_123": ["final Vāk/C′/Wiki/Context-Frame conformance"],
        "not_claimed": ["live model/provider P", "owner-machine material M", "human EX/Recognition H"]})
    raise RuntimeError("whole Development Field C is not complete; bounded proof cannot satisfy unexercised S0/S1/S3")

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prepare", "probe", "dispatch", "whole-gate"])
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--bootstrap-lock", action="store_true")
    args = parser.parse_args()
    out = args.out.resolve(); out.mkdir(parents=True, exist_ok=True)
    try:
        if args.phase == "prepare": prepare(out)
        elif args.phase == "probe": probe(out, args.bootstrap_lock)
        elif args.phase == "dispatch": dispatch(out)
        else: full_gate(out)
        return 0
    except Exception as error:
        native.write(out / (args.phase + "-failure.json"), {"phase": args.phase, "status": "failed", "error": str(error), "harness_revision": os.environ.get("GITHUB_SHA"), "cut_sha256": native.digest(CUT)})
        print(str(error), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
