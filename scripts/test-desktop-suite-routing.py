#!/usr/bin/env python3
"""Read-only parity against real locally built owners; never substitutes fake CLIs.

Default entries come from `oi products --json`, including an explicitly selected
runtime catalogue. Explicit owner-bin overrides still win. No language or build-
profile assumption may select an entry in place of the owner's descriptor.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Mapping

ROOT = Path(__file__).resolve().parents[1]
OI = Path(os.environ.get("OI_TEST_BIN", ROOT / "cli/target/debug/oi"))
WORK = ROOT.parent
# Workspace placement and public override names, not executable/build recipes.
OWNER_ROOTS = {
    "central": ("OI_CENTRAL_CTRL_BIN", "Central"),
    "actuation": ("OI_ACTUATION_BIN", "Actuation"),
    "ai-kit": ("OI_AIKIT_BIN", "ai-kit"),
    "software-factory": ("OI_FACTORY_BIN", "Software-Factory"),
    "workcell": ("OI_WORKCELL_BIN", "Workcell"),
    "quaternal-logic": ("OI_QL_BIN", "Quaternal-Logic"),
}


def owner_bindings(
    catalogue: dict, work: Path, environ: Mapping[str, str]
) -> list[tuple[str, str, Path]]:
    """Resolve native entries from the same public reading the CLI exposes."""
    products = catalogue.get("products", [])
    if len(products) != len(OWNER_ROOTS):
        raise ValueError("routing proof requires all six product descriptors")
    by_id = {product["id"]: product for product in products}
    if set(by_id) != set(OWNER_ROOTS):
        raise ValueError("routing proof requires six distinct native owners")
    bindings = []
    for product_id, (key, directory) in OWNER_ROOTS.items():
        product = by_id[product_id]
        entry = (product.get("source_install") or {}).get("executable_path")
        namespace = product.get("namespace")
        if not isinstance(entry, str) or not entry.strip():
            raise ValueError(f"{product_id}: missing native source entry")
        if not isinstance(namespace, str) or not namespace.strip():
            raise ValueError(f"{product_id}: missing native namespace")
        override = environ.get(key)
        bindings.append((namespace, key, Path(override) if override else work / directory / entry))
    return bindings


class Routing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = dict(
            os.environ,
            OI_HOME=self.tmp.name,
            OI_DATA_HOME=str(Path(self.tmp.name) / "oi-data"),
            AIKIT_HOME=str(Path(self.tmp.name) / "aikit"),
            OI_BIN=str(OI),
            OI_CENTRAL_ROOT=str(WORK.parent),
        )
        reading = self.call(OI, "products", "--json")
        self.assertEqual(reading.returncode, 0, reading.stderr.decode())
        self.owners = owner_bindings(json.loads(reading.stdout), WORK, self.env)
        for _, key, path in self.owners:
            self.env[key] = str(path)
            self.assertTrue(path.is_file() and os.access(path, os.X_OK), f"Build declared owner entry first: {path}")
        self.env["OI_AIKIT_SESSION_SPACE_BIN"] = os.environ.get(
            "OI_AIKIT_SESSION_SPACE_BIN",
            str(Path(self.env["OI_AIKIT_BIN"]).with_name("aikit-session-space")),
        )

    def call(self, *args):
        return subprocess.run(
            [str(arg) for arg in args], env=self.env, cwd=ROOT,
            capture_output=True, timeout=45,
        )

    def test_all_six_native_help_preserved(self):
        for namespace, key, _ in self.owners:
            with self.subTest(namespace=namespace):
                direct = self.call(self.env[key], "--help")
                routed = self.call(OI, namespace, "--help")
                self.assertEqual(direct.returncode, 0, direct.stderr.decode())
                self.assertEqual(
                    (routed.returncode, routed.stdout, routed.stderr),
                    (direct.returncode, direct.stdout, direct.stderr),
                )

    def test_native_refusal_preserved(self):
        args = ("--json", "action", "run", "no.such.action", "{}")
        direct = self.call(self.env["OI_CENTRAL_CTRL_BIN"], *args)
        routed = self.call(OI, "central", *args)
        self.assertNotEqual(direct.returncode, 0)
        self.assertEqual(
            (routed.returncode, routed.stdout, routed.stderr),
            (direct.returncode, direct.stdout, direct.stderr),
        )

    def test_desktop_files_reader_uses_actual_central(self):
        result = self.call(OI, "desktop", "files", "list", "Work/O-I")
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        reading = json.loads(result.stdout)
        self.assertIn("README.md", [entry["name"] for entry in reading["entries"]])
        entry = next(entry for entry in reading["entries"] if entry["name"] == "README.md")
        result = self.call(OI, "desktop", "files", "read", json.dumps(entry["location"]))
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertEqual(json.loads(result.stdout)["content"], (ROOT / "README.md").read_text())

    def test_session_space_companion_and_application_parity(self):
        args = ("-C", self.tmp.name, "discover", "--project", "project:o-i")
        native = self.call(self.env["OI_AIKIT_SESSION_SPACE_BIN"], *args)
        route = self.call(OI, "aikit-session-space", *args)
        desktop = self.call(OI, "desktop", "session-spaces", self.tmp.name, "project:o-i")
        self.assertEqual(native.returncode, 0, native.stderr.decode())
        self.assertEqual(route.returncode, native.returncode)
        self.assertEqual(route.stdout, native.stdout)
        self.assertEqual(route.stderr, native.stderr)
        self.assertEqual(desktop.returncode, 0, desktop.stderr.decode())
        self.assertEqual(json.loads(desktop.stdout), json.loads(native.stdout))

    def test_knowledge_history_application_parity(self):
        native = self.call(self.env["OI_AIKIT_BIN"], "--json", "-C", self.tmp.name, "knowledge", "history")
        desktop = self.call(OI, "desktop", "knowledge", self.tmp.name, '{"action":"history"}')
        self.assertEqual(native.returncode, 0, native.stderr.decode())
        self.assertEqual(desktop.returncode, 0, desktop.stderr.decode())
        self.assertEqual(json.loads(desktop.stdout), json.loads(native.stdout)["data"])


if __name__ == "__main__":
    unittest.main()
