#!/usr/bin/env python3
"""Public updater regression using two real, independently qualified O:I images.

The caller supplies exact source cuts and artifact digests. The receiver is fresh
and isolated; its first receipt is produced by the native updater. No scripted
product, provider, source build, installed-world mutation or fabricated receipt
is used. Run the same driver against the original and repaired updater.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import time


def digest(path):
    result = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while block := stream.read(262144):
            result.update(block)
    return result.hexdigest()


def group_readback(group):
    if sys.platform == "darwin":
        # Darwin may return EPERM from killpg(0) after retiring an orphaned
        # group. Query membership independently, never infer absence from it.
        native = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
        native.proc_listpgrppids.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
        members = (ctypes.c_int * 16384)()
        ctypes.set_errno(0)
        count = native.proc_listpgrppids(group, members, ctypes.sizeof(members))
        error = ctypes.get_errno()
        return {"absent": count == 0 and error == 0, "basis": "native proc_listpgrppids",
                "count": count, "errno": error,
                "members": list(members[:count]) if 0 < count < len(members) else []}
    try:
        os.killpg(group, 0)
        return {"absent": False, "basis": "killpg group exists"}
    except ProcessLookupError:
        return {"absent": True, "basis": "killpg ESRCH"}
    except OSError as error:
        return {"absent": False, "basis": "group observation unavailable", "errno": error.errno}


def main():
    # These are executed assertions about actual native effects. Refuse an
    # interpreter which would erase them before any fixture or process starts.
    if sys.flags.optimize:
        raise SystemExit("native updater regression refused: Python assertions are disabled")
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("updater", "previous", "candidate", "repo", "receiver"):
        parser.add_argument("--" + name, required=True, type=Path)
    for name in ("previous-cut", "candidate-cut", "updater-sha256", "previous-sha256", "candidate-sha256"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--expect", required=True, choices=("original-failure", "repaired"))
    args = parser.parse_args()
    args.repo = args.repo.resolve(strict=True)
    args.receiver = args.receiver.resolve()
    for name in ("updater", "previous", "candidate"):
        path = getattr(args, name).resolve(strict=True)
        assert digest(path) == getattr(args, name + "_sha256"), name + " artifact digest mismatch"
        setattr(args, name, path)
    for cut in (args.previous_cut, args.candidate_cut):
        assert len(cut) == 40 and all(c in "0123456789abcdef" for c in cut), "exact Git cut required"
        subprocess.run(["git", "-C", str(args.repo), "cat-file", "-e", cut + "^{commit}"],
                       check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    args.receiver.mkdir(parents=True, exist_ok=False)
    home = args.receiver / "home"
    state = args.receiver / "state"
    data = args.receiver / "data"
    ground = args.receiver / "ground"
    for directory in (home, state, ground / "Work", args.receiver / "tmp"):
        directory.mkdir(parents=True)
    # Reference the existing source repository; never create a second checkout.
    (ground / "Work/O-I").symlink_to(args.repo.resolve(), target_is_directory=True)
    (state / "composition.json").write_text(json.dumps({"schema": 1, "personal_ground": str(ground), "modules": {}}))
    environment = {k: v for k, v in os.environ.items() if k not in ("OI_HOME", "OI_DATA_HOME", "XDG_DATA_HOME")}
    environment.update(HOME=str(home), OI_HOME=str(state), OI_DATA_HOME=str(data), TMPDIR=str(args.receiver / "tmp"))
    steps = []
    started = time.time()

    def run(label, words, artifact=args.candidate, executable=args.updater, expected_failure=None, timeout=20):
        # PATH admits only the named real image and OS utilities. In particular,
        # no live AIKit gateway is discovered or restarted by resident reporting.
        env = dict(environment, PATH=str(artifact.parent) + ":/usr/bin:/bin")
        assert all(hasattr(os, name) for name in ("waitid", "WNOWAIT", "WEXITED", "WNOHANG")), "finite unreaped child observation is unavailable"
        process = subprocess.Popen([str(executable), *words], env=env, stdin=subprocess.DEVNULL,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        step = {"label": label, "executable": str(executable), "words": words, "owned_pid_group": process.pid}
        steps.append(step)
        process_receipt = args.receiver / (label + ".process.json")
        streams = {"stdout": bytearray(), "stderr": bytearray()}
        failure = None
        failure_kind = None
        exit_observed_without_reap = False
        deadline = time.monotonic() + timeout
        try:
            process_receipt.write_text(json.dumps(step, indent=2))
            with selectors.DefaultSelector() as poller:
                for name, stream in (("stdout", process.stdout), ("stderr", process.stderr)):
                    os.set_blocking(stream.fileno(), False)
                    poller.register(stream, selectors.EVENT_READ, name)
                while poller.get_map():
                    remaining_time = deadline - time.monotonic()
                    if remaining_time <= 0:
                        raise TimeoutError("deadline including output EOF")
                    for key, _ in poller.select(min(remaining_time, .05)):
                        try:
                            block = os.read(key.fd, 8192)
                        except BlockingIOError:
                            continue
                        if not block:
                            poller.unregister(key.fileobj)
                            continue
                        remaining_bytes = 262144 - sum(len(value) for value in streams.values())
                        streams[key.data].extend(block[:remaining_bytes])
                        if len(block) > remaining_bytes:
                            raise OverflowError("bounded native output exceeded")
                while True:
                    observed = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                    if observed is not None and observed.si_pid == process.pid:
                        exit_observed_without_reap = True
                        break
                    if time.monotonic() >= deadline:
                        raise TimeoutError("deadline including native exit")
                    time.sleep(.01)
        except BaseException as error:
            failure = str(error)
            failure_kind = "output_limit" if isinstance(error, OverflowError) else "deadline" if isinstance(error, (TimeoutError, subprocess.TimeoutExpired)) else "io"
        finally:
            # Normal EOF also retains the leader until actual exit is observed
            # without reaping. Retire descendants before releasing that PID on
            # both success and refusal; never resignal after the final wait.
            observed = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            exit_observed_without_reap = observed is not None and observed.si_pid == process.pid
            retirement = group_readback(process.pid)
            only_exited_leader = exit_observed_without_reap and retirement.get("members") == [process.pid]
            # A reserved, exited leader is not a surviving descendant. Darwin
            # refuses signals to that zombie-only group; final wait releases it.
            if not retirement["absent"] and not only_exited_leader:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as error:
                    failure = (failure or "") + "; owned group retirement failed: " + str(error)
                    failure_kind = "cleanup"
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                failure = (failure or "") + "; owned leader reap unconfirmed within cleanup budget"
                failure_kind = "cleanup"
            process.stdout.close()
            process.stderr.close()
        stdout, stderr = bytes(streams["stdout"]), bytes(streams["stderr"])
        (args.receiver / (label + ".stdout")).write_bytes(stdout)
        (args.receiver / (label + ".stderr")).write_bytes(stderr)
        readback_deadline = time.monotonic() + .25
        while True:
            group = group_readback(process.pid)
            if group["absent"] or time.monotonic() >= readback_deadline:
                break
            time.sleep(.01)
        step.update({"status": process.returncode, "stdout_bytes": len(stdout), "stderr_bytes": len(stderr),
                      "failure": failure, "failure_kind": failure_kind,
                      "exit_observed_without_reap": exit_observed_without_reap,
                      "group_before_final_wait": retirement,
                      "only_exited_leader_before_final_wait": only_exited_leader,
                      "owned_leader_reaped": process.returncode is not None, "owned_group_absent": group["absent"],
                      "group_readback": group})
        process_receipt.write_text(json.dumps(step, indent=2))
        assert failure_kind == expected_failure, label + ": " + str(failure)
        assert group["absent"], label + ": owned process group still present or unreadable at readback"
        return process.returncode, stdout, stderr

    def plan(label, cut, artifact, rebuild=False):
        words = ["update", "--check", "--json", "--candidate", "oi=" + cut]
        if rebuild:
            words.append("--rebuild")
        code, stdout, stderr = run(label, words, artifact)
        assert code in (0, 1), stderr.decode(errors="replace")
        result = json.loads(stdout)
        assert len(result["products"]) == 1 and result["products"][0]["product"] == "oi"
        return result["products"][0]

    active = data / "receipts/updates/active.json"
    previous_receipt = data / "receipts/updates/previous.json"
    activation = home / ".local/bin/oi"
    receipt = {"schema": "oi.actual-artifact-upgrade-proof/v1", "expectation": args.expect,
               "updater_sha256": args.updater_sha256, "previous_sha256": args.previous_sha256,
               "candidate_sha256": args.candidate_sha256, "previous_cut": args.previous_cut,
               "candidate_cut": args.candidate_cut, "source_repository": str(args.repo), "steps": steps,
               "installed_world_modified": False}
    try:
        # Exercise finite capture against actual OS processes, separately from
        # product acceptance. Neither process pretends to be an O:I artifact.
        run("driver-stuck-process-refusal", ["30"], executable=Path("/bin/sleep"), expected_failure="deadline", timeout=.3)
        run("driver-noisy-process-refusal", ["native-updater-proof-output"], executable=Path("/usr/bin/yes"), expected_failure="output_limit")
        run("driver-term-ignoring-descendant-refusal", ["-c", "trap '' TERM; sleep 30 & child=$!; echo $child; wait"],
            executable=Path("/bin/sh"), expected_failure="deadline", timeout=.3)
        run("driver-exited-leader-inherited-pipe-refusal", ["-c", "sleep 30 & child=$!; echo $child; exit 0"],
            executable=Path("/bin/sh"), expected_failure="deadline", timeout=.3)
        run("driver-exited-leader-closed-pipe-descendant-retirement",
            ["-c", "trap '' TERM; sleep 30 >/dev/null 2>&1 & child=$!; echo $child; exit 0"], executable=Path("/bin/sh"))
        for name in ("previous", "candidate"):
            code, stdout, stderr = run(name + "-version", ["--version"], executable=getattr(args, name))
            cut = getattr(args, name + "_cut")
            assert code == 0 and cut[:12].encode() in stdout + stderr, name + " does not name its exact qualified cut"
        first = plan("initial-plan", args.previous_cut, args.previous)
        assert first["action"] == "adopt", first
        code, _, stderr = run("initial-adoption", ["update", "--apply", "--candidate", "oi=" + args.previous_cut], args.previous)
        assert code == 0, stderr.decode(errors="replace")
        before = active.read_bytes()
        installed = json.loads(before)["products"]["oi"]
        assert installed["revision"] == args.previous_cut and installed["sha256"] == args.previous_sha256
        assert installed["provenance"] == "adopted" and not installed["build_command"]
        assert digest(activation) == args.previous_sha256
        wrong = plan("wrong-cut-refusal", args.candidate_cut, args.previous)
        assert wrong["action"] == "build", wrong
        forced = plan("explicit-rebuild-plan", args.candidate_cut, args.candidate, rebuild=True)
        assert forced["action"] == "build", forced
        assert active.read_bytes() == before and digest(activation) == args.previous_sha256
        next_plan = plan("receipted-upgrade-plan", args.candidate_cut, args.candidate)
        receipt["observed_upgrade_plan"] = next_plan
        if args.expect == "original-failure":
            assert next_plan["action"] == "build", "original failure no longer reproduced"
            assert active.read_bytes() == before and digest(activation) == args.previous_sha256
            receipt["result"] = "original failure preserved: existing receipt hides the qualified external image"
            return
        assert next_plan["action"] == "adopt", next_plan
        code, _, stderr = run("receipted-upgrade", ["update", "--apply", "--candidate", "oi=" + args.candidate_cut])
        assert code == 0, stderr.decode(errors="replace")
        upgraded = json.loads(active.read_bytes())["products"]["oi"]
        assert upgraded["revision"] == args.candidate_cut and upgraded["sha256"] == args.candidate_sha256
        assert upgraded["provenance"] == "adopted" and not upgraded["build_command"]
        assert json.loads(previous_receipt.read_bytes()) == json.loads(before)
        assert digest(activation) == args.candidate_sha256
        assert plan("healthy-current-plan", args.candidate_cut, args.candidate)["action"] == "skip"
        # Damage only the isolated prior image. The real rollback must refuse
        # before any current link/receipt changes, then succeed after restoration.
        prior_image = Path(installed["managed"])
        current_receipt = active.read_bytes()
        with prior_image.open("r+b") as stream:
            original = stream.read(1)
            stream.seek(0)
            stream.write(bytes([original[0] ^ 1]))
        try:
            code, _, stderr = run("drifted-rollback-refusal", ["update", "--rollback"])
            assert code != 0 and b"digest drifted" in stderr
            assert active.read_bytes() == current_receipt and digest(activation) == args.candidate_sha256
        finally:
            with prior_image.open("r+b") as stream:
                stream.write(original)
        assert digest(prior_image) == args.previous_sha256
        code, _, stderr = run("native-rollback", ["update", "--rollback"])
        assert code == 0, stderr.decode(errors="replace")
        assert json.loads(active.read_bytes())["products"]["oi"]["revision"] == args.previous_cut
        assert digest(activation) == args.previous_sha256
        code, stdout, stderr = run("activated-rollback-version", ["--version"], executable=activation)
        assert code == 0 and args.previous_cut[:12].encode() in stdout + stderr
        assert not (data / "cache/build").exists(), "artifact adoption unexpectedly entered source build"
        receipt["result"] = "passed: genuine native adoption, exact-cut refusal, forced-build plan, healthy currency and drift-refusing rollback"
    except Exception as error:
        receipt["result"] = "failed"
        receipt["error"] = str(error)
        raise
    finally:
        receipt["duration_seconds"] = time.time() - started
        (args.receiver / "receipt.json").write_text(json.dumps(receipt, indent=2))
        print(json.dumps({"receiver": str(args.receiver), "result": receipt.get("result"), "steps": len(steps)}))


if __name__ == "__main__":
    main()
