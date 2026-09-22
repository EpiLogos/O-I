"""Source/projection tests only. None of these tests runs the human feature."""
from __future__ import annotations

import contextlib
import copy
import csv
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("experience_map", ROOT / "scripts/experience_map.py")
assert spec and spec.loader
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)


class ExperienceMapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        # Copy the declared public source module field, never a private World.
        shutil.copytree(ROOT / "docs/experience", self.root / "docs/experience")
        # A declared module can reference a contract outside docs/experience.
        # Include those real dependencies; do not weaken missing-source checks.
        config = json.loads((self.root / "docs/experience/campaign.json").read_text())
        for module_path in config.get("source_modules", []):
            module = json.loads(em.source_path(ROOT, module_path).read_text())
            for key in ("story_source", "document_operations_source"):
                relative = module.get(key)
                if relative:
                    target = em.source_path(self.root, relative)
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(em.source_path(ROOT, relative), target)
        # The declared executable-test relation is a source dependency too.
        bindings = config.get("executable_test_bindings") or {}
        if bindings.get("path"):
            target = self.root / bindings["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(em.source_path(ROOT, bindings["path"]), target)
            # Stub the declared tests' files so the join validates against
            # this copied field (receipts stay absent: nothing performed).
            scenarios = target.parent / "scenarios"
            scenarios.mkdir(exist_ok=True)
            (target.parent / "artifacts").mkdir(exist_ok=True)
            declared = json.loads(target.read_text())["tests"]
            for name, entry in declared.items():
                relative = entry.get("path") if entry.get("kind") == "node-test" else f"scenarios/{name}.mjs"
                stub = target.parent / relative
                stub.parent.mkdir(parents=True, exist_ok=True)
                stub.write_text("export default async () => {};\n")

    def tearDown(self):
        self.temp.cleanup()

    def test_all_declared_stories_and_practices_are_present_without_feature_claim(self):
        result = em.load_sources(self.root)
        declared = {key for family in result["config"]["families"] for key in family["ids"]}
        self.assertEqual({row["id"] for row in result["stories"]}, declared)
        self.assertTrue(result["planning_only"])
        self.assertIsNone(result["feature_verdict"])
        for story in result["stories"]:
            self.assertIn("agent_ux", story["extensions"])
            self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
            self.assertEqual(story["extensions"]["execution_evidence"], [])
            self.assertIsNone(story["extensions"]["human_experience"])

    def test_wiki_contract_outside_experience_is_retained_and_required(self):
        key = "docs/cradle/WIKI-CONSTELLATION-SPEC.md"
        result = em.load_sources(self.root)
        document = result["source_documents"][key]
        self.assertEqual(document["text"], (ROOT / key).read_text())
        self.assertEqual(document["digest"], em.digest((ROOT / key).read_bytes()))
        (self.root / key).unlink()
        with self.assertRaises(OSError):
            em.load_sources(self.root)

    def test_wiki_decisions_extend_existing_stories_without_new_family(self):
        result = em.load_sources(self.root)
        path = self.root / "docs/experience/wiki-constellation.json"
        module = json.loads(path.read_text())
        self.assertEqual(module["families"], [])
        expected = {f"wc65:WC{i:02}" for i in range(1, 16)}
        adaptive = {f"adaptive65:AP{i:02}" for i in range(1, 9)}
        self.assertEqual(set(module["required_obligation_ids"]), expected | adaptive)
        obligations = [o for o in result["inherited_obligations"] if o["id"].startswith("wc65:")]
        self.assertEqual({o["id"] for o in obligations}, expected)
        stories = {s["id"] for s in result["stories"]}
        for obligation in obligations:
            self.assertTrue(set(obligation["story_ids"]).issubset(stories))
            self.assertTrue(obligation["required_branches"])
        self.assertFalse(module["runtime_or_human_acceptance"])
        self.assertIsNone(result["feature_verdict"])

    def test_source_omission_does_not_shrink_parent(self):
        path = self.root / "docs/experience/STORIES.md"
        path.write_text("\n".join(line for line in path.read_text().splitlines() if not line.startswith("| AG01 |")))
        with self.assertRaisesRegex(ValueError, "missing stories"):
            em.load_sources(self.root)

    def test_duplicate_story_and_unknown_practice_fail(self):
        path = self.root / "docs/experience/STORIES.md"
        original = path.read_text()
        row = next(line for line in original.splitlines() if line.startswith("| AG01 |"))
        path.write_text(original + "\n" + row + "\n")
        with self.assertRaisesRegex(ValueError, "duplicate story"):
            em.load_sources(self.root)
        path.write_text(original.replace(row, row.replace("P01/", "P99/", 1)))
        with self.assertRaisesRegex(ValueError, "unresolved practice"):
            em.load_sources(self.root)

    def test_native_matrix_format_and_no_local_capability_impersonation(self):
        result = em.load_sources(self.root)
        manifest, rows = em.relation_projection(result)
        self.assertEqual(manifest["protocol"], "ql-capability-matrix/1")
        self.assertIsNone(manifest["extensions"]["feature_verdict"])
        self.assertTrue(rows)
        for row in rows:
            self.assertEqual(row["record_type"], "relation")
            self.assertEqual(json.loads(row["capability_refs"]), [])
            self.assertEqual(row["coverage"], "unexercised")
            self.assertEqual(json.loads(row["extensions"])["ux"]["binding_status"], "binding-required")

    def native_inventory(self):
        path = self.root / "native.csv"
        with path.open("w", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=["id", "record_type", "need", "extensions", "future_column"])
            writer.writeheader()
            writer.writerow({"id":"cap.native.example", "record_type":"capability", "need":"Keep the useful source",
                             "extensions":json.dumps({"future": [1, {"more": True}]}), "future_column":"retained"})
        return em.read_matrix("Example/Native", path)

    def test_native_unknown_fields_preserved_and_source_link_is_not_proof(self):
        result = em.load_sources(self.root)
        result["capability_inventory"] = self.native_inventory()
        native = result["capability_inventory"][0]
        binding = {"repository":"Example/Native", "capability_id":"cap.native.example",
                   "source_digest":native["source_digest"], "disposition":"direct", "story_ids":["GV02"],
                   "future_metadata":{"preserve":True}}
        em.apply_bindings(result, [binding])
        self.assertEqual(native["native_record"]["future_column"], "retained")
        self.assertEqual(result["capability_bindings"][0]["future_metadata"], {"preserve":True})
        story = next(item for item in result["stories"] if item["id"] == "GV02")
        self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
        self.assertIsNone(result["feature_verdict"])

    def test_stale_or_fabricated_native_binding_fails(self):
        result = em.load_sources(self.root)
        result["capability_inventory"] = self.native_inventory()
        native = result["capability_inventory"][0]
        binding = {"repository":"Example/Native", "capability_id":"cap.native.example",
                   "source_digest":"wrong", "disposition":"direct", "story_ids":["GV02"]}
        with self.assertRaisesRegex(ValueError, "stale native"):
            em.apply_bindings(result, [binding])
        binding.update(source_digest=native["source_digest"], capability_id="cap.fabricated")
        with self.assertRaisesRegex(ValueError, "not read from native"):
            em.apply_bindings(result, [binding])

    def test_transitive_and_deferred_need_explicit_reason(self):
        result = em.load_sources(self.root)
        result["capability_inventory"] = self.native_inventory()
        binding = {"repository":"Example/Native", "capability_id":"cap.native.example",
                   "source_digest":result["capability_inventory"][0]["source_digest"],
                   "disposition":"transitive", "story_ids":["GV02"]}
        with self.assertRaisesRegex(ValueError, "support path"):
            em.apply_bindings(result, [binding])
        binding.update(disposition="deferred", reason="Provider absent")
        with self.assertRaisesRegex(ValueError, "owner and re-entry"):
            em.apply_bindings(result, [binding])

    def test_ql_unknown_rows_and_standing_are_preserved_not_ratified(self):
        result = em.load_sources(self.root)
        ql = self.root / "QL-MEF"
        spec = result["config"]["delegated_ql"]
        trace_path, standing_path = ql / spec["trace_path"], ql / spec["standing_path"]
        trace_path.parent.mkdir(parents=True)
        trace = {"stories":[{"id":key} for key in spec["known_ids"]] + [{"id":"UX-new", "future":"retained"}],
                 "deeper_inventory":{"must_survive":["unexpected-relation"]}}
        standing = {"H_ratification":"pending", "human_experience_validated":False}
        trace_path.write_text(json.dumps(trace))
        standing_path.write_text(json.dumps(standing))
        em.include_ql(result, ql)
        self.assertEqual(result["external_ql"]["trace"], trace)
        self.assertEqual(result["external_ql"]["publication_standing"], standing)
        trace["stories"] = trace["stories"][1:]
        trace_path.write_text(json.dumps(trace))
        with self.assertRaisesRegex(ValueError, "omits"):
            em.include_ql(result, ql)

    def test_all_existing_caw_ids_are_retained(self):
        result = em.load_sources(self.root)
        self.assertEqual(result["config"]["existing_caw"]["required_case_ids"], [f"P{i:02}" for i in range(1, 29)])
        self.assertEqual(len(set(result["config"]["setup_contexts"])), 6)
        self.assertIn("headless", result["config"]["composition_examples"])

    def test_method_description_has_the_real_prefix(self):
        # The METHOD: prefix on the skill's description is a real contract and
        # is kept. The former `assertIn("Source publication does", text)` was a
        # brittle exact-prose match on the skill body — a documentation-wording
        # check, not product acceptance, that broke on any rewording of the same
        # distinction — so it is removed rather than protected (F09).
        text = (ROOT / "skills/experience-campaign/SKILL.md").read_text()
        description = next(line for line in text.splitlines() if line.startswith("description:"))
        self.assertTrue(description.split(":", 1)[1].strip().strip('"').startswith("METHOD:"))

    def test_output_is_new_derived_planning_only(self):
        output = self.root / "generated"
        self.assertEqual(em.main(["--root", str(self.root), "--output-dir", str(output)]), 0)
        result = json.loads((output / "ux-reading.json").read_text())
        self.assertIsNone(result["feature_verdict"])
        self.assertEqual(result["external_ql"]["binding_status"], "source-root-required")
        self.assertEqual(em.main(["--root", str(self.root), "--output-dir", str(output)]), 1)


class ExecutableCoverageTests(unittest.TestCase):
    """The declared relation between executable frontend tests and the
    obligation field: validation, receipt join, and the grade law (#201: no
    automation earns P, M or H)."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "docs/experience", self.root / "docs/experience")
        config = json.loads((self.root / "docs/experience/campaign.json").read_text())
        for module_path in config.get("source_modules", []):
            module = json.loads(em.source_path(ROOT, module_path).read_text())
            for key in ("story_source", "document_operations_source"):
                relative = module.get(key)
                if relative:
                    target = em.source_path(self.root, relative)
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(em.source_path(ROOT, relative), target)
        bindings = config.get("executable_test_bindings") or {}
        self.bindings_path = self.root / bindings["path"]
        self.bindings_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(em.source_path(ROOT, bindings["path"]), self.bindings_path)
        self.artifacts = self.bindings_path.parent / "artifacts"
        self.artifacts.mkdir()
        # One real scenario file; bindings must point at existing tests.
        (self.bindings_path.parent / "scenarios").mkdir()
        (self.bindings_path.parent / "scenarios" / "example.mjs").write_text("export default async () => {};\n")

    def tearDown(self):
        self.temp.cleanup()

    def write_bindings(self, tests: dict):
        document = json.loads(self.bindings_path.read_text())
        document["tests"] = tests
        self.bindings_path.write_text(json.dumps(document, indent=2) + "\n")

    def write_receipt(self, name: str, *, passed=True, grade="B", checks=(True, True)):
        receipt = {
            "schema": "oi.cradle.walk.scenario/v1", "scenario": name,
            "spec_ref": "docs/cradle/05-EXECUTION.md §3", "grade": grade,
            "generated_at": "2026-09-22T00:00:00Z", "passed": passed,
            "checks": [{"ok": ok, "label": f"check {i}"} for i, ok in enumerate(checks)],
            "environment": {"source": {"repository_head": "head", "dirty_digest": "digest"}},
        }
        (self.artifacts / f"{name}.json").write_text(json.dumps(receipt, indent=2) + "\n")

    def coverage_of(self, obligation_id: str) -> dict:
        result = em.load_sources(self.root)
        em.load_coverage(result, self.root)
        return next(o for o in result["inherited_obligations"] if o["id"] == obligation_id)["executable_coverage"]

    def test_valid_binding_and_passing_receipt_earn_deterministic_only(self):
        self.write_receipt("example")
        self.write_bindings({"example": {
            "kind": "walk", "serves": ["factory289:arrangement"], "claims_grade": "D",
            "branches": {"factory289:arrangement": [0]}, "negatives": ["stale"], "note": "proves the face"}})
        coverage = self.coverage_of("factory289:arrangement")
        self.assertEqual(coverage["earned_grades"], ["D"])
        self.assertIn("H", coverage["remaining_grades"])
        self.assertEqual(coverage["covered_branches"], [0])
        self.assertTrue(coverage["unproved_branches"])
        self.assertEqual(coverage["performed"][0]["receipt_grade"], "B")
        self.assertEqual(coverage["negatives_exercised"], ["stale"])
        result = em.load_sources(self.root)
        em.load_coverage(result, self.root)
        reading = em.coverage_reading(result)
        self.assertEqual(reading["summary"]["obligations_with_executable_test"], 1)
        self.assertIsNone(result["feature_verdict"])

    def test_unknown_or_malformed_relation_is_refused(self):
        self.write_bindings({"example": {"kind": "walk", "serves": ["factory289:not-an-obligation"]}})
        result = em.load_sources(self.root)
        with self.assertRaisesRegex(ValueError, "unknown obligation/story"):
            em.load_coverage(result, self.root)
        self.write_bindings({"example": {
            "kind": "walk", "serves": ["factory289:arrangement"],
            "branches": {"factory289:arrangement": [99]}}})
        result = em.load_sources(self.root)
        with self.assertRaisesRegex(ValueError, "branch index out of range"):
            em.load_coverage(result, self.root)
        self.write_bindings({"example": {"kind": "walk", "serves": ["factory289:arrangement"], "negatives": ["fabricated"]}})
        result = em.load_sources(self.root)
        with self.assertRaisesRegex(ValueError, "negative outside declared vocabulary"):
            em.load_coverage(result, self.root)
        self.write_bindings({"missing-scenario": {"kind": "walk", "serves": ["factory289:arrangement"]}})
        result = em.load_sources(self.root)
        with self.assertRaisesRegex(ValueError, "test file not found"):
            em.load_coverage(result, self.root)

    def test_conformance_claim_requires_native_or_bridge_receipt(self):
        self.write_receipt("example", grade="C")
        self.write_bindings({"example": {"kind": "walk", "serves": ["factory289:arrangement"], "claims_grade": "C"}})
        result = em.load_sources(self.root)
        with self.assertRaisesRegex(ValueError, "claims cross-product conformance"):
            em.load_coverage(result, self.root)
        self.write_receipt("example", grade="B")
        result = em.load_sources(self.root)
        em.load_coverage(result, self.root)
        obligation = next(o for o in result["inherited_obligations"] if o["id"] == "factory289:arrangement")
        self.assertEqual(obligation["executable_coverage"]["earned_grades"], ["C"])

    def test_automation_never_earns_provider_material_or_human_grades(self):
        self.write_receipt("example", grade="A")
        self.write_bindings({"example": {"kind": "walk", "serves": ["grounding220:source-place"], "claims_grade": "C"}})
        coverage = self.coverage_of("grounding220:source-place")
        self.assertEqual(coverage["earned_grades"], ["C"])
        self.assertEqual(coverage["remaining_grades"], ["P", "M"])
        self.write_receipt("example", passed=False)
        coverage = self.coverage_of("grounding220:source-place")
        self.assertEqual(coverage["earned_grades"], [])
        self.assertEqual(coverage["covered_branches"], [])

    def test_coverage_reading_is_refused_without_declared_bindings(self):
        result = em.load_sources(self.root)
        result.pop("executable_bindings", None)
        with self.assertRaisesRegex(ValueError, "no executable_test_bindings"):
            em.coverage_reading(result)


class SelectionTests(unittest.TestCase):
    """Relevant-test selection: relations include, Jev may only add."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "docs/experience", self.root / "docs/experience")
        config = json.loads((self.root / "docs/experience/campaign.json").read_text())
        bindings = config.get("executable_test_bindings") or {}
        self.bindings_path = self.root / bindings["path"]
        self.bindings_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(em.source_path(ROOT, bindings["path"]), self.bindings_path)
        (self.bindings_path.parent / "scenarios").mkdir()
        (self.bindings_path.parent / "scenarios" / "example.mjs").write_text("export default async () => {};\n")

    def tearDown(self):
        self.temp.cleanup()

    def select(self, *args):
        import importlib.util as util
        spec = util.spec_from_file_location("select_relevant_tests", ROOT / "scripts/select_relevant_tests.py")
        module = util.module_from_spec(spec)
        spec.loader.exec_module(module)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = module.main(["--root", str(self.root), *args])
        return code, output.getvalue()

    def test_module_change_selects_bound_tests_with_recorded_reason(self):
        self.bindings_path.write_text(json.dumps({**json.loads(self.bindings_path.read_text()),
            "tests": {"example": {"kind": "walk", "serves": ["factory289:arrangement"], "note": "n"}}}))
        code, out = self.select("--changed", "docs/experience/factory-agency.json")
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual([s["test"] for s in payload["selected"]], ["example"])
        self.assertIn("factory289:arrangement", payload["selected"][0]["reasons"][0])

    def test_app_source_selects_every_walk_test(self):
        self.bindings_path.write_text(json.dumps({**json.loads(self.bindings_path.read_text()),
            "tests": {"example": {"kind": "walk", "serves": ["factory289:arrangement"], "note": "n"}}}))
        code, out = self.select("--changed", "desktop/cradle/src/CradleFrame.tsx")
        payload = json.loads(out)
        self.assertEqual(len(payload["selected"]), 1)
        self.assertIn("application/harness source under test changed", payload["selected"][0]["reasons"][0])

    def test_jev_unavailable_is_recorded_never_simulated(self):
        self.bindings_path.write_text(json.dumps({**json.loads(self.bindings_path.read_text()),
            "tests": {"example": {"kind": "walk", "serves": ["factory289:arrangement"], "note": "n"}}}))
        code, out = self.select("--changed", "docs/experience/STORIES.md", "--use-jev")
        self.assertEqual(code, 0)
        payload = json.loads(out)
        # A campaign-wide source change selects the bound test through the
        # declared relation, whatever the faculty does.
        self.assertEqual([s["test"] for s in payload["selected"]], ["example"])
        self.assertNotIn("jev semantic", " ".join(payload["selected"][0]["reasons"]))
        self.assertIsInstance(payload["jev"]["available"], bool)
        self.assertFalse(payload["jev"]["used"] and not payload["jev"]["available"])


if __name__ == "__main__":
    unittest.main()
