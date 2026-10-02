#!/usr/bin/env python3
"""Prepare actual QL/A/P fixtures for the existing unfiltered OI kernel gates.

Uses the supplied exact, clean native source owner and its ordinary build cache.
No checkout, install, provider, app/device or parallel runtime is started here.
The native source revision must already be qualified by the integration owner.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import time
import uuid


def checked_git(source: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(source), *args], capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "native source qualification refused")
    return result.stdout.strip()


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ql-source", type=Path, required=True)
    parser.add_argument("--expected-ql-head", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=int, default=900)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_ql_head):
        parser.error("expected QL head must be an exact full Git revision")
    if not 1 <= args.timeout_seconds <= 900:
        parser.error("fixture preparation bound must be 1..900 seconds")
    source = args.ql_source.resolve(strict=True)
    if Path(checked_git(source, "rev-parse", "--show-toplevel")).resolve() != source:
        raise RuntimeError("QL source must name its actual native repository owner")
    if checked_git(source, "rev-parse", "HEAD") != args.expected_ql_head:
        raise RuntimeError("actual native QL head differs from admitted source")
    # Whole fixture-producing source, lock and code must be committed. A label
    # identifying HEAD cannot qualify a dirty compiler/producer implementation.
    checked_git(source, "diff", "--exit-code")
    checked_git(source, "diff", "--cached", "--exit-code")
    if checked_git(source, "ls-files", "--others", "--exclude-standard"):
        raise RuntimeError("untracked native source requires owner qualification before fixture generation")
    for name in ["crates/ql-mef/examples/retained-performance-fixture.rs",
                 "crates/ql-mef/examples/retained-source-performance-fixture.rs",
                 "cpp/tests/retained_performance_checkpoint_wire.cpp",
                 "cpp/tests/performance_management_artifacts_packet.cpp",
                 "cpp/tests/performance_managed_application_order_packet.cpp",
                 "cpp/tests/performance_retained_workload_packet.cpp",
                 "cpp/tests/performance_score_reservation_packet.cpp",
                 "crates/ql-mef/examples/retained-performance-context-fixture.rs"]:
        if not (source / name).is_file():
            raise RuntimeError("qualified native source has no retained performance producer: " + name)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    run = output / ("native-performance-" + uuid.uuid4().hex)
    run.mkdir(mode=0o700)
    act_home = run / "act-custody"
    act_home.mkdir(mode=0o700)
    records: list[dict] = []
    start = time.monotonic()
    receipt = {"schema": "oi.retained-performance-fixture-preparation/v1",
               "expected_ql_head": args.expected_ql_head, "actual_ql_head": args.expected_ql_head,
               "run": str(run), "commands": records, "status": "preparing"}

    def retain() -> None:
        receipt["elapsed_seconds"] = time.monotonic() - start
        (run / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")

    def execute(command: list[str], name: str, stdout: Path | None = None) -> None:
        remaining = args.timeout_seconds - (time.monotonic() - start)
        if remaining <= 0:
            raise RuntimeError("native fixture preparation exhausted admitted time bound")
        record = {"argv": command, "cwd": str(source), "log": str(run / (name + ".log"))}
        records.append(record)
        then = time.monotonic()
        with (run / (name + ".log")).open("wb") as log:
            with (stdout.open("wb") if stdout else (run / (name + ".stdout")).open("wb")) as out:
                child = subprocess.Popen(command, cwd=source, stdout=out, stderr=log,
                                         start_new_session=True, env=os.environ.copy())
                try:
                    record["exit_code"] = child.wait(timeout=remaining)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                    record["exit_code"] = child.returncode
                    record["timed_out"] = True
                    raise RuntimeError("native fixture command exceeded admitted bound") from None
                finally:
                    record["elapsed_seconds"] = time.monotonic() - then
                    retain()
        if record["exit_code"] != 0:
            raise RuntimeError("actual native producer refused; preserved command/log: " + name)

    try:
        rust_fixture = run / "retained-performance-fixture.json"
        checkpoint_fixture = run / "retained-performance-checkpoint-fixture.json"
        source_fixture = run / "retained-source-performance-fixture.json"
        context_fixture = run / "retained-performance-context-fixture.json"
        execute(["cargo", "run", "--quiet", "--locked", "-p", "ql-mef", "--example", "retained-performance-fixture"],
                "rust-producer", rust_fixture)
        execute(["cargo", "run", "--quiet", "--locked", "-p", "ql-mef", "--example", "retained-source-performance-fixture"],
                "actual-retained-source-form-producer", source_fixture)
        execute(["cargo", "run", "--quiet", "--locked", "-p", "ql-mef", "--example", "retained-performance-context-fixture"],
                "actual-native-original-context-producer", context_fixture)
        complete_source=json.loads(source_fixture.read_bytes())
        if complete_source.get("schema")!="ql.retained-source-performance-fixture/v1" or any(
            not isinstance(complete_source.get(name),dict) for name in ["basis","source_assets","native_preparation","native_basis"]
        ) or not isinstance(complete_source.get("pitches"),list):
            raise RuntimeError("actual SourceForm producer omitted complete SAME Return/basis/config/native preparation")
        if complete_source["source_assets"].get("native_basis")!=complete_source["native_basis"]:
            raise RuntimeError("SourceForm asset and native packet detached from original producer")
        produced_source = json.loads(rust_fixture.read_bytes())
        if produced_source.get("schema") != "ql.retained-performance-fixture/v1":
            raise RuntimeError("actual retained source producer contract differs")
        packet = produced_source.get("native_preparation")
        if not isinstance(packet, dict) or not isinstance(packet.get("native_basis"), dict):
            raise RuntimeError("actual retained producer omitted its complete original native packet/basis")
        # Exact extraction of the SAME post-command source owner, avoiding the
        # separate pre-command packet test's different M3 generation/tonic.
        packet_dir = run / "native-packets"
        packet_dir.mkdir(mode=0o700)
        (packet_dir / "baseline.packet.json").write_text(json.dumps(packet, separators=(",", ":")) + "\n")
        (packet_dir / "baseline.basis.json").write_text(json.dumps(packet["native_basis"], separators=(",", ":")) + "\n")
        native_dir = source / "target/physical-musical/native"
        native = native_dir / "retained_performance_checkpoint_wire-test"
        management_native = native_dir / "performance_management_artifacts_packet-test"
        order_native=native_dir/"performance_managed_application_order_packet-test"
        workload_native=native_dir/"performance_retained_workload_packet-test"
        reservation_native=native_dir/"performance_score_reservation_packet-test"
        execute(["make", "-C", "cpp", "BUILD_DIR=" + str(native_dir), str(native), str(management_native),str(order_native),str(workload_native),str(reservation_native)], "native-checkpoint-build")
        execute([str(native), str(rust_fixture)], "actual-native-play-checkpoint-replay", checkpoint_fixture)
        management_dir = run / "native-management"
        management_dir.mkdir(mode=0o700)
        execute([str(management_native), str(packet_dir), str(management_dir)], "actual-native-managed-play-checkpoint-journal")
        order_dir=run/"native-managed-order"
        execute([str(order_native),str(packet_dir),str(order_dir)],"actual-native-managed-overtaking-checkpoint-journal")
        reservation_dir=run/"native-score-reservations"
        execute([str(reservation_native),str(packet_dir),str(reservation_dir)],"actual-native-score-cancellation-and-explicit-loss")
        workload_dir=run/"native-retained-workload"
        execute([str(workload_native),str(packet_dir),str(workload_dir)],"actual-native-full-fifteen-minute-workload")
        workload=json.loads((workload_dir/"manifest.json").read_bytes())
        if workload.get("schema")!="ql.retained-native-workload/v1" or any(workload.get(k)!=v for k,v in
                [("sample_rate","48000"),("duration_samples","43200000"),("voice_count","24"),("application_count","45000"),("edition_count","180")]):
            raise RuntimeError("actual native workload was truncated or substituted")
        if len(workload.get("editions",[]))!=180 or sum(p.stat().st_size for p in workload_dir.glob("*.json"))>512*1024*1024:
            raise RuntimeError("actual native workload output count/declared artifact budget differs")
        for name in ["release","panic"]:
            order=json.loads((order_dir/(name+".history.json")).read_bytes())
            before=json.loads((order_dir/(name+".checkpoint.json")).read_bytes())
            after=json.loads((order_dir/(name+".continued-checkpoint.json")).read_bytes())
            actual_basis=json.loads((order_dir/(name+".basis.json")).read_bytes())
            entries=order.get("applications")
            if order.get("schema")!="ql.performance-managed-application-history/v1" or not isinstance(entries,list) or len(entries)!=3:
                raise RuntimeError("real Management overtaking artifact omitted its complete original applications")
            if actual_basis!=packet["native_basis"] or [e.get("sequence") for e in entries]!=["1","3","2"] or [e.get("applied_application_ordinal") for e in entries]!=["1","2","3"]:
                raise RuntimeError("Management overtaking lost same source basis or distinct admission/commit identities")
            if any(e.get("schema")!="ql.performance-applied-event/v2" or e.get("applied") is not True for e in entries):
                raise RuntimeError("Management overtaking did not commit actual application/v2 receipts")
            if entries[1].get("admitted_sample")!="0" or entries[1].get("applied_sample")!="128" or entries[1].get("late_admitted") is not True or entries[2].get("applied_sample")!="48000":
                raise RuntimeError("Management overtaking lost exact late release/future automation timing")
            for wire,cursor,highwater in [(before,"256","2"),(after,"48128","3")]:
                if wire.get("schema")!="ql.performance-management-checkpoint/v1" or wire["native_pair"]["audio"].get("schema")!="ql.performance-checkpoint/v2" or wire["native_pair"]["audio"].get("cursor")!=cursor or wire["native_pair"]["audio"].get("applied_application_ordinal")!=highwater:
                    raise RuntimeError("Management overtaking lost the exact stopped cursor/committed high-water")
            if not isinstance(order.get("input_history"),list):
                raise RuntimeError("Management overtaking original input journal absent")
        pending = json.loads((management_dir / "baseline.pending.management.json").read_bytes())
        applications = json.loads((management_dir / "baseline.applied-events.json").read_bytes())
        if pending.get("schema") != "ql.performance-management-checkpoint/v1" or applications.get("schema") != "ql.native-applied-event-artifact/v1":
            raise RuntimeError("actual management artifact contract differs")
        actual_events = applications.get("applications")
        if not isinstance(actual_events, list) or len(actual_events) != 4 or any(event.get("applied") is not True for event in actual_events):
            raise RuntimeError("actual native management fixture did not commit all four operations")
        actual_by_sequence = {event["sequence"]: event for event in actual_events}
        audio = pending["native_pair"]["audio"]
        queued = []
        for owner, key in [("operations", None), ("releases", None), ("pending_operations", "operation"), ("pending_releases", "release")]:
            entries = audio[owner]["entries"] if key is None else audio[owner]
            for entry in entries:
                operation = entry if key is None else entry[key]
                application = actual_by_sequence.get(operation["sequence"])
                if application is None or application["applied_sample"] != operation["sample"]:
                    raise RuntimeError("pending native operation was lost or applied at another sample")
                # Explicit fixture mapping: these actual four native baseline
                # ordinals ARE its recorded occurrence IDs. No UI ordinal/time
                # or inferred source key creates a recorded occurrence here.
                queued.append({"native_sequence": operation["sequence"], "recorded_sequence": application["sequence"], "effective_sample": operation["sample"]})
        management_fixture = run / "retained-performance-management-fixture.json"
        management_fixture.write_text(json.dumps({"schema": "ql.retained-performance-management-fixture/v1",
            "recorded_sequence_policy": "actual-native-baseline-ordinal-identity",
            "management_checkpoint": pending, "queued_events": queued,
            "actual_applied_events": applications,
            "original_input_journal": json.loads((management_dir / "baseline.input-journal.json").read_bytes()),
            "original_native_basis": json.loads((management_dir / "baseline.basis.json").read_bytes())}, separators=(",", ":")) + "\n")
        for fixture, schema in [(rust_fixture, "ql.retained-performance-fixture/v1"),
                                (source_fixture, "ql.retained-source-performance-fixture/v1"),
                                (checkpoint_fixture, "ql.retained-performance-checkpoint-fixture/v1"),
                                (management_fixture, "ql.retained-performance-management-fixture/v1")]:
            if fixture.stat().st_size > 32 * 1024 * 1024:
                raise RuntimeError("actual native fixture exceeds retained input budget")
            if json.loads(fixture.read_bytes()).get("schema") != schema:
                raise RuntimeError("actual native fixture contract differs")
        checked_git(source, "diff", "--exit-code")
        checked_git(source, "diff", "--cached", "--exit-code")
        if checked_git(source, "rev-parse", "HEAD") != args.expected_ql_head:
            raise RuntimeError("native source changed during actual fixture production")
        values = {"QL_RETAINED_PERFORMANCE_FIXTURE": str(rust_fixture),
                  "QL_RETAINED_SOURCE_PERFORMANCE_FIXTURE": str(source_fixture),
                  "QL_RETAINED_PERFORMANCE_CONTEXT_FIXTURE": str(context_fixture),
                  "QL_RETAINED_PERFORMANCE_WORKLOAD_DIRECTORY": str(workload_dir),
                  "QL_RETAINED_PERFORMANCE_RESERVATION_DIRECTORY": str(reservation_dir),
                  "QL_RETAINED_PERFORMANCE_CHECKPOINT_FIXTURE": str(checkpoint_fixture),
                  "QL_RETAINED_PERFORMANCE_MANAGEMENT_FIXTURE": str(management_fixture),
                  "QL_RETAINED_PERFORMANCE_MANAGEMENT_DIRECTORY": str(management_dir),
                  "QL_RETAINED_PERFORMANCE_MANAGED_ORDER_DIRECTORY":str(order_dir),
                  "OI_RETAINED_PERFORMANCE_TEST_HOME": str(act_home)}
        env_file = run / "environment.sh"
        env_file.write_text("".join("export " + name + "=" + shlex.quote(value) + "\n" for name, value in values.items()))
        receipt.update(status="ready", environment_file=str(env_file),
                       fixtures=[{"path": str(path), "sha256": sha(path), "bytes": path.stat().st_size}
                                 for path in [rust_fixture, source_fixture, context_fixture, checkpoint_fixture, management_fixture,
                                              *sorted(packet_dir.glob("*.json")), *sorted(management_dir.glob("*.json")),*sorted(order_dir.glob("*.json")),*sorted(workload_dir.glob("*.json")),*sorted(reservation_dir.glob("*.json"))]],
                       native_binaries=[{"path": str(path), "sha256": sha(path)}
                                        for path in [native, management_native,order_native,workload_native,reservation_native]],
                       standing="actual native source/played checkpoint fixture; no installed app/device or whole C acceptance")
        print(json.dumps({"environment_file": str(env_file), "receipt": str(run / "receipt.json")}, sort_keys=True))
    except Exception as error:
        receipt.update(status="refused", reason=str(error))
        raise
    finally:
        retain()


if __name__ == "__main__":
    main()
