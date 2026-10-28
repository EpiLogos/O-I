#!/usr/bin/env python3
"""The starting worlds are made, kept and reset under a root, and never touch the computer's own world (O-I #738).

Every run stands on a scratch home (OI_NATIVE_HOME) and a scratch root; nothing here reads or writes the real home.
"""
import contextlib
import gzip
import importlib.util
import io
import json
import os
import socket
import subprocess
import tempfile
import unittest
import wave
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]


def load():
    spec = importlib.util.spec_from_file_location('starting_worlds', HERE / 'starting-worlds.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StartingWorldsTests(unittest.TestCase):
    def setUp(self):
        self.worlds = load()
        self.scratch = Path(tempfile.mkdtemp(prefix='oi-starting-worlds-')).resolve()
        self.home = self.scratch / 'home'
        (self.home / 'Central/Work').mkdir(parents=True)
        (self.home / '.aikit').mkdir()
        (self.home / '.config/oi').mkdir(parents=True)
        (self.home / '.config/oi/composition.json').write_text(json.dumps({'personal_ground': str(self.home / 'Central')}))
        self.root = self.scratch / 'worlds'
        self.environment = os.environ.get('OI_NATIVE_HOME')
        os.environ['OI_NATIVE_HOME'] = str(self.home)

    def tearDown(self):
        if self.environment is None:
            os.environ.pop('OI_NATIVE_HOME', None)
        else:
            os.environ['OI_NATIVE_HOME'] = self.environment
        subprocess.run(['rm', '-rf', str(self.scratch)], check=True)

    def run_tool(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = self.worlds.main(['--root', str(self.root), *args])
        return code, out.getvalue(), err.getvalue()

    def make(self, *args):
        code, out, err = self.run_tool('make', *args)
        self.assertEqual(code, 0, err)
        return Path(json.loads(out)['folder'])

    def test_bare_is_an_empty_folder_and_is_made_once(self):
        bare = self.make('bare')
        self.assertEqual(bare, self.root / 'Bare')
        self.assertEqual(list(bare.iterdir()), [])
        manifest = json.loads((self.root / 'starting-worlds.json').read_text())
        self.assertEqual(manifest['worlds']['Bare']['kind'], 'bare')
        code, _, err = self.run_tool('make', 'bare')
        self.assertEqual(code, 2)
        self.assertIn('reset it instead', err)

    def test_arriving_is_a_person_with_their_own_tools_and_no_central_yet(self):
        arriving = self.make('arriving')
        for repo in ('code/field-notes', 'code/tide-sketches'):
            self.assertTrue((arriving / repo / 'AGENTS.md').is_file(), repo)
            log = subprocess.run(['git', 'log', '--format=%an %s'], cwd=arriving / repo, capture_output=True, text=True,
                                 env={'PATH': os.environ['PATH'], 'HOME': str(arriving), 'GIT_CONFIG_GLOBAL': os.devnull})
            self.assertEqual(log.returncode, 0, log.stderr)
            self.assertEqual(len(log.stdout.strip().splitlines()), 1)
            self.assertTrue(log.stdout.startswith('Mira Okafor'))
        skills = sorted(p.parent.name for p in (arriving / '.claude/skills').glob('*/SKILL.md'))
        self.assertEqual(skills, ['field-recording-log', 'weekly-review'])
        for skill in (arriving / '.claude/skills').glob('*/SKILL.md'):
            self.assertTrue(skill.read_text().startswith('---\nname: '), skill)
        self.assertTrue(json.loads((arriving / '.claude/settings.json').read_text())['permissions'])
        self.assertTrue((arriving / 'Notes/Recordings.md').is_file())
        for take in (arriving / 'Music/Audio').glob('*.wav'):
            with wave.open(str(take)) as audio:
                self.assertGreater(audio.getnframes(), 10000)
        live_set = ET.fromstring(gzip.decompress((arriving / 'Music/Ableton/Tide Sketch Project/Tide Sketch.als').read_bytes()))
        names = [n.get('Value') for n in live_set.iter('EffectiveName')]
        self.assertEqual(names, ['Estuary', 'Market hall', 'Tide pad'])
        self.assertEqual(live_set.find('LiveSet/MainTrack/DeviceChain/Mixer/Tempo/Manual').get('Value'), '92')
        self.assertTrue((arriving / 'Vault/.obsidian/app.json').is_file())
        self.assertIn('[[Tide tables]]', (arriving / 'Vault/Estuary.md').read_text())
        self.assertFalse((arriving / 'Central').exists(), 'Setup makes the ground')
        self.assertFalse((arriving / '.aikit').exists())

    def test_reset_makes_bare_and_arriving_again_from_nothing(self):
        arriving = self.make('arriving')
        (arriving / 'Central').mkdir()
        (arriving / '.aikit').mkdir()
        (arriving / 'Notes/Recordings.md').write_text('walked forward')
        code, _, err = self.run_tool('reset', 'Arriving')
        self.assertEqual(code, 0, err)
        self.assertFalse((arriving / 'Central').exists())
        self.assertFalse((arriving / '.aikit').exists())
        self.assertIn('Estuary', (arriving / 'Notes/Recordings.md').read_text())
        bare = self.make('bare')
        (bare / 'Central').mkdir()
        self.assertEqual(self.run_tool('reset', 'Bare')[0], 0)
        self.assertEqual(list(bare.iterdir()), [])

    def test_a_kept_world_resets_to_its_snapshot_in_place(self):
        lived = self.make('bare', '--as', 'Lived-in')
        (lived / 'Central/Work/First').mkdir(parents=True)
        (lived / '.aikit').mkdir()
        (lived / '.aikit/state.json').write_text('{"walked": true}')
        code, out, err = self.run_tool('keep', 'Lived-in')
        self.assertEqual(code, 0, err)
        self.assertTrue(Path(json.loads(out)['snapshot']).is_file())
        (lived / 'Central/Work/Second').mkdir()
        (lived / '.aikit/state.json').write_text('{"walked": "further"}')
        self.assertEqual(self.run_tool('reset', 'Lived-in')[0], 0)
        self.assertTrue((lived / 'Central/Work/First').is_dir())
        self.assertFalse((lived / 'Central/Work/Second').exists())
        self.assertEqual(json.loads((lived / '.aikit/state.json').read_text()), {'walked': True})

    def test_yours_and_the_native_places_are_never_made_or_reset(self):
        self.assertEqual(self.run_tool('make', 'bare', '--as', 'Yours')[0], 2)
        self.assertEqual(self.run_tool('reset', 'Yours')[0], 2)
        for root in (self.home / 'Central', self.home / 'Central/Worlds', self.home / '.aikit/worlds', self.scratch,
                     self.home / 'Library/worlds'):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = self.worlds.main(['--root', str(root), 'make', 'bare'])
            self.assertEqual(code, 2, root)
            self.assertIn('own', err.getvalue())
        # A folder the tool did not make is never removed.
        (self.root / 'Mine').mkdir(parents=True)
        (self.root / 'Mine/keep.txt').write_text('mine')
        code, _, err = self.run_tool('reset', 'Mine')
        self.assertEqual(code, 2)
        self.assertEqual((self.root / 'Mine/keep.txt').read_text(), 'mine')

    def test_a_world_open_in_a_candidate_is_not_reset(self):
        bare = self.make('bare')
        data = bare / 'Library/Application Support/OI-Shell-Candidate/full-suite'
        data.mkdir(parents=True)
        # The candidate's own endpoint for that data home; bound by its folder, as a long path does not fit.
        sock = self.worlds.endpoint(data)
        sock.parent.mkdir(parents=True, exist_ok=True)
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            os.chdir(sock.parent)
            server.bind('expression.sock')
            server.listen(1)
            code, _, err = self.run_tool('reset', 'Bare')
            self.assertEqual(code, 2)
            self.assertIn('quit it first', err)
            server.close()
            code, _, err = self.run_tool('reset', 'Bare')
            self.assertEqual(code, 0, err)
        finally:
            server.close()
            os.chdir(HERE)
            if sock.parent.name.startswith('oi-cradle-'):
                subprocess.run(['rm', '-rf', str(sock.parent)], check=True)

    def test_register_names_the_world_for_the_worlds_menu_without_opening_it(self):
        bare = self.make('bare')
        code, out, err = self.run_tool('register', 'Bare')
        self.assertEqual(code, 0, err)
        register = json.loads((self.home / '.config/oi-shell-candidate/worlds.json').read_text())
        self.assertEqual(register, {'schema': 'oi.shell-worlds/v1', 'current': None, 'worlds': [{'name': 'Bare', 'folder': str(bare)}]})
        self.assertEqual(self.run_tool('register', 'Bare')[0], 0)
        self.assertEqual(len(json.loads((self.home / '.config/oi-shell-candidate/worlds.json').read_text())['worlds']), 1)


if __name__ == '__main__':
    unittest.main()
