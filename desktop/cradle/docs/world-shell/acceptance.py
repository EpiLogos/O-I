#!/usr/bin/env python3
"""Initialize or verify the source-bound new-shell acceptance register.

This instrument checks identity, provenance and closure evidence. It does not
claim functionality from structural validity, existing tests or imported code.
Initialization refuses to replace any previously recorded target progress.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

# Home: O-I desktop/cradle/docs/world-shell (moved from the reverse-engineering campaign, 12 Oct 2026).
CAMPAIGN = Path(__file__).resolve().parent
LANES_DIR = CAMPAIGN / "lanes"
OUT = CAMPAIGN
SEAT = Path("/Users/admin/Central/worktrees/env-1/o-i")
GROUND = Path("/Users/admin/Central")
LANES = {
    1: ("lane-1-canvas-graph", "Canvas / Project / Graph", [f"A{i}" for i in range(1, 11)] + [f"B{i}" for i in range(1, 5)] + [f"C{i}" for i in range(1, 5)] + [f"D{i}" for i in range(1, 4)]),
    2: ("lane-2-timeline", "Timeline", [f"T{i}" for i in range(1, 26)]),
    3: ("lane-3-expressions-editor", "Expressions editing core", [f"E{i:02}" for i in range(1, 27)]),
    4: ("lane-4-world-places", "Places", [f"T{i}" for i in range(1, 31)]),
    5: ("lane-5-journey-palace", "Journey / Palace", [f"T{i}" for i in range(1, 25)]),
}
AXES = ("implemented", "exercised", "passed", "failed", "blocked")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source(path: Path) -> dict:
    data = path.read_bytes()
    return {"path": str(path), "sha256": digest(data), "bytes": len(data)}


def git_head(path: Path) -> str | None:
    result = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"], capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def save(name: str, value: dict) -> None:
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def target_definitions(lane: int, path: Path) -> list[dict]:
    raw = path.read_bytes()
    body = raw.decode("utf-8")
    patterns = {
        1: r"^### ([A-D]\d+) — ",
        2: r"^### (T\d+) — ",
        3: r"^- \*\*(E\d{2}) ",
        4: r"^\*\*(T\d+) — ",
        5: r"^### (T\d+)\. ",
    }
    starts = list(re.finditer(patterns[lane], body, re.M))
    rows = []
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(body)
        trailing_heading = re.search(r"^#{1,3} ", body[match.end():end], re.M)
        if trailing_heading:
            end = match.end() + trailing_heading.start()
        block = body[match.start():end].rstrip()
        title_start = match.end()
        if lane in (3, 4):
            title_end = body.index("**", title_start, end)
            title = body[title_start:title_end].strip().rstrip(".")
        else:
            title = body[title_start:body.index("\n", title_start, end)].strip()
        rows.append({
            "id": f"lane-{lane}:{match.group(1)}",
            "lane": lane,
            "target_id": match.group(1),
            "title": " ".join(title.split()),
            "instrument": LANES[lane][1],
            "definition": {
                "source": source(path),
                "line_start": body.count("\n", 0, match.start()) + 1,
                "line_end": body.count("\n", 0, match.start() + len(block)) + 1,
                "sha256": digest(block.encode("utf-8")),
                "markdown": block,
            },
        })
    expected = LANES[lane][2]
    observed = [row["target_id"] for row in rows]
    if observed != expected:
        raise ValueError(f"lane {lane}: target identity mismatch: expected {expected}, found {observed}")
    return rows


def references() -> list[dict]:
    # Classes describe the permitted acquisition operation, not a claim that
    # any source code has entered this candidate. Every code_entered is false.
    definitions = [
        ("tldraw", "/tmp/lane1-tldraw", "LICENSE.md", "source-available tldraw License", "interface-only", ["tldraw"], "Study-only; no vendoring or code adoption."),
        ("excalidraw", "/tmp/lane1-excalidraw", "LICENSE", "MIT", "adopt", ["Excalidraw"], "Permissive own-source only; retain notices and exact import provenance before entry."),
        ("timelinejs3", "/tmp/techne-lane2-scratch/TimelineJS3", "LICENSE", "MPL-2.0", "interface-only", ["TimelineJS3"], "Pinned LICENSE and package.json both say MPL-2.0; lane 2's MIT claim is incorrect. No code adoption is commissioned by this ledger."),
        ("vis-timeline", "/tmp/techne-lane2-scratch/vis-timeline", "LICENSE.md", "MIT OR Apache-2.0", "adopt", ["vis-timeline", "vis "], "Choose and retain the applicable licence and notices before any own-source adoption."),
        ("periodo", "/tmp/techne-lane2-scratch/periodo-data", "LICENSE", "Unlicense (repository code); dataset terms separately required", "interface-only", ["PeriodO"], "Root LICENSE is Unlicense; lane 2's CC0 data statement is not a licence for every artifact. This baseline adopts neither data nor code."),
        ("kdenlive", "/tmp/techne-lane3-re/kdenlive", "COPYING", "GPL-3.0 family", "interface-only", ["Kdenlive"], "GPL-family code adoption requires a separately recorded explicit decision. Interface contracts may guide independent implementation."),
        ("blender", "/tmp/techne-lane3-re/blender", "COPYING", "GPL family; per-file terms govern", "interface-only", ["Blender"], "No GPL code or assets enter the candidate; use documented behavior/interface only."),
        ("olive", "/tmp/techne-lane3-re/olive", "LICENSE", "GPL-3.0 family", "interface-only", ["Olive"], "No GPL code adoption; independently implement the recovered interface."),
        ("libopenshot", "/tmp/techne-lane3-re/libopenshot", "COPYING", "LGPL-3.0 family", "interface-only", ["libopenshot", "OpenShot"], "No linking or vendoring authorised by this ledger; classify any future proposed link explicitly."),
        ("shotcut", "/tmp/techne-lane3-re/shotcut", "COPYING", "GPL-3.0 family", "interface-only", ["Shotcut"], "GPL-family code adoption requires an explicit recorded decision; none taken here."),
        ("mlt", "/tmp/techne-lane3-re/mlt", "COPYING", "LGPL-2.1 family with module-specific terms", "interface-only", ["MLT"], "No code or runtime adoption; module-specific licence review would precede a future link."),
        ("cesiumjs", "/tmp/re-lane4-cesium", "LICENSE.md", "Apache-2.0", "interface-only", ["Cesium"], "Camera/interface reference only. Places extends the existing MapLibre renderer; no second globe."),
        ("godot", "/tmp/re-lane5/godot", "LICENSE.txt", "MIT (Godot own code); thirdparty notices separately govern", "adopt", ["Godot"], "Only source verified under this own-code licence may be adopted; no thirdparty closure inferred."),
        ("twine", "/tmp/re-lane5/twine", "LICENSE", "GPL-3.0", "interface-only", ["Twine"], "Pinned LICENSE is GPL v3 and package.json says GPL-3.0. Programme/owner premise of permissive MIT is contradicted by possessed source; no source adoption."),
    ]
    rows = []
    for name, root, licence, observed, classification, aliases, reason in definitions:
        path = Path(root)
        rows.append({"id": name, "path": root, "revision": git_head(path), "licence": observed, "licence_source": source(path / licence), "classification": classification, "reason": reason, "aliases": aliases, "code_entered": False, "imports": []})
    native = SEAT / "desktop/cradle/expressions-app"
    rows.append({"id": "native-o-i", "path": str(SEAT), "revision": git_head(SEAT), "licence": "Existing owner-native implementation; normal package/build reuse (acquisition B)", "licence_source": None, "classification": "adopt", "reason": "Reuse the existing Expressions body and its existing native owners, rather than copying semantics into shell state.", "aliases": [], "code_entered": False, "imports": [], "source": source(native / "package.json")})
    maplibre = native / "node_modules/maplibre-gl"
    package = json.loads((maplibre / "package.json").read_text())
    rows.append({"id": "maplibre", "path": str(maplibre), "revision": "npm:" + package["version"], "licence": package["license"], "licence_source": source(maplibre / "LICENSE.txt"), "classification": "adopt", "reason": "Already in-tree Places dependency. Extend this renderer; no second globe. Preserve its existing dependency licence closure.", "aliases": ["MapLibre", "maplibre", "Google Earth"], "code_entered": False, "imports": [], "source": source(maplibre / "package.json")})
    for name, aliases, reason in [
        ("obsidian", ["Obsidian"], "Possessed Obsidian 1.7.7 behavior and .canvas interface only; no proprietary code or assets."),
        ("miro", ["Miro"], "Documentation-only quality bar, no captured authenticated behavior or source adoption."),
        ("aeon", ["Aeon"], "Aeon Timeline 2 manual only; installed application unavailable. No source code adoption."),
        ("histography-chronas", ["Histography", "Chronas"], "Captured observable interfaces only; no code/assets adoption."),
        ("unity", ["Unity"], "Manual vocabulary only; implementation not possessed. No code/assets adoption."),
        ("resolve", ["Resolve"], "Quality bar/documentation only; implementation unpossessed. No code adoption."),
        ("google-earth", ["Google Earth"], "Documented UX bar only; no code or imagery/asset adoption."),
        ("qgis-worldview", ["QGIS", "Worldview"], "Documentation/interface precedent only; no repository or provider data adoption."),
    ]:
        rows.append({"id": name, "revision": None, "licence": "No code or assets adopted; documentation/observable interface only", "licence_source": None, "classification": "interface-only", "reason": reason, "aliases": aliases, "code_entered": False, "imports": []})
    return rows


def contract_dependencies(row: dict) -> list[str]:
    lane, key = row["lane"], row["target_id"]
    dependencies = ["boundary:P1"]
    if lane == 1 and key == "B1":
        dependencies.append("persistence:A1")
    if lane == 1 and key == "C2":
        dependencies.append("lane-1:A5")
    if lane == 2:
        if key in ("T8", "T17", "T21"):
            dependencies.append("time:techne:time-axis/v1")
        if key == "T18":
            dependencies.append("lane-2:T15")
        if key == "T21":
            dependencies.extend(["lane-2:T6", "lane-2:T17"])
    if lane == 3:
        specific = {"E01": ["E03"], "E05": ["E01", "E03", "E15", "E16", "E20"], "E06": ["E01", "E03", "E15", "E16", "E20"], "E07": ["E03", "E08", "E15", "E16", "E20"], "E09": ["E08"], "E13": ["E12"], "E22": ["E03", "E12", "E21"], "E25": ["E09", "E12", "E13"]}
        dependencies += ["lane-3:" + dep for dep in specific.get(key, [])]
        if key in ("E17", "E18", "E19"):
            dependencies.append("persistence:A1")
    if lane == 4:
        if key in ("T14", "T15", "T16", "T20", "T23"):
            dependencies += ["time:techne:time-axis/v1", "lane-2:T6", "lane-2:T17"]
        if key == "T26":
            dependencies += ["editing:SC-1", "editing:SC-2", "editing:SC-3", "lane-5:T3"]
    if lane == 5:
        shared = {
            "T1": [1, 6], "T2": [1, 2, 3], "T3": [1, 2, 3], "T4": [1, 6],
            "T5": [2, 4], "T6": [2, 3, 7], "T7": [2, 4], "T8": [1, 4],
            "T9": [6, 7], "T10": [1, 6], "T11": [1, 6], "T12": [6],
            "T14": [1, 3, 6], "T15": [6], "T16": [6], "T17": [4, 6, 7],
            "T18": [6], "T19": [3, 6], "T20": [1, 2, 3, 5, 7],
            "T21": [6, 7], "T22": [7], "T23": [1, 6, 7], "T24": [6, 7],
        }
        dependencies += [f"editing:SC-{n}" for n in shared.get(key, [])]
        dependencies.append("persistence:A1")
    return list(dict.fromkeys(dependencies))


def native_saved_metadata() -> dict:
    root = Path(os.environ.get("OI_HOME", str(Path.home() / ".oi"))) / "desktop/expression-recovery"
    rows = []
    for scope in ("techne", "expressions"):
        for path in sorted((root / scope).glob("*.json")):
            data = path.read_bytes()
            try:
                record = json.loads(data)
            except (ValueError, UnicodeDecodeError):
                continue
            value = record.get("value", {})
            document = value.get("view", {}).get("document", {}) if isinstance(value, dict) else {}
            ref = document.get("expression_ref", "")
            if not (ref.startswith("expression:techne-m0.") or ref.startswith("expression:authored-")):
                continue
            rows.append({"ref": ref, "title": document.get("title"), "document_revision": document.get("revision"), "scene_count": len(document.get("scenes", [])), "record_id": record.get("id"), "scope": record.get("scope"), "kind": record.get("kind"), "storage_revision": record.get("revision"), "source": {"path": str(path), "sha256": digest(data), "bytes": len(data)}, "standing": "observed recovery checkpoint metadata; not an active retained or published document", "native_read_request": {"op": "expression_recovery", "request": {"operation": "find_checkpoint", "scope": scope, "expression_ref": ref}}})
    return {
        "schema": "techne.new-shell-saved-work/v1", "records": rows,
        "native_endpoint_observations": [
            {"command": "oi desktop expression '{\"operation\":\"list\"}'", "exit_code": 0, "result_schema": "oi.expression-list/v1", "expressions": [], "interpretation": "No loaded documents on this resolved native endpoint; this does not establish absence of recovery checkpoints."},
            {"command": "oi desktop expression '{\"operation\":\"index\"}'", "exit_code": 0, "result_schema": "oi.expression-index/v1", "expressions": [], "interpretation": "Native retained index empty at observation."},
            {"command": "lsof -nP -iTCP:4179 -sTCP:LISTEN", "exit_code": 1, "interpretation": "No walk bridge listener on 4179 at observation."},
            {"command": "oi desktop files list Control/user/collections", "exit_code": 2, "error": "oi: Central owner Action refused: No such file or directory (os error 2)"},
            {"command": "oi desktop files list Work/O-I/ProjectCentral/user/collections", "exit_code": 2, "error": "oi: Central owner Action refused: No such file or directory (os error 2)"},
        ],
        "reopen_requirement": "Recovery must be read and validated by its owning operation, then explicitly reopened through the ordinary native Expression owner. Recovery never replays a pending mutation. The shell must not persist recovered bodies as another semantic store.",
        "build_source": source(SEAT / "desktop/cradle/expressions-app/package.json"),
        "build_usage": "cd desktop/cradle/expressions-app && npm run build; private oi-expressions-app 0.3.0 builds journeys then Vite dist with relative base; generated dist/node_modules are excluded from source.",
        "kernel_start_source": source(SEAT / "desktop/cradle/kernel/src/bin/walk-bridge.rs"),
        "kernel_start_usage": "From desktop/cradle/kernel: cargo run --bin walk-bridge -- 127.0.0.1:<port>. Actual parser consumes positional address (the header's --bind wording is stale). Use the existing kernel and durable owner store; production native host uses Tauri kernel_op.",
        "kernel_http_usage": "POST http://127.0.0.1:<port>/op with one typed KernelOp; /state and /event-replay are reads; /material mirrors native material resolution. This transport is development-only.",
    }


def initialize() -> None:
    for name in ("targets.json", "references.json", "sources.json", "saved-work.json"):
        if (OUT / name).exists():
            raise ValueError(f"Refusing to replace existing acceptance record: {name}")
    refs = references()
    rows = []
    for lane, (directory, instrument, expected) in LANES.items():
        for row in target_definitions(lane, LANES_DIR / directory / "TARGET-SET.md"):
            body = row["definition"]["markdown"].lower()
            relevant = [ref for ref in refs if ref["id"] == "native-o-i" or any(alias.lower() in body for alias in ref["aliases"])]
            row.update({
                "implementation_owner": "SOl new-shell integration lane (parent)",
                "native_owners": ["O:I Expression kernel", "Central / AIKit declared source owners"],
                "contract_owner": f"programme lane {lane}",
                "status": "pending",
                "progress": {axis: {"state": "pending", "evidence": []} for axis in AXES},
                "candidate_revision": None,
                "dependencies": contract_dependencies(row),
                "reference_sources": [ref["id"] for ref in relevant],
                "licence_decisions": [{"source_id": ref["id"], "classification": ref["classification"], "code_entered": False, "reason": ref["reason"]} for ref in relevant],
                "notes": ["No new-shell native exercise or craft acceptance executed for this target at initialization. Earlier model/unit checks are baselines and do not close it."],
            })
            rows.append(row)
    core = {1: ["E02", "E03"], 2: ["E04", "E05", "E06", "E07", "E11"], 3: ["E15", "E16", "E20"], 4: ["E01", "E08", "E09", "E10"], 5: ["E06", "E12", "E13"], 6: ["E21", "E22"], 7: ["E17", "E18", "E19"]}
    contracts = [
        {"id": f"editing:SC-{n}", "owner": "lane 3 editing core", "targets": ["lane-3:" + target for target in targets], "state": "pending", "source": source(LANES_DIR / "lane-3-expressions-editor/TARGET-SET.md")} for n, targets in core.items()
    ]
    contracts += [
        {"id": "boundary:P1", "owner": "one portable boundary, consumed by new-shell and Cradle", "state": "pending", "source": source(LANES_DIR / "lane-7-app-structure/STRUCTURE.md")},
        {"id": "persistence:A1", "owner": "native owning write operation; client schedules, waits for acknowledgements and preserves drafts on failure", "state": "pending", "source": source(GROUND / "Work/O-I/campaign-evidence/2026-10-07-obsidian-re/contracts/a1-save-handling.contract.md"), "divergence": "Lane 3 E18 targets consistent atomic per-document stores rather than Obsidian's observed in-place non-atomic writes. A1 includes the documented divergence decision, not a silent compatibility claim."},
        {"id": "time:techne:time-axis/v1", "owner": "lane 2; lane 4 consumes, never redefines", "targets": ["lane-2:T6", "lane-2:T17", "lane-2:T21", "lane-4:T14", "lane-4:T15"], "state": "pending", "transport_bridge": "Civil/Day/NOW time remains native; musical work time binds through one explicit typed bridge, not fabricated dates or a second transport clock."},
    ]
    basis = [CAMPAIGN / "PROGRAMME.md", CAMPAIGN / "CONVERGENCE.md", LANES_DIR / "lane-7-app-structure/STRUCTURE.md"]
    for directory, _, _ in LANES.values():
        basis += [LANES_DIR / directory / "TARGET-SET.md", LANES_DIR / directory / "RE-TARGETS.md"]
    basis += [GROUND / "Work/O-I/campaign-evidence/2026-10-07-obsidian-re/contracts/a1-save-handling.contract.md", GROUND / "Work/O-I/campaign-evidence/2026-10-07-obsidian-re/recreation-backlog.md"]
    save("targets.json", {
        "schema": "techne.new-shell-target-register/v1",
        "recorded_on": "2026-10-07", "recorded_at_utc": datetime.now(timezone.utc).isoformat(),
        "standing": "agent-maintained acceptance continuation, source-bound to owner-commissioned target sets; no authored source edited",
        "candidate_basis": {"checkout": str(SEAT), "head": git_head(SEAT), "tree_claim": "Initial revision only. Concurrent candidate edits are not covered until a per-target evidence record names their actual bytes/revision."},
        "status_rules": {"axes": list(AXES), "axis_states": ["pending", "yes", "no"], "pending_means": "not evaluated; absence of evidence is neither a failure nor a blocker", "passed_requires": "Target-bound native exercise at an exact candidate revision, plus stated visual/save/ref oracles. Baselines and aggregate green tests do not close targets.", "blocked_requires": "Exact external condition, owner/source and independent work retained; an unimplemented dependency is pending, not an invented blocker.", "failed_requires": "Executed target exercise with its command, actual error/output and revision."},
        "owner_overrides": [
            {"id": "WO0", "source": "owner conversation, 2026-10-07 (latest commission)", "effect": "Initial shell UI surface is SOl's work in packages/live-shell/ui from measured UI-EVIDENCE.md and two reference captures. Surface ownership and do-not-mount-until-external-shell language in PROGRAMME D-A is superseded in this scope."},
            {"id": "D-E", "source": "owner conversation and PROGRAMME current rulings", "effect": "Expressions and M0/M5 deep-working app enter the shell as first-class inhabitants. STRUCTURE P7 and older lane 6 coupled-views-only wording is superseded. Native owners retain authority."},
            {"id": "plain-names", "source": "owner commission / PROGRAMME naming rulings", "effect": "Use Project/Graph, Canvas, Timeline, Journey, Places, Palace; historical M-prefixes are retained only inside verbatim source definitions/code identifiers."},
            {"id": "candidate-only", "source": "owner commission", "effect": "Deep document API, parameter tables, offline audio and device-editing lanes are consumed when landed, never rebuilt or supervised by this parent."},
        ],
        "contracts": contracts, "targets": rows,
        "counts": {"total": len(rows), "by_lane": {str(lane): sum(row["lane"] == lane for row in rows) for lane in LANES}, "by_status": dict(Counter(row["status"] for row in rows))},
    })
    save("references.json", {"schema": "techne.new-shell-source-licence-register/v1", "standing": "acquisition classification before reference code entry; imports are empty at baseline", "sources": refs, "known_corrections": ["Twine 2.12.1 is GPL-3.0 at the possessed revision, despite permissive/MIT claims in source notes and commission premise.", "TimelineJS3 3.9.13 is MPL-2.0 at the possessed revision, despite lane-2 MIT claim.", "PeriodO repository code root licence is Unlicense; its CC0 dataset claim does not classify all repository code."]})
    save("sources.json", {"schema": "techne.new-shell-source-basis/v1", "sources": [source(path) for path in basis]})
    save("saved-work.json", native_saved_metadata())
    verify()


def verify() -> None:
    document = json.loads((OUT / "targets.json").read_text())
    refs = json.loads((OUT / "references.json").read_text())
    basis = json.loads((OUT / "sources.json").read_text())
    rows = document["targets"]
    expected = {f"lane-{lane}:{key}" for lane, (_, _, keys) in LANES.items() for key in keys}
    actual = [row["id"] for row in rows]
    assert len(rows) == 126 and len(set(actual)) == 126 and set(actual) == expected, "126 exact identities must remain complete and unique"
    for record in basis["sources"]:
        assert source(Path(record["path"])) == record, f"Source revision changed: {record['path']}"
    source_ids = {record["id"] for record in refs["sources"]}
    known = expected | {contract["id"] for contract in document["contracts"]}
    definitions = {item["id"]: item["definition"] for lane, (directory, _, _) in LANES.items() for item in target_definitions(lane, LANES_DIR / directory / "TARGET-SET.md")}
    for row in rows:
        assert row["definition"] == definitions[row["id"]], f"Target differs from its actual source: {row['id']}"
        assert digest(row["definition"]["markdown"].encode()) == row["definition"]["sha256"], f"Target text changed: {row['id']}"
        assert "acceptance" in row["definition"]["markdown"].lower() or "Evidence:" in row["definition"]["markdown"], f"Missing craft acceptance: {row['id']}"
        assert set(row["progress"]) == set(AXES), f"Progress axes incomplete: {row['id']}"
        assert set(row["reference_sources"]) <= source_ids, f"Unknown reference: {row['id']}"
        assert set(row["dependencies"]) <= known, f"Unknown dependency: {row['id']}"
        for axis, state in row["progress"].items():
            assert state["state"] in ("pending", "yes", "no"), f"Invalid {axis} status: {row['id']}"
            if state["state"] == "yes":
                assert row["candidate_revision"] and state["evidence"], f"Evidence required for {axis}: {row['id']}"
        if row["progress"]["passed"]["state"] == "yes":
            assert row["progress"]["exercised"]["state"] == "yes", f"Passing requires exercise: {row['id']}"
        if row["progress"]["failed"]["state"] == "yes":
            assert row["progress"]["exercised"]["state"] == "yes", f"Failure requires exercise: {row['id']}"
        assert {decision["source_id"] for decision in row["licence_decisions"]} == set(row["reference_sources"]), f"Per-target licence classification incomplete: {row['id']}"
    licence_text_absent = []
    for ref in refs["sources"]:
        assert ref["classification"] in ("adopt", "clean-room", "interface-only")
        if ref["licence_source"]:
            # The pinned digest is the licence record. Its text was read from a study clone; when that clone is gone
            # and no code has entered from the source, the digest stands and the absence is named. Once code enters,
            # the licence text must be present and match.
            if not Path(ref["licence_source"]["path"]).exists() and not ref["code_entered"]:
                licence_text_absent.append(ref["id"])
            else:
                assert source(Path(ref["licence_source"]["path"])) == ref["licence_source"], f"Licence revision changed: {ref['id']}"
        if ref["id"] in ("tldraw", "twine", "timelinejs3", "kdenlive", "olive", "shotcut"):
            assert ref["classification"] == "interface-only" and not ref["code_entered"], f"Uncleared adoption: {ref['id']}"
    counts = {str(lane): sum(row["lane"] == lane for row in rows) for lane in LANES}
    result = {"schema": "techne.new-shell-register-verification/v1", "result": "passed", "scope": "identity / source revision / target text / dependency / licence / evidence-record integrity only; no target functionality asserted", "total": len(rows), "by_lane": counts, "by_status": dict(Counter(row["status"] for row in rows)), "progress_yes": {axis: sum(row["progress"][axis]["state"] == "yes" for row in rows) for axis in AXES}, "licence_text_absent_no_code_entered": licence_text_absent}
    save("register-verification.json", result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("initialize", "verify"))
    args = parser.parse_args()
    try:
        if args.operation == "initialize":
            initialize()
        else:
            verify()
    except (ValueError, AssertionError, OSError, KeyError) as error:
        print(f"acceptance register refused: {error}", file=sys.stderr)
        sys.exit(1)
