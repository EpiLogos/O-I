#!/usr/bin/env python3
"""Owner-admitted everyday continuity migration (LEGACY-CRADLE-RETIREMENT §3 gate 3, §4).

Two owner-run operations. Nothing runs on its own, and nothing here writes
WebKit storage:

  export  Reads the everyday app's WebKit localStorage origin store through a
          private copy, while the everyday app is not running, and publishes a
          sealed bundle (records, digests, counts) into an archive directory the
          owner names. The source store is digested before and after the read and
          is never written.
  admit   Verifies a bundle against its own digests and key mapping, checks the
          candidate namespace for existing data, and publishes an adoption record
          into the candidate's own data home. The candidate applies that record
          inside its own process on first run. That is the only place its WebKit
          storage may be written; a closed sqlite file is not written from outside.

--dry-run on either operation lists what would move and writes nothing. Re-running
either against unchanged inputs reports "already exported" or "already admitted"
with the bundle digest. Only register keys are read (an allowlist). Credentials
and receipts are never in WebKit storage and are never migrated.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


recorder = load('continuity_recorder', HERE / 'record-cli-build.py')
require = recorder.require
canonical = recorder.canonical

BUNDLE_SCHEMA = 'oi.everyday-continuity-bundle/v1'
RECORDS_SCHEMA = 'oi.everyday-continuity-records/v1'
ADOPTION_SCHEMA = 'oi.everyday-continuity-adoption/v1'
ADMISSION_SCHEMA = 'oi.everyday-continuity-admission/v1'

EVERYDAY_ID = 'org.epilogos.oi.cradle'
CANDIDATE_ID = 'org.epilogos.oi.live-shell'
EVERYDAY_BUNDLE = 'O-I.app'
CANDIDATE_BUNDLE = 'O-I Shell Candidate.app'
CANDIDATE_DATA_ROOT = Path('Library/Application Support/OI-Shell-Candidate')
DEFAULT_BACKING = '0-1-2'
CANDIDATE_NAMESPACE_PREFIX = 'oi.live-shell.candidate.'

# Everyday namespace: workspaceStorageNamespace() default branch in
# desktop/cradle/src/workspace/store.ts, and checkpoints.ts STAGE_KEY,
# recovery.ts POINTER/PREFIX. Pinned by test_key_map_matches_source.
EV_BOOK = 'oi-cradle.workspaces.v1'
EV_LAYOUT = 'oi-cradle.layout.v1'
EV_JOURNAL = 'oi-cradle.book.stage.v1'
EV_RECOVERY_POINTER = 'oi-cradle.recovery.latest'
EV_RECOVERY_PREFIX = 'oi-cradle.recovery.'
EV_UNPLACED_PREFIX = 'oi-cradle.unplaced-draft.v1:'
# Drafts are one module (desktop/cradle/src/workspace/drafts.ts) shared by both
# apps, so the same key is correct in both origins: kept verbatim.
DRAFT_PREFIX = 'oi-cradle.draft.v1:'

# Candidate namespace: CANDIDATE_WORKSPACE_KEY and CANDIDATE_LEGACY_LAYOUT_KEY in
# packages/live-shell/ui/src/continuity/workspace.tsx, with the derived journal,
# recovery and unplaced-draft keys from workspaceStorageNamespace(). Pinned by test.
CAND_BOOK = 'oi.live-shell.candidate.workspace.v2'
CAND_LAYOUT = 'oi.live-shell.candidate.layout.v1'
CAND_JOURNAL = CAND_BOOK + '.stage'
CAND_RECOVERY_POINTER = CAND_BOOK + '.recovery.latest'
CAND_RECOVERY_PREFIX = CAND_BOOK + '.recovery.'
CAND_UNPLACED_PREFIX = CAND_BOOK + '.unplaced-draft:'


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def family(key):
    return key.split(':', 1)[0]


def classify(key):
    """Register mapping: (class, candidate key) for a migrated everyday key, else (None, None)."""
    if key == EV_BOOK:
        return 'workspace-book', CAND_BOOK
    if key == EV_LAYOUT:
        return 'legacy-layout', CAND_LAYOUT
    if key == EV_JOURNAL:
        return 'checkpoint-journal', CAND_JOURNAL
    if key == EV_RECOVERY_POINTER:
        return 'recovery-pointer', CAND_RECOVERY_POINTER
    if key.startswith(EV_RECOVERY_PREFIX) and len(key) > len(EV_RECOVERY_PREFIX):
        return 'recovery-record', CAND_RECOVERY_PREFIX + key[len(EV_RECOVERY_PREFIX):]
    if key.startswith(EV_UNPLACED_PREFIX) and len(key) > len(EV_UNPLACED_PREFIX):
        return 'unplaced-draft', CAND_UNPLACED_PREFIX + key[len(EV_UNPLACED_PREFIX):]
    if key.startswith(DRAFT_PREFIX) and len(key) > len(DRAFT_PREFIX):
        return 'draft', key
    return None, None


def decode(value, cls):
    """WebKit ItemTable values: UTF-16LE blobs (observed header 7B 00 22 00 for '{"').
    A UTF-8 JSON text never contains a raw NUL, so a NUL byte selects UTF-16."""
    if isinstance(value, str):
        return value.encode('utf-8'), value, 'sqlite-text'
    try:
        if value.startswith(b'\xff\xfe') or value.startswith(b'\xfe\xff'):
            return value, value.decode('utf-16'), 'utf-16-bom'
        if b'\x00' in value:
            return value, value.decode('utf-16-le'), 'utf-16le'
        return value, value.decode('utf-8'), 'utf-8'
    except UnicodeDecodeError as error:
        raise ValueError(f'Undecodable everyday value under a migrated key ({cls}): {error.reason}') from None


def is_json(text):
    try:
        json.loads(text)
        return True
    except ValueError:
        return False


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def rewrite(cls, key, target, text):
    """Carry one value across. Only keys that name the everyday namespace change; the rest is verbatim."""
    if cls == 'checkpoint-journal':
        try:
            journal = json.loads(text)
        except ValueError:
            return text, 'verbatim: unparseable journal'
        if not (isinstance(journal, dict) and isinstance(journal.get('slots'), dict)):
            return text, 'verbatim: journal without slots'
        slots = journal['slots']
        kept = {CAND_BOOK: slots[EV_BOOK]} if EV_BOOK in slots else {}
        dropped = [k for k in slots if k != EV_BOOK]
        note = 'slots rekeyed to the candidate book key'
        if dropped:
            note += f'; {len(dropped)} slot(s) for other keys left behind'
        return dumps({'version': journal.get('version', 1), 'slots': kept}), note
    if cls == 'recovery-pointer':
        if text.startswith(EV_RECOVERY_PREFIX):
            return CAND_RECOVERY_PREFIX + text[len(EV_RECOVERY_PREFIX):], 'pointer rekeyed'
        return text, 'verbatim: pointer names no everyday record'
    if cls == 'recovery-record':
        try:
            record = json.loads(text)
        except ValueError:
            return text, 'verbatim: unparseable recovery record'
        if isinstance(record, dict) and record.get('key') == key:
            record['key'] = target
            return dumps(record), 'record key rekeyed; raw, sourceKey, reason and seq kept'
        return text, 'verbatim: record does not name its own key'
    return text, 'verbatim'


def plan_records(rows):
    migrated, excluded = [], Counter()
    for key, value in sorted(rows, key=lambda row: row[0]):
        cls, target = classify(key)
        if cls is None:
            excluded[family(key)] += 1
            continue
        raw, text, encoding = decode(value, cls)
        out, note = rewrite(cls, key, target, text)
        migrated.append({
            'class': cls, 'source_key': key, 'target_key': target, 'encoding': encoding,
            'source_value_bytes': len(raw), 'source_value_sha256': sha256_bytes(raw),
            'json_valid': is_json(out), 'rewrite': note,
            'text': out, 'text_sha256': sha256_bytes(out.encode('utf-8')),
        })
    return migrated, dict(sorted(excluded.items()))


def app_webkit_root(home, app_id):
    return Path(home) / 'Library/WebKit' / app_id


def find_stores(app_root):
    """Every origin store one app keeps, labelled by where it sits. Both layouts were observed in the
    everyday app's WebKit data: WebsiteData/Default/<o>/<o>/LocalStorage/ and
    WebsiteDataStore/<partition>/Origins/<o>/<o>/LocalStorage/. A label is the path-qualified name
    (Default/<o> or WebsiteDataStore/<partition>/<o>) that --origin selects."""
    stores = []
    for pattern, label_of in (
        ('WebsiteData/Default/*/*/LocalStorage/localstorage.sqlite3',
         lambda db: f'Default/{db.parents[2].name}'),
        ('WebsiteDataStore/*/Origins/*/*/LocalStorage/localstorage.sqlite3',
         lambda db: f'WebsiteDataStore/{db.parents[4].name}/{db.parents[2].name}'),
    ):
        for db in sorted(Path(app_root).glob(pattern)):
            if db.parents[1].name == db.parents[2].name:
                stores.append((label_of(db), db))
    return sorted(stores)


def read_store(label, db, scratch):
    """Read one origin store through a private copy. The source bytes are digested before and
    after the copy; a change during the read refuses rather than mixing states."""
    wal = db.with_name(db.name + '-wal')
    files = [db] + ([wal] if wal.exists() else [])
    before = {f.name: recorder.sha(f) for f in files}
    target = Path(scratch) / label.replace('/', '__')
    target.mkdir(mode=0o700, parents=True)
    for f in files:
        shutil.copyfile(f, target / f.name)
    after = {f.name: recorder.sha(f) for f in files}
    require(before == after, f'The store changed while it was read: {label}')
    conn = sqlite3.connect(str(target / db.name))
    try:
        rows = conn.execute('SELECT key, value FROM ItemTable').fetchall()
    finally:
        conn.close()
    modified = datetime.fromtimestamp(db.stat().st_mtime, timezone.utc).isoformat()
    return {'origin': label, 'db': db, 'rows': rows, 'digests': before, 'modified': modified}


def process_lines():
    result = subprocess.run(['ps', '-axww', '-o', 'args='], capture_output=True, text=True, check=True)
    return result.stdout.splitlines()


def app_prefixes(home, bundle):
    return [f'{base}/{bundle}/Contents/MacOS/' for base in (str(Path(home) / 'Applications'), '/Applications')]


def running(lines, prefixes, app_id):
    """Processes whose executable path sits under an installed bundle, or whose WebKit helper
    serves this app's data. Matched by path prefix, so a shell that merely names the path is not
    an app process."""
    hits = []
    for line in lines:
        text = line.strip()
        argv0 = text.split(' ', 1)[0]
        if any(text.startswith(prefix) for prefix in prefixes) or ('com.apple.WebKit' in argv0 and f'Library/WebKit/{app_id}/' in text):
            hits.append(text[:160])
    return hits


def publish_directory(parent, name, files):
    """Port of build-source-archive.py's publish: claim the destination exclusively, stage and
    fsync every file aside, verify the staged bytes, then rename into place. A failure removes
    the claim and the stage; nothing partial is ever visible under the final name."""
    parent = Path(parent)
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(not parent.is_symlink(), 'Publication parent is a symlink')
    final = parent / name
    require(not final.is_symlink(), 'Refusing a symlinked publication destination')
    final.mkdir(mode=0o700)
    try:
        with tempfile.TemporaryDirectory(prefix='.continuity-', dir=parent) as temporary:
            stage = Path(temporary) / 'published'
            stage.mkdir(mode=0o700)
            for file_name, content in files.items():
                path = stage / file_name
                with path.open('xb') as stream:
                    stream.write(content)
                    stream.flush()
                    os.fsync(stream.fileno())
                path.chmod(0o600)
            for file_name, content in files.items():
                require((stage / file_name).read_bytes() == content, f'Staged bytes differ: {file_name}')
            descriptor = os.open(stage, os.O_RDONLY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            os.replace(stage, final)
        descriptor = os.open(parent, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    except BaseException:
        if final.is_dir() and not any(final.iterdir()):
            final.rmdir()
        raise
    return final


def verify_bundle(bundle):
    bundle = Path(bundle).absolute()
    require(bundle.is_dir() and not bundle.is_symlink(), f'Bundle must be an ordinary directory: {bundle}')
    meta = json.loads((bundle / 'BUNDLE.json').read_bytes())
    records_raw = (bundle / 'records.json').read_bytes()
    digest = sha256_bytes(records_raw)
    require(meta.get('schema') == BUNDLE_SCHEMA, 'Unrecognised bundle schema')
    require(meta.get('bundle_digest_sha256') == digest, 'records.json differs from the recorded bundle digest')
    require(bundle.name == f'everyday-continuity-{digest[:16]}', 'Bundle directory name differs from its digest')
    records = json.loads(records_raw)
    require(records.get('schema') == RECORDS_SCHEMA, 'Unrecognised records schema')
    rows = records['records']
    for row in rows:
        cls, target = classify(row['source_key'])
        require(cls == row['class'] and target == row['target_key'], f'Key mapping differs for a {row["class"]} record')
        require(sha256_bytes(row['text'].encode('utf-8')) == row['text_sha256'], f'Record text digest differs ({row["class"]})')
    require(meta['counts']['migrated'] == len(rows), 'Migrated record count differs from BUNDLE.json')
    return meta, rows, digest


def export_bundle(archive, home, origin=None, lines=None, dry_run=False):
    archive = Path(archive).absolute()
    lines = process_lines() if lines is None else lines
    everyday_root = app_webkit_root(home, EVERYDAY_ID)
    require(not archive.is_relative_to(everyday_root), 'The archive must lie outside the everyday WebKit store')
    refusals = []
    live = running(lines, app_prefixes(home, EVERYDAY_BUNDLE), EVERYDAY_ID)
    if live:
        # Refused before any store is read: a running app's store is not a stable source.
        refusals.append(f'the everyday app is running ({live[0]}); quit it before export')
        plan = {'operation': 'export', 'dry_run': dry_run, 'origin': None, 'refusals': refusals,
                'would_move': [], 'by_class': {}, 'excluded_families': {}, 'status': 'planned-with-refusals'}
        if dry_run:
            return plan
        raise ValueError('; '.join(refusals))
    with tempfile.TemporaryDirectory(prefix='continuity-export-') as scratch:
        reads = []
        for label, db in find_stores(everyday_root):
            read = read_store(label, db, scratch)
            if any(key == EV_BOOK for key, _ in read['rows']):
                reads.append(read)
        if origin is None:
            if len(reads) != 1:
                listing = '; '.join(f'{r["origin"]} (modified {r["modified"]})' for r in reads) or 'none'
                newest = max(reads, key=lambda r: r['modified'])['origin'] if reads else None
                hint = f'; most recently modified: {newest} (a suggestion; the owner chooses)' if newest else ''
                refusals.append(f'{len(reads)} everyday origin store(s) hold a workspace book ({listing}){hint}; '
                                'choose one with --origin <label>')
            chosen = reads[0] if len(reads) == 1 else None
        else:
            matched = [r for r in reads if r['origin'] == origin]
            if not matched:
                refusals.append(f'origin {origin} does not hold the everyday workspace book')
            chosen = matched[0] if matched else None
        plan = {'operation': 'export', 'dry_run': dry_run, 'origin': chosen['origin'] if chosen else None,
                'refusals': refusals, 'would_move': [], 'by_class': {}, 'excluded_families': {}}
        if chosen is None or refusals:
            if dry_run:
                plan['status'] = 'planned-with-refusals'
                return plan
            raise ValueError('; '.join(refusals) or 'no everyday workspace book found')
        migrated, excluded = plan_records(chosen['rows'])
        require(any(row['class'] == 'workspace-book' for row in migrated), 'No everyday workspace book in the store')
        records_bytes = canonical({'schema': RECORDS_SCHEMA, 'records': migrated})
        digest = sha256_bytes(records_bytes)
        name = f'everyday-continuity-{digest[:16]}'
        meta = {'schema': BUNDLE_SCHEMA, 'bundle_digest_sha256': digest, 'bundle_name': name,
                'records_file': 'records.json', 'records_bytes': len(records_bytes),
                'source': {'app_id': EVERYDAY_ID, 'origin': chosen['origin'], 'store_files': sorted(chosen['digests']),
                           'store_sha256_before': chosen['digests'], 'store_modified': chosen['modified'],
                           'read_method': 'private copy of the origin store; source digested before and after the copy'},
                'counts': {'migrated': len(migrated), 'by_class': dict(Counter(row['class'] for row in migrated)),
                           'excluded': sum(excluded.values())},
                'excluded_families': excluded,
                'standing': 'Source-read export while the everyday app was not running. Decoded text and digests are recorded; '
                            'candidate runtime acceptance is separate and not implied.'}
        plan.update({'bundle': str(archive / name), 'bundle_digest_sha256': digest,
                     'by_class': meta['counts']['by_class'], 'excluded_families': excluded,
                     'would_move': [{'class': row['class'], 'source_key': row['source_key'], 'target_key': row['target_key'],
                                     'rewrite': row['rewrite']} for row in migrated]})
        final = archive / name
        if final.exists() or final.is_symlink():
            _, _, existing = verify_bundle(final)
            require(existing == digest, 'An existing bundle at this digest path does not match its content')
            plan['status'] = 'planned: already exported' if dry_run else 'already exported'
            return plan
        if dry_run:
            plan['status'] = 'planned'
            return plan
        archive.mkdir(mode=0o700, parents=True, exist_ok=True)
        meta_bytes = (json.dumps(meta, indent=2, sort_keys=True, ensure_ascii=False) + '\n').encode()
        publish_directory(archive, name, {'BUNDLE.json': meta_bytes, 'records.json': records_bytes})
        verify_bundle(final)
        # The store's files (database and WAL) must still match the bytes the copy was taken from.
        require(all(recorder.sha(chosen['db'].with_name(file_name)) == digest_value
                    for file_name, digest_value in chosen['digests'].items()),
                'The everyday store changed during export; discard the published bundle and export again')
        plan['status'] = 'exported'
        return plan


def candidate_store_keys(home, scratch):
    keys = set()
    for label, db in find_stores(app_webkit_root(home, CANDIDATE_ID)):
        keys.update(key for key, _ in read_store(label, db, scratch)['rows'])
    return keys


def verify_admission(final, digest):
    admission = json.loads((final / 'ADMISSION.json').read_bytes())
    adoption = (final / 'adoption.json').read_bytes()
    require(admission.get('schema') == ADMISSION_SCHEMA, 'Unrecognised admission schema')
    require(admission.get('bundle_digest_sha256') == digest and admission.get('adoption_sha256') == sha256_bytes(adoption),
            'The existing admission differs from this bundle; refusing rather than overwriting it')
    return admission


def admit_bundle(bundle, home, backing=DEFAULT_BACKING, owner_replace=False, lines=None, dry_run=False):
    lines = process_lines() if lines is None else lines
    meta, rows, digest = verify_bundle(bundle)
    continuity = Path(home) / CANDIDATE_DATA_ROOT / backing / 'continuity'
    final = continuity / f'admission-{digest[:16]}'
    plan = {'operation': 'admit', 'dry_run': dry_run, 'bundle_digest_sha256': digest, 'backing': backing,
            'admission': str(final), 'by_class': meta['counts']['by_class'], 'refusals': [],
            'would_apply': [{'class': row['class'], 'target_key': row['target_key']} for row in rows]}
    if final.exists() or final.is_symlink():
        verify_admission(final, digest)
        plan['status'] = 'planned: already admitted' if dry_run else 'already admitted'
        return plan
    refusals = plan['refusals']
    candidate_live = running(lines, app_prefixes(home, CANDIDATE_BUNDLE), CANDIDATE_ID)
    if candidate_live:
        # Not probed while live: a running app's store is locked and its namespace is not a stable reading.
        refusals.append('the candidate app is running; quit it before admission')
    book = [row for row in rows if row['class'] == 'workspace-book']
    if not book:
        refusals.append('the bundle carries no workspace book')
    elif not book[0]['json_valid']:
        refusals.append('the bundle workspace book is not valid JSON; admission refuses an unreadable book')
    targets = {row['target_key'] for row in rows}
    present = []
    if not candidate_live:
        with tempfile.TemporaryDirectory(prefix='continuity-admit-') as scratch:
            existing = candidate_store_keys(home, scratch)
        present = sorted(k for k in existing if k.startswith(CANDIDATE_NAMESPACE_PREFIX) or k in targets)
    plan['candidate_keys_present'] = present
    if present and not owner_replace:
        refusals.append(f'the candidate namespace already holds {len(present)} key(s) (first: {present[0]}); '
                        'pass --owner-replace to adopt over it, with the candidate preserving them first')
    policy = 'apply-after-preserving-candidate-namespace' if present else 'apply-when-candidate-namespace-empty'
    plan['apply_policy'] = policy
    plan['owner_replace'] = owner_replace
    if refusals and not dry_run:
        raise ValueError('; '.join(refusals))
    if refusals:
        plan['status'] = 'planned-with-refusals'
        return plan
    if dry_run:
        plan['status'] = 'planned'
        return plan
    adoption = {'schema': ADOPTION_SCHEMA, 'bundle_digest_sha256': digest, 'apply_policy': policy,
                'records': sorted(({'class': row['class'], 'target_key': row['target_key'], 'text': row['text'],
                                    'text_sha256': row['text_sha256']} for row in rows), key=lambda r: r['target_key'])}
    adoption_bytes = canonical(adoption)
    admission = {'schema': ADMISSION_SCHEMA, 'bundle_digest_sha256': digest, 'adoption_sha256': sha256_bytes(adoption_bytes),
                 'candidate_app_id': CANDIDATE_ID, 'backing': backing, 'apply_policy': policy, 'owner_replace': owner_replace,
                 'candidate_keys_present': present, 'by_class': meta['counts']['by_class'], 'records': len(rows),
                 'standing': 'Admitted adoption record. The candidate applies it inside its own process on first run; '
                             'this command did not write WebKit storage and implies no candidate runtime acceptance.'}
    admission_bytes = (json.dumps(admission, indent=2, sort_keys=True, ensure_ascii=False) + '\n').encode()
    publish_directory(continuity, final.name, {'adoption.json': adoption_bytes, 'ADMISSION.json': admission_bytes})
    verify_admission(final, digest)
    plan['status'] = 'admitted'
    return plan


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--home', type=Path, default=Path.home(),
                        help='Owner home. Default is the native user home; tests pass a fixture home.')
    sub = parser.add_subparsers(dest='operation', required=True)
    export = sub.add_parser('export', help='Read the everyday store and publish a sealed bundle')
    export.add_argument('--archive', required=True, type=Path, help='Owner archive directory for the bundle')
    export.add_argument('--origin', help='Store label (Default/<origin> or WebsiteDataStore/<partition>/<origin>), required when several hold a book')
    export.add_argument('--dry-run', action='store_true', help='List what would move; write nothing')
    admit = sub.add_parser('admit', help='Admit a verified bundle into the candidate data home')
    admit.add_argument('--bundle', required=True, type=Path)
    admit.add_argument('--backing', default=DEFAULT_BACKING, help='Candidate backing id (default 0-1-2)')
    admit.add_argument('--owner-replace', action='store_true',
                       help='Adopt even though the candidate namespace holds data; the candidate preserves it first')
    admit.add_argument('--dry-run', action='store_true', help='List what would move; write nothing')
    args = parser.parse_args(argv)
    try:
        if args.operation == 'export':
            result = export_bundle(args.archive, args.home, origin=args.origin, dry_run=args.dry_run)
        else:
            result = admit_bundle(args.bundle, args.home, backing=args.backing, owner_replace=args.owner_replace,
                                  dry_run=args.dry_run)
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error, subprocess.CalledProcessError) as error:
        parser.exit(2, f'Continuity migration refused: {error}\n')
    print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False, default=str))
    return 0


if __name__ == '__main__':
    sys.exit(main())
