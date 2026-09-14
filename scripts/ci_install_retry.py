#!/usr/bin/env python3
"""Bounded CI retry of idempotent oi install for GitHub attestation API 5xx only.

Native verification is never bypassed. Tests, trust failures, unknown errors and
timeouts are never retried. Use only in a disposable CI installation directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

TRANSIENT = re.compile(
    r"^Error: HTTP (?:502|503|504): [^\n]*"
    r"\(https://api\.github\.com/repos/[\w.-]+/[\w.-]+/attestations/[^\s)]+\)$"
)
SUMMARY = re.compile(r"^oi: GitHub attestation verification failed for [\w.-]+$")
ERROR = re.compile(r"(?:^Error:|^oi:|^fatal:|\bpanic|\binvalid\b|\bmismatch\b|\bfailed\b|\bHTTP [45]\d\d\b)", re.I)


def retryable(output: str) -> bool:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return any(TRANSIENT.fullmatch(line) for line in lines) and all(
        TRANSIENT.fullmatch(line) or SUMMARY.fullmatch(line)
        for line in lines if ERROR.search(line)
    )


def run_install(oi: Path, ground: Path | None, out: Path, *, attempts: int = 3,
                delay: float = 5, timeout: float = 300) -> int:
    if not 1 <= attempts <= 3 or not 0 <= delay <= 30 or not 0 < timeout <= 600:
        raise ValueError("invalid retry budget")
    out.mkdir(parents=True, exist_ok=True)
    argv = [str(oi.resolve()), "install"]
    if ground is not None:
        argv.extend(["--personal-ground", str(ground.resolve())])
    records = []
    for attempt in range(1, attempts + 1):
        log = out / f"attempt-{attempt}.log"
        timed_out = False
        with log.open("xb") as handle:
            # Fresh process group permits bounded cleanup if the installer or
            # a verification child stalls. Uncertain timeout is NOT retryable.
            try:
                process = subprocess.Popen(argv, stdout=handle, stderr=subprocess.STDOUT,
                                           start_new_session=True)
            except OSError as error:
                handle.write(str(error).encode())
                code = 127
            else:
                try:
                    code = process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    timed_out = True
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                    code = 124
        raw = log.read_bytes()
        output = raw.decode("utf-8", errors="replace")
        # Classification never makes a native failure successful.
        again = code != 0 and not timed_out and retryable(output)
        records.append({"attempt": attempt, "exit_code": code, "timed_out": timed_out,
                        "transient_attestation_service_failure": again,
                        "log": log.name, "sha256": hashlib.sha256(raw).hexdigest()})
        report = {"schema": "oi.ci-install-attempts/v1", "operation": "oi install",
                  "standing": "native-install-succeeded" if code == 0 else "failed",
                  "attempts": records, "verification_bypassed": False}
        (out / "attempts.json").write_text(json.dumps(report, indent=2) + "\n")
        # Prevent child output from emitting GitHub workflow control commands.
        print(f"install attempt {attempt}: exit={code}; log={log}", flush=True)
        print("\n".join("| " + line for line in output[-8000:].splitlines()), flush=True)
        if code == 0:
            return 0
        if not again or attempt == attempts:
            return code if code > 0 else 1
        print("Retrying the same idempotent install after attestation-service 5xx; native trust checks remain required.", flush=True)
        time.sleep(delay * attempt)
    raise AssertionError("unreachable")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oi", type=Path, required=True)
    parser.add_argument("--personal-ground", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    return run_install(args.oi, args.personal_ground, args.out)


if __name__ == "__main__":
    sys.exit(main())
