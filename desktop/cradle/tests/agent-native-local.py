#!/usr/bin/env python3
"""Bounded local Agent creation and useful-work acceptance, using real owners.

Default preflight is read-only. Every mutation requires --execute AND a named
phase. Acceptance requires the separately reviewed exact source digest and the
existing native human-authority channel. No token/key, fake Agent, fixture
provider, policy grant, installation or automatic uncertain-turn retry exists.
Receipts are private (0600); do not publish them as a substitute for UI evidence.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from typing import Any

SCHEMA = 'oi.native-agent-local-acceptance/v1'
MUTATIONS = {'propose', 'accept', 'prepare', 'connect', 'live', 'resume'}

class Refused(RuntimeError):
    pass

def sha(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def exact_text(value: str, maximum: int, name: str) -> str:
    if not value or value != value.strip() or len(value.encode()) > maximum or '\x00' in value:
        raise Refused(f'{name} must be nonempty, bounded and already trimmed; its wording will not be rewritten.')
    return value

def decode(raw: str) -> Any:
    try:
        value = json.loads(raw)
    except (ValueError, TypeError) as error:
        raise Refused('Native reply unreadable; outcome is not assumed.') from error
    if isinstance(value, dict) and 'ok' in value:
        if value['ok'] is not True:
            error = value.get('error') or {}
            code = error.get('code', 'native_refusal') if isinstance(error, dict) else 'native_refusal'
            raise Refused(f'Native refusal ({code}); inspect private owner diagnostics. No retry was sent.')
        return value.get('data')
    return value

def validate_review(value: Any, scope: str, reference: str | None = None, accepted: bool = False) -> dict:
    if not isinstance(value, dict) or value.get('schema') != 'central.agent-profile-review/v1':
        raise Refused('No native Agent review.')
    profile = value.get('profile') or {}
    if value.get('scope_ref') != scope or value.get('execution_authority_granted') is not False:
        raise Refused('Native review scope or authority mismatch.')
    for name in ['ref', 'agent_ref', 'revision']:
        if not isinstance(profile.get(name), str) or not profile[name]:
            raise Refused('Native identity is incomplete.')
    if reference is not None and profile['ref'] != reference:
        raise Refused('Native review returned another profile.')
    if not isinstance(value.get('content_digest'), str) or not value['content_digest']:
        raise Refused('Native review lacks a content digest.')
    if accepted:
        receipt = value.get('acceptance') or {}
        expected = {'schema':'central.agent-profile-acceptance/v1', 'profile_ref':profile['ref'],
                    'agent_ref':profile['agent_ref'], 'profile_revision':profile['revision'],
                    'scope_ref':scope, 'content_digest':value['content_digest']}
        if value.get('accepted') is not True or any(receipt.get(k) != v for k,v in expected.items()) or not receipt.get('acceptance_ref'):
            raise Refused('Native acceptance is absent or differs from the exact source.')
    return value

def check_prior(value: Any, basis: dict) -> dict:
    if not isinstance(value, dict) or value.get('schema') != SCHEMA or value.get('basis') != basis:
        raise Refused('Prior receipt does not belong to this exact candidate and working scope.')
    return value

def checkpoint(path: Path, value: dict) -> None:
    """Atomic receipt replacement; only a path exclusively reserved by this run."""
    fd, temporary = tempfile.mkstemp(prefix=path.name+'.', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ctrl', default='ctrl'); parser.add_argument('--aikit', default='aikit'); parser.add_argument('--oi', default='oi')
    parser.add_argument('--cwd', type=Path, required=True)
    parser.add_argument('--phase', choices=['preflight','review',*sorted(MUTATIONS)], default='preflight')
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--receipt', type=Path, required=True); parser.add_argument('--prior', type=Path)
    parser.add_argument('--name'); parser.add_argument('--purpose-file', type=Path); parser.add_argument('--skill', action='append', default=[])
    parser.add_argument('--confirm-scope'); parser.add_argument('--profile-ref'); parser.add_argument('--reviewed-digest')
    parser.add_argument('--provider'); parser.add_argument('--source', type=Path); parser.add_argument('--seconds', type=int, default=90)
    args = parser.parse_args()
    if args.phase in MUTATIONS and not args.execute:
        parser.error('This phase requires --execute. Default preflight does not create or start anything.')
    if args.phase == 'accept' and (not args.prior or not args.reviewed_digest):
        parser.error('Acceptance requires --prior and --reviewed-digest after separate native source review.')
    if args.phase in {'prepare','connect','live','resume'} and not args.prior:
        parser.error('This phase requires the previous native receipt, not renderer-selected identities.')
    if args.phase in {'connect','live','resume'} and not args.provider:
        parser.error('Choose an actual native provider ID explicitly with --provider.')
    if not 10 <= args.seconds <= 300:
        parser.error('--seconds must be between 10 and 300.')
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(args.receipt, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600); os.close(fd)
    except FileExistsError:
        parser.error('Receipt already exists; preserve earlier evidence and choose a new path.')
    result: dict[str,Any] = {'schema':SCHEMA,'phase':args.phase,'standing':'not-run','observed_unix_seconds':int(time.time()),
        'machine':{'system':platform.system(),'release':platform.release(),'architecture':platform.machine()},
        'not_proved':['native Mac keyboard/focus/window interaction','microphone/audio','independent provider model identity',
                      'brokered-child activation','human acceptance of the whole experience']}
    def save(standing: str):
        result['standing']=standing; checkpoint(args.receipt,result)
    save('preflight-started')
    try:
        binaries = {key:Path(shutil.which(value) or '') for key,value in [('ctrl',args.ctrl),('aikit',args.aikit),('oi',args.oi)]}
        if not args.cwd.is_dir() or any(not p.is_file() for p in binaries.values()):
            raise Refused('An exact native candidate executable or working directory is unavailable.')
        cwd=args.cwd.resolve(); basis={'cwd_sha256':hashlib.sha256(str(cwd).encode()).hexdigest(), 'binaries':{k:sha(p) for k,p in binaries.items()}}
        result['basis']=basis
        previous=check_prior(json.loads(args.prior.read_text()),basis) if args.prior else {}
        for key in ['profile_ref','agent_ref','profile_revision','content_digest','acceptance_ref','request_id','prepared','live_receipt','live_receipt_sha256']:
            if key in previous: result[key]=previous[key]
        env=dict(os.environ);env['CENTRAL_CTRL_BIN']=str(binaries['ctrl'].resolve())
        def command(argv: list[str]) -> Any:
            try: call=subprocess.run(argv,cwd=cwd,env=env,text=True,capture_output=True,timeout=35)
            except subprocess.TimeoutExpired as error: raise Refused('Native timeout; outcome remains unknown and no request was replayed.') from error
            if call.returncode:
                try: decode(call.stdout)
                except Refused: raise
                raise Refused(f'Native process failed ({call.returncode}); inspect its local diagnostics.')
            return decode(call.stdout)
        def ai(*parts: str):return command([str(binaries['aikit'].resolve()),'session-space','-C',str(cwd),*parts])
        scope=ai('agent-session-scope')
        if scope.get('schema')!='aikit.direct-agent-scope/v1' or Path(scope['cwd']).resolve()!=cwd or scope.get('execution_authority_granted') is not False:
            raise Refused('AIKit did not return the actual native working scope.')
        root=Path(scope['central_root']).resolve()
        if cwd==root: scoped={'scope':'root'}
        else:
            member=cwd.relative_to(root/'Work')
            if len(member.parts)!=1:raise Refused('Choose the exact native Project root, not a subdirectory.')
            scoped={'scope':'project','project':str(member)}
        env['CENTRAL_ROOT']=str(root)
        def central(action: str, **fields):return command([str(binaries['ctrl'].resolve()),'--json','--root',str(root),'action','run',action,json.dumps({**scoped,**fields})])
        roster=central('agent-profile.roster')
        if roster.get('schema')!='central.agent-profile-roster/v1' or roster.get('execution_authority_granted') is not False or not isinstance(roster.get('profiles'),list):
            raise Refused('Native roster is unavailable.')
        scope_ref=exact_text(roster['scope_ref'],1024,'Native scope');result['scope_ref']=scope_ref
        skills=ai('agent-session-skills')
        if skills.get('schema')!='aikit.direct-agent-skills/v1' or skills.get('activation_performed') is not False:
            raise Refused('Native effective Skill discovery is unavailable.')
        result['world_ready']=scope['world_readiness']['ready']
        result['eligible_skills']=[{'ref':r['ref'],'name':r['name']} for r in skills['rows'] if r.get('eligible') is True]
        if args.phase=='preflight':
            result['available_profiles']=[{'ref':v['profile']['ref'],'accepted':v['accepted']} for v in roster['profiles']]
            save('preflight-only-no-write-no-provider');return 0
        if args.phase=='propose':
            if args.prior and previous.get('standing','').endswith('unknown'):
                raise Refused('An uncertain proposal cannot be regenerated. Read the native roster and review its actual source first.')
            if args.confirm_scope!=scope_ref:raise Refused('Pass --confirm-scope with the exact disclosed scope; no implicit World ratification.')
            if not args.purpose_file or args.purpose_file.is_symlink() or not args.purpose_file.is_file() or args.purpose_file.stat().st_size>16384:
                raise Refused('Supply a regular purpose file below 16 KiB; it will not be published in a receipt.')
            name=exact_text(args.name or '',256,'Name');purpose=exact_text(args.purpose_file.read_text(),16384,'Purpose')
            if len(args.skill)!=len(set(args.skill)) or any(s not in [r['ref'] for r in result['eligible_skills']] for s in args.skill):
                raise Refused('Choose unique currently eligible native Skill refs.')
            save('proposal-submitted-outcome-unknown')
            proposed=central('agent-profile.express',name=name,purpose=purpose,intent_expression=purpose,world_ref=scope_ref,ratified_world_refs=[scope_ref],skill_refs=args.skill)
            result['profile_ref']=proposed['profile']['ref'];save('proposal-returned-review-pending')
        ref=args.profile_ref or result.get('profile_ref')
        if not ref:raise Refused('Read the roster and select the actual source with --profile-ref.')
        review=validate_review(central('agent-profile.review',profile_ref=ref),scope_ref,ref)
        p=review['profile'];result.update(profile_ref=ref,agent_ref=p['agent_ref'],profile_revision=p['revision'],content_digest=review['content_digest'])
        if args.phase in {'review','propose'}:
            print(json.dumps({'review_native_source':p,'content_digest':review['content_digest'],'accepted':review['accepted']},indent=2))
            save('native-source-reviewed');return 0
        if args.phase=='accept':
            if args.reviewed_digest!=review['content_digest'] or previous.get('content_digest')!=review['content_digest'] or previous.get('profile_ref')!=ref or previous.get('profile_revision')!=p['revision']:
                raise Refused('The human-reviewed source basis changed; review again without applying the old acceptance.')
            save('acceptance-submitted-outcome-unknown')
            central('agent-profile.accept',profile_ref=ref,expected_revision=p['revision'],expected_content_digest=review['content_digest'])
            review=validate_review(central('agent-profile.review',profile_ref=ref),scope_ref,ref,True)
        else: validate_review(review,scope_ref,ref,True)
        accepted_rows=central('agent-profile.roster')['profiles']
        if not any(v.get('accepted') is True and v.get('content_digest')==review['content_digest'] and v.get('profile',{}).get('ref')==ref and v.get('acceptance',{}).get('acceptance_ref')==review['acceptance']['acceptance_ref'] for v in accepted_rows):
            raise Refused('Acceptance was not read back from the native roster.')
        result['acceptance_ref']=review['acceptance']['acceptance_ref']
        if args.phase=='accept':save('native-acceptance-and-roster-observed');return 0
        if args.phase=='prepare':
            if not result['world_ready']:raise Refused('Native World declaration is missing. Use the exact Central setup route; this packet does not manufacture it.')
            result.setdefault('request_id',str(uuid.uuid4()));save('preparation-submitted-outcome-unknown')
            prepared=ai('agent-session-prepare','--request-json',json.dumps({'request_id':result['request_id'],'profile_ref':ref,'expected_revision':p['revision'],'expected_content_digest':review['content_digest'],'expected_acceptance_ref':result['acceptance_ref']}))
            if prepared.get('prepared') is not True or prepared.get('provider_started') is not False or prepared.get('execution_authority_granted') is not False:
                raise Refused('Native preparation remains incomplete. Inspect/continue the same correlation, never replace its identity.')
            result['prepared']=prepared;save('native-session-prepared-not-connected');return 0
        prepared=ai('agent-session-find','--request-id',result.get('request_id',''))
        if prepared!=result.get('prepared') or prepared.get('profile_ref')!=ref or prepared.get('acceptance_ref')!=result['acceptance_ref']:
            raise Refused('The original native preparation changed or is incomplete.')
        session=prepared['agent_session'];space=prepared['space']
        def encounter(action: str, **fields):return ai('encounter','--request-json',json.dumps({'action':action,**fields}))
        if args.phase=='connect':
            save('owner-start-submitted-outcome-unknown');ai('encounter-start')
            providers=encounter('providers')
            if not any(r.get('id')==args.provider for r in providers):raise Refused('Choose a provider actually disclosed by the native owner.')
            save('provider-open-submitted-outcome-unknown')
            connection=encounter('open',space=space,agent_session=session,provider=args.provider,cwd=str(cwd))
            if not connection.get('native_session_id'):raise Refused('No native handshake/session binding returned.')
            result['native_session_sha256']=hashlib.sha256(connection['native_session_id'].encode()).hexdigest()
            save('native-handshake-observed-not-useful-work');return 0
        if not args.source:raise Refused('Live proof needs --source with a permitted fresh source nonce.')
        live_path=Path(str(args.receipt)+'.live.json')
        argv=[sys.executable,str(Path(__file__).with_name('agent-native-live.py')),'--oi',str(binaries['oi'].resolve()),'--cwd',str(cwd),'--project-ref',prepared['project_ref'],'--space',space,'--session',session,'--provider',args.provider,'--source',str(args.source),'--live','--seconds',str(args.seconds),'--receipt',str(live_path)]
        if args.phase=='resume':
            earlier=Path(previous.get('live_receipt',''))
            if not earlier.is_file() or sha(earlier)!=previous.get('live_receipt_sha256'):raise Refused('The previous live receipt is absent or changed.')
            argv+=['--resume','--prior-receipt',str(earlier)]
        save('live-operation-submitted-outcome-unknown')
        run=subprocess.run(argv,env=env,timeout=args.seconds+90,check=False)
        if not live_path.is_file():raise Refused('No live evidence returned; no replay was attempted.')
        live=json.loads(live_path.read_text());result.update(live_receipt=str(live_path.resolve()),live_receipt_sha256=sha(live_path))
        if run.returncode or live.get('standing')!='source-return-observed':raise Refused('Actual source-dependent work is not proved; retain the live receipt and original session.')
        save('same-native-reopen-and-source-return-observed' if args.phase=='resume' else 'live-source-return-observed');return 0
    except (Refused,OSError,ValueError,KeyError,TypeError,subprocess.TimeoutExpired) as error:
        result['failure']=str(error) if isinstance(error,Refused) else type(error).__name__
        if not result['standing'].endswith('unknown'):result['standing']='blocked-before-next-effect'
        checkpoint(args.receipt,result);return 1
    finally:
        print(json.dumps({'phase':args.phase,'standing':result['standing'],'receipt':str(args.receipt),'full_installed_human_acceptance':False}))

if __name__=='__main__':raise SystemExit(main())
