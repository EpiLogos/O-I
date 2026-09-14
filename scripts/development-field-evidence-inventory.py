#!/usr/bin/env python3
"""Read-only GitHub run inventory. Collection success is not D/C acceptance."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
import zipfile

IDS = {'oi', 'central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic'}
RUN_KEYS = ('id', 'name', 'path', 'head_sha', 'head_branch', 'event', 'status', 'conclusion', 'run_attempt', 'created_at', 'updated_at', 'html_url')
JOB_KEYS = ('id', 'name', 'status', 'conclusion', 'run_attempt', 'started_at', 'completed_at', 'html_url')
ARTIFACT_KEYS = ('id', 'name', 'size_in_bytes', 'expired', 'digest', 'created_at', 'expires_at', 'workflow_run')
MAX_BYTES = 128 * 1024 * 1024

def now():
    return datetime.now(timezone.utc).isoformat()

def write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + '\n', encoding='utf-8')

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).scheme != 'https':
            raise ValueError('Refusing a non-HTTPS artifact redirect')
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and urllib.parse.urlparse(newurl).netloc != 'api.github.com':
            redirected.remove_header('Authorization')
        return redirected

def get(path: str, binary=False):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'oi-development-field-evidence'}
    if os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    req = urllib.request.Request('https://api.github.com/' + path, headers=headers)
    with urllib.request.build_opener(SafeRedirect()).open(req, timeout=45) as response:
        payload = response.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES:
        raise ValueError('Response exceeds bounded inventory input size')
    return payload if binary else json.loads(payload)

def paged(path: str, key: str):
    result, page = [], 1
    while True:
        separator = '&' if '?' in path else '?'
        batch = get(f'{path}{separator}per_page=100&page={page}')[key]
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1

def validate_cut(raw):
    cut = json.loads(raw)
    owners = cut.get('owners', [])
    if cut.get('schema') != 'oi.development-field-cut/v1' or len(owners) != 7 or {o['id'] for o in owners} != IDS:
        raise ValueError('Expected the seven distinct Development Field owners')
    for owner in owners:
        if not re.fullmatch(r'[0-9a-f]{40}', owner['revision']):
            raise ValueError('Every tested revision must be a full SHA')
        if not re.fullmatch(r'EpiLogos/[A-Za-z0-9_.-]+', owner['repository']):
            raise ValueError('Invalid repository identity')
    return cut

def enrich(record):
    base = f"repos/{record['repository']}/actions/runs/{record['id']}"
    try:
        jobs = paged(base + '/jobs?filter=all', 'jobs')
        record['jobs'] = [{**{k: job.get(k) for k in JOB_KEYS}, 'steps': job.get('steps', [])} for job in jobs]
        record['artifacts'] = [{k: item.get(k) for k in ARTIFACT_KEYS} for item in paged(base + '/artifacts', 'artifacts')]
    except Exception as error:
        record['observation_error'] = str(error)
    return record

def retain_receipts(record, out):
    """Keep native/probe evidence bytes and verify service-provided archive digests."""
    receipts = []
    for artifact in record.get('artifacts', []):
        name = artifact['name']
        if not name.startswith(('development-field-D-', 'development-field-probe-', 'development-field-conformance-')):
            continue
        if artifact.get('expired') or artifact['size_in_bytes'] > MAX_BYTES:
            receipts.append({'artifact': artifact, 'status': 'unavailable-or-over-limit'})
            continue
        entry = {'artifact': artifact, 'files': {}}
        try:
            payload = get(f"repos/{record['repository']}/actions/artifacts/{artifact['id']}/zip", binary=True)
            digest = 'sha256:' + hashlib.sha256(payload).hexdigest()
            if artifact.get('digest') != digest:
                raise ValueError('Artifact digest absent or differs from downloaded bytes')
            entry['verified_archive_digest'] = digest
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                for member in archive.infolist():
                    # Do not unpack archive paths or execute any downloaded content.
                    if member.is_dir() or member.file_size > 8 * 1024 * 1024 or not member.filename.endswith(('.json', '.log')):
                        continue
                    data = archive.read(member)
                    destination = out / 'receipts' / str(record['id']) / str(artifact['id']) / (hashlib.sha256(member.filename.encode()).hexdigest()[:16] + '-' + Path(member.filename).name)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(data)
                    entry['files'][member.filename] = {'path': str(destination.relative_to(out)), 'sha256': hashlib.sha256(data).hexdigest()}
            entry['status'] = 'retained-byte-verified-not-semantic-acceptance'
        except Exception as error:
            entry.update(status='observation-error', error=str(error))
        receipts.append(entry)
    return receipts

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cut', type=Path, default=Path(__file__).resolve().parents[1] / 'tests/development-field/cut.json')
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--harness-branch', default='ci/development-field-dc-cut')
    args = parser.parse_args()
    raw = args.cut.read_bytes()
    cut = validate_cut(raw)
    out = args.out.resolve()
    report = {'schema': 'oi.development-field-evidence-inventory/v1', 'observation_started_at': now(),
              'cut': cut, 'cut_sha256': hashlib.sha256(raw).hexdigest(), 'inventory_harness_revision': os.environ.get('GITHUB_SHA'),
              'inventory_run_id': os.environ.get('GITHUB_RUN_ID'), 'standing': 'read-only-observation-not-acceptance',
              'evidence_grades_claimed': [], 'owners': [], 'runs': [], 'errors': []}
    runs = {}
    try:
        for owner in cut['owners']:
            try:
                base = f"repos/{owner['repository']}"
                current = get(base + '/git/ref/heads/main')['object']['sha']
                report['owners'].append({**owner, 'main_at_observation': current, 'tested_cut_is_current_main': current == owner['revision'], 'observed_at': now()})
                for run in paged(base + '/actions/runs?' + urllib.parse.urlencode({'head_sha': owner['revision']}), 'workflow_runs'):
                    runs[(owner['repository'], run['id'])] = {**{k: run.get(k) for k in RUN_KEYS}, 'repository': owner['repository'], 'basis': 'exact-owner-cut'}
            except Exception as error:
                report['errors'].append({'owner': owner['id'], 'error': str(error)})
        query = urllib.parse.urlencode({'branch': args.harness_branch})
        for run in paged('repos/EpiLogos/O-I/actions/runs?' + query, 'workflow_runs'):
            runs[('EpiLogos/O-I', run['id'])] = {**{k: run.get(k) for k in RUN_KEYS}, 'repository': 'EpiLogos/O-I', 'basis': 'S7-harness-attempt-not-owner-main'}
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(enrich, record) for record in runs.values()]
            report['runs'] = sorted((f.result() for f in as_completed(futures)), key=lambda r: (r['repository'], r['id']))
        # Keep the newest native and joined evidence; older attempts remain in the inventory.
        native = [r for r in report['runs'] if r['path'].endswith('/development-field-native.yml') and r['conclusion'] == 'success']
        joined = [r for r in report['runs'] if r['path'].endswith('/development-field-conformance.yml') and any(a['name'].startswith(('development-field-probe-', 'development-field-conformance-')) for a in r.get('artifacts', []))]
        selected = sorted(native, key=lambda r: r['id'], reverse=True)[:1] + sorted(joined, key=lambda r: r['id'], reverse=True)[:2]
        report['retained_receipts'] = {str(r['id']): retain_receipts(r, out) for r in selected}
    except Exception as error:
        report['errors'].append({'error': str(error)})
    finally:
        report['observation_finished_at'] = now()
        receipt_errors = any(a['status'] != 'retained-byte-verified-not-semantic-acceptance' for batch in report.get('retained_receipts', {}).values() for a in batch)
        report['collection_status'] = 'complete' if not report['errors'] and not receipt_errors and all('observation_error' not in r for r in report['runs']) else 'partial'
        write(out / 'inventory.json', report)
        with (out / 'workflow-runs.csv').open('w', newline='') as handle:
            keys = ['repository', *RUN_KEYS, 'basis']
            writer = csv.DictWriter(handle, fieldnames=keys, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(report['runs'])
        print(json.dumps({'collection_status': report['collection_status'], 'runs_observed': len(report['runs']), 'errors': report['errors'], 'evidence_grades_claimed': []}))
    return int(report['collection_status'] != 'complete')

if __name__ == '__main__':
    sys.exit(main())
