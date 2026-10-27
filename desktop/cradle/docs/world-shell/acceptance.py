#!/usr/bin/env python3
"""Initialize, verify, re-home or re-prove the source-bound new-shell acceptance register.

This instrument checks identity, provenance and closure evidence. It does not
claim functionality from structural validity, existing tests or imported code.
Initialization refuses to replace any previously recorded target progress.

`rehome <input.json>` (FOUNDATION §8, added 15 Oct 2026) records, for every
target, its home in the candidate (the component that draws or performs it and
how a person reaches it) and its owner op (the suite operation its home calls),
or no home and a named gap with the build ticket that would home it. Every
cited path:line is re-opened and must hold its quote; every home is run through
packages/live-shell/ui/scripts/candidate-reachable.mjs and refused when the
candidate does not load it. It changes no progress axis and no target text.

`reprogress [--apply] [--at REV]` (lane V, added 15 Oct 2026) re-holds the
implemented axis to the code, as `rehome` re-holds homes. Every `implemented:
yes` claim's evidence is read again at one revision (HEAD by default, never the
shared seat's working tree): a `commit` must be in this repository's history; a
`source path:line — quote` must still stand in its file, at its line or the
nearest line holding the quote (the line is re-pointed, never the quote); a
`source path — description` (or `path:a-b`) must still find its file; a
`scripted` test file must exist. A row returns to `implemented: pending`, its
evidence withdrawn and named in an appended dated note with where its behaviour
went (its home, or its gap), when no source or scripted citation holds — commit
evidence alone never keeps implemented — or when the row is a named gap. Without
--apply it reports and writes nothing. exercised, passed, failed and blocked are
never touched. A source quote that names other targets and never this one is
another target's evidence and does not hold for this row (the lead, 15 Oct).
`--lane N` (repeatable) scopes a run; `--at-home` also returns a homed row whose
evidence never cites its home's file (FOUNDATION §8: implemented counts only at
a reachable home).

`prove-at-home <id>… --commit SHA… --scripted FILE[::TITLE]…` records
`implemented: yes` at the row's re-homed home, and only on what it checks: the
home's own cited path:line still holds its quote at the revision; each test file
stands there (each named test title in it) and its imports reach the home's file
(candidate-reachable.mjs's walk, the test as root, over the revision's own files
written to a scratch tree); each commit is in the revision's history and
touched the home's file or a cited test. The evidence entries are exactly the
home citation, the tests and the commits.

`pending <id>… --reason TEXT` records why a row stands (or returns to) pending,
as a dated note; a `yes` returns to pending with its evidence withdrawn and named.
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
import shutil
import subprocess
import sys
import tempfile

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
# FOUNDATION §8 re-homing: the repository the cited paths are relative to, and the reachability measure the candidate is held to.
REPO = CAMPAIGN.parents[3]
REACHABILITY_SCRIPT = "packages/live-shell/ui/scripts/candidate-reachable.mjs"
REHOME_FIELDS = ("home", "owner_op", "gap", "home_evidence")
REHOME_CHANNELS = ("code-reading", "scripted via candidate-reachable", "headless", "computer-use")
REHOME_CONDITIONS = ("none", "open-work", "open-work+wiki-scene")
GAP_KINDS = ("unreachable", "no-owner-read", "no-native-receiver", "not-built")
TICKET_KINDS = ("gap", "re-home", "door")
CITED_AT = re.compile(r"^[^\s:]+:[1-9]\d*$")
# The implemented axis's evidence forms (lane V): a commit, a quoted source line, a described source file (or line range), a test file.
EVIDENCE_COMMIT = re.compile(r"^commit ([0-9a-f]{7,40}) — ")
EVIDENCE_QUOTE = re.compile(r"^source ([^\s:]+):([1-9]\d*) — (.+)$", re.S)
EVIDENCE_FILE = re.compile(r"^source ([^\s:]+)(?::([1-9]\d*)-([1-9]\d*))? — (.+)$", re.S)
EVIDENCE_SCRIPTED = re.compile(r"^scripted (.+?) — (.+)$", re.S)
# A target id a quote names (A–D, T and E ids, a range like `T15-T18` or `T14–T16`), and the `lane-N` that scopes those after it.
TARGET_TOKEN = re.compile(r"\blane-([1-5])\b|\b([A-DET])(\d{1,2})\b(?:\s*[-–]\s*\2?(\d{1,2})\b)?")
# A scripted citation that names its test: `scripted <file> — test "<title>"; …`.
SCRIPTED_TITLE = re.compile(r'^test "([^"]+)"')
# What prove-at-home's import walk reads at a revision: the source trees a test can import, and the walk itself.
WALKED_DIRS = ("packages", "desktop/cradle/src", "desktop/cradle/expressions-app")
WALKED_FILES = re.compile(r"\.(?:tsx?|mts|cts|mjs|cjs|jsx?|css|json|html)$")


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
    # PROGRAMME and CONVERGENCE stand in the project's documentation tiers (O-I #727).
    basis = [REPO / "ProjectCentral/docs/0-ground/PROGRAMME.md", REPO / "ProjectCentral/docs/4-development/world-shell/CONVERGENCE.md", LANES_DIR / "lane-7-app-structure/STRUCTURE.md"]
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


def candidate_reachability(paths: list[str]) -> dict[str, str]:
    """The candidate's own verdict per file: `product …`, `NOT …` (or `types …`), from candidate-reachable.mjs run at REPO."""
    if not paths:
        return {}
    result = subprocess.run(["node", REACHABILITY_SCRIPT, *paths], cwd=REPO, capture_output=True, text=True, check=False)
    verdicts = {}
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1] in paths:
            verdicts[parts[1]] = " ".join(line.split())
    missing = [path for path in paths if path not in verdicts]
    if missing:
        raise ValueError(f"candidate-reachable gave no verdict for {missing}: {result.stderr.strip()[:400]}")
    return verdicts


def cited(record: dict) -> dict:
    """Re-open a cited file and hold the line to its quote; the citation is stored as {at: path:line, quote}."""
    if not isinstance(record, dict) or not isinstance(record.get("path"), str) or not isinstance(record.get("quote"), str) or not record["quote"]:
        raise ValueError(f"A citation needs a path, a line and a quote: {record!r}")
    line = record.get("line")
    if not isinstance(line, int) or line < 1:
        raise ValueError(f"A citation needs a positive line: {record!r}")
    lines = (REPO / record["path"]).read_text().split("\n")
    if line > len(lines) or record["quote"] not in lines[line - 1]:
        raise ValueError(f"{record['path']}:{line} does not hold the cited quote {record['quote']!r}")
    return {"at": f"{record['path']}:{line}", "quote": record["quote"]}


def rehome_counts(rows: list[dict]) -> dict:
    homed = [row for row in rows if row["home"] is not None]
    gaps = [row for row in rows if row["gap"] is not None]
    return {
        "homed": len(homed), "gap": len(gaps),
        "by_lane": {str(lane): {"homed": sum(row["lane"] == lane for row in homed), "gap": sum(row["lane"] == lane for row in gaps)} for lane in LANES},
        "gap_by_kind": dict(sorted(Counter(row["gap"]["kind"] for row in gaps).items())),
        "homed_by_condition": dict(sorted(Counter(row["home"]["condition"] for row in homed).items())),
        "homed_on_a_retiring_home": sum("retires" in row["home"] for row in homed),
        "screen_verified": sum(isinstance(row["home_evidence"]["screen"], dict) for row in rows),
    }


def verify_rehome(document: dict) -> dict | None:
    """Structural law of the re-homing columns. Absent columns are the register before FOUNDATION §8 and pass as before."""
    rows = document["targets"]
    present = [row["id"] for row in rows if any(field in row for field in REHOME_FIELDS)]
    if not present:
        return None
    assert len(present) == len(rows), "Re-homing is whole: every target carries home, owner_op, gap and home_evidence, or none does"
    tickets = document.get("rehome_tickets")
    assert isinstance(tickets, list) and tickets, "Re-homing names its build tickets (rehome_tickets)"
    routes, chains = document.get("rehome_routes"), document.get("rehome_owner_ops")
    assert isinstance(routes, dict) and routes and isinstance(chains, dict) and chains, "Re-homing names its routes and owner chains"
    for name, route in routes.items():
        assert route["condition"] in REHOME_CONDITIONS and route["chain"] and all(CITED_AT.match(step["at"]) and step["quote"] for step in route["chain"]), f"Route cited: {name}"
    for name, chain in chains.items():
        assert chain["op"] and chain["calls"] and all(CITED_AT.match(call["at"]) and call["quote"] for call in chain["calls"]), f"Owner chain cited: {name}"
    ids = {row["id"] for row in rows}
    by_ticket = {}
    for ticket in tickets:
        assert ticket["id"] not in by_ticket, f"Duplicate ticket: {ticket['id']}"
        assert ticket["kind"] in TICKET_KINDS and ticket["title"] and ticket["what"] and isinstance(ticket["rank"], int), f"Ticket incomplete: {ticket['id']}"
        assert ticket["targets"] and set(ticket["targets"]) <= ids, f"Ticket names an unknown target: {ticket['id']}"
        by_ticket[ticket["id"]] = ticket
    assert sorted(ticket["rank"] for ticket in tickets) == list(range(1, len(tickets) + 1)), "Ticket ranks run 1..n"
    for row in rows:
        assert all(field in row for field in REHOME_FIELDS), f"Re-homing incomplete: {row['id']}"
        home, owner, gap, evidence = (row[field] for field in REHOME_FIELDS)
        assert (home is None) != (gap is None), f"A target is homed or a named gap, never both nor neither: {row['id']}"
        channels = evidence["channels"]
        assert channels and set(channels) <= set(REHOME_CHANNELS) and "code-reading" in channels, f"Evidence channels: {row['id']}"
        screen = evidence["screen"]
        assert (isinstance(screen, str) and screen.startswith("UNVERIFIED")) or (isinstance(screen, dict) and screen.get("channel") == "computer-use" and screen.get("evidence")), f"Screen leg is UNVERIFIED or a computer-use record: {row['id']}"
        assert evidence["recorded_on"] and evidence["candidate_head"], f"Evidence basis: {row['id']}"
        if owner is not None:
            assert owner["op"] and CITED_AT.match(owner["call"]["at"]) and owner["call"]["quote"], f"Owner op cites its call: {row['id']}"
            assert owner["chains"] and set(owner["chains"]) <= set(chains), f"Owner op names known owner chains: {row['id']}"
        if home is not None:
            assert owner is not None, f"A home reads its owner: {row['id']}"
            assert CITED_AT.match(home["component"]["at"]) and home["component"]["quote"], f"Home component cited: {row['id']}"
            assert home["reach"] and home["route"] in routes, f"Home reach names a known route: {row['id']}"
            assert home["condition"] == routes[home["route"]]["condition"], f"Home condition is its route's: {row['id']}"
            assert evidence["reachability"].startswith("product "), f"A home the candidate does not load is no home: {row['id']}"
            assert "scripted via candidate-reachable" in channels, f"A home names its reachability verdict: {row['id']}"
        else:
            assert gap["kind"] in GAP_KINDS and gap["what"], f"Gap named: {row['id']}"
            assert gap["ticket"] in by_ticket and by_ticket[gap["ticket"]]["kind"] == "gap", f"A gap names its build ticket: {row['id']}"
            assert row["id"] in by_ticket[gap["ticket"]]["targets"], f"The gap's ticket lists it: {row['id']}"
    for ticket in tickets:
        if ticket["kind"] == "gap":
            assert all(next(row for row in rows if row["id"] == target)["gap"] is not None for target in ticket["targets"]), f"A gap ticket lists only gaps: {ticket['id']}"
    counts = rehome_counts(rows)
    assert document["counts"].get("rehome") == counts, "counts.rehome differs from the rows; re-run rehome"
    return counts


REHOME_STANDING = ("2026-10-15 (FOUNDATION §8, ticket M): every target carries home and owner_op, read from the code and held to "
                   "candidate-reachable.mjs, or home null with a named gap and its build ticket (rehome_tickets, counts.rehome); "
                   "the screen leg is the lead's and stands UNVERIFIED until a computer-use record replaces it.")


def rehome(input_path: Path, reachability=candidate_reachability) -> None:
    document = json.loads((OUT / "targets.json").read_text())
    data = json.loads(Path(input_path).read_text())
    rows = document["targets"]
    entries, notes, tickets = data["rows"], data.get("notes", {}), data["tickets"]
    expected = {row["id"] for row in rows}
    if set(entries) != expected:
        raise ValueError(f"Re-homing is whole: missing {sorted(expected - set(entries))[:5]}, unknown {sorted(set(entries) - expected)[:5]}")
    if not data.get("recorded_on") or not data.get("candidate_head"):
        raise ValueError("A re-homing names the day and the candidate revision it read")
    # The person's routes to the homes and the owner chains the homes call are shared by many targets: each is cited once.
    routes = {name: {"chain": [cited(step) for step in route["chain"]], "condition": route["condition"]} for name, route in data["routes"].items()}
    chains = {name: {"op": chain["op"], "calls": [cited(call) for call in chain["calls"]]} for name, chain in data["owner_ops"].items()}
    homes = sorted({entry["home"]["component"]["path"] for entry in entries.values() if entry["home"]})
    verdicts = reachability(homes)
    for row in rows:
        entry = entries[row["id"]]
        home, owner, gap = entry["home"], entry["owner_op"], entry["gap"]
        if (home is None) == (gap is None):
            raise ValueError(f"{row['id']}: homed or a named gap, never both nor neither")
        if owner is not None and not set(owner["chains"]) <= set(chains):
            raise ValueError(f"{row['id']}: an owner chain the input does not name")
        recorded_owner = None if owner is None else {"op": owner["op"], "call": cited(owner["call"]), "chains": owner["chains"], **({"note": owner["note"]} if owner.get("note") else {})}
        evidence = {"channels": ["code-reading"], "screen": "UNVERIFIED — the lead's computer-use leg", "recorded_on": data["recorded_on"], "candidate_head": data["candidate_head"]}
        if home is not None:
            verdict = verdicts[home["component"]["path"]]
            if not verdict.startswith("product "):
                raise ValueError(f"{row['id']}: the candidate does not load its home ({verdict})")
            if home["route"] not in routes:
                raise ValueError(f"{row['id']}: a route the input does not name")
            recorded_home = {"component": cited(home["component"]), "reach": home["reach"], "route": home["route"], "condition": home["condition"]}
            if home.get("retires"):
                recorded_home["retires"] = home["retires"]
            evidence["channels"].append("scripted via candidate-reachable")
            evidence["reachability"] = verdict
            row["home"], row["gap"] = recorded_home, None
        else:
            recorded_gap = {"kind": gap["kind"], "what": gap["what"], "ticket": gap["ticket"]}
            if gap.get("where"):
                recorded_gap["where"] = cited(gap["where"])
            row["home"], row["gap"] = None, recorded_gap
        row["owner_op"], row["home_evidence"] = recorded_owner, evidence
        if row["id"] in notes:
            note = f"{data['recorded_on']} re-home: {notes[row['id']]}"
            if note not in row["notes"]:
                row["notes"].append(note)
    document["rehome_routes"] = routes
    document["rehome_owner_ops"] = chains
    document["rehome_tickets"] = tickets
    document["rehome_basis"] = {"recorded_on": data["recorded_on"], "candidate_head": data["candidate_head"], "tool": "acceptance.py rehome",
                                "law": "A target counts as implemented only when its home is reachable in the candidate and reads its real owner (FOUNDATION §8). Homes are read from the code (each path:line re-opened against its quote) and held to candidate-reachable.mjs; the person's path to each home is code-read; the screen leg is the lead's."}
    if REHOME_STANDING not in document["standing"]:
        document["standing"] = f"{document['standing']} {REHOME_STANDING}"
    document["counts"]["rehome"] = rehome_counts(rows)
    verify_rehome(document)
    save("targets.json", document)
    verify()


class Tree:
    """The candidate's files and history at one revision, read through git. The seat is shared with other lanes' uncommitted
    edits, so the progress axis is held to a commit, never to the working tree."""

    def __init__(self, revision: str = "HEAD", repo: Path = REPO):
        self.repo = repo
        result = self.git("rev-parse", "--verify", f"{revision}^{{commit}}")
        if result.returncode != 0:
            raise ValueError(f"No such revision: {revision}")
        self.head = result.stdout.decode().strip()
        self._text: dict[str, str | None] = {}
        self._commits: dict[str, bool] = {}

    def git(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(["git", "-C", str(self.repo), *args], capture_output=True, check=False)

    def text(self, path: str) -> str | None:
        if path not in self._text:
            result = self.git("cat-file", "blob", f"{self.head}:{path}")
            self._text[path] = result.stdout.decode("utf-8", errors="replace") if result.returncode == 0 else None
        return self._text[path]

    def has_commit(self, sha: str) -> bool:
        if sha not in self._commits:
            self._commits[sha] = self.git("cat-file", "-e", f"{sha}^{{commit}}").returncode == 0
        return self._commits[sha]

    def removed_by(self, path: str, quote: str | None = None) -> str | None:
        """The latest commit (to this revision) that deleted the file, or that took the quote out of it."""
        selector = ["--diff-filter=D"] if quote is None else ["-S", quote]
        result = self.git("log", "-1", "--format=%h", "--abbrev=9", *selector, self.head, "--", path)
        return result.stdout.decode().strip() or None

    def in_history(self, sha: str) -> bool:
        """The commit is this revision or one of its ancestors."""
        return self.has_commit(sha) and self.git("merge-base", "--is-ancestor", sha, self.head).returncode == 0

    def full(self, sha: str) -> str:
        return self.git("rev-parse", f"{sha}^{{commit}}").stdout.decode().strip()

    def subject(self, sha: str) -> str:
        return self.git("log", "-1", "--format=%s", sha).stdout.decode().strip()

    def touched(self, sha: str) -> set[str]:
        return {line for line in self.git("show", "--name-only", "--format=", sha).stdout.decode().splitlines() if line}

    def materialize(self, dirs: tuple[str, ...] = WALKED_DIRS) -> Path:
        """This revision's own source files under the dirs, written into a scratch tree: the import walk reads files from disk, and
        the seat's working tree carries other lanes' edits. The cradle's node_modules (for TypeScript) is linked in, not copied."""
        root = Path(tempfile.mkdtemp(prefix="acceptance-walk-"))
        listing = self.git("ls-tree", "-r", "-z", self.head, "--", *dirs).stdout.decode()
        blobs = []
        for line in filter(None, listing.split("\0")):
            meta, path = line.split("\t", 1)
            _, kind, sha = meta.split()
            if kind == "blob" and WALKED_FILES.search(path):
                blobs.append((sha, path))
        batch = subprocess.run(["git", "-C", str(self.repo), "cat-file", "--batch"], input="".join(f"{sha}\n" for sha, _ in blobs).encode(),
                               capture_output=True, check=True).stdout
        at = 0
        for _, path in blobs:
            header_end = batch.index(b"\n", at)
            size = int(batch[at:header_end].split()[2])
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(batch[header_end + 1:header_end + 1 + size])
            at = header_end + 1 + size + 1
        (root / "desktop/cradle").mkdir(parents=True, exist_ok=True)
        (root / "desktop/cradle/node_modules").symlink_to(self.repo / "desktop/cradle/node_modules")
        return root


def evidence_kind(entry) -> str | None:
    """The form of one implemented-axis evidence entry, or None when it is none of the register's forms."""
    if not isinstance(entry, str):
        return None
    if EVIDENCE_COMMIT.match(entry):
        return "commit"
    if EVIDENCE_QUOTE.match(entry) or EVIDENCE_FILE.match(entry):
        return "source"
    if EVIDENCE_SCRIPTED.match(entry):
        return "scripted"
    return None


def scripted_files(names: str) -> list[str]:
    """`a/b/x.test.mjs, y.test.mjs; c/z.test.mjs`: a bare name sits in the directory of the file named before it."""
    files = []
    for name in (part.strip() for part in re.split(r"[,;]", names)):
        if name:
            files.append(name if "/" in name or not files else str(Path(files[-1]).parent / name))
    return files


def targets_named(text: str) -> list[tuple[int | None, str]]:
    """The target ids a text names, each with the lane a preceding `lane-N` gives it (None when none does). Ranges expand:
    `lane-2 T15-T18` names lane-2 T15, T16, T17 and T18. A–D ids are lane 1's, E ids lane 3's, T ids lanes 2, 4 and 5's."""
    named, lane = [], None
    for match in TARGET_TOKEN.finditer(text):
        if match.group(1):
            lane = int(match.group(1))
            continue
        prefix, start, end = match.group(2), int(match.group(3)), match.group(4)
        width = len(match.group(3))
        if prefix == "E" and width != 2:
            continue
        last = int(end) if end and 0 < int(end) - start <= 30 else start
        for number in range(start, last + 1):
            named.append((lane, f"{prefix}{number:0{width}d}" if prefix == "E" else f"{prefix}{number}"))
    return named


def names_other_targets(quote: str, row: dict) -> list[str]:
    """The targets a quote names when it names some and never this row's own: such a quote is another target's evidence."""
    named = targets_named(quote)
    if not named or any(key == row["target_id"] and lane in (None, row["lane"]) for lane, key in named):
        return []
    return list(dict.fromkeys(f"lane-{lane} {key}" if lane else key for lane, key in named))


def gone_from(tree: Tree, path: str) -> str:
    removed = tree.removed_by(path)
    return f"deleted in {removed}" if removed else "not in the tree"


def held(entry, tree: Tree, row: dict | None = None) -> dict:
    """Re-hold one evidence entry at the tree's revision: {kind, holds, entry (re-pointed when its quote moved), cited, why}.
    With the row, a quote that names other targets and never this one does not hold for it."""
    kind = evidence_kind(entry)
    if kind == "commit":
        sha = EVIDENCE_COMMIT.match(entry).group(1)
        holds = tree.has_commit(sha)
        return {"kind": kind, "holds": holds, "entry": entry, "cited": f"commit {sha[:9]}", "why": None if holds else "not in this repository's history"}
    if kind == "scripted":
        names, described = EVIDENCE_SCRIPTED.match(entry).groups()
        files = scripted_files(names)
        missing = [path for path in files if tree.text(path) is None]
        why = "; ".join(gone_from(tree, path) if len(files) == 1 else f"{path} {gone_from(tree, path)}" for path in missing) or None
        titled = SCRIPTED_TITLE.match(described)
        if not missing and titled and len(files) == 1 and not any(titled.group(1) in line for line in tree.text(files[0]).split("\n") if "test(" in line):
            why = f'no test "{titled.group(1)}" stands in the file'
        return {"kind": kind, "holds": why is None, "entry": entry, "cited": ", ".join(files), "why": why}
    match = EVIDENCE_QUOTE.match(entry) if kind == "source" else None
    if match:
        path, line, quote = match.group(1), int(match.group(2)), match.group(3)
        verdict = {"kind": kind, "holds": False, "entry": entry, "cited": f"{path}:{line}", "why": None}
        text = tree.text(path)
        if text is None:
            return {**verdict, "why": gone_from(tree, path)}
        lines = [number for number, body in enumerate(text.split("\n"), 1) if quote in body]
        if not lines:
            removed = tree.removed_by(path, quote)
            why = f"the quote was taken out in {removed}" if removed else "the quote never stood in the file: a description, not a quote"
            return {**verdict, "why": why}
        others = names_other_targets(quote, row) if row is not None else []
        if others:
            return {**verdict, "why": f"the quote names {', '.join(others)}, not this target"}
        nearest = min(lines, key=lambda number: (abs(number - line), number))
        verdict["holds"] = True
        if nearest != line:
            verdict.update(entry=f"source {path}:{nearest} — {quote}", repointed={"from": line, "to": nearest})
        return verdict
    if kind == "source":
        path, start, end, _ = EVIDENCE_FILE.match(entry).groups()
        verdict = {"kind": kind, "holds": False, "entry": entry, "cited": path + (f":{start}-{end}" if start else ""), "why": None, "form": "file"}
        text = tree.text(path)
        if text is None:
            return {**verdict, "why": gone_from(tree, path)}
        if end and int(end) > len(text.split("\n")):
            return {**verdict, "why": "the cited range runs past the file's end"}
        return {**verdict, "holds": True}
    return {"kind": None, "holds": False, "entry": entry, "cited": repr(entry)[:80], "why": "not a commit, source or scripted citation"}


def where_now(row: dict) -> str:
    home, gap = row.get("home"), row.get("gap")
    if home is not None:
        return f"Its behaviour is homed at {home['component']['at']} (route {home['route']}); implemented to be re-proven there."
    if gap is not None:
        return f"It is a named gap ({gap['ticket']}, {gap['kind']}); implemented to be re-proven when {gap['ticket']} builds its home."
    return "It has no recorded home; implemented to be re-proven where it is built."


def home_file(row: dict) -> str | None:
    home = row.get("home")
    return home["component"]["at"].rsplit(":", 1)[0] if home else None


REPROGRESS_LAW = ("An implemented claim stands only on evidence that still holds at a named revision: its commits in history, each source "
                  "quote in its file (the line re-pointed, never the quote) and naming no other target in place of this one, each described "
                  "source file and each test file present (a cited test title still in it). A row with no source or test citation left, "
                  "or a named gap, returns to pending with a dated note naming what vanished and where its behaviour went; with --at-home, "
                  "so does a homed row whose evidence never cites its home (FOUNDATION §8: implemented counts only at a reachable home). "
                  "Commit evidence alone never keeps implemented. exercised, passed, failed and blocked are untouched.")
REPROGRESS_STANDING = ("2026-10-15 (lane V): the implemented axis follows the code: `reprogress` re-holds every implemented claim's "
                       "evidence at one revision (commits in history, each source quote in its file, re-pointed to its line and never "
                       "rewritten, each test file present) and returns a row to pending, with a dated note, when no source or test "
                       "citation holds or the row is a named gap; commit evidence alone never keeps implemented.")
AT_HOME_STANDING = ("2026-10-15 (lane V, the lead's rulings): a quote that names another target is not this target's evidence; implemented "
                    "counts only at a reachable home — `prove-at-home` records it only on the home's own cited line, test files whose "
                    "imports reach that home, and a commit in the revision's history that touched them; `reprogress --at-home` returns "
                    "a homed row whose evidence never cites its home.")


def record_run(document: dict, tree: Tree | None, day: str, run: dict) -> None:
    """Append one changing run of the progress verbs; `pending` reads no code, so it names no revision."""
    basis = document.get("reprogress_basis") or {"tool": "acceptance.py reprogress --apply", "runs": []}
    basis.update(recorded_on=day, law=REPROGRESS_LAW, **({"candidate_head": tree.head} if tree else {}))
    basis["runs"].append({"recorded_on": day, **({"candidate_head": tree.head} if tree else {}), **run})
    document["reprogress_basis"] = basis
    for standing in (REPROGRESS_STANDING, AT_HOME_STANDING):
        if standing not in document["standing"]:
            document["standing"] = f"{document['standing']} {standing}"


def reprogress(apply: bool = False, tree: Tree | None = None, day: str | None = None, lanes: list[int] | None = None, at_home: bool = False) -> dict:
    tree = tree or Tree()
    day = day or datetime.now().date().isoformat()
    document = json.loads((OUT / "targets.json").read_text())
    rows = document["targets"]
    yes = lambda: {str(lane): sum(row["lane"] == lane and row["progress"]["implemented"]["state"] == "yes" for row in rows) for lane in LANES}
    before = yes()
    repointed, withdrawn, returned, described = [], [], [], []
    for row in rows:
        if lanes and row["lane"] not in lanes:
            continue
        axis = row["progress"]["implemented"]
        if axis["state"] != "yes":
            continue
        verdicts = [held(entry, tree, row) for entry in axis["evidence"]]
        kept = [verdict for verdict in verdicts if verdict["holds"]]
        lost = [verdict for verdict in verdicts if not verdict["holds"]]
        code = [verdict for verdict in kept if verdict["kind"] in ("source", "scripted")]
        lost_text = "; ".join(f"{verdict['cited']} ({verdict['why']})" for verdict in lost)
        beside = at_home and row.get("home") is not None and code and not any(
            verdict["kind"] == "source" and verdict["cited"].split(":")[0] == home_file(row) for verdict in code)
        if row.get("gap") is not None or not code or beside:
            if row.get("gap") is not None:
                cause = "gap"
                gap = row["gap"]
                reason = f"a named gap cannot stay implemented: {gap['what'].rstrip('.')}."
                if lost:
                    reason += f" Its evidence no longer held at {tree.head[:9]}: {lost_text}."
                if kept:
                    reason += f" What still held ({', '.join(verdict['cited'] for verdict in kept)}) does not make a home."
            elif not code:
                cause = "no citation of its own holds"
                reason = f"no source or test citation holds at {tree.head[:9]}: {lost_text}."
                commits = [verdict["cited"].split()[1] for verdict in kept if verdict["kind"] == "commit"]
                if commits:
                    reason += f" Its commit{'s' if len(commits) > 1 else ''} {', '.join(commits)} stand{'' if len(commits) > 1 else 's'} in history, but commit evidence alone never keeps implemented."
            else:
                cause = "beside its home"
                reason = (f"implemented counts only at a reachable home (FOUNDATION §8), and its evidence is code beside its home: "
                          f"{', '.join(verdict['cited'] for verdict in code)}; none cites its home {row['home']['component']['at']}.")
                if lost:
                    reason += f" Its evidence no longer held at {tree.head[:9]}: {lost_text}."
            axis.update(state="pending", evidence=[])
            row["notes"].append(f"{day} reprogress: implemented returns to pending — {reason} {where_now(row)}")
            returned.append({"id": row["id"], "lane": row["lane"], "cause": cause, "lost": [f"{verdict['cited']} ({verdict['why']})" for verdict in lost],
                             "held": [verdict["cited"] for verdict in kept], "now": where_now(row)})
            continue
        axis["evidence"] = [verdict["entry"] for verdict in kept]
        for verdict in kept:
            if "repointed" in verdict:
                repointed.append({"id": row["id"], "cited": verdict["cited"], "to": verdict["repointed"]["to"]})
            if verdict.get("form") == "file":
                described.append({"id": row["id"], "cited": verdict["cited"]})
        if lost:
            standing = f"{len(code)} source or test citations that still hold" if len(code) > 1 else "one source or test citation that still holds"
            row["notes"].append(f"{day} reprogress: evidence withdrawn, no longer held at {tree.head[:9]} — {lost_text}. Implemented stands on {standing}.")
            withdrawn.append({"id": row["id"], "lost": [f"{verdict['cited']} ({verdict['why']})" for verdict in lost]})
    after = yes()
    returned_ids = {item["id"] for item in returned}
    result = {
        "verb": "reprogress", "lanes": sorted(lanes) if lanes else "all", "at_home": at_home,
        "implemented_yes": {"before": sum(before.values()), "after": sum(after.values()), "by_lane_before": before, "by_lane_after": after},
        "rows_repointed": len({item["id"] for item in repointed}), "citations_repointed": len(repointed),
        "returned_to_pending": dict(sorted(Counter(f"lane-{item['lane']}" for item in returned).items())),
        "returned_by_cause": dict(sorted(Counter(item["cause"] for item in returned).items())),
        "rows_with_evidence_withdrawn": len(withdrawn),
    }
    report = {
        "schema": "techne.new-shell-reprogress/v1", "applied": apply, "recorded_on": day, "candidate_head": tree.head, **result,
        "returned": returned, "withdrawn": withdrawn, "repointed": repointed,
        # Reported, never acted on: a description held only to its file, and a homed row whose implemented is pending (allowed:
        # implementation proof comes with exercise, through prove-at-home; never flipped without evidence).
        "held_to_file_only": described,
        "homed_pending": [row["id"] for row in rows if (not lanes or row["lane"] in lanes) and row.get("home") is not None
                          and row["progress"]["implemented"]["state"] == "pending" and row["id"] not in returned_ids],
    }
    if apply:
        if returned or withdrawn or repointed:
            record_run(document, tree, day, result)
        save("targets.json", document)
        verify()
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return report


def test_reaches(tests: list[str], home: str, root: Path = REPO) -> dict[str, bool]:
    """Whether each test's imports reach the home's file: candidate-reachable.mjs's own walk, with the test as its root, over the
    files under root (a revision's materialized tree, or the repository)."""
    script = (f"import {{walk}} from {json.dumps((root / REACHABILITY_SCRIPT).as_uri())};import {{resolve}} from 'node:path';"
              "const [home, ...tests] = process.argv.slice(1);"
              "for (const test of tests) console.log(JSON.stringify([test, walk([[resolve(test), test]]).has(resolve(home))]));")
    result = subprocess.run(["node", "--input-type=module", "-e", script, home, *tests], cwd=root, capture_output=True, text=True, check=False)
    verdicts = dict(json.loads(line) for line in result.stdout.splitlines() if line.startswith("["))
    if set(verdicts) != set(tests):
        raise ValueError(f"the import walk gave no verdict for {sorted(set(tests) - set(verdicts))}: {result.stderr.strip()[:400]}")
    return verdicts


def prove_at_home(ids: list[str], commits: list[str], scripted: list[str], tree: Tree | None = None, day: str | None = None, reach=None) -> dict:
    """Record `implemented: yes` at the row's home, on evidence this verb checks: the home's own cited line still holds its quote at
    the revision; each test file stands there (and each named test title in it) and its imports reach the home's file, walked over
    the revision's own files; each commit is in the revision's history and touched the home's file or a cited test. The evidence
    is exactly those, never more."""
    tree = tree or Tree()
    if reach is None:
        root = tree.materialize()
        try:
            return prove_at_home(ids, commits, scripted, tree=tree, day=day, reach=lambda tests, home: test_reaches(tests, home, root))
        finally:
            shutil.rmtree(root, ignore_errors=True)
    day = day or datetime.now().date().isoformat()
    if not ids or not commits or not scripted:
        raise ValueError("prove-at-home needs targets, at least one --commit and at least one --scripted test file")
    tests = [(path.strip(), title.strip() or None) for path, _, title in (spec.partition("::") for spec in scripted)]
    if any(title and '"' in title for _, title in tests):
        raise ValueError('a test title is cited between double quotes, so it cannot hold one')
    document = json.loads((OUT / "targets.json").read_text())
    rows = {row["id"]: row for row in document["targets"]}
    refusals, plans = [], {}
    for target in ids:
        row = rows.get(target)
        if row is None:
            refusals.append(f"{target}: no such target")
            continue
        if row.get("home") is None:
            refusals.append(f"{target}: no home to prove at" + (f" (a named gap, {row['gap']['ticket']})" if row.get("gap") else ""))
            continue
        path, line, quote = home_file(row), int(row["home"]["component"]["at"].rsplit(":", 1)[1]), row["home"]["component"]["quote"]
        text = tree.text(path)
        lines = text.split("\n") if text is not None else []
        if line > len(lines) or quote not in lines[line - 1]:
            refusals.append(f"{target}: its home {path}:{line} does not hold its quote at {tree.head[:9]}")
            continue
        entries = []
        for sha in commits:
            if not tree.in_history(sha):
                refusals.append(f"{target}: commit {sha} is not in the history of {tree.head[:9]}")
            elif path not in tree.touched(sha) and not any(test in tree.touched(sha) for test, _ in tests):
                refusals.append(f"{target}: commit {sha} touched neither its home's file nor a cited test")
            else:
                entries.append(f"commit {tree.full(sha)} — {tree.subject(sha)}")
        entries.append(f"source {path}:{line} — {quote}")
        verdicts = reach([test for test, _ in tests], path)
        for test, title in tests:
            body = tree.text(test)
            if body is None:
                refusals.append(f"{target}: no test file {test} at {tree.head[:9]}")
            elif title and not any(title in text_line for text_line in body.split("\n") if "test(" in text_line):
                refusals.append(f'{target}: no test "{title}" in {test}')
            elif not verdicts.get(test):
                refusals.append(f"{target}: {test} never reaches its home {path} (a test that never touches the home is not its evidence)")
            else:
                entries.append(f"scripted {test} — " + (f'test "{title}"; ' if title else "") + f"its imports reach {path}")
        plans[target] = entries
    if refusals:
        raise ValueError("prove-at-home refused: " + "; ".join(refusals))
    yes_before = sum(row["progress"]["implemented"]["state"] == "yes" for row in rows.values())
    for target, entries in plans.items():
        row = rows[target]
        axis = row["progress"]["implemented"]
        replaced = [entry.split(" — ")[0] for entry in (axis["evidence"] if axis["state"] == "yes" else []) if entry not in entries]
        axis.update(state="yes", evidence=entries)
        row["candidate_revision"] = tree.head
        named = ", ".join(f'{test} ("{title}")' if title else test for test, title in tests)
        note = (f"{day} prove-at-home: implemented at its home {row['home']['component']['at']} (route {row['home']['route']}), held at "
                f"{tree.head[:9]}: the home's line holds its quote; {named} reach{'' if len(tests) > 1 else 'es'} it; "
                f"commit{'s' if len(commits) > 1 else ''} {', '.join(sha[:9] for sha in commits)} in its history.")
        if replaced:
            note += f" Replaces its earlier evidence: {'; '.join(replaced)}."
        row["notes"].append(note)
    result = {"verb": "prove-at-home", "targets": list(plans), "commits": [tree.full(sha) for sha in commits], "tests": [test for test, _ in tests],
              "implemented_yes": {"before": yes_before, "after": sum(row["progress"]["implemented"]["state"] == "yes" for row in rows.values())}}
    record_run(document, tree, day, result)
    save("targets.json", document)
    verify()
    print(json.dumps(result, indent=1, ensure_ascii=False))
    return result


def hold_pending(ids: list[str], reason: str, day: str | None = None) -> dict:
    """Record why a row's implemented stands (or returns to) pending: a dated note with the reason; a `yes` returns to pending and
    its evidence is withdrawn, named in the note. Pending claims nothing, so the reason is the caller's reading, said as such."""
    day = day or datetime.now().date().isoformat()
    if not reason or not reason.strip():
        raise ValueError("pending needs its --reason")
    document = json.loads((OUT / "targets.json").read_text())
    rows = {row["id"]: row for row in document["targets"]}
    unknown = [target for target in ids if target not in rows]
    if not ids or unknown:
        raise ValueError(f"pending needs known targets: {unknown or 'none named'}")
    returned, noted = [], []
    for target in ids:
        row = rows[target]
        axis = row["progress"]["implemented"]
        note = f"{day} pending: {reason.strip().rstrip('.')}."
        if axis["state"] == "yes":
            withdrawn = [entry.split(" — ")[0] for entry in axis["evidence"]]
            axis.update(state="pending", evidence=[])
            note += f" Implemented returns to pending; its evidence is withdrawn: {'; '.join(withdrawn)}."
            returned.append(target)
        elif note in row["notes"]:
            continue
        row["notes"].append(note)
        noted.append(target)
    result = {"verb": "pending", "returned_to_pending": returned, "noted": noted}
    if noted:
        record_run(document, None, day, result)
    save("targets.json", document)
    verify()
    print(json.dumps(result, ensure_ascii=False))
    return result


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
        implemented = row["progress"]["implemented"]
        if implemented["state"] == "yes":
            kinds = [evidence_kind(entry) for entry in implemented["evidence"]]
            assert None not in kinds, f"Implemented evidence is a commit, source or scripted citation: {row['id']}"
            assert "source" in kinds or "scripted" in kinds, f"Commit evidence alone never keeps implemented: {row['id']}"
            assert row.get("gap") is None, f"A named gap cannot stay implemented: {row['id']}"
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
    rehomed = verify_rehome(document)
    if rehomed is not None:
        result["rehome"] = rehomed
    save("register-verification.json", result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("operation", choices=("initialize", "verify", "rehome", "reprogress", "prove-at-home", "pending"))
    parser.add_argument("args", nargs="*", help="rehome: the re-homing input (rows, notes, tickets); prove-at-home, pending: target ids")
    parser.add_argument("--apply", action="store_true", help="reprogress: record the result (default: report only)")
    parser.add_argument("--at", default="HEAD", help="reprogress, prove-at-home: the revision the evidence is held to (default HEAD)")
    parser.add_argument("--lane", type=int, action="append", choices=sorted(LANES), help="reprogress: only this lane (repeatable)")
    parser.add_argument("--at-home", action="store_true", help="reprogress: a homed row's evidence must cite its home")
    parser.add_argument("--commit", action="append", default=[], help="prove-at-home: a commit that landed the home or its tests")
    parser.add_argument("--scripted", action="append", default=[], help="prove-at-home: a test file, optionally FILE::TEST TITLE")
    parser.add_argument("--reason", help="pending: why the rows stand pending")
    args = parser.parse_args()
    try:
        if args.operation == "initialize":
            initialize()
        elif args.operation == "rehome":
            if len(args.args) != 1:
                raise ValueError("rehome needs its input file")
            rehome(Path(args.args[0]))
        elif args.operation == "reprogress":
            reprogress(apply=args.apply, tree=Tree(args.at), lanes=args.lane, at_home=args.at_home)
        elif args.operation == "prove-at-home":
            prove_at_home(args.args, args.commit, args.scripted, tree=Tree(args.at))
        elif args.operation == "pending":
            hold_pending(args.args, args.reason)
        else:
            verify()
    except (ValueError, AssertionError, OSError, KeyError) as error:
        print(f"acceptance register refused: {error}", file=sys.stderr)
        sys.exit(1)
