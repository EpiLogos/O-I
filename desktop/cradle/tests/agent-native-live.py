#!/usr/bin/env python3
"""Opt-in live encounter check, NOT full Agent-creation acceptance.

Default: read-only native discovery. --live sends one source-dependent turn to
an already-admitted, idle session. The source bytes are never put in the prompt.
No credentials, profiles, grants, installation, service shutdown or model policy
are written. This checks an existing session; it does not create an Agent.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import time
from typing import Any

class CheckFailed(RuntimeError):
    pass

def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

def decode_reply(raw: str) -> Any:
    value = json.loads(raw)
    if isinstance(value, dict) and "ok" in value:
        if value["ok"] is not True:
            # A provider may print sensitive stderr/message text: publish codes only.
            error = value.get("error") or {}
            code = error.get("code", "native_refusal") if isinstance(error, dict) else "native_refusal"
            raise CheckFailed(f"Native owner refused the request ({code}).")
        return value.get("data")
    return value

def read_probe(path: Path) -> str:
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 65536:
        raise CheckFailed("Use a regular, non-symlink, non-sensitive probe file below 64 KiB.")
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or not re.fullmatch(r"OI_AGENT_PROBE_[a-f0-9]{32}", lines[0]):
        raise CheckFailed("Probe first line must be OI_AGENT_PROBE_ followed by a fresh 32-digit random hexadecimal value.")
    return lines[0]

def new_assistant_text(view: dict, after: int) -> str:
    return "".join(row.get("text", "") for row in view.get("blocks", [])
                   if row.get("kind") == "assistant" and isinstance(row.get("id"), int) and row["id"] > after)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oi", default="oi", help="Exact installed candidate executable; no shell expansion")
    parser.add_argument("--cwd", type=Path, required=True)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--space", required=True)
    parser.add_argument("--session", required=True)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--receipt", type=Path, required=True, help="New local JSON receipt (no transcript or source bytes)")
    parser.add_argument("--live", action="store_true", help="Authorize one real, potentially billable native turn")
    parser.add_argument("--resume", action="store_true", help="Explicitly resume, never create a replacement native session")
    parser.add_argument("--prior-receipt", type=Path, help="Required with --resume; bind reopening to the prior native identity")
    parser.add_argument("--seconds", type=int, default=90)
    args = parser.parse_args()
    if args.receipt.exists():
        parser.error("Receipt already exists; choose a new path to preserve earlier evidence.")
    if args.resume and (not args.live or not args.prior_receipt):
        parser.error("--resume needs --live and --prior-receipt; no automatic service restart is performed.")
    if not 10 <= args.seconds <= 300:
        parser.error("--seconds must be between 10 and 300.")
    executable = shutil.which(args.oi)
    receipt: dict[str, Any] = {
        "schema": "oi.native-encounter-local-check/v1", "observed_unix_seconds": int(time.time()),
        "standing": "not-run", "live_requested": args.live,
        "machine": {"system": platform.system(), "release": platform.release(), "architecture": platform.machine()},
        "checks": {}, "full_agent_creation_acceptance": False,
        "unproved": ["new Agent creation and human acceptance", "Actuation authority outside the native operation's own admission",
                     "independent model identity", "effective skills and brokered-child context", "native Mac UI", "microphone/audio"],
    }
    try:
        if not executable or not args.cwd.is_dir():
            raise CheckFailed("Installed oi executable or selected working directory is unavailable.")
        cwd = args.cwd.resolve()
        receipt["candidate_sha256"] = hashlib.sha256(Path(executable).read_bytes()).hexdigest()
        prefix = [executable, "aikit", "session-space", "-C", str(cwd)]
        def native(*parts: str) -> Any:
            try:
                result = subprocess.run(prefix + list(parts), capture_output=True, text=True, timeout=35, check=False)
            except subprocess.TimeoutExpired as error:
                raise CheckFailed("Native call timed out; an effect may be unknown. Do not replay automatically.") from error
            if result.returncode:
                raise CheckFailed(f"Native process returned {result.returncode}; inspect its private local diagnostics, not a public log.")
            try:
                return decode_reply(result.stdout)
            except (ValueError, TypeError) as error:
                raise CheckFailed("Native reply is unreadable; no success is inferred.") from error
        def call(action: str, **fields: Any) -> Any:
            return native("encounter", "--request-json", json.dumps({"action": action, **fields}))
        def session(action: str, **fields: Any) -> Any:
            return call(action, agent_session=args.session, **fields)
        spaces = native("discover", "--project", args.project_ref)
        attached = isinstance(spaces, list) and any(row.get("definition", {}).get("id") == args.space
                    and args.project_ref in row.get("definition", {}).get("projects", [])
                    and args.session in row.get("agent_sessions", {}) for row in spaces)
        if not attached:
            raise CheckFailed("No exact native Project / SessionSpace / AgentSession attachment was returned.")
        providers = call("providers")
        if not isinstance(providers, list) or not any(row.get("id") == args.provider for row in providers):
            raise CheckFailed("Chosen harness is absent from the actual native provider discovery.")
        receipt["checks"]["exact_native_attachment"] = True
        receipt["checks"]["configured_provider_discovered"] = True
        if not args.live:
            receipt["standing"] = "preflight-only-no-model-turn"
        else:
            if args.source is None:
                raise CheckFailed("--live needs a permitted source file containing a fresh test nonce, never credentials.")
            source = args.source.absolute()
            # Validate no symlink BEFORE resolving the path, and require explicit Project scope.
            token = read_probe(source)
            source = source.resolve()
            if not source.is_relative_to(cwd):
                raise CheckFailed("The probe source must be inside the explicitly selected working directory.")
            prior = None
            if args.resume:
                prior = json.loads(args.prior_receipt.read_text())
                if prior.get("schema") != receipt["schema"] or prior.get("standing") != "source-return-observed":
                    raise CheckFailed("Prior receipt does not prove a completed source-return check.")
                session("reconnect", space=args.space, provider=args.provider, cwd=str(cwd))
            before = session("view")
            connection = before.get("connection") or {}
            native_id = connection.get("native_session_id")
            if connection.get("state") != "Resident" or connection.get("error") or not native_id:
                raise CheckFailed("The native session is not healthy and idle. Connect it explicitly in Cradle first.")
            if (connection.get("provider") or {}).get("id") != args.provider:
                raise CheckFailed("The resident harness differs from the selected native provider.")
            if before.get("draft", {}).get("text", "").strip():
                raise CheckFailed("Session has a preserved draft; it will not be overwritten by this check.")
            if prior and prior.get("native_session_sha256") != fingerprint(native_id):
                raise CheckFailed("Reopening returned a different native session identity.")
            baseline = max([row.get("id", -1) for row in before.get("blocks", [])] or [-1])
            receipt["native_session_sha256"] = fingerprint(native_id)
            receipt["source_sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
            receipt["probe_token_sha256"] = fingerprint(token)
            reading = session("model-read")
            if reading.get("native_session_id") != native_id or reading.get("agent_session") != args.session:
                raise CheckFailed("Model observation is not bound to the same canonical/native session.")
            receipt["checks"]["same_session_model_read"] = True
            receipt["model_identity_standing"] = reading.get("standing")
            prompt = ("Read this permitted local test file using your actual file-reading capability: "
                      + json.dumps(str(source)) + ". Return its first line exactly. Do not guess, do not modify files, "
                      "do not read any other file, and do not ask for credentials.")
            receipt["standing"] = "draft-write-submitted-outcome-unknown"
            draft = session("draft", basis=before["draft"]["revision"], text=prompt)
            receipt["standing"] = "turn-submitted-outcome-unknown"
            session("prompt", draft_revision=draft["revision"])
            deadline = time.monotonic() + args.seconds
            permission_notice = False
            while time.monotonic() < deadline:
                view = session("view")
                connection = view.get("connection") or {}
                if view.get("permissions"):
                    # No blanket approval, automatic denial or hidden permission policy.
                    if not permission_notice:
                        print("A native permission request awaits your review in Cradle; this check will not answer it.")
                        permission_notice = True
                    receipt["checks"]["native_permission_requested"] = True
                    time.sleep(0.4)
                    continue
                if connection.get("error") or connection.get("native_session_id") != native_id:
                    raise CheckFailed("Native transport failed or session changed; outcome remains unknown.")
                text = new_assistant_text(view, baseline)
                if connection.get("state") == "Resident" and token in text:
                    if read_probe(source) != token:
                        raise CheckFailed("Probe changed while the turn was running.")
                    receipt["checks"]["source_dependent_fresh_return"] = True
                    receipt["checks"]["idle_after_return"] = True
                    receipt["checks"]["same_native_reopen"] = bool(prior)
                    receipt["standing"] = "source-return-observed"
                    break
                if connection.get("state") == "Resident" and text:
                    receipt["standing"] = "completed-without-required-source-return"
                    raise CheckFailed("The turn returned without the fresh source token; source-dependent success is not proved.")
                time.sleep(0.4)
            else:
                raise CheckFailed("Bounded observation deadline reached. No automatic replay, service kill or cancellation was performed.")
    except (CheckFailed, OSError, ValueError, KeyError, TypeError) as error:
        if receipt["standing"] == "not-run":
            receipt["standing"] = "blocked-before-proof"
        receipt["failure"] = str(error) if isinstance(error, CheckFailed) else type(error).__name__
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(args.receipt, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(receipt, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"standing": receipt["standing"], "checks": receipt["checks"], "full_agent_creation_acceptance": False}))
    return 0 if receipt["standing"] in ("preflight-only-no-model-turn", "source-return-observed") else 1

if __name__ == "__main__":
    raise SystemExit(main())
