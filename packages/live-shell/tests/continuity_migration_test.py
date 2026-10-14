"""Fixture-only qualification of the everyday continuity migration.

Every store here is a temporary fixture home; nothing reads the owner's WebKit data
or the owner's candidate data home. The key map is pinned to the TypeScript sources
it was ported from, so a renamed key fails here rather than migrating silently.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).resolve().parent
REPO = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('continuity_migration', HERE.parent / 'continuity-migration.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

BOOK_TEXT = json.dumps({'version': 2, 'active': 'w1', 'workspaces': [
    {'id': 'w1', 'name': 'Central', 'writing': '', 'layout': {'surfaces': {}, 'root': None}}]}, separators=(',', ':'))
DRAFT_KEY = 'oi-cradle.draft.v1:central:path:/Users/owner/Central:Work/x/y.md'
UNPLACED_KEY = 'oi-cradle.unplaced-draft.v1:draft-1'
RECOVERY_KEY = 'oi-cradle.recovery.rec-1'


def encode(value):
    if isinstance(value, bytes):
        return value
    return value.encode('utf-16-le')


def make_store(path, items):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    try:
        conn.execute('CREATE TABLE ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB NOT NULL ON CONFLICT FAIL)')
        for key, value in items.items():
            conn.execute('INSERT INTO ItemTable (key, value) VALUES (?, ?)', (key, encode(value)))
        conn.commit()
    finally:
        conn.close()


def everyday_items(book=BOOK_TEXT):
    journal = json.dumps({'version': 1, 'slots': {
        'oi-cradle.workspaces.v1': {'previous': BOOK_TEXT, 'candidate': BOOK_TEXT},
        'oi-cradle.other.v1': {'previous': 'x'}}}, separators=(',', ':'))
    record = json.dumps({'key': RECOVERY_KEY, 'sourceKey': 'oi-cradle.workspaces.v1', 'raw': '{broken',
                         'reason': 'fixture', 'savedAt': '2026-10-01T00:00:00.000Z', 'seq': 1})
    return {
        'oi-cradle.workspaces.v1': book,
        'oi-cradle.layout.v1': '{"surfaces":{}}',
        'oi-cradle.book.stage.v1': journal,
        'oi-cradle.recovery.latest': RECOVERY_KEY,
        RECOVERY_KEY: record,
        UNPLACED_KEY: '{"text":"carried","at":1}',
        DRAFT_KEY: '{"content":"hello","base_revision":"r1","saved_content":"s"}',
        # Outside the register: counted and left behind, never migrated.
        'oi-cradle.techne.m0-entry.v1': '{}',
        'oi-cradle.credential.api-key': 'fixture-credential-never-migrated',
        'oi-cradle.receipt.last': '{}',
        'oi-cradle.file-caret:some/file': '3',
    }


def store_path(home, app_id, origin):
    return Path(home) / 'Library/WebKit' / app_id / 'WebsiteData/Default' / origin / origin / 'LocalStorage/localstorage.sqlite3'


def digests_under(root):
    out = {}
    for path in sorted(Path(root).rglob('*')):
        if path.is_file():
            out[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


class ContinuityMigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='continuity-test-')
        self.root = Path(self.tmp.name)
        self.home = self.root / 'home'
        self.archive = self.root / 'archive'
        make_store(store_path(self.home, module.EVERYDAY_ID, 'AAA'), everyday_items())

    def tearDown(self):
        self.tmp.cleanup()

    def export(self, **kwargs):
        kwargs.setdefault('lines', [])
        return module.export_bundle(self.archive, self.home, **kwargs)

    def admit(self, bundle, **kwargs):
        kwargs.setdefault('lines', [])
        return module.admit_bundle(bundle, self.home, **kwargs)

    def exported_bundle(self):
        plan = self.export()
        self.assertEqual(plan['status'], 'exported')
        return Path(plan['bundle'])

    # Source pinning -------------------------------------------------------------

    def test_key_map_matches_source(self):
        store = (REPO / 'desktop/cradle/src/workspace/store.ts').read_text()
        self.assertIn('const KEY = "oi-cradle.workspaces.v1"', store)
        self.assertIn('"oi-cradle.layout.v1"', store)
        self.assertIn('journalKey: candidate ? `${key}.stage` : "oi-cradle.book.stage.v1"', store)
        self.assertIn('pointer: candidate ? `${key}.recovery.latest` : "oi-cradle.recovery.latest"', store)
        self.assertIn('prefix: candidate ? `${key}.recovery.` : "oi-cradle.recovery."', store)
        self.assertIn('draftPrefix: candidate ? `${key}.unplaced-draft:` : "oi-cradle.unplaced-draft.v1:"', store)
        ws = (REPO / 'packages/live-shell/ui/src/continuity/workspace.tsx').read_text()
        self.assertIn("CANDIDATE_WORKSPACE_KEY = 'oi.live-shell.candidate.workspace.v2'", ws)
        self.assertIn("CANDIDATE_LEGACY_LAYOUT_KEY = 'oi.live-shell.candidate.layout.v1'", ws)
        self.assertIn('STAGE_KEY = "oi-cradle.book.stage.v1"', (REPO / 'desktop/cradle/src/workspace/checkpoints.ts').read_text())
        recovery = (REPO / 'desktop/cradle/src/workspace/recovery.ts').read_text()
        self.assertIn('const POINTER="oi-cradle.recovery.latest"', recovery)
        self.assertIn('const PREFIX="oi-cradle.recovery."', recovery)
        self.assertIn("'oi-cradle.draft.v1:'", (REPO / 'desktop/cradle/src/workspace/drafts.ts').read_text())
        self.assertEqual(module.CAND_JOURNAL, 'oi.live-shell.candidate.workspace.v2.stage')
        self.assertEqual(module.CAND_UNPLACED_PREFIX, 'oi.live-shell.candidate.workspace.v2.unplaced-draft:')

    # Mapping --------------------------------------------------------------------

    def test_decode_handles_utf16le_bom_and_utf8(self):
        self.assertEqual(module.decode('{"a":1}'.encode('utf-16-le'), 'x')[1], '{"a":1}')
        self.assertEqual(module.decode(b'\xff\xfe{\x00}\x00', 'x')[1], '{}')
        self.assertEqual(module.decode('{"a":"é"}'.encode('utf-8'), 'x')[2], 'utf-8')
        with self.assertRaises(ValueError):
            module.decode(b'\x00\xd8', 'x')  # unpaired surrogate: refuse, never guess

    def test_allowlist_excludes_everything_outside_the_register(self):
        for key in ['oi-cradle.credential.api-key', 'oi-cradle.receipt.last', 'oi-cradle.techne.m0-entry.v1',
                    'oi-cradle.file-caret:x', 'oi-cradle.', 'oi-cradle.draft.v1:']:
            self.assertEqual(module.classify(key), (None, None), key)
        self.assertEqual(module.classify(module.EV_BOOK), ('workspace-book', module.CAND_BOOK))
        self.assertEqual(module.classify(DRAFT_KEY), ('draft', DRAFT_KEY))

    def test_rewrites_touch_only_namespace_keys(self):
        raw = [(k, v) for k, v in everyday_items().items()]
        migrated, excluded = module.plan_records(raw)
        by_source = {row['source_key']: row for row in migrated}
        self.assertEqual(by_source[UNPLACED_KEY]['target_key'], module.CAND_UNPLACED_PREFIX + 'draft-1')
        self.assertEqual(by_source[DRAFT_KEY]['target_key'], DRAFT_KEY)
        self.assertEqual(by_source[DRAFT_KEY]['text'], '{"content":"hello","base_revision":"r1","saved_content":"s"}')
        self.assertEqual(by_source['oi-cradle.recovery.latest']['text'], module.CAND_RECOVERY_PREFIX + 'rec-1')
        record = json.loads(by_source[RECOVERY_KEY]['text'])
        self.assertEqual(record['key'], module.CAND_RECOVERY_PREFIX + 'rec-1')
        self.assertEqual((record['raw'], record['sourceKey'], record['seq']), ('{broken', 'oi-cradle.workspaces.v1', 1))
        journal = json.loads(by_source['oi-cradle.book.stage.v1']['text'])
        self.assertEqual(set(journal['slots']), {module.CAND_BOOK})
        self.assertEqual(by_source['oi-cradle.workspaces.v1']['text'], BOOK_TEXT)
        self.assertEqual(excluded, {'oi-cradle.credential.api-key': 1, 'oi-cradle.file-caret': 1,
                                    'oi-cradle.receipt.last': 1, 'oi-cradle.techne.m0-entry.v1': 1})

    # Export ---------------------------------------------------------------------

    def test_dry_run_lists_plan_and_writes_nothing(self):
        before = digests_under(self.home)
        plan = self.export(dry_run=True)
        self.assertEqual(plan['status'], 'planned')
        self.assertFalse(self.archive.exists())
        self.assertEqual(digests_under(self.home), before)
        self.assertIn({'class': 'workspace-book', 'source_key': 'oi-cradle.workspaces.v1',
                       'target_key': module.CAND_BOOK, 'rewrite': 'verbatim'}, [
            {k: row[k] for k in ('class', 'source_key', 'target_key', 'rewrite')} for row in plan['would_move']])

    def test_export_refused_while_everyday_app_runs(self):
        running = [f'{self.home}/Applications/O-I.app/Contents/MacOS/oi-cradle --flag']
        plan = self.export(dry_run=True, lines=running)
        self.assertEqual(plan['status'], 'planned-with-refusals')
        self.assertIn('everyday app is running', plan['refusals'][0])
        with self.assertRaisesRegex(ValueError, 'quit it before export'):
            self.export(lines=running)
        self.assertFalse(self.archive.exists())

    def test_shell_that_names_the_bundle_is_not_an_app_process(self):
        lines = [f'/bin/zsh -c cat {self.home}/Applications/O-I.app/Contents/MacOS/oi-cradle']
        self.assertEqual(module.running(lines, module.app_prefixes(self.home, module.EVERYDAY_BUNDLE), module.EVERYDAY_ID), [])

    def test_ambiguous_origins_need_an_explicit_label(self):
        make_store(store_path(self.home, module.EVERYDAY_ID, 'BBB'), everyday_items())
        with self.assertRaisesRegex(ValueError, 'choose one with --origin <label>'):
            self.export()
        plan = self.export(origin='Default/AAA')
        self.assertEqual(plan['origin'], 'Default/AAA')
        self.assertEqual(plan['status'], 'exported')

    def test_book_in_webkit_data_store_partition_is_discovered(self):
        partition = self.home / 'Library/WebKit' / module.EVERYDAY_ID / 'WebsiteDataStore/part-1/Origins/EEE/EEE/LocalStorage/localstorage.sqlite3'
        make_store(partition, everyday_items())
        with self.assertRaisesRegex(ValueError, 'WebsiteDataStore/part-1/EEE'):
            self.export()  # Default/AAA and the partition both hold a book: the owner chooses
        plan = self.export(origin='WebsiteDataStore/part-1/EEE')
        self.assertEqual(plan['status'], 'exported')
        self.assertEqual(module.verify_bundle(Path(plan['bundle']))[0]['source']['origin'], 'WebsiteDataStore/part-1/EEE')

    def test_refusal_names_most_recent_store_as_a_suggestion_only(self):
        other = store_path(self.home, module.EVERYDAY_ID, 'BBB')
        make_store(other, everyday_items())
        os.utime(other, (0, 0))  # BBB is the older store
        with self.assertRaisesRegex(ValueError, 'most recently modified: Default/AAA'):
            self.export()

    def test_export_seals_bundle_and_never_writes_source(self):
        source_root = self.home / 'Library/WebKit' / module.EVERYDAY_ID
        before = digests_under(source_root)
        plan = self.export()
        self.assertEqual(digests_under(source_root), before)
        bundle = Path(plan['bundle'])
        meta, rows, digest = module.verify_bundle(bundle)
        self.assertEqual(digest, plan['bundle_digest_sha256'])
        self.assertEqual(bundle.name, f'everyday-continuity-{digest[:16]}')
        self.assertEqual(meta['counts']['migrated'], len(rows))
        self.assertEqual(meta['counts']['by_class']['draft'], 1)
        self.assertEqual(meta['counts']['excluded'], 4)
        self.assertEqual(oct((bundle / 'records.json').stat().st_mode & 0o777), '0o600')
        self.assertEqual(meta['source']['origin'], 'Default/AAA')
        self.assertNotIn('fixture-credential-never-migrated', (bundle / 'records.json').read_text())
        self.assertNotIn('fixture-credential-never-migrated', (bundle / 'BUNDLE.json').read_text())

    def test_export_rerun_reports_already_exported(self):
        first = self.export()
        second = self.export()
        self.assertEqual(second['status'], 'already exported')
        self.assertEqual(second['bundle_digest_sha256'], first['bundle_digest_sha256'])
        self.assertEqual(len(list(self.archive.iterdir())), 1)

    def test_export_refuses_home_without_workspace_book(self):
        empty = self.root / 'empty'
        make_store(store_path(empty, module.EVERYDAY_ID, 'CCC'), {'oi-cradle.layout.v1': '{}'})
        with self.assertRaisesRegex(ValueError, 'hold a workspace book'):
            module.export_bundle(self.archive, empty, lines=[])
        self.assertFalse(self.archive.exists())

    def test_export_refuses_archive_inside_everyday_store(self):
        with self.assertRaisesRegex(ValueError, 'outside the everyday WebKit store'):
            module.export_bundle(self.home / 'Library/WebKit/org.epilogos.oi.cradle/archive', self.home, lines=[])

    def test_publish_failure_leaves_no_partial_bundle(self):
        with mock.patch.object(module.os, 'replace', side_effect=OSError('injected publish failure')):
            with self.assertRaisesRegex(OSError, 'injected'):
                self.export()
        self.assertEqual([p.name for p in self.archive.iterdir()], [])

    def test_unreadable_book_exports_verbatim_and_admit_refuses(self):
        store_path(self.home, module.EVERYDAY_ID, 'AAA').unlink()
        make_store(store_path(self.home, module.EVERYDAY_ID, 'AAA'), everyday_items(book='{"version":2,"workspaces":['))
        bundle = self.exported_bundle()
        with self.assertRaisesRegex(ValueError, 'not valid JSON'):
            self.admit(bundle)

    # Admit ----------------------------------------------------------------------

    def test_admit_dry_run_writes_nothing(self):
        bundle = self.exported_bundle()
        continuity = self.home / module.CANDIDATE_DATA_ROOT / module.DEFAULT_BACKING / 'continuity'
        plan = self.admit(bundle, dry_run=True)
        self.assertEqual(plan['status'], 'planned')
        self.assertFalse(continuity.exists())
        self.assertEqual(len(plan['would_apply']), 7)

    def test_admit_refused_while_candidate_runs(self):
        bundle = self.exported_bundle()
        lines = [f'{self.home}/Applications/O-I Shell Candidate.app/Contents/MacOS/oi-cradle']
        plan = self.admit(bundle, dry_run=True, lines=lines)
        self.assertIn('candidate app is running', plan['refusals'][0])
        with self.assertRaisesRegex(ValueError, 'quit it before admission'):
            self.admit(bundle, lines=lines)

    def test_live_candidate_is_not_probed(self):
        bundle = self.exported_bundle()
        lines = [f'{self.home}/Applications/O-I Shell Candidate.app/Contents/MacOS/oi-cradle']
        with mock.patch.object(module, 'candidate_store_keys', side_effect=AssertionError('probed while live')):
            plan = self.admit(bundle, dry_run=True, lines=lines)
        self.assertIn('candidate app is running', plan['refusals'][0])

    def test_admit_publishes_adoption_then_reports_already_admitted(self):
        bundle = self.exported_bundle()
        plan = self.admit(bundle)
        self.assertEqual(plan['status'], 'admitted')
        self.assertEqual(plan['apply_policy'], 'apply-when-candidate-namespace-empty')
        admission = Path(plan['admission'])
        adoption = json.loads((admission / 'adoption.json').read_bytes())
        self.assertEqual(len(adoption['records']), 7)
        targets = {row['target_key'] for row in adoption['records']}
        self.assertIn(module.CAND_BOOK, targets)
        self.assertIn(DRAFT_KEY, targets)
        self.assertNotIn('oi-cradle.workspaces.v1', targets)
        record = json.loads((admission / 'ADMISSION.json').read_bytes())
        self.assertEqual(record['adoption_sha256'], hashlib.sha256((admission / 'adoption.json').read_bytes()).hexdigest())
        again = self.admit(bundle)
        self.assertEqual(again['status'], 'already admitted')
        self.assertEqual(again['bundle_digest_sha256'], plan['bundle_digest_sha256'])
        self.assertEqual(len(list((self.home / module.CANDIDATE_DATA_ROOT / module.DEFAULT_BACKING / 'continuity').iterdir())), 1)

    def test_candidate_namespace_with_data_refused_unless_owner_replaces(self):
        make_store(store_path(self.home, module.CANDIDATE_ID, 'DDD'), {module.CAND_BOOK: BOOK_TEXT})
        bundle = self.exported_bundle()
        with self.assertRaisesRegex(ValueError, 'already holds'):
            self.admit(bundle)
        plan = self.admit(bundle, owner_replace=True)
        self.assertEqual(plan['status'], 'admitted')
        self.assertEqual(plan['apply_policy'], 'apply-after-preserving-candidate-namespace')
        self.assertIn(module.CAND_BOOK, plan['candidate_keys_present'])

    def test_tampered_records_refused(self):
        bundle = self.exported_bundle()
        records = bundle / 'records.json'
        records.write_bytes(records.read_bytes().replace(b'hello', b'HELLO'))
        with self.assertRaisesRegex(ValueError, 'recorded bundle digest'):
            self.admit(bundle)

    def test_recomputed_mapping_edit_refused_by_key_check(self):
        bundle = self.exported_bundle()
        payload = json.loads((bundle / 'records.json').read_bytes())
        for row in payload['records']:
            if row['class'] == 'draft':
                row['target_key'] = 'oi-cradle.draft.v1:elsewhere'
        new_bytes = module.canonical(payload)
        digest = hashlib.sha256(new_bytes).hexdigest()
        meta = json.loads((bundle / 'BUNDLE.json').read_bytes())
        meta['bundle_digest_sha256'] = digest
        forged = bundle.parent / f'everyday-continuity-{digest[:16]}'
        forged.mkdir()
        (forged / 'records.json').write_bytes(new_bytes)
        (forged / 'BUNDLE.json').write_text(json.dumps(meta))
        with self.assertRaisesRegex(ValueError, 'Key mapping differs'):
            self.admit(forged)

    def test_admit_publish_failure_leaves_no_partial_admission(self):
        bundle = self.exported_bundle()
        with mock.patch.object(module.os, 'replace', side_effect=OSError('injected publish failure')):
            with self.assertRaisesRegex(OSError, 'injected'):
                self.admit(bundle)
        continuity = self.home / module.CANDIDATE_DATA_ROOT / module.DEFAULT_BACKING / 'continuity'
        self.assertEqual([p.name for p in continuity.iterdir()], [])

    # Command surface ------------------------------------------------------------

    def test_cli_dry_run_and_refusal_exit_codes(self):
        out = io.StringIO()
        with mock.patch.object(module, 'process_lines', return_value=[]), contextlib.redirect_stdout(out):
            code = module.main(['--home', str(self.home), 'export', '--archive', str(self.archive), '--dry-run'])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out.getvalue())['status'], 'planned')
        self.assertFalse(self.archive.exists())
        with mock.patch.object(module, 'process_lines', return_value=[]), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as refused:
                module.main(['--home', str(self.home), 'admit', '--bundle', str(self.root / 'missing')])
        self.assertEqual(refused.exception.code, 2)


if __name__ == '__main__':
    unittest.main()
