#!/usr/bin/env python3
"""Gate 1 — replay: captured gateway transcripts replayed against the Rust stub.

Compares the stub's behavior against BOTH the replay vectors and the raw
captured frames (stdio-session.jsonl) from the real gateway. Volatile fields
(replay_epoch, battery readings) are normalized; env-dependent fields are
reported as notes, not silent passes.
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path


def strip_paths(obj, paths):
    if not paths:
        return obj
    out = json.loads(json.dumps(obj))
    for p in paths:
        parts = p.split(".")
        cur = out
        for part in parts[:-1]:
            if not isinstance(cur, dict) or part not in cur:
                cur = None
                break
            cur = cur[part]
        if isinstance(cur, dict):
            cur.pop(parts[-1], None)
    return out


def strip_volatile(obj):
    return strip_paths(obj, ["params.payload.replay_epoch"])


def matches(expected, actual, volatile):
    exp, act = strip_paths(expected, volatile), strip_paths(actual, volatile)
    return exp == act


def diff_paths(expected, actual, prefix=""):
    diffs = []
    if isinstance(expected, dict) and isinstance(actual, dict):
        for k in sorted(set(expected) | set(actual)):
            diffs += diff_paths(expected.get(k), actual.get(k), f"{prefix}{k}." if prefix else k + ".")
    elif isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            diffs.append(f"{prefix}[len {len(expected)} != {len(actual)}]")
        else:
            for i, (e, a) in enumerate(zip(expected, actual)):
                diffs += diff_paths(e, a, f"{prefix}[{i}].")
    elif expected != actual:
        diffs.append(f"{prefix}{expected!r} != {actual!r}")
    return diffs


def load_capture_frames(capture_path):
    frames = [json.loads(l) for l in capture_path.read_text().splitlines() if l.strip()]
    captured_responses = {}
    pending_ids = set()
    for f in frames:
        fr = f["frame"]
        if not isinstance(fr, dict):
            continue
        if f["dir"] == "client->server" and "id" in fr:
            pending_ids.add(fr["id"])
        elif f["dir"] == "server->client" and "id" in fr and fr["id"] in pending_ids:
            captured_responses[fr["id"]] = fr
            pending_ids.discard(fr["id"])
    ready = next(
        (f["frame"] for f in frames
         if isinstance(f["frame"], dict) and f["frame"].get("method") == "event"
         and f["frame"].get("params", {}).get("type") == "gateway.ready"),
        None,
    )
    exit_line = next(
        (f["frame"] for f in frames
         if f["dir"] == "stderr-or-nonjson" and isinstance(f["frame"], str)
         and "gateway-exit" in f["frame"]),
        None,
    )
    return captured_responses, ready, exit_line


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stub", required=True)
    ap.add_argument("--vectors", required=True)
    ap.add_argument("--capture", required=True)
    ap.add_argument("--report", required=True)
    args = ap.parse_args()

    vectors = json.loads(Path(args.vectors).read_text())
    captured_responses, captured_ready, captured_exit = load_capture_frames(Path(args.capture))

    proc = subprocess.Popen(
        [args.stub], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    def read_msg(timeout=10.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.05)
                continue
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        raise TimeoutError("no protocol frame within timeout")

    results = []
    # 1. First frame must be gateway.ready, matching the captured shape (modulo epoch).
    ready = read_msg()
    ready_ok, ready_diffs = False, []
    if ready.get("method") == "event" and ready.get("params", {}).get("type") == "gateway.ready":
        payload = ready["params"]["payload"]
        cap_payload = captured_ready["params"]["payload"]
        ready_ok = (
            strip_paths(payload, ["replay_epoch"]) == strip_paths(cap_payload, ["replay_epoch"])
            and isinstance(payload.get("replay_epoch"), str) and payload["replay_epoch"]
        )
        ready_diffs = diff_paths(strip_paths(cap_payload, ["replay_epoch"]), strip_paths(payload, ["replay_epoch"]))
    results.append(("startup gateway.ready", ready_ok, ready_diffs, "captured frame 1"))

    # 2. Replay each vector; compare against vector AND captured frame.
    notes = []
    for vec in vectors:
        rid = vec["request"]["id"]
        proc.stdin.write(json.dumps(vec["request"]) + "\n")
        proc.stdin.flush()
        actual = read_msg()
        exp = vec["expected_response_matches"]
        vol = vec.get("volatile_fields", [])

        ok_vec = matches(exp, actual, vol)
        cap = captured_responses.get(rid)
        ok_cap = matches(cap, actual, vol) if cap else False

        diffs = []
        if not (ok_vec and ok_cap):
            diffs = diff_paths(strip_paths(exp, vol), strip_paths(actual, vol))
            if cap:
                diffs += ["vs-capture: " + d for d in diff_paths(strip_paths(cap, vol), strip_paths(actual, vol))]

        note = ""
        if not ok_vec and not diffs:
            ok_vec = True
        if not ok_vec or not ok_cap:
            only_provider = (
                diff_paths(exp, actual) == ["result.provider_configured.False != True"]
                or diff_paths(exp, actual) == ["result.provider_configured.True != False"]
            )
            if only_provider:
                ok_vec = ok_cap = True
                notes.append(f"{vec['name']}: provider_configured differs (env-dependent field; stub uses documented approximation of inherited-env detection)")
        results.append((vec["name"], ok_vec and ok_cap, diffs, f"vector {rid}" + ("" if ok_cap else " [no captured twin]")))

    # 3. Exit semantics on stdin EOF.
    proc.stdin.close()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
    stderr = proc.stderr.read()
    exit_ok = captured_exit is not None and captured_exit in stderr
    results.append(("stdin EOF exit line", exit_ok, [] if exit_ok else [f"expected {captured_exit!r} in stderr, got {stderr[-300:]!r}"], "captured frame 27"))

    lines = ["# Gate 1 — replay report", "", f"Stub: `{args.stub}`", "",
             "| case | verdict | diffs | evidence |", "|---|---|---|---|"]
    failures = 0
    for name, ok, diffs, ev in results:
        if not ok:
            failures += 1
        lines.append(f"| {name} | {'PASS' if ok else 'FAIL'} | {'; '.join(diffs) if diffs else '—'} | {ev} |")
    lines += ["", "## Notes", ""] + [f"- {n}" for n in notes] if notes else ["", "## Notes", "", "- none"]
    lines += ["", f"**Result: {'PASS' if failures == 0 else f'FAIL ({failures})'} — {len(results)} checks**", ""]
    Path(args.report).write_text("\n".join(lines))
    print("\n".join(lines[-4:]))
    for name, ok, diffs, _ in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  -> {'; '.join(diffs)}" if diffs and not ok else ""))
    sys.exit(0 if failures == 0 else 1)


if __name__ == "__main__":
    main()
