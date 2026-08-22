#!/usr/bin/env python3
"""Verify O:I #97's durable PR/branch disposition ledger.

The original false-positive closure demonstrated that counts and green selected-state
checks do not prove convergence completeness. This verifier compares the *sets* of
live GitHub refs with the checked-in disposition ledger.

Regular mode validates structure only. `--live` queries GitHub and requires exact
coverage. `--closure` additionally refuses any item still marked closure_blocking.

A small amendments file may carry refs created concurrently while the repair is in
flight or replace an earlier disposition after its ambiguity has been resolved.
Amendments are not an escape hatch: they use the same required disposition, owner,
reason, re-entry and closure-blocking fields and participate in exact set equality.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER_PATH = ROOT / "suite/convergence-ledger.json"
AMENDMENTS_PATH = ROOT / "suite/convergence-ledger-amendments.json"
ALLOWED = {
    "KEEP_ACTIVE_EXCEPTION",
    "BLOCKED_PHYSICAL",
    "ARCHIVE_PROVENANCE_ONLY",
    "RETIRE_SUPERSEDED",
    "RETIRE_MERGED",
    "REPAIR_ACTIVE",
    "RECONCILE_BEFORE_CLOSURE",
}


def die(message: str) -> None:
    raise SystemExit(f"convergence ledger verification failed: {message}")


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def keyed(items: list, key: str, context: str) -> dict:
    result = {}
    for item in items:
        if not isinstance(item, dict) or key not in item:
            die(f"{context}: amendment/base item missing {key}")
        result[item[key]] = item
    return result


def load() -> dict:
    ledger = read_json(LEDGER_PATH)
    if not AMENDMENTS_PATH.exists():
        return ledger

    amendments = read_json(AMENDMENTS_PATH)
    if amendments.get("schema") != "oi.convergence-ledger-amendments/v1":
        die("unexpected convergence amendments schema")

    by_repo = {
        entry["repository"]: entry
        for entry in ledger.get("repositories", [])
        if isinstance(entry, dict) and isinstance(entry.get("repository"), str)
    }
    for amendment in amendments.get("repositories", []):
        repo = amendment.get("repository")
        if not isinstance(repo, str) or "/" not in repo:
            die(f"invalid amendment repository identity: {repo!r}")
        target = by_repo.get(repo)
        if target is None:
            target = {"repository": repo, "branches": [], "open_pull_requests": []}
            ledger.setdefault("repositories", []).append(target)
            by_repo[repo] = target

        branches = keyed(target.get("branches", []), "name", f"{repo} branches")
        branches.update(keyed(amendment.get("branches", []), "name", f"{repo} branch amendments"))
        target["branches"] = list(branches.values())

        prs = keyed(target.get("open_pull_requests", []), "number", f"{repo} PRs")
        prs.update(keyed(amendment.get("open_pull_requests", []), "number", f"{repo} PR amendments"))
        target["open_pull_requests"] = list(prs.values())
    return ledger


def github_json(url: str):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "oi-convergence-ledger-verifier/1",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        die(f"GitHub query {url} returned {error.code}: {detail}")
    except OSError as error:
        die(f"GitHub query {url} failed: {error}")


def paged(repo: str, endpoint: str) -> list:
    owner, name = repo.split("/", 1)
    page = 1
    values = []
    while True:
        url = f"https://api.github.com/repos/{owner}/{name}/{endpoint}?per_page=100&page={page}"
        batch = github_json(url)
        if not isinstance(batch, list):
            die(f"unexpected GitHub payload for {repo} {endpoint}")
        values.extend(batch)
        if len(batch) < 100:
            return values
        page += 1


def validate_item(repo: str, kind: str, key: str, item: dict, closure: bool) -> None:
    disposition = item.get("disposition")
    if disposition not in ALLOWED:
        die(f"{repo} {kind} {key}: invalid disposition {disposition!r}")
    for field in ("owner", "reason", "reentry_condition"):
        if not isinstance(item.get(field), str) or not item[field].strip():
            die(f"{repo} {kind} {key}: missing {field}")
    blocking = item.get("closure_blocking")
    if not isinstance(blocking, bool):
        die(f"{repo} {kind} {key}: closure_blocking must be boolean")
    if closure and blocking:
        die(f"{repo} {kind} {key}: still closure-blocking ({disposition})")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="compare ledger sets with live GitHub")
    parser.add_argument("--closure", action="store_true", help="also require zero closure-blocking entries")
    args = parser.parse_args()

    ledger = load()
    if ledger.get("schema") != "oi.convergence-ledger/v1":
        die("unexpected ledger schema")

    repositories = ledger.get("repositories")
    if not isinstance(repositories, list) or not repositories:
        die("repositories must be a non-empty list")

    seen_repositories = set()
    for entry in repositories:
        repo = entry.get("repository")
        if not isinstance(repo, str) or "/" not in repo:
            die(f"invalid repository identity: {repo!r}")
        if repo in seen_repositories:
            die(f"duplicate repository entry: {repo}")
        seen_repositories.add(repo)

        branch_items = entry.get("branches", [])
        pr_items = entry.get("open_pull_requests", [])
        branch_map = {}
        for item in branch_items:
            name = item.get("name")
            if not isinstance(name, str) or not name or name == "main":
                die(f"{repo}: invalid non-main branch name {name!r}")
            if name in branch_map:
                die(f"{repo}: duplicate branch ledger entry {name}")
            branch_map[name] = item
            validate_item(repo, "branch", name, item, args.closure)

        pr_map = {}
        for item in pr_items:
            number = item.get("number")
            if not isinstance(number, int) or number <= 0:
                die(f"{repo}: invalid PR number {number!r}")
            if number in pr_map:
                die(f"{repo}: duplicate PR ledger entry #{number}")
            pr_map[number] = item
            validate_item(repo, "PR", f"#{number}", item, args.closure)

        if args.live:
            live_branches = {
                branch["name"]
                for branch in paged(repo, "branches")
                if branch.get("name") != "main"
            }
            live_prs = {
                pull["number"]
                for pull in paged(repo, "pulls")
                if pull.get("state") == "open"
            }

            ledger_branches = set(branch_map)
            ledger_prs = set(pr_map)
            if live_branches != ledger_branches:
                missing = sorted(live_branches - ledger_branches)
                stale = sorted(ledger_branches - live_branches)
                die(f"{repo}: branch set mismatch; unledgered_live={missing}, ledgered_but_absent={stale}")
            if live_prs != ledger_prs:
                missing = sorted(live_prs - ledger_prs)
                stale = sorted(ledger_prs - live_prs)
                die(f"{repo}: open PR set mismatch; unledgered_live={missing}, ledgered_but_closed={stale}")

    if args.closure and ledger.get("closure_ready") is not True:
        die("ledger itself still declares closure_ready=false")

    print("convergence ledger structure: PASS")
    if AMENDMENTS_PATH.exists():
        print("explicit concurrent amendments: INCLUDED")
    if args.live:
        print("live open-PR/non-main-branch set equality: PASS")
    if args.closure:
        print("closure-blocking disposition check: PASS")
    else:
        print("closure readiness: NOT CLAIMED (run with --closure only at actual #97 closure)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
