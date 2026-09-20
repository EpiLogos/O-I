#!/usr/bin/env python3
"""Bounded adoption acceptance; never installs into the person's World.

Default: actual oi protocol and terminal checks in one disposable HOME, plus
non-identifying machine facts. --native-read permits current-World readback.
--native-check PROGRAM explicitly permits one execution of each local native
provider/computer-use checker; its exit is retained, not promoted to live proof.
Mac microphone/output capture requires the separate explicit media switches.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import pty
import select
import shutil
import subprocess
import tempfile
import time


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def protocol(oi: Path, home: Path, request: dict) -> tuple[int, dict]:
    env = {"HOME": str(home), "OI_HOME": str(home / "config"),
           "OI_DATA_HOME": str(home / "data"), "PATH": "", "TERM": "xterm-256color"}
    result = subprocess.run([str(oi), "setup", "--request-file", "-", "--json"],
                            input=json.dumps(request).encode(), stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env, cwd=home, timeout=30)
    value = json.loads(result.stdout)
    if value.get("schema") != "oi.setup/v1":
        raise AssertionError("Installed O:I does not provide oi.setup/v1")
    return result.returncode, value


def terminal_cancel(oi: Path, home: Path) -> dict:
    master, slave = pty.openpty()
    env = {"HOME": str(home), "OI_HOME": str(home / "config"),
           "OI_DATA_HOME": str(home / "data"), "PATH": "", "TERM": "xterm-256color"}
    process = subprocess.Popen([str(oi), "setup"], stdin=slave, stdout=slave,
                               stderr=slave, env=env, cwd=home, start_new_session=True)
    os.close(slave)
    output = bytearray()
    sent = False
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if select.select([master], [], [], 0.1)[0]:
                try:
                    chunk = os.read(master, 8192)
                except OSError:
                    break
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > 1024 * 1024:
                    raise AssertionError("Unexpected unbounded terminal output")
                if b"Choose a number" in output and not sent:
                    os.write(master, b"q\n")
                    sent = True
            if process.poll() is not None:
                break
        process.wait(timeout=2)
        if process.returncode != 0 or not sent:
            raise AssertionError(f"Terminal cancel failed: exit={process.returncode}, prompt={sent}")
        if (home / "config").exists() or (home / "data").exists():
            raise AssertionError("Cancelling clean setup wrote native state")
        return {"name": "actual-terminal-cancel", "passed": True,
                "transcript_sha256": digest(bytes(output)), "bytes": len(output)}
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        os.close(master)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oi", default="oi", help="Exact candidate executable; never built or installed here")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--native-read", action="store_true", help="Explicitly read the current native World")
    parser.add_argument("--native-check", action="append", default=[], type=Path,
                        help="Explicitly execute one existing authorised live-provider/computer-use checker")
    parser.add_argument("--mac-microphone", action="store_true")
    parser.add_argument("--mac-audio-output", action="store_true")
    args = parser.parse_args()
    resolved = shutil.which(args.oi) if "/" not in args.oi else args.oi
    if not resolved or not Path(resolved).is_file():
        parser.error("Supply an existing O:I executable")
    oi = Path(resolved).resolve()
    report = {"schema": "oi.adoption-local-check/v1", "scope": "actual CLI in disposable HOME; not product installation",
              "candidate_sha256": digest(oi.read_bytes()),
              "machine": {"system": platform.system(), "release": platform.release(), "architecture": platform.machine()},
              "checks": [], "material_obligations": ["installed native Mac interaction", "actual provider inference", "human audio audibility", "current full corpus publication"],
              "passed": False}
    code = 1
    try:
        with tempfile.TemporaryDirectory(prefix="oi-adoption-acceptance-") as temporary:
            root = Path(temporary)
            clean = root / "clean"; clean.mkdir()
            status, value = protocol(oi, clean, {"action": "discover"})
            assert status == 0 and len(value["discovery"]["products"]) == 6
            assert not (clean / "config").exists() and not (clean / "data").exists()
            report["checks"].append({"name": "clean-actual-discovery-no-write", "passed": True})
            report["checks"].append(terminal_cancel(oi, clean))
            # All compositions remain real native plans. Missing optional owners
            # may block an operation, never become fake installed capabilities.
            for choice in value["discovery"]["choices"]:
                status, plan = protocol(oi, clean, {"action": "plan", "selection": {
                    "composition": choice["id"], "desktop": "keep", "products": [], "remove_products": []}})
                assert status == 0 and plan["plan"]["schema"] == "oi.adoption-plan/v1"
                report["checks"].append({"name": "plan-" + choice["id"], "passed": True,
                                         "blocked_count": len(plan["plan"]["blocked"]), "steps": len(plan["plan"]["steps"])})
            maintenance = root / "maintenance"; maintenance.mkdir()
            _, result = protocol(oi, maintenance, {"action": "plan", "selection": {
                "composition": "custom", "desktop": "remove", "products": [], "remove_products": []}})
            plan = result["plan"]; assert not plan["blocked"]
            request = {"action": "apply", "plan": plan, "approval": plan["review_token"]}
            status, applied = protocol(oi, maintenance, request)
            assert status == 0 and applied["disposition"] == "verified"
            _, repeated = protocol(oi, maintenance, request)
            assert repeated["journal"] == applied["journal"] and repeated["replayed"] is False
            _, checked = protocol(oi, maintenance, {"action": "recheck"})
            assert checked["disposition"] == "verified" and not (maintenance / "Central").exists()
            report["checks"].append({"name": "absent-desktop-noop-and-actual-intent-journal-restart", "passed": True,
                                     "product_installation_proven": False})
        if args.native_read:
            result = subprocess.run([str(oi), "setup", "discover", "--json"], stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, timeout=45)
            reading = json.loads(result.stdout)
            assert result.returncode == 0 and reading["schema"] == "oi.setup/v1"
            report["checks"].append({"name": "current-native-readback", "passed": True,
                                     "target": reading["discovery"]["target"],
                                     "products": [{key: row.get(key) for key in ("id", "present", "registered", "managed")} for row in reading["discovery"]["products"]]})
        for program in args.native_check:
            # The caller explicitly chooses the already-authorised native test.
            # No shell parsing, guessed provider, arbitrary retry or secret log.
            program = program.resolve(strict=True)
            result = subprocess.run([str(program)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
            report["checks"].append({"name": program.name, "scope": "explicit native checker; inspect its owning evidence before live acceptance",
                                     "passed": result.returncode == 0, "exit_code": result.returncode,
                                     "stdout_sha256": digest(result.stdout), "stderr_sha256": digest(result.stderr)})
            assert result.returncode == 0, "Native checker failed; its original evidence remains with its owner"
        if args.mac_microphone or args.mac_audio_output:
            assert platform.system() == "Darwin", "Real Mac media checks require macOS, not a simulated device"
            source = Path(__file__).with_name("adoption-media-check.swift")
            command = ["swift", str(source)]
            if args.mac_microphone: command.append("--microphone")
            if args.mac_audio_output: command.append("--audio-output")
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            media = json.loads(result.stdout)
            report["checks"].append({"name": "native-Mac-media", "passed": result.returncode == 0, "reading": media})
            assert result.returncode == 0, "Native Mac media check did not pass"
        report["passed"] = True; code = 0
    except Exception as error:
        report["failure"] = f"{type(error).__name__}: {error}"
    finally:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({"passed": report["passed"], "report": str(args.output), "checks": len(report["checks"])}))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
