#!/usr/bin/env python3
"""Root-register NOW/DAY lifecycle executor for Central.

Mirrors the semantics of ctrl's `projectcentral.now.*` actions (canonical at
the project register) for the root register field at `Control/agents/now`,
until Central ships native root actions. One law, two registers: same policy
schema, same envelope, same rollover order, same preserve-ref protection.

Subcommands: inspect | return | update | promote | rollover
All output is JSON on stdout; failures exit non-zero with a JSON error object.
"""

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

SKILL = "central-session-strap/now.py"
SCHEMA_HANDOFF = "central.project-now.handoff/v1"
SCHEMA_POLICY = "central.project-now.policy/v1"
SCHEMA_PROMOTIONS = "central.project-now.promotions/v1"

NOW_DIR = Path("Control/agents/now")
USER_DIR = NOW_DIR / "user"
AGENT_DIR = NOW_DIR / "agents"
DAY_DIR = NOW_DIR / "day"
POLICY = NOW_DIR / "policy.json"
PROMOTIONS = NOW_DIR / "promotions.json"
HUMAN_SOURCE_DIR = Path("Control/user")
WIKI_RETURN_DIR = Path("Control/agents/wiki/returns")

KINDS = {"handoff", "question", "note", "learning"}
STATUSES = {"active", "waiting", "resolved", "carried", "promoted", "expired"}


def fail(message, kind="invalid_input"):
    print(json.dumps({"ok": False, "error_kind": kind, "error": message}, indent=2))
    sys.exit(1)


def default_root():
    root = os.environ.get("CENTRAL_ROOT")
    if root:
        return Path(root).expanduser().resolve()
    return Path(__file__).resolve().parents[4]


def write_json(path: Path, value, replace):
    if replace and path.exists():
        path.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def read_handoff(root: Path, rel: Path):
    path = root / rel
    if not path.is_file():
        raise FileNotFoundError(f"no such return: {rel}")
    handoff = json.loads(path.read_text(encoding="utf-8"))
    if handoff.get("schema") != SCHEMA_HANDOFF:
        raise ValueError(f"not a {SCHEMA_HANDOFF} envelope: {rel}")
    return handoff, path


def load_policy(root: Path):
    policy = json.loads((root / POLICY).read_text(encoding="utf-8"))
    if policy.get("schema") != SCHEMA_POLICY:
        raise ValueError(f"policy schema mismatch at {POLICY}")
    return policy


def list_files(directory: Path, root: Path):
    if not directory.is_dir():
        return []
    found = []
    for path in sorted(directory.rglob("*")):
        if path.is_file() and not path.is_symlink():
            found.append(path.relative_to(root).as_posix())
    return found


def list_handoffs(root: Path):
    directory = root / AGENT_DIR
    if not directory.is_dir():
        return []
    pairs = []
    for path in sorted(directory.iterdir()):
        if path.is_file() and path.suffix == ".json":
            pairs.append((path.relative_to(root).as_posix(), path))
    return pairs


def load_promotions(root: Path):
    path = root / PROMOTIONS
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("entries", [])


# ---------------------------------------------------------------- inspect ---


def cmd_inspect(root: Path, _args):
    exists = (root / NOW_DIR).is_dir()
    result = {
        "register": "control:root",
        "exists": exists,
        "human_scratch": list_files(root / USER_DIR, root) if exists else [],
        "active_items": [],
        "open_questions": [],
        "inactive_items": [],
        "invalid_items": [],
        "day_records": list_files(root / DAY_DIR, root) if exists else [],
        "promotions": load_promotions(root) if exists else [],
        "policy": load_policy(root) if exists else None,
        "boundaries": [
            "NOW is the moving horizon; DAY is the dated closure reading",
            "promotion to human ground requires human acceptance",
            "agent-wiki promotion writes agents/wiki/returns, never wiki.json",
            "human scratch is copied at close, never cleaned",
        ],
    }
    if not exists:
        return result
    policy = result["policy"]
    for rel, path in list_handoffs(root):
        try:
            handoff = json.loads(path.read_text(encoding="utf-8"))
            if handoff.get("schema") != SCHEMA_HANDOFF:
                raise ValueError("schema mismatch")
        except (ValueError, json.JSONDecodeError) as error:
            result["invalid_items"].append(f"{rel}: {error}")
            continue
        if handoff["status"] in policy["carry_statuses"]:
            if handoff["kind"] == "question":
                result["open_questions"].append(rel)
            result["active_items"].append(rel)
        else:
            result["inactive_items"].append(rel)
    print(json.dumps(result, indent=2))


# ----------------------------------------------------------------- return ---


def cmd_return(root: Path, args):
    if not (root / NOW_DIR).is_dir():
        fail("root NOW is not initialized (Control/agents/now)", "not_found")
    if args.kind not in KINDS:
        fail(f"kind must be one of {sorted(KINDS)}")
    if args.status not in STATUSES:
        fail(f"status must be one of {sorted(STATUSES)}")
    handoff_id = args.id or f"handoff-{int(time.time())}"
    if "/" in handoff_id or handoff_id.startswith("."):
        fail("id must be a plain file name")
    handoff = {
        "schema": SCHEMA_HANDOFF,
        "id": handoff_id,
        "provenance": "agent-authored-bounded-return",
        "actor": args.actor,
        "kind": args.kind,
        "recorded_at_unix_seconds": int(time.time()),
        "subject": args.subject,
        "result": args.result,
        "status": args.status,
        "carried_from_days": [],
        "promoted_to": [],
    }
    for key, values in (("source_refs", args.source_ref), ("evidence_refs", args.evidence_ref), ("preserve_refs", args.preserve_ref)):
        if values:
            handoff[key] = values
    if args.session_ref:
        handoff["session_ref"] = args.session_ref
    path = root / AGENT_DIR / f"{handoff_id}.json"
    if path.exists():
        fail(f"return already exists: {path}", "already_exists")
    write_json(path, handoff, replace=False)
    print(json.dumps({"ok": True, "source": path.relative_to(root).as_posix()}, indent=2))


# ----------------------------------------------------------------- update ---


def cmd_update(root: Path, args):
    if args.status not in STATUSES:
        fail(f"status must be one of {sorted(STATUSES)}")
    rel = AGENT_DIR / f"{args.id}.json"
    handoff, path = read_handoff(root, rel)
    handoff["status"] = args.status
    preserve = handoff.setdefault("preserve_refs", [])
    for ref in args.preserve_ref:
        if ref not in preserve:
            preserve.append(ref)
    write_json(path, handoff, replace=True)
    print(json.dumps({"ok": True, "source": rel.as_posix(), "status": args.status}, indent=2))


# ---------------------------------------------------------------- promote ---


def safe_member(root: Path, raw: str):
    rel = Path(raw)
    if rel.is_absolute() or ".." in rel.parts or any(part.startswith(".") and part not in (".central",) for part in rel.parts[:-1]):
        fail(f"not a root-relative member path: {raw}")
    return rel


def cmd_promote(root: Path, args):
    if not (root / NOW_DIR).is_dir():
        fail("root NOW is not initialized", "not_found")
    source = safe_member(root, args.source)
    destination = safe_member(root, args.destination)

    if args.target == "human-ground":
        if args.acceptance != "human-accepted":
            fail("human-ground promotion requires acceptance=human-accepted")
        if not str(source).startswith(f"{USER_DIR.as_posix()}/"):
            fail(f"source must be inside {USER_DIR}")
        if not str(destination).startswith(f"{HUMAN_SOURCE_DIR.as_posix()}/"):
            fail(f"destination must be inside {HUMAN_SOURCE_DIR}")
        src, dst = root / source, root / destination
        if not src.is_file() or src.is_symlink():
            fail("promotion source must be an ordinary file")
        if dst.exists():
            fail(f"destination already exists: {destination}", "already_exists")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        receipt = {
            "source": str(source),
            "target": args.target,
            "destination": str(destination),
            "acceptance": args.acceptance,
            "recorded_at_unix_seconds": int(time.time()),
            "source_preserved": True,
        }
        ledger = json.loads((root / PROMOTIONS).read_text(encoding="utf-8"))
        ledger["entries"].append(receipt)
        write_json(root / PROMOTIONS, ledger, replace=True)
        print(json.dumps({"ok": True, **receipt}, indent=2))
        return

    if args.target == "agent-wiki":
        if args.acceptance != "agent-return":
            fail("agent-wiki promotion requires acceptance=agent-return")
        if not str(source).startswith(f"{AGENT_DIR.as_posix()}/"):
            fail(f"source must be inside {AGENT_DIR}")
        if not str(destination).startswith(f"{WIKI_RETURN_DIR.as_posix()}/"):
            fail(f"destination must be inside {WIKI_RETURN_DIR}")
        handoff, src = read_handoff(root, source)
        dst = root / destination
        if dst.exists():
            fail(f"destination already exists: {destination}", "already_exists")
        handoff["status"] = "promoted"
        promoted_to = handoff.setdefault("promoted_to", [])
        if str(destination) not in promoted_to:
            promoted_to.append(str(destination))
        write_json(src, handoff, replace=True)
        write_json(dst, handoff, replace=False)
        receipt = {
            "source": str(source),
            "target": args.target,
            "destination": str(destination),
            "acceptance": args.acceptance,
            "recorded_at_unix_seconds": int(time.time()),
            "source_preserved": True,
        }
        ledger = json.loads((root / PROMOTIONS).read_text(encoding="utf-8"))
        ledger["entries"].append(receipt)
        write_json(root / PROMOTIONS, ledger, replace=True)
        print(json.dumps({"ok": True, **receipt}, indent=2))
        return

    fail("target must be human-ground or agent-wiki")


# --------------------------------------------------------------- rollover ---


def parse_day(value: str):
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        fail(f"day must be YYYY-MM-DD: {value}")
    digits = value[:4] + value[5:7] + value[8:]
    if not digits.isdigit():
        fail(f"day must be YYYY-MM-DD: {value}")
    return value


def render_day(root: Path, day, next_day, human_scratch, handoffs, carried, removed, protected, promotions, snapshot_root):
    lines = [
        f"# DAY {day}",
        "",
        f"Closed {day}; the field opens on {next_day}.",
        f"Sources: `{snapshot_root}`",
        "",
        "## Human scratch (own words, from the snapshot)",
    ]
    rendered = False
    for rel in human_scratch:
        rel_path = Path(rel)
        lines.append(f"### {rel}")
        snapshot = root / snapshot_root / "user" / rel_path.relative_to(USER_DIR)
        try:
            lines.append(snapshot.read_text(encoding="utf-8").rstrip())
        except (UnicodeDecodeError, OSError):
            lines.append("_(non-renderable source retained in the snapshot)_")
        lines.append("")
        rendered = True
    if not rendered:
        lines.append("_(none)_")
        lines.append("")
    lines.append("## Agent returns")
    for rel, handoff in handoffs:
        lines.append(
            f"- `{rel}` — {handoff['kind']} by {handoff['actor']}"
            f" [{handoff['status']}]: {handoff['subject']}"
        )
    lines += ["", "## Rollover"]
    lines.append(f"- carried: {', '.join(carried) if carried else '_(none)'}")
    lines.append(f"- removed: {', '.join(removed) if removed else '_(none)'}")
    lines.append(f"- protected (preserve refs): {', '.join(protected) if protected else '_(none)'}")
    if promotions:
        lines += ["", "## Promotions entering this day"]
        for receipt in promotions:
            lines.append(
                f"- `{receipt['source']}` → **{receipt['target']}** → `{receipt['destination']}`"
                f" ({receipt['acceptance']})"
            )
    lines.append("")
    return "\n".join(lines)


def cmd_rollover(root: Path, args):
    day = parse_day(args.day)
    next_day = parse_day(args.next_day)
    if next_day <= day:
        fail("next_day must be later than day")
    if not (root / NOW_DIR).is_dir():
        fail("root NOW is not initialized", "not_found")
    policy = load_policy(root)
    human_scratch = list_files(root / USER_DIR, root)

    handoffs = []
    for rel, path in list_handoffs(root):
        handoffs.append((rel, json.loads(path.read_text(encoding="utf-8"))))

    promotions = load_promotions(root)
    carried, removed, protected = [], [], []
    for rel, handoff in handoffs:
        if handoff["status"] in policy["carry_statuses"]:
            carried.append(rel)
        elif handoff["status"] in policy["remove_statuses"]:
            if policy.get("protect_when_preserve_refs_exist") and handoff.get("preserve_refs"):
                protected.append(rel)
            else:
                removed.append(rel)
        else:
            protected.append(rel)

    day_path = root / DAY_DIR / f"{day}.md"
    if day_path.exists():
        fail(f"DAY is already closed: {day}", "already_exists")

    snapshot_root = DAY_DIR / f"{day}.sources"
    absolute_snapshot = root / snapshot_root
    absolute_snapshot.mkdir(parents=True, exist_ok=False)
    cleanup_failures = []
    try:
        for rel in human_scratch:
            src = root / rel
            dst = absolute_snapshot / "user" / Path(rel).relative_to(USER_DIR)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
        for rel, _ in handoffs:
            src = root / rel
            dst = absolute_snapshot / "agents" / Path(rel).relative_to(AGENT_DIR)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dst)
        day_text = render_day(
            root, day, next_day, human_scratch, handoffs, carried, removed, protected,
            promotions, snapshot_root,
        )
        day_path.write_text(day_text, encoding="utf-8")
    except Exception as error:
        shutil.rmtree(absolute_snapshot, ignore_errors=True)
        day_path.unlink(missing_ok=True)
        fail(f"day close failed before cleanup; nothing was cleaned: {error}", "internal_failure")

    for rel, handoff in handoffs:
        path = root / rel
        if rel in carried:
            handoff["status"] = "carried"
            lineage = handoff.setdefault("carried_from_days", [])
            if day not in lineage:
                lineage.append(day)
            try:
                write_json(path, handoff, replace=True)
            except OSError as error:
                cleanup_failures.append(f"carry {rel}: {error}")
        elif rel in removed:
            try:
                path.unlink()
            except OSError as error:
                cleanup_failures.append(f"remove {rel}: {error}")

    try:
        write_json(root / PROMOTIONS, {"schema": SCHEMA_PROMOTIONS, "entries": []}, replace=True)
    except OSError as error:
        cleanup_failures.append(f"reset promotion ledger: {error}")

    print(json.dumps({
        "ok": True,
        "day": day,
        "next_day": next_day,
        "day_record": (DAY_DIR / f"{day}.md").as_posix(),
        "day_sources": snapshot_root.as_posix(),
        "carried": carried,
        "removed": removed,
        "protected": protected,
        "human_scratch": human_scratch,
        "promotions": promotions,
        "cleanup_failures": cleanup_failures,
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(prog="now.py", description=__doc__)
    parser.add_argument("--root", type=Path, default=None, help="Central root (default: resolve from this file)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("inspect", help="read the current temporal field")

    p_return = sub.add_parser("return", help="write an attributed bounded agent return")
    p_return.add_argument("--actor", required=True)
    p_return.add_argument("--kind", required=True)
    p_return.add_argument("--subject", required=True)
    p_return.add_argument("--result", required=True)
    p_return.add_argument("--status", required=True)
    p_return.add_argument("--id")
    p_return.add_argument("--session-ref")
    p_return.add_argument("--source-ref", action="append", default=[])
    p_return.add_argument("--evidence-ref", action="append", default=[])
    p_return.add_argument("--preserve-ref", action="append", default=[])

    p_update = sub.add_parser("update", help="update status / add preserve refs")
    p_update.add_argument("--id", required=True)
    p_update.add_argument("--status", required=True)
    p_update.add_argument("--preserve-ref", action="append", default=[])

    p_promote = sub.add_parser("promote", help="explicit return into human ground or the wiki owner path")
    p_promote.add_argument("--source", required=True)
    p_promote.add_argument("--target", required=True, choices=["human-ground", "agent-wiki"])
    p_promote.add_argument("--destination", required=True)
    p_promote.add_argument("--acceptance", required=True, choices=["human-accepted", "agent-return"])

    p_roll = sub.add_parser("rollover", help="snapshot DAY, then clean/carry NOW")
    p_roll.add_argument("--day", required=True)
    p_roll.add_argument("--next-day", required=True)

    args = parser.parse_args()
    root = args.root.expanduser().resolve() if args.root else default_root()
    {"inspect": cmd_inspect, "return": cmd_return, "update": cmd_update,
     "promote": cmd_promote, "rollover": cmd_rollover}[args.command](root, args)


if __name__ == "__main__":
    main()
