#!/usr/bin/env python3
"""Deterministic Development Field S0 conformance.

This verifies relations O:I actually owns: protocol compatibility, exact six-owner
composition, command metadata/mainline revision agreement, package envelopes and
the historical-manifest non-authority law. It does not infer owner runtime health.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL = "1.0"
EXPECTED = [
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
]
SHA40 = re.compile(r"^[0-9a-fA-F]{40}$")
SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")


def load(path: str):
    with (ROOT / path).open(encoding="utf-8") as handle:
        return json.load(handle)


def version(value: str) -> tuple[int, ...]:
    parts = value.split(".")
    assert parts and all(part.isdigit() for part in parts), f"invalid numeric version: {value}"
    return tuple(int(part) for part in parts)


def admits(protocol_min: str, protocol_max: str) -> bool:
    low, high, observed = version(protocol_min), version(protocol_max), version(PROTOCOL)
    width = max(len(low), len(high), len(observed))
    low += (0,) * (width - len(low))
    high += (0,) * (width - len(high))
    observed += (0,) * (width - len(observed))
    return low <= observed <= high


def exact_ids(values, label: str):
    observed = [item["id"] for item in values]
    assert observed == EXPECTED, f"{label} sixfold/order drift: {observed}"


def main() -> None:
    channels = load("suite/channels.json")
    assert channels["schema"] == "oi.suite-channels/v1"
    assert admits(channels["protocol_min"], channels["protocol_max"])
    assert channels["default_channel"] == "mainline"
    assert set(channels["channels"]) == {"stable", "mainline", "source"}
    assert all(entry["source"] != "suite/manifest.json" for entry in channels["channels"].values())

    surfaces = load("surfaces.json")
    exact_ids(surfaces["surfaces"], "surface catalogue")
    surface_by_id = {item["id"]: item for item in surfaces["surfaces"]}
    for item in surfaces["surfaces"]:
        native = item["native"]
        assert native["namespace"] and native["executable"]
        assert native["version_command"] and native["capability_command"] and native["verification_command"]
        assert native["command_standing"] == "accepted-main"
        assert SHA40.fullmatch(native["command_revision"])
        assert native["command_revision"] == item["install"]["revision"]

    mainline = load("suite/mainline.json")
    exact_ids(mainline["products"], "mainline snapshot")
    for item in mainline["products"]:
        expected = surface_by_id[item["id"]]["native"]["command_revision"]
        assert item["revision"] == expected, (
            f"{item['id']} mainline/command revision drift: {item['revision']} != {expected}"
        )

    native_protocol = load("suite/native-protocol.json")
    assert native_protocol["schema"] == "oi.native-protocol-projection/v1"
    assert native_protocol["protocol"] == PROTOCOL
    exact_ids(native_protocol["products"], "native protocol projection")
    for item in native_protocol["products"]:
        assert admits(item["protocol_min"], item["protocol_max"])
        assert item["revision"] == surface_by_id[item["id"]]["native"]["command_revision"]

    historical = load("suite/manifest.json")
    exact_ids(historical["products"], "historical artifact manifest")
    assert historical["standing"] == "historical-unratified-prelocal-build-record"
    assert "not release ratification" in historical["purpose"]
    for product in historical["products"]:
        assert SHA40.fullmatch(product["revision"])
        assets = product["artifact"]["assets"]
        assert assets, f"{product['id']} has no historical reproducibility assets"
        for asset in assets:
            assert SHA256.fullmatch(asset["sha256"]), f"bad sha256 for {product['id']}:{asset['name']}"
            assert asset["attestation"], f"missing attestation for {product['id']}:{asset['name']}"

    for path in ["packages/examples/ide-environment.json", "packages/examples/model-environment.json"]:
        package = load(path)
        assert package["schema"] == "oi.package/v1"
        assert admits(package["protocol_min"], package["protocol_max"]), f"{path} excludes protocol {PROTOCOL}"
        assert package["contributions"], f"{path} has no native contributions"
        assert all(contribution["native_verification"]["operation"] for contribution in package["contributions"])

    package_schema = load("schemas/oi.package-v1.schema.json")
    required = set(package_schema["required"])
    assert {"protocol_min", "protocol_max"} <= required

    impact = load("suite/development-field-s0-impact.json")
    assert impact["schema"] == "oi.development-impact/v1"
    assert impact["plan_refs"] and impact["affected_owners"] and impact["expected_proof"]
    assert "ex_refs" not in impact, "machine-authored S0 declaration must not fabricate human EX"
    assert set(impact["expected_proof"]) <= {"D", "C", "P", "M", "H"}

    # Current repository fact: accepted mainline source truth exists, but no
    # current-main artifact candidate/digests are published here yet. Keeping
    # these channels non-installable prevents historical bytes becoming a
    # silent selector for current runtime state.
    assert channels["channels"]["mainline"]["source"] == "suite/mainline.json"
    assert channels["channels"]["mainline"]["installable"] is False
    assert channels["channels"]["stable"]["installable"] is False

    print("Development Field S0 deterministic conformance: PASS")
    print("protocol=1.0 products=6 channels=stable,mainline,source historical_manifest_authority=false")


if __name__ == "__main__":
    main()
