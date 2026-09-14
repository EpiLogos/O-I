#!/usr/bin/env python3
"""Controlled O:I -> Central -> AIKit profile/generation proof, not harness P/M.

Uses actual oi init, native guardian pickup, and aikit init/apply. Never edits
an existing ground or a person's Control. Missing binaries give pending, not
success. All raw command output stays local; export via caw_campaign export.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys
import uuid
import caw_campaign as c


def generated_bodies(root: Path, generation: str, context: str | None = None) -> list[tuple[str, str]]:
    """Follow only a real native current pointer matching apply's generation.

    AIKit owns this public layout: generation_format/generation_id in
    metadata.json, current -> generations/gen_<hash>, and projections/.
    Old generations, other contexts and the capsule store are not uptake.
    """
    found, matched = [], 0
    for base, directories, _ in os.walk(root, followlinks=False):
        for directory in list(directories):
            path = Path(base) / directory
            if directory != "current" or not path.is_symlink():
                continue
            current = path.resolve(strict=True)
            if not current.is_relative_to(root.resolve()):
                raise c.Failure("native current generation escaped the controlled World")
            metadata = c.load(current / "metadata.json")
            if metadata.get("generation_id") != generation:
                continue
            if context is not None and metadata.get("context_id") != context:
                continue
            if metadata.get("generation_format", 0) < 1:
                raise c.Failure("native current target is not a committed generation")
            matched += 1
            projections = current / "projections"
            if not projections.is_dir():
                raise c.Failure("native committed generation has no projection tree")
            seen = set()
            for location, dirs, files in os.walk(projections, followlinks=True):
                canonical = Path(location).resolve()
                if not canonical.is_relative_to(root.resolve()):
                    raise c.Failure("native projection escaped the controlled World")
                if canonical in seen:
                    dirs[:] = []
                    continue
                seen.add(canonical)
                if len(seen) > 10000:
                    raise c.Failure("native projection traversal exceeded its bound")
                for child in dirs:
                    if not (Path(location) / child).resolve().is_relative_to(root.resolve()):
                        raise c.Failure("native projection directory escapes the controlled World")
                if "SKILL.md" not in files:
                    continue
                skill = Path(location) / "SKILL.md"
                if not skill.resolve().is_relative_to(root.resolve()) or skill.stat().st_size > c.MAX_CAPTURE:
                    raise c.Failure("native projected Skill escaped or exceeded the inspection bound")
                text = skill.read_bytes()
                start = b"<!-- caw-governance-source:start -->\n"
                end = b"<!-- caw-governance-source:end -->"
                if start not in text:
                    continue
                if text.count(start) != 1 or text.count(end) != 1:
                    raise c.Failure("ambiguous native governance payload")
                body = text.split(start, 1)[1].split(end, 1)[0]
                if c.sha(body) != c.GOVERNANCE_SHA:
                    raise c.Failure("current AIKit projection changed the authored governance bytes")
                # the root as given may be a non-canonical macOS tempdir path
                # (/var vs /private/var); report the skill relative to the
                # resolved root so the projection stays inspectable off-Linux.
                found.append((str(skill.resolve().relative_to(root.resolve())), c.sha(text)))
    if not matched:
        raise c.Failure("apply receipt has no matching native current-generation readback")
    return sorted(set(found))


def prove_role(role: str, recorder: c.Recorder) -> list[dict]:
    first = len(recorder.records)
    world = c.fresh_directory(recorder.output / role)
    home = c.fresh_directory(world / "home")
    native_bin = c.fresh_directory(world / "native-bin")
    names = {"oi": "oi", "central": "ctrl", "aikit": "aikit"}
    for owner, name in names.items():
        (native_bin / name).symlink_to(recorder.bind(owner))
    env = {"HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config"),
           "XDG_DATA_HOME": str(home / ".local/share"), "XDG_STATE_HOME": str(home / ".local/state"),
           "PATH": f"{native_bin}:/usr/bin:/bin", "LANG": "C.UTF-8", "TZ": "UTC",
           # Native declared context input; each CLI otherwise generates a new
           # context. One profile campaign must observe its own current pointer.
           "AIKIT_CONTEXT_ID": f"ctx_caw_{uuid.uuid4().hex}"}
    ground = world / "Central"  # native Central init, not a handcrafted mock ground

    def run(owner: str, args: list[str], cwd: Path, label: str) -> bytes:
        for dependency in names:
            recorder.bind(dependency)
        code, data = recorder.execute(owner, args, cwd, env, f"{role}:{label}")
        for dependency in names:
            recorder.bind(dependency)
        if code:
            raise c.Failure(f"{owner} {label} failed; native output retained; no projection/uptake claim")
        return data

    # Native bootstrap performs Central init/doctor and actual O:I guardian
    # projection -> AIKit adopt/set/apply through the existing owner adapter.
    run("aikit", ["--json", "init"], world, "native-aikit-init")
    run("oi", ["init", "--personal-ground", str(ground)], world, "native-bootstrap")
    profile = ground / ".aikit/profile.toml"
    profile.parent.mkdir(parents=True, exist_ok=True)
    # This is a controlled native PoolPatch, not a personal AgentProfile or grant.
    capsule = "skill/oi/oi-suite-operator"
    for phase, enabled, expected_present in (
        ("unreviewed", True, False), ("enabled", True, True),
        ("disconnected", False, False), ("reconnected", True, True),
    ):
        if phase == "enabled":
            # AIKit correctly withholds an unseen adopted revision. Review only
            # this controlled source, then use its public revision-trust operation.
            # This is not adoption of private governance or human Recognition.
            source = ground / ".claude/skills/oi-suite-operator/SKILL.md"
            if not source.resolve().is_relative_to(world.resolve()):
                raise c.Failure("review source escaped the controlled World")
            source_bytes = source.read_bytes()
            if c.governance() not in source_bytes:
                raise c.Failure("refuse review: adopted Skill lacks exact S4 governance")
            run("aikit", ["--json", "trust", "record", capsule, "--note",
                "CAW disposable-world source review; SHA256=" + c.sha(source_bytes)
                + "; no personal adoption or human Recognition"], ground, "review-source-revision")
            run("aikit", ["--json", "trust", "show", capsule], ground, "review-public-readback")
        profile.write_text(
            f'# Controlled {role} profile; no personal source adoption.\nschema = 1\n'
            + (f'enable = ["{capsule}"]\n' if enabled else f'disable = ["{capsule}"]\n'),
            encoding="utf-8",
        )
        data = json.loads(run("aikit", ["--json", "apply"], ground, phase))
        if data.get("ok") is not True or not data.get("data", {}).get("generation"):
            raise c.Failure("AIKit apply did not publish a native generation")
        bodies = generated_bodies(world, data["data"]["generation"], env["AIKIT_CONTEXT_ID"])
        c.store(recorder.output / f"{role}-{phase}.json", {
            "schema": "oi.caw-profile-readback/v1", "role": role, "phase": phase,
            "native_generation": data["data"]["generation"], "profile_sha256": c.sha(profile.read_bytes()),
            "current_bodies": [{"relative_path": p, "sha256": digest} for p, digest in bodies],
            "source_sha256": c.GOVERNANCE_SHA, "scope": "controlled-applied-profile-not-harness-loaded",
            "expected_present": expected_present, "actual_bodies": len(bodies),
            "native_context": env["AIKIT_CONTEXT_ID"],
        })
        if expected_present != bool(bodies):
            # Native diagnostic is retained privately, never exported as proof.
            # These are fresh controlled Worlds, not personal source or secrets.
            code, explanation = recorder.execute("aikit", ["--json", "explain", capsule],
                                                 ground, env, f"{role}:{phase}:diagnostic")
            diagnostic = explanation.decode("utf-8", "replace").replace(str(world), "$WORLD")[:3000]
            raise c.Failure(
                f"{role}/{phase}: expected governance present={expected_present}, actual bodies={len(bodies)}; "
                f"native explanation exit={code}: {diagnostic}")
    # Restart is intrinsic: every owner operation above is a fresh native process.
    return [{"id": f"native-{role}-profile", "case": "P01", "obligation": f"{role}-profile-loading",
             "standing": "observed", "grade": grade, "disconnected": "detected",
             "scope": "controlled-native-profile-generation-only", "record_ids": list(range(first, len(recorder.records)))}
            for grade in ("D", "C")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bindings", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = c.fresh_directory(args.output)
    recorder = c.Recorder(output, c.load(args.bindings), timeout=180)
    observations = []
    for role in ("coding", "verifier"):
        try:
            c.governance()
            observations.extend(prove_role(role, recorder))
        except (c.Pending, c.Failure, OSError, ValueError, KeyError) as error:
            observations.append({"id": f"native-{role}-profile", "case": "P01", "obligation": f"{role}-profile-loading",
                                 "standing": "pending" if isinstance(error, c.Pending) else "failed", "detail": str(error)})
    acceptance = c.assess(c.matrix(), observations)
    c.store(output / "report.json", {"schema": "oi.caw-campaign-evidence/v1", "run_id": str(uuid.uuid4()),
            "test_source_sha256": c.sha(Path(__file__).read_bytes()),
            "matrix_sha256": c.sha((c.SPEC / "cases.json").read_bytes()),
            "commands": recorder.records, "observations": observations, "acceptance": acceptance})
    print(json.dumps({"standing": acceptance["standing"], "observations": observations, "report": str(output / "report.json")}))
    return 1 if acceptance["standing"] == "failed" else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (c.Failure, OSError, ValueError, KeyError) as error:
        print(f"caw-native-profiles: {error}", file=sys.stderr)
        raise SystemExit(1)
