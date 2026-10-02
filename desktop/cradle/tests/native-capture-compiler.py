"""Compile the native body painter and verify its exact shipped companion.

Only the existing native compiler is used. The isolated input carries the
current retained modules; this check cannot refresh their implementation.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time

repo = Path(__file__).resolve().parents[3]
out = Path(os.environ.get("OI_CAPTURE_COMPILE_OUT", repo / "desktop/cradle/tests/artifacts/native-capture-compiler")).resolve()
assert not out.exists(), "Use a fresh owned compiler artifact directory"
out.mkdir(parents=True)
source = "desktop/cradle/expressions-app/field-studies-journeys/src/capture.ts"
module = "shell/capture.mjs"
engine = "packages/oi-design-system/expressions-engine"
compiler = repo / "desktop/cradle/expressions-app/node_modules"
assert json.loads((compiler / "esbuild/package.json").read_text())["version"] == "0.25.12"
root = out / "input"
(root / source).parent.mkdir(parents=True)
shutil.copy2(repo / source, root / source)
(root / "scripts").mkdir()
shutil.copy2(repo / "scripts/vendor-expressions-engine.mjs", root / "scripts/vendor-expressions-engine.mjs")
shutil.copytree(repo / engine, root / engine)
(root / "desktop/cradle/node_modules").symlink_to(compiler, target_is_directory=True)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def files():
    return {str(p.relative_to(root / engine)): digest(p) for p in (root / engine).rglob("*") if p.is_file()}

def owned(pgid):
    rows = subprocess.check_output(["ps", "-eo", "pid=,pgid=,rss=,stat="], text=True, timeout=3)
    return [{"pid": int(pid), "pgid": int(group), "rss_bytes": int(rss) * 1024, "state": state}
            for line in rows.splitlines() if len(parts := line.split()) == 4
            for pid, group, rss, state in [parts] if int(group) == pgid]

before = files()
old_provenance = json.loads((root / engine / "PROVENANCE.json").read_text())
command = ["node", "scripts/vendor-expressions-engine.mjs", "--refresh-module", "field-studies-journeys/src/capture.ts", "--retain-dependencies"]
receipt = {"schema": "oi.native-capture-compiler-check/v1", "source": source,
           "source_sha256": digest(repo / source), "compiler": "esbuild@0.25.12",
           "command": command, "samples": [], "pass": False}
started = time.monotonic()
try:
    with (out / "compiler.log").open("wb") as log:
        process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        receipt["owned_pgid"] = process.pid
        try:
            # Keep the leader unreaped until group cleanup. Its retained PID
            # fences the numeric process group against reuse while signalling.
            while os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT) is None:
                rows = owned(process.pid)
                rss = sum(row["rss_bytes"] for row in rows)
                elapsed = time.monotonic() - started
                receipt["samples"].append({"seconds": round(elapsed, 4), "rss_bytes": rss, "members": rows})
                assert rss <= 1024 ** 3, "Native compiler exceeds its 1 GiB owned-group budget"
                assert elapsed <= 57, "Native compiler exhausted its wall budget before cleanup"
                time.sleep(0.05)
        finally:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                receipt["exit_code"] = process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                receipt["cleanup_unknown"] = "The signalled native compiler did not exit within its cleanup deadline"
                raise
            finally:
                receipt["remaining_owned_processes"] = owned(process.pid)
            cleanup_deadline = min(started + 60, time.monotonic() + 3)
            while receipt["remaining_owned_processes"] and time.monotonic() < cleanup_deadline:
                time.sleep(0.05)
                receipt["remaining_owned_processes"] = owned(process.pid)
    assert receipt["exit_code"] == 0 and not receipt["remaining_owned_processes"], receipt
    report = json.loads((out / "compiler.log").read_text())
    assert report["refreshed"] == [module] and report["retained_dependencies"] is True, report
    after = files()
    changed = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
    assert set(changed) <= {module, "PROVENANCE.json"}, changed
    provenance = json.loads((root / engine / "PROVENANCE.json").read_text())
    reading = provenance["module_refreshes"][module]
    assert reading["source_sha256"] == receipt["source_sha256"]
    assert reading["output_sha256"] == digest(root / engine / module)
    assert reading["compiler"] == receipt["compiler"]
    unrelated_before = json.loads(json.dumps(old_provenance))
    unrelated_after = json.loads(json.dumps(provenance))
    unrelated_before.get("module_refreshes", {}).pop(module, None)
    unrelated_after["module_refreshes"].pop(module)
    assert unrelated_before == unrelated_after, "An unrelated native receipt changed"
    pair = out / "compiled"
    (pair / "shell").mkdir(parents=True)
    shutil.copy2(root / engine / module, pair / module)
    shutil.copy2(root / engine / "PROVENANCE.json", pair / "PROVENANCE.json")
    receipt.update(changed_outputs=changed, compiler_reading=reading,
                   output_sha256=digest(pair / module), compiled=True)
    assert not changed, "The shipped native painter/receipt differs from its actual compiler output; retain and include the exact compiled companion"
    assert time.monotonic() - started <= 60, "Native compiler and cleanup exceeded the wall budget"
    receipt["pass"] = True
except BaseException as error:
    receipt["failure"] = str(error)
    raise
finally:
    receipt["wall_seconds"] = round(time.monotonic() - started, 4)
    receipt["maximum_sampled_aggregate_rss_bytes"] = max((row["rss_bytes"] for row in receipt["samples"]), default=0)
    (root / "desktop/cradle/node_modules").unlink()
    (out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))
