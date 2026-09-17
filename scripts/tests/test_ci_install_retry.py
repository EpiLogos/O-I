"""Real controlled subprocess tests for CI retries; not provider/trust evidence."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("install_retry", ROOT / "scripts/ci_install_retry.py")
retry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(retry)

TRANSIENT = "Error: HTTP 503: trust-metadata-api service unavailable (https://api.github.com/repos/EpiLogos/Actuation/attestations/sha256:abc?per_page=30)\noi: GitHub attestation verification failed for actuation"


class ClassifierTests(unittest.TestCase):
    def test_only_attestation_api_transient_codes_are_allowed(self):
        for code in (502, 503, 504):
            self.assertTrue(retry.retryable(TRANSIENT.replace("503", str(code))))
        for code in (400, 401, 403, 404, 429, 500):
            self.assertFalse(retry.retryable(TRANSIENT.replace("503", str(code))))
        self.assertFalse(retry.retryable(TRANSIENT.replace("api.github.com", "untrusted.example")))
        self.assertFalse(retry.retryable(TRANSIENT.replace("/attestations/", "/other/")))

    def test_trust_and_unknown_failures_are_never_hidden(self):
        for failure in ("invalid signature", "digest mismatch", "Error: no attestations found",
                        "fatal: checkout failed", "test result: FAILED"):
            self.assertFalse(retry.retryable(failure))
            self.assertFalse(retry.retryable(TRANSIENT + "\n" + failure))


class ProcessTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.counter = self.root / "calls.json"
        self.out = self.root / "evidence"
        self.oi = self.root / "oi"

    def executable(self, body):
        self.oi.write_text(f"#!{sys.executable}\nfrom pathlib import Path\nimport json,sys,time\np=Path({str(self.counter)!r})\ncalls=json.loads(p.read_text()) if p.exists() else []\ncalls.append(sys.argv[1:])\np.write_text(json.dumps(calls))\n" + body + "\n")
        self.oi.chmod(0o755)

    def result(self):
        return json.loads((self.out / "attempts.json").read_text())

    def test_transient_failure_then_native_success_preserves_attempts_and_arguments(self):
        self.executable(f"print({TRANSIENT!r}) if len(calls)==1 else print('native verification passed')\nsys.exit(2 if len(calls)==1 else 0)")
        ground = self.root / "ground with spaces"
        self.assertEqual(0, retry.run_install(self.oi, ground, self.out, delay=0))
        calls = json.loads(self.counter.read_text())
        self.assertEqual([["install", "--personal-ground", str(ground)]] * 2, calls)
        self.assertEqual([2, 0], [row['exit_code'] for row in self.result()['attempts']])
        self.assertFalse(self.result()['verification_bypassed'])
        self.assertEqual(2, len(list(self.out.glob('attempt-*.log'))))

    def test_permanent_failure_executes_once_and_preserves_exit_code(self):
        self.executable("print('Error: invalid signature'); sys.exit(17)")
        self.assertEqual(17, retry.run_install(self.oi, None, self.out, delay=0))
        self.assertEqual([["install"]], json.loads(self.counter.read_text()))
        self.assertEqual('failed', self.result()['standing'])

    def test_exhaustion_is_three_attempts_not_green(self):
        self.executable(f"print({TRANSIENT!r}); sys.exit(2)")
        self.assertEqual(2, retry.run_install(self.oi, None, self.out, delay=0))
        self.assertEqual(3, len(self.result()['attempts']))
        self.assertEqual('failed', self.result()['standing'])

    def test_timeout_is_not_retried_even_after_transient_text(self):
        self.executable(f"print({TRANSIENT!r}, flush=True); time.sleep(30)")
        self.assertEqual(124, retry.run_install(self.oi, None, self.out, delay=0, timeout=0.2))
        self.assertEqual(1, len(self.result()['attempts']))
        self.assertTrue(self.result()['attempts'][0]['timed_out'])

    def test_bad_budget_and_existing_evidence_do_not_execute(self):
        self.executable("sys.exit(0)")
        with self.assertRaises(ValueError):
            retry.run_install(self.oi, None, self.out, attempts=4)
        self.out.mkdir()
        (self.out / 'attempt-1.log').write_text('retained')
        with self.assertRaises(FileExistsError):
            retry.run_install(self.oi, None, self.out, delay=0)
        self.assertFalse(self.counter.exists())
        self.assertEqual('retained', (self.out / 'attempt-1.log').read_text())

    def test_missing_executable_is_recorded_and_not_retried(self):
        self.assertEqual(127, retry.run_install(self.oi, None, self.out, delay=0))
        self.assertEqual(1, len(self.result()['attempts']))


if __name__ == '__main__':
    unittest.main()
