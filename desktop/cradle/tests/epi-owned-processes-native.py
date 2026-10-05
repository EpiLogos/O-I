#!/usr/bin/env python3
"""Real Linux PID/start/image/exec, lifetime archive and refusal checks.

Every process below is actually started in a disposable test directory. No
/proc rows, native images, cleanup outcomes or filesystem replies are mocked.
This establishes observer custody only, never Epi scene/installed acceptance.
"""
import importlib.util
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('hosted', Path(__file__).with_name('epi-world-hosted-native.py'))
hosted = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hosted)


class ActualOwnedLifetimes(unittest.TestCase):
    def setUp(self):
        self.assertTrue(sys.platform.startswith('linux') and Path('/proc').is_dir())
        self.temp = tempfile.TemporaryDirectory(prefix='epi-owned-actual-')
        self.processes, self.observers = [], []

    def tearDown(self):
        for owned in self.observers:
            if owned.monitor.is_alive():
                try:
                    owned.close()
                except Exception:
                    pass
                owned.quit.set()
                owned.monitor.join(timeout=5)
            self.assertFalse(owned.monitor.is_alive())
        for process in self.processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
            for pipe in (process.stdin, process.stdout, process.stderr):
                if pipe:
                    pipe.close()
        self.temp.cleanup()

    def observer(self):
        output = Path(self.temp.name) / str(len(self.observers))
        output.mkdir()
        owned = hosted.OwnedProcesses(output)
        self.observers.append(owned)
        return owned

    def process(self, owned=None, family=False):
        body = ("import os,time,json; children=[]\n"
                "for i in range(2):\n"
                " p=os.fork()\n"
                " if p==0:\n"
                "  time.sleep(60);os._exit(0)\n"
                " children.append(p)\n"
                "print(json.dumps(children),flush=True);time.sleep(60)" if family else
                "import os,sys;print('ready',flush=True);sys.stdin.buffer.read(1);os.execv('/bin/sleep',['sleep','60'])")
        process = subprocess.Popen([sys.executable, '-u', '-c', body], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        self.processes.append(process)
        with selectors.DefaultSelector() as ready:
            ready.register(process.stdout, selectors.EVENT_READ)
            self.assertTrue(ready.select(timeout=5), 'Actual test process did not start')
        announced = process.stdout.readline()
        children = json.loads(announced) if family else []
        if owned:
            self.assertTrue(owned.add(process, 'actual-family' if family else 'actual-exec'))
        return process, children

    def two_images(self, owned):
        process, _ = self.process(owned)
        identity = process.epi_owned_identity
        owned.capture()
        first = os.readlink(f'/proc/{process.pid}/exe')
        process.stdin.write(b'x'); process.stdin.flush()
        deadline = time.monotonic() + 5
        while os.readlink(f'/proc/{process.pid}/exe') == first:
            self.assertLess(time.monotonic(), deadline, 'Actual same-PID exec did not complete')
            time.sleep(.005)
        owned.capture()
        self.assertEqual(hosted.proc_stat(process.pid)['starttime'], identity[1])
        self.assertEqual(len([row for row in owned.rows.values() if (row['pid'], row['starttime']) == identity]), 2)
        receipt = owned.stop(process)
        self.assertFalse(receipt['observation_failure'])
        self.assertFalse(receipt['live_descendants_remaining'])
        # The exact owned stop receipt is retained; exited process pipes no
        # longer serve a reader and must not accumulate across phase rotation.
        for pipe in (process.stdin, process.stdout, process.stderr):
            if pipe:
                pipe.close()

    def test_complete_576_original_images_and_144_constructor_images_in_all_declared_lifetimes(self):
        self.assertEqual(hosted.OWNED_PHASES[:3], ('first-construction-identity-setup', 'first-construction', 'first-construction-restart'))
        self.assertEqual(len(hosted.OWNED_PHASES[3:]), 12, 'All original twelve lifetimes remain')
        owned = self.observer()
        for phase in hosted.OWNED_PHASES:
            owned.begin_phase(phase)
            for _ in range(24):
                self.two_images(owned)
            self.assertEqual(len(owned.rows), 48)
        result = owned.finish_phases()
        self.assertFalse(result['errors'])
        self.assertEqual([row['phase'] for row in result['archived_phases']], list(hosted.OWNED_PHASES))
        self.assertEqual(sum(row['records'] for row in result['archived_phases'][3:]), 576)
        self.assertEqual(sum(row['records'] for row in result['archived_phases'][:3]), 144)
        self.assertEqual(len(owned.cleanups), 360)
        owned.close()
        self.assertEqual(len(owned.cleanups), 360, 'Close must reuse completed exact cleanup receipts')
        owned.verify_archives()

    def test_actual_startup_above_select_descriptor_ceiling(self):
        descriptors = []
        try:
            while not descriptors or descriptors[-1] <= 1024:
                descriptors.append(os.open(os.devnull, os.O_RDONLY))
            owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0])
            self.two_images(owned)
            self.assertEqual(len(owned.rows), 2)
            owned.close()
        finally:
            for descriptor in descriptors:
                os.close(descriptor)

    def test_original_512_record_refusal_retains_all_actual_family_identities_for_cleanup(self):
        owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0])
        for _ in range(256):
            self.two_images(owned)
        self.assertEqual(len(owned.rows), 512)
        process, children = self.process(owned, family=True)
        with self.assertRaisesRegex(AssertionError, 'record bound'):
            owned.capture()
        for pid in [process.pid, *children]:
            actual = hosted.proc_stat(pid)
            self.assertIn((pid, actual['starttime']), owned.known)
        receipt = owned.stop(process)
        self.assertIsNotNone(receipt['observation_failure'])
        self.assertFalse(receipt['live_descendants_remaining'])
        for pid in children:
            actual = hosted.proc_stat(pid)
            self.assertTrue(actual is None or actual['state'] == 'Z')
        self.assertTrue(owned.errors)
        with self.assertRaises(AssertionError):
            owned.begin_phase(hosted.OWNED_PHASES[1])
        with self.assertRaisesRegex(AssertionError, 'observation failed'):
            owned.close()
        self.assertFalse(owned.monitor.is_alive())

    def test_wrong_actual_native_image_stays_fatal_and_cleanup_still_runs(self):
        owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0])
        image = hosted.file_ref(Path(sys.executable).resolve())
        owned.expected = {'actual-python': {**image, 'sha256': '0' * 64}}
        process, _ = self.process(owned)
        with self.assertRaisesRegex(AssertionError, 'differs from offered cut'):
            owned.capture()
        receipt = owned.stop(process)
        self.assertIsNotNone(receipt['observation_failure'])
        self.assertIsNotNone(process.poll())
        with self.assertRaises(AssertionError):
            owned.close()

    def test_build_family_is_retired_before_first_phase_and_unowned_process_is_untouched(self):
        owned = self.observer()
        external, _ = self.process()
        root, children = self.process(owned, family=True)
        owned.capture(); owned.begin_phase(hosted.OWNED_PHASES[0])
        self.assertIsNotNone(root.poll())
        self.assertIsNone(external.poll())
        self.assertNotIn(external.pid, [row['pid'] for row in owned.known.values()])
        for pid in children:
            actual = hosted.proc_stat(pid)
            self.assertTrue(actual is None or actual['state'] == 'Z')
        self.assertEqual(len(owned.cleanups), 1)
        self.assertEqual(owned.rows, {})
        owned.close()

    def test_actual_archive_replacement_and_oversized_file_are_refused(self):
        for oversized in (False, True):
            owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0])
            self.two_images(owned); owned.begin_phase(hosted.OWNED_PHASES[1])
            path = Path(owned.archives[0]['archive']['path'])
            if oversized:
                path.write_bytes(b'x' * (2 * 1024 * 1024 + 1))
            else:
                value = json.loads(path.read_bytes()); value['records'][0]['exe'] += '-replaced'
                path.write_text(json.dumps(value))
            with self.assertRaisesRegex(AssertionError, 'evidence changed'):
                owned.evidence()
            with self.assertRaises(AssertionError):
                owned.close()

    def test_sealed_registration_undeclared_rotation_and_missing_lifetime_are_refused(self):
        owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0]); self.two_images(owned)
        with self.assertRaises(AssertionError):
            owned.begin_phase('arbitrary-rollover')
        owned.seal_phase()
        process, _ = self.process()
        with self.assertRaisesRegex(AssertionError, 'after its immutable lifetime'):
            owned.add(process, 'late-root')
        with self.assertRaisesRegex(AssertionError, 'omitted an original owned lifetime'):
            owned.finish_phases()
        owned.close()

    def test_real_archive_io_failure_cannot_claim_a_sealed_lifetime(self):
        owned = self.observer(); owned.begin_phase(hosted.OWNED_PHASES[0]); self.two_images(owned)
        (owned.output / 'owned-image-phases').write_text('actual filesystem obstruction')
        with self.assertRaises(FileExistsError):
            owned.seal_phase()
        self.assertEqual(owned.archives, [])
        self.assertIsNone(owned.sealed_phase)
        with self.assertRaises(FileExistsError):
            owned.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
