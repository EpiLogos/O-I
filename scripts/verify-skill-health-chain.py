#!/usr/bin/env python3
"""Read the enabled -> trusted -> projected -> loadable -> fired chain.

This is a read model, not a projection engine.  It never repairs a skill,
trust record, generation, link, hook seam, or local edit.  The default exit is
fail-open so a strap can disclose degradation without blocking a session;
``--strict`` converts unhealthy states into a verification failure.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


def fnv1a64_digest(data: bytes) -> str:
    digest = 0xCBF29CE484222325
    for byte in data:
        digest ^= byte
        digest = (digest * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return f"fnv1a64:{digest:016x}"


def frontmatter_name(text: str) -> str | None:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            return None
        if line.startswith("name:"):
            value = line[5:].strip().strip('"').strip("'")
            return value or None
    return None


def generated_projection(
    repository: str, path: str, revision: str, skill_ref: str, source: str
) -> str:
    marker = "<!-- O:I DERIVED SKILL PROJECTION;"
    header = (
        f"{marker} canonical source = {repository}/{path} @ {revision}; "
        f"skill_ref = {skill_ref}; local edits never become authoritative. -->"
    )
    lines = source.splitlines()
    if lines and lines[0].strip() == "---":
        frontmatter = [lines[0]]
        for line in lines[1:]:
            frontmatter.append(line)
            if line.strip() == "---":
                break
        rest = lines[len(frontmatter) :]
        return "\n".join(frontmatter) + f"\n{header}\n\n" + "\n".join(rest)
    return header + "\n" + source


@dataclass
class MemberHealth:
    skill_ref: str
    state: str
    enabled: bool
    trusted: bool | None
    projected: bool
    loadable: bool
    fired: bool | None
    destinations: dict[str, str]
    reason: str
    repair_owner: str
    source_revision: str
    projected_revision: str | None


def state_rank(member: MemberHealth) -> int:
    order = {
        "fired": 6,
        "loadable": 5,
        "projected": 4,
        "trusted": 3,
        "enabled": 2,
        "unprojected": 1,
        "excluded": 0,
    }
    return order.get(member.state, -1)


def read_manifest(manifest_path: Path) -> dict[str, Any]:
    import tomllib

    with manifest_path.open("rb") as stream:
        return tomllib.load(stream)


def package_revision(repository_root: Path) -> str:
    cargo = repository_root / "cli/Cargo.toml"
    for line in cargo.read_text(encoding="utf-8").splitlines():
        if line.startswith("version = "):
            return "oi-cli-v" + line.split('"', 2)[1]
    raise ValueError(f"no package version in {cargo}")


def trust_record(capability: str, cwd: Path | None = None) -> tuple[bool | None, str | None]:
    executable = os.environ.get("AIKIT_BIN") or "aikit"
    try:
        result = subprocess.run(
            [executable, "trust", "show", "--json", capability],
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return None, f"trust read unavailable: {error}"
    if result.returncode != 0:
        return False, result.stderr.strip() or result.stdout.strip()
    try:
        reply = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, "aikit trust produced unreadable JSON"
    revisions = reply.get("data", {}).get("revisions", [])
    if not isinstance(revisions, list):
        return None, "aikit trust produced an unexpected revision list"
    if any(item.get("state") == "trusted" for item in revisions):
        return True, None
    return False, "no current revision has an explicit trusted record"


def inspect_codex_hooks(ground: Path) -> tuple[bool, str]:
    path = ground / ".codex/hooks.json"
    if not path.is_file():
        return False, "project-relative .codex/hooks.json is absent"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as error:
        return False, f".codex/hooks.json unreadable: {error}"
    if "aikit hook dispatch codex SessionStart" not in text:
        return False, "SessionStart dispatcher entry is absent"
    return True, "SessionStart dispatcher entry installed"


def fire_guidance(harness: str, ai_kit: str) -> tuple[bool | None, str]:
    try:
        result = subprocess.run(
            [ai_kit, "hook", "dispatch", harness, "SessionStart"],
            input=json.dumps({}),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return None, f"hook fire probe unavailable: {error}"
    if result.returncode != 0:
        return False, result.stderr.strip() or "hook dispatch exited non-zero"
    try:
        reply = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, "hook dispatch returned no JSON inject envelope; loading-unconfirmed"
    injected = reply.get("decision", {}).get("injected")
    if isinstance(injected, str) and injected.strip():
        return True, "SessionStart inject capsule delivered content"
    return False, "SessionStart dispatch completed without inject content"


def health(
    repository_root: Path,
    ground: Path,
    *,
    read_trust: bool,
    fire_hooks: bool,
) -> dict[str, Any]:
    manifest_path = repository_root / "skills/suite-operator/skillset.toml"
    manifest = read_manifest(manifest_path)
    profile = next(
        item
        for item in manifest["profiles"]
        if item["profile_ref"] == "oi:skillset:base-guardian"
    )
    enabled_refs = {item["skill_ref"] for item in profile["members"]}
    skill_index = {item["skill_ref"]: item for item in manifest["skills"]}
    revision = package_revision(repository_root)
    members: list[MemberHealth] = []
    selected_path = (
        Path(os.environ.get("AIKIT_HOME", Path.home() / ".aikit"))
        / "skillsets/oi-guardian/members"
    )
    selected_but_unloaded: set[str] = set()
    if selected_path.is_file():
        try:
            selected_lines = {
                line.strip()
                for line in selected_path.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            }
        except OSError:
            selected_lines = set()
        for skill_ref in enabled_refs:
            capability_tail = {
                "oi:skill:operate-suite": "oi",
                "oi:skill:suite-operator": "oi-suite-operator",
                "oi:skill:central-session-strap": "central-session-strap",
            }[skill_ref]
            capability = f"skill/oi/{capability_tail}"
            if capability in selected_lines:
                selected_but_unloaded.add(skill_ref)

    ai_kit = os.environ.get("AIKIT_BIN") or "aikit"
    codex_hooks, codex_hook_reason = inspect_codex_hooks(ground)
    guidance_fired: bool | None = None
    guidance_reason = "hook-fire probe not requested"
    if fire_hooks:
        guidance_fired, guidance_reason = fire_guidance("codex", ai_kit)

    for skill_ref, skill in skill_index.items():
        enabled = skill_ref in enabled_refs
        source_rel = skill["source"]["path"]
        source = repository_root / source_rel
        trusted: bool | None = None
        trust_reason: str | None = None
        if enabled and read_trust:
            capability = "skill/oi/" + {
                "oi:skill:operate-suite": "oi",
                "oi:skill:suite-operator": "oi-suite-operator",
                "oi:skill:central-session-strap": "central-session-strap",
            }.get(skill_ref, "")
            trusted, trust_reason = trust_record(capability, repository_root)

        destinations: dict[str, str] = {}
        expected_projected = 0
        current_projected = 0
        loadable = True
        load_reason: str | None = None
        projected_revision: str | None = None

        if not enabled:
            destinations = {"all": "excluded-from-bootstrap-set"}
        else:
            source_text = source.read_text(encoding="utf-8")
            expected = generated_projection(
                skill["source"]["repository"],
                source_rel,
                revision,
                skill_ref,
                source_text,
            )
            expected_digest = fnv1a64_digest(expected.encode("utf-8"))
            skill_name = frontmatter_name(source_text)
            if skill_name is None:
                loadable = False
                load_reason = "source has no discoverable frontmatter name"
            for root_name in (".claude/skills", ".agents/skills"):
                label = "claude" if root_name.startswith(".claude") else "codex-shared"
                destination = ground / root_name / (skill_name or "unknown") / "SKILL.md"
                expected_projected += 1
                receipt_path = destination.with_name("SKILL.md.oi-projection.json")
                if not destination.is_file():
                    destinations[label] = "unprojected"
                    loadable = False
                    load_reason = load_reason or f"{label}: SKILL.md absent"
                    continue
                try:
                    current = destination.read_text(encoding="utf-8")
                    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as error:
                    destinations[label] = "stale"
                    loadable = False
                    load_reason = load_reason or f"{label}: unreadable projection or receipt: {error}"
                    continue
                projected_revision = receipt.get("source_revision")
                if fnv1a64_digest(current.encode("utf-8")) != expected_digest:
                    destinations[label] = "stale"
                    loadable = False
                    load_reason = load_reason or f"{label}: projected bytes differ from source revision"
                    continue
                if projected_revision != revision:
                    destinations[label] = "stale"
                    loadable = False
                    load_reason = load_reason or f"{label}: receipt revision {projected_revision} != {revision}"
                    continue
                if frontmatter_name(current) != skill_name:
                    destinations[label] = "blocked"
                    loadable = False
                    load_reason = load_reason or f"{label}: projected frontmatter name mismatch"
                    continue
                companion = destination.parent / "references/claim-reception.md"
                if source_rel == "skills/oi/SKILL.md" and not companion.is_file():
                    destinations[label] = "broken-companion"
                    loadable = False
                    load_reason = load_reason or f"{label}: claim-reception companion is absent"
                    continue
                destinations[label] = "projected-loadable"
                current_projected += 1

        if not enabled:
            state = "excluded"
            reason = "not a bootstrap member by contract"
        elif not projected_revision and current_projected == 0:
            state = "unprojected"
            reason = load_reason or "no current projection found"
        elif current_projected != expected_projected:
            state = "stale"
            reason = load_reason or "at least one harness projection is absent or stale"
        elif trusted is False:
            state = "blocked"
            reason = trust_reason or "TrustRequired gate is closed"
        elif not loadable:
            state = "blocked"
            reason = load_reason or "entry is not loadable"
        else:
            state = "loadable"
            reason = "enabled, trusted where readable, current, and harness-loadable"

        members.append(
            MemberHealth(
                skill_ref=skill_ref,
                state=state,
                enabled=enabled,
                trusted=trusted,
                projected=current_projected == expected_projected and expected_projected > 0,
                loadable=loadable and enabled,
                fired=None,
                destinations=destinations,
                reason=reason,
                repair_owner="O-I",
                source_revision=revision,
                projected_revision=projected_revision,
            )
        )
    if "oi:skill:central-session-strap" not in skill_index:
        members.append(
            MemberHealth(
                skill_ref="oi:skill:central-session-strap",
                state="excluded",
                enabled=False,
                trusted=None,
                projected=False,
                loadable=False,
                fired=None,
                destinations={"all": "withheld-from-bootstrap-set"},
                reason="bootstrap set stays two-member; Central ground practice is routed by AIKit's Central binding",
                repair_owner="AIKit",
                source_revision=revision,
                projected_revision=None,
            )
        )
    unloaded_selected = sorted(selected_but_unloaded)

    healthy = all(member.state in {"loadable", "excluded"} for member in members)
    if fire_hooks:
        healthy = healthy and guidance_fired is not False and codex_hooks
    return {
        "schema": "oi.skill-health-chain/v1",
        "profile_ref": profile["profile_ref"],
        "ground": str(ground),
        "source_revision": revision,
        "healthy": healthy,
        "members": sorted((asdict(member) for member in members), key=lambda member: state_rank(MemberHealth(**member)), reverse=True),
        "selected_but_unloaded": unloaded_selected,
        "hooks": {
            "codex_session_start": {
                "installed": codex_hooks,
                "reason": codex_hook_reason,
            },
            "guidance_fired": guidance_fired,
            "reason": guidance_reason,
        },
        "delivery": {
            "claude": "project-relative harness tree",
            "codex-shared": "shared Codex-managed tree; disclosed as actual posture",
            "zcode-brokered": "de-facto fallback onto the Codex-managed shared tree (.agents/skills); no native broker projection or hook injection; owner: AIKit broker layer",
        },
    }


def self_test() -> None:
    repository = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as temporary:
        ground = Path(temporary)
        report = health(repository, ground, read_trust=False, fire_hooks=False)
        assert report["schema"] == "oi.skill-health-chain/v1"
        assert not report["healthy"]
        assert {member["state"] for member in report["members"]} >= {"unprojected", "excluded"}

        manifest = read_manifest(repository / "skills/suite-operator/skillset.toml")
        assert len(manifest["profiles"][0]["members"]) == 2
        assert all(
            member["skill_ref"] != "oi:skill:central-session-strap"
            for member in manifest["profiles"][0]["members"]
        )

        codex = ground / ".codex"
        codex.mkdir()
        (codex / "hooks.json").write_text(
            '{"hooks":{"SessionStart":[{"hooks":[{"command":"aikit hook dispatch codex SessionStart","type":"command"}]}]}}',
            encoding="utf-8",
        )
        hooked = health(repository, ground, read_trust=False, fire_hooks=False)
        assert hooked["hooks"]["codex_session_start"]["installed"]

        fixture = ground / "fixture-oi"
        (fixture / "cli").mkdir(parents=True)
        (fixture / "skills/suite-operator").mkdir(parents=True)
        (fixture / "cli/Cargo.toml").write_text('[package]\nversion = "9.9.9"\n', encoding="utf-8")
        for relative in (
            "skills/suite-operator/skillset.toml",
            "skills/oi/SKILL.md",
            "skills/oi/references/claim-reception.md",
            "skills/suite-operator/SKILL.md",
            "skills/central-session-strap/SKILL.md",
        ):
            source = repository / relative
            destination = fixture / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
        fixture_manifest = read_manifest(fixture / "skills/suite-operator/skillset.toml")
        for skill in fixture_manifest["skills"]:
            source_text = (fixture / skill["source"]["path"]).read_text(encoding="utf-8")
            name = frontmatter_name(source_text)
            if skill["source"]["path"] == "skills/oi/SKILL.md":
                companion = (fixture / "skills/oi/references/claim-reception.md").read_bytes()
            generated = generated_projection(
                skill["source"]["repository"],
                skill["source"]["path"],
                "oi-cli-v9.9.9",
                skill["skill_ref"],
                source_text,
            )
            for harness_root in (".claude/skills", ".agents/skills"):
                destination = ground / harness_root / name / "SKILL.md"
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(generated, encoding="utf-8")
                receipt = {
                    "schema": "oi.skill-projection-receipt/v1",
                    "source_revision": "oi-cli-v9.9.9",
                }
                destination.with_name("SKILL.md.oi-projection.json").write_text(
                    json.dumps(receipt), encoding="utf-8"
                )
                if skill["source"]["path"] == "skills/oi/SKILL.md":
                    (destination.parent / "references/claim-reception.md").parent.mkdir(
                        parents=True, exist_ok=True
                    )
                    (destination.parent / "references/claim-reception.md").write_bytes(companion)
        projected = health(fixture, ground, read_trust=False, fire_hooks=False)
        enabled_health = [
            member for member in projected["members"] if member["enabled"]
        ]
        assert enabled_health
        assert all(member["state"] == "loadable" for member in enabled_health), enabled_health

        stale_destination = ground / ".claude/skills/oi/SKILL.md"
        stale_destination.write_text(
            stale_destination.read_text(encoding="utf-8") + "\nlocal drift\n", encoding="utf-8"
        )
        stale = health(fixture, ground, read_trust=False, fire_hooks=False)
        assert any(member["state"] == "stale" for member in stale["members"])

        stale_destination.write_text(
            generated_projection(
                "EpiLogos/O-I",
                "skills/oi/SKILL.md",
                "oi-cli-v9.9.9",
                "oi:skill:operate-suite",
                (fixture / "skills/oi/SKILL.md").read_text(encoding="utf-8"),
            ),
            encoding="utf-8",
        )
        (ground / ".agents/skills/oi/references/claim-reception.md").unlink()
        broken = health(fixture, ground, read_trust=False, fire_hooks=False)
        assert any(
            member["destinations"].get("codex-shared") == "broken-companion"
            for member in broken["members"]
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--ground", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--trust", action="store_true", help="read AIKit trust records when available")
    parser.add_argument("--fire-hooks", action="store_true", help="run a bounded SessionStart dispatch probe")
    parser.add_argument("--json", action="store_true", help="emit only the machine-readable report")
    parser.add_argument("--strict", action="store_true", help="exit 1 on unhealthy states (verification mode)")
    parser.add_argument("--self-test", action="store_true", help="run bounded negative fixtures")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        if not args.json:
            print("skill health-chain self-test: ok")
        return 0

    report = health(args.repository.resolve(), args.ground.resolve(), read_trust=args.trust, fire_hooks=args.fire_hooks)
    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        summary = ", ".join(
            f"{member['skill_ref']}={member['state']}" for member in report["members"]
        )
        print(f"skill health chain: {'healthy' if report['healthy'] else 'degraded'} ({summary})")
        for label, detail in report["hooks"].items():
            print(f"{label}: {detail}")
    if args.strict and not report["healthy"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
