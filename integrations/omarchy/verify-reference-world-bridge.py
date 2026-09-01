#!/usr/bin/env python3
"""Deterministic source-level conformance for the Omarchy Reference World bridge.

This deliberately does not claim a running Quickshell/Omarchy host. It proves the
checked-in plugin consumes the canonical O:I Current World contract, derives only
presentation state from it, and clears presentation state on invalid/unavailable
returns. Physical shell lifecycle/relogin remains the #97 acceptance boundary.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "integrations/omarchy/oi.reference-world"
FIXTURES = ROOT / "integrations/omarchy/fixtures"
SERVICE = (PLUGIN / "Service.qml").read_text()
PANEL = (PLUGIN / "Panel.qml").read_text()
BAR = (PLUGIN / "BarWidget.qml").read_text()


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def presentation(reading: dict) -> dict:
    if reading.get("schema") != "oi.current-world/v1":
        raise ValueError("unsupported current-world schema")
    frame = reading.get("context_frame") or {}
    positions = frame.get("present_positions") or []
    maximal = frame.get("maximal") is True
    machine = reading.get("current_machine") or {}
    return {
        "available": True,
        "present_products": len(positions),
        "maximal_context": maximal,
        "world_label": "O:I · CF5" if maximal else f"O:I · {len(positions)}/6",
        "machine_label": str(machine.get("role") or "current") if machine else "",
        "workcell_health": str(machine.get("health") or "") if machine else "",
    }


def main() -> None:
    cf5 = load("current-world-cf5.json")
    partial = load("current-world-partial.json")

    assert [p["position"] for p in cf5["positions"]] == [0, 1, 2, 3, 4, 5]
    assert cf5["context_frame"]["present_positions"] == [0, 1, 2, 3, 4, 5]
    assert presentation(cf5) == {
        "available": True,
        "present_products": 6,
        "maximal_context": True,
        "world_label": "O:I · CF5",
        "machine_label": "reference",
        "workcell_health": "healthy",
    }

    assert partial["context_frame"]["present_positions"] == [0, 1, 4]
    assert presentation(partial) == {
        "available": True,
        "present_products": 3,
        "maximal_context": False,
        "world_label": "O:I · 3/6",
        "machine_label": "reference",
        "workcell_health": "degraded",
    }

    # Exact canonical bridge. The shell contribution does not discover or rebuild
    # the World itself; it reads the owner-produced current-world JSON.
    assert 'command: ["oi", "current-world", "--json"]' in SERVICE
    assert 'value.schema !== "oi.current-world/v1"' in SERVICE
    for token in [
        "context_frame",
        "present_positions",
        "current_machine",
        "root.currentWorld = value",
    ]:
        assert token in SERVICE, token

    # Invalid/unavailable returns must clear stale presentation-derived state.
    mark = SERVICE.split("function markUnavailable(reason) {", 1)[1].split("}", 1)[0]
    for reset in [
        "root.available = false",
        "root.currentWorld = null",
        'root.worldLabel = "O:I · unavailable"',
        'root.machineLabel = ""',
        'root.workcellHealth = ""',
        "root.presentProducts = 0",
        "root.maximalContext = false",
    ]:
        assert reset in mark, reset
    assert "if (exitCode !== 0) root.markUnavailable" in SERVICE

    # Host presentation must not silently acquire semantic owners that live in
    # AIKit/Actuation/#155. Mentions in explanatory prose are intentionally absent
    # from executable QML as well, making accidental shell-local registries visible.
    executable_qml = "\n".join([SERVICE, PANEL, BAR])
    for forbidden in [
        "SessionSpaceRef",
        "AgentSessionRef",
        "ActuationStream",
        "ActivityRef",
        "AttentionRef",
        "GatewaySession",
    ]:
        assert forbidden not in executable_qml, forbidden

    # Inspect is a read-only Surface over the canonical CLI; no UI-only semantic
    # mutation path is introduced by the panel.
    assert '["oi", "current-world"]' in PANEL
    assert "Quickshell.execDetached" in PANEL

    print("Omarchy Reference World bridge fixtures: PASS")


if __name__ == "__main__":
    main()
