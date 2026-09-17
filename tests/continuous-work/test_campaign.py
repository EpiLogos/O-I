"""Harness mechanics only: fixture subprocesses NEVER establish suite C/P/M/H."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("campaign", ROOT / "scripts/caw_campaign.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

FIXTURE = '''import json, pathlib, sys, time
p=pathlib.Path("state")
mode=sys.argv[1]
if mode=="write": p.write_text("arrived")
if mode=="read": print(json.dumps({"arrived":p.exists()}))
if mode=="constant": print(json.dumps({"arrived":True}))
if mode=="fail": sys.exit(3)
if mode=="wait": time.sleep(20)
'''

class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "README").write_text("runner fixture, not a suite runtime")
        for args in (["init", "-q"], ["add", "README"], ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"]):
            subprocess.run(["git", "-C", str(self.source), *args], check=True, capture_output=True)
        revision = subprocess.check_output(["git", "-C", str(self.source), "rev-parse", "HEAD"], text=True).strip()
        exe = Path(sys.executable).resolve()
        self.bindings = {"fixture": {"path":str(exe), "sha256":c.sha(exe.read_bytes()), "source":str(self.source), "revision":revision}}
        self.out = c.fresh_directory(self.root / "evidence")
        self.rec = c.Recorder(self.out, self.bindings, timeout=2)
        self.recipe = {"schema":"oi.caw-native-probe/v1", "id":"fixture-only", "case":"P13", "obligation":"commission-publication",
                       "owner_contract":"fixture: test engine mechanics, not product APIs", "source_basis":"test fixture",
                       "max_grade":"D", "fixtures":{"fixture.py":FIXTURE},
                       "initial_checks":[{"file":"state","exists":False}],
                       "steps":[{"id":"write","kind":"operation","owner":"fixture","argv":["{world}/fixture.py","write"]},
                                {"id":"read","kind":"readback","owner":"fixture","argv":["{world}/fixture.py","read"]}],
                       "disconnect":"write", "checks":[{"step":"read","pointer":"/arrived","equals":True}]}

    def test_real_subprocess_observes_effect_and_disconnection(self):
        result = c.run_recipe(self.recipe,self.rec)
        self.assertEqual(result["disconnected"],"detected")
        self.assertEqual(len(self.rec.records),3)
        self.assertEqual(result["grade"],"D")

    def test_receipt_only_constant_observer_is_rejected(self):
        self.recipe["steps"][1]["argv"][-1]="constant"
        with self.assertRaisesRegex(c.Failure,"disconnected operation still passes"):
            c.run_recipe(self.recipe,self.rec)

    def test_noop_operation_cannot_pass(self):
        self.recipe["steps"][0]["argv"][-1]="noop"
        with self.assertRaisesRegex(c.Failure,"connected native path failed"):
            c.run_recipe(self.recipe,self.rec)

    def test_failed_operation_is_not_pending_or_mutation_success(self):
        self.recipe["steps"][0]["argv"][-1]="fail"
        with self.assertRaisesRegex(c.Failure,"setup/operation failed"):
            c.run_recipe(self.recipe,self.rec)

    def test_timeout_is_failure_and_retains_evidence(self):
        self.recipe["steps"][0]["argv"][-1]="wait"
        with self.assertRaisesRegex(c.Failure,"timed out"):
            c.run_recipe(self.recipe,self.rec)
        self.assertTrue(self.rec.records[0]["timed_out"])
        self.assertTrue((self.out/"0000.invocation.json").is_file())

    def test_missing_binary_is_pending(self):
        self.rec.binaries={}
        with self.assertRaises(c.Pending): c.run_recipe(self.recipe,self.rec)

    def test_binary_digest_mismatch_fails(self):
        self.bindings["fixture"]["sha256"]="0"*64
        with self.assertRaisesRegex(c.Failure,"digest"): self.rec.bind("fixture")

    def test_dirty_source_fails(self):
        (self.source/"README").write_text("changed")
        with self.assertRaisesRegex(c.Failure,"clean exact cut"): self.rec.bind("fixture")

    def test_wrong_source_cut_fails(self):
        self.bindings["fixture"]["revision"]="0"*40
        with self.assertRaises(c.Failure): self.rec.bind("fixture")

    def test_relative_binary_cannot_use_path_fallback(self):
        self.bindings["fixture"]["path"]="python3"
        with self.assertRaises(c.Pending): self.rec.bind("fixture")

    def test_symlink_binary_refused(self):
        link=self.root/"python";link.symlink_to(sys.executable)
        self.bindings["fixture"]["path"]=str(link)
        with self.assertRaises(c.Pending): self.rec.bind("fixture")

    def test_no_public_readback_refused(self):
        self.recipe["steps"][1]["kind"]="operation"
        with self.assertRaisesRegex(c.Failure,"readback"):c.validate_recipe(self.recipe)

    def test_producer_receipt_is_not_readback(self):
        self.recipe["checks"][0]["step"]="write"
        with self.assertRaisesRegex(c.Failure,"producer receipt"): c.validate_recipe(self.recipe)

    def test_disconnect_must_be_actual_operation(self):
        self.recipe["disconnect"]="read"
        with self.assertRaises(c.Failure): c.validate_recipe(self.recipe)

    def test_empty_assertion_cannot_pass(self):
        self.recipe["checks"]=[]
        with self.assertRaises(c.Failure): c.validate_recipe(self.recipe)

    def test_single_owner_cannot_claim_c(self):
        self.recipe["max_grade"]="C"
        with self.assertRaisesRegex(c.Failure,"cross-owner"):c.validate_recipe(self.recipe)

    def test_recipe_cannot_claim_provider_material_human(self):
        for grade in "PMH":
            self.recipe["max_grade"]=grade
            with self.assertRaises(c.Failure):c.validate_recipe(self.recipe)

    def test_duplicate_step_rejected(self):
        self.recipe["steps"].append(self.recipe["steps"][0])
        with self.assertRaises(c.Failure):c.validate_recipe(self.recipe)

    def test_fixture_traversal_refused(self):
        self.recipe["fixtures"]={"../escape":"no"}
        with self.assertRaises(c.Failure):c.run_recipe(self.recipe,self.rec)
        self.assertFalse((self.root/"escape").exists())

    def test_absolute_fixture_refused(self):
        with self.assertRaises(c.Failure):c.inside(self.out,"/tmp/escape")

    def test_symlink_readback_refused(self):
        (self.out/"escape").symlink_to(self.source,target_is_directory=True)
        with self.assertRaises(c.Failure):c.inside(self.out,"escape/README")

    def test_existing_output_never_overwritten(self):
        with self.assertRaises(c.Failure):c.fresh_directory(self.out)

    def test_private_live_world_not_replayed(self):
        with self.assertRaises(c.Pending):c.run_recipe(self.recipe,self.rec,installed=True)
        self.assertEqual(self.rec.records,[])

    def test_full_28_case_matrix(self):
        self.assertEqual([x["id"] for x in c.matrix()],[f"P{i:02}" for i in range(1,29)])

    def test_missing_essential_cases_are_pending_not_green(self):
        report=c.assess(c.matrix(),[])
        self.assertEqual(report["standing"],"pending")
        self.assertEqual(len(report["cases"]),28)
        self.assertIsNone(report["whole_feature_verdict"])

    def test_bounded_real_probe_does_not_close_full_case(self):
        observation=c.run_recipe(self.recipe,self.rec)
        result=c.assess(c.matrix(),[observation])
        self.assertEqual(result["cases"][12]["standing"],"pending")
        self.assertGreater(len(result["cases"][12]["missing"]),1)

    def test_failed_observation_fails_parent(self):
        result=c.assess(c.matrix(),[{"case":"P26","standing":"failed"}])
        self.assertEqual(result["standing"],"failed")

    def test_json_pass_and_skips_have_no_grade(self):
        for status in ("passed","skipped","unavailable","not-run"):
            result=c.assess(c.matrix(),[{"case":"P01","standing":status,"grade":"D"}])
            self.assertEqual(result["standing"],"pending")

    def test_no_process_records_means_no_native_evidence(self):
        result=c.assess(c.matrix(),[{"case":"P13","obligation":"commission-publication","standing":"observed","grade":"D","disconnected":"detected","record_ids":[]}])
        self.assertIn({"obligation":"commission-publication","grade":"D"},result["cases"][12]["missing"])

    def test_pointer_rfc6901_and_wrong_value(self):
        self.assertEqual(c.pointer({"a/b":{"~":[1]}},"/a~1b/~0/0"),1)
        self.assertFalse(c.matches([{"step":"x","pointer":"/n","equals":2}],{"x":(0,b'{"n":1}')},self.out))

    def test_filesystem_postcondition_not_json_only(self):
        self.assertFalse(c.matches([{"file":"not-created","exists":True}],{},self.out))

    def test_export_is_fingerprint_only_and_detects_changed_artifacts(self):
        observations=[c.run_recipe(self.recipe,self.rec)]
        report={"run_id":"test","test_source_sha256":"a"*64,"matrix_sha256":"b"*64,
                "acceptance":c.assess(c.matrix(),observations),"observations":observations,"commands":self.rec.records}
        c.store(self.out/"report.json",report)
        dest=self.root/"public.json";c.export_evidence(self.out,dest)
        text=dest.read_text()
        self.assertNotIn(str(self.root),text)
        self.assertNotIn("fixture.py",text)
        self.assertNotIn('"argv":',text)
        (self.out/"0000.stdout").write_text("tampered")
        with self.assertRaisesRegex(c.Failure,"changed after capture"):
            c.export_evidence(self.out,self.root/"bad-export.json")

    def test_source_hash_locks_exact_draft(self):
        data=c.governance()
        self.assertEqual(c.sha(data),c.GOVERNANCE_SHA)
        self.assertIn(b"Draft for human validation",data)
        self.assertNotEqual(c.sha(data.replace(b"independent verification",b"self approval")),c.GOVERNANCE_SHA)

    def test_native_recipe_uses_existing_owner_fixture_and_api(self):
        recipe=c.load(c.SPEC/"native-probes.json")[0]
        c.validate_recipe(recipe)
        self.assertIn("commission-read",recipe["steps"][1]["argv"])
        self.assertNotIn("factory.json",recipe.get("fixtures",{}))

if __name__=="__main__":unittest.main()
