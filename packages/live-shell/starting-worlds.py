#!/usr/bin/env python3
"""Make and reset the DLW's starting worlds (O-I #708, #738; docs/experience/LOCAL-CAMPAIGN.md §2.2).

A world is one folder. The candidate opens it with that folder as the home of every product it
starts (desktop/cradle/src-tauri/src/world_folder.rs), so each product keeps the world's state
under it, and the world's Central is made inside it by Setup's Ground step.

  make bare      Bare: nothing. No ground, no agent tools, no projects.
  make arriving  Arriving: a realistic, disposable person. Repositories with their own agent
                 instructions, a configured coding agent with skills, notes, audio, an Ableton
                 set and an Obsidian vault. No Central yet: Setup adopts what is there.
  keep NAME      Lived-in: a world walked forward through the app is kept. Its folder is
                 snapshotted, and from then on reset restores that snapshot in place.
  reset NAME     Bare and Arriving are made again from nothing; a kept world returns to its
                 snapshot. Only a folder this tool made is ever removed.
  register NAME  Names the world in the register the computer's own user keeps, so it stands
                 in the candidate's O-I > Worlds menu.
  list           The worlds under the root, with their kind and whether they are kept.

Yours, the owner's own ground, is never made, kept or reset here. A root may not stand in or
over the computer's own home, its product homes, its Library or its Central.

Open a world by launching the candidate's executable by its path with the folder named:

  OI_WORLD_FOLDER="<root>/Bare" "<run>/O-I Shell Candidate.app/Contents/MacOS/oi-cradle"
"""
import argparse
import gzip
import json
import math
import os
import shutil
import socket
import struct
import subprocess
import sys
import tarfile
import tempfile
import wave
from datetime import datetime, timezone
from pathlib import Path

MANIFEST = 'starting-worlds.json'
MANIFEST_SCHEMA = 'oi.starting-worlds/v1'
REGISTER_SCHEMA = 'oi.shell-worlds/v1'
KINDS = {'bare': 'Bare', 'arriving': 'Arriving'}
KEPT_DIR = '.kept'
PERSON = ('Mira Okafor', 'mira.okafor@example.invalid')
# The first commit of every Arriving repository, so a world made twice is the same world.
COMMIT_DATE = '2026-09-14T10:00:00+00:00'


class Refused(Exception):
    pass


def native_home():
    return Path(os.environ.get('OI_NATIVE_HOME') or Path.home()).resolve()


def guarded(home):
    places = [home / d for d in ('.aikit', '.oi', '.config', '.central', '.claude', '.codex', 'Library', 'Central')]
    composition = home / '.config/oi/composition.json'
    try:
        ground = json.loads(composition.read_text()).get('personal_ground')
        if isinstance(ground, str) and ground:
            places.append(Path(ground))
    except (OSError, ValueError):
        pass
    return [p.resolve() for p in places]


def inside(path, place):
    try:
        path.relative_to(place)
        return True
    except ValueError:
        return False


def check_root(root, home):
    root = root.resolve()
    if inside(home, root):
        raise Refused(f'{root} holds the computer\'s own home; choose a folder of its own for the worlds')
    for place in guarded(home):
        if inside(root, place) or inside(place, root):
            raise Refused(f'{root} stands in or over {place}, which belongs to your own world')
    return root


def read_manifest(root):
    path = root / MANIFEST
    if not path.exists():
        return {'schema': MANIFEST_SCHEMA, 'worlds': {}}
    manifest = json.loads(path.read_text())
    if manifest.get('schema') != MANIFEST_SCHEMA:
        raise Refused(f'{path} is not {MANIFEST_SCHEMA}')
    return manifest


def write_manifest(root, manifest):
    path = root / MANIFEST
    temporary = path.with_suffix(f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    temporary.replace(path)


def world_name(name):
    if name.lower() == 'yours':
        raise Refused('Yours is the owner\'s own ground: it is never made, kept or reset here')
    if not name or name.startswith('.') or '/' in name or name == MANIFEST:
        raise Refused(f'{name!r} is not a world\'s name')
    return name


def endpoint(directory):
    """Where a candidate whose data home is `directory` listens: the kernel's own choice
    (desktop/cradle/kernel/src/expression_transport.rs `choose_endpoint`), a short hashed
    endpoint under the temporary folder when the path would overflow a socket address."""
    path = directory / 'expression.sock'
    if len(os.fsencode(str(path))) < 100:
        return path
    digest = 0xcbf29ce484222325
    for byte in os.fsencode(str(directory)):
        digest = ((digest ^ byte) * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF
    return Path(tempfile.gettempdir()) / f'oi-cradle-{digest:08x}' / 'expression.sock'


def answers(sock):
    """Whether something listens on `sock`, reached by its folder so a long path still fits."""
    if not sock.exists():
        return False
    here = os.getcwd()
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        os.chdir(sock.parent)
        client.settimeout(0.5)
        client.connect(sock.name)
        return True
    except OSError:
        return False
    finally:
        client.close()
        os.chdir(here)


def in_use(folder):
    """A candidate open in this world answers on its expression socket."""
    for data in folder.glob('Library/Application Support/OI-Shell-Candidate/*'):
        if data.is_dir() and answers(endpoint(data)):
            return endpoint(data)
    return None


# ---------------------------------------------------------------- Arriving's material

def write(folder, relative, text):
    path = folder / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def write_wav(path, seconds, tone):
    path.parent.mkdir(parents=True, exist_ok=True)
    rate = 22050
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        frames = bytearray()
        for i in range(int(rate * seconds)):
            t = i / rate
            swell = 0.5 - 0.5 * math.cos(2 * math.pi * t / seconds)
            sample = swell * (0.6 * math.sin(2 * math.pi * tone * t) + 0.2 * math.sin(2 * math.pi * tone * 1.5 * t))
            frames += struct.pack('<h', int(sample * 12000))
        out.writeframes(bytes(frames))


def ableton_set(tempo, tracks):
    """A LiveSet the DLW's reader opens (packages/live-set): its tracks, devices and scenes."""
    rows = []
    for index, (kind, name) in enumerate(tracks):
        rows.append(
            f'<{kind} Id="{10 + index}"><Name><EffectiveName Value="{name}" /><UserName Value="{name}" /></Name>'
            f'<DeviceChain><DeviceChain><Devices /></DeviceChain></DeviceChain></{kind}>')
    scenes = ''.join(f'<Scene Id="{i}"><Name Value="" /></Scene>' for i in range(4))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<Ableton MajorVersion="5" MinorVersion="12.0_12025" SchemaChangeCount="3" Creator="Ableton Live 12.0.25">'
           f'<LiveSet><Tracks>{"".join(rows)}</Tracks>'
           f'<MainTrack><DeviceChain><Mixer><Tempo><Manual Value="{tempo}" /></Tempo></Mixer>'
           '<DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>'
           f'<Scenes>{scenes}</Scenes></LiveSet></Ableton>\n')
    return gzip.compress(xml.encode(), mtime=0)


def git(repo, folder, *args):
    environment = {
        'PATH': os.environ.get('PATH', '/usr/bin:/bin'),
        'HOME': str(folder),
        'GIT_CONFIG_GLOBAL': os.devnull,
        'GIT_CONFIG_NOSYSTEM': '1',
        'GIT_AUTHOR_NAME': PERSON[0], 'GIT_AUTHOR_EMAIL': PERSON[1],
        'GIT_COMMITTER_NAME': PERSON[0], 'GIT_COMMITTER_EMAIL': PERSON[1],
        'GIT_AUTHOR_DATE': COMMIT_DATE, 'GIT_COMMITTER_DATE': COMMIT_DATE,
    }
    subprocess.run(['git', '-c', 'init.defaultBranch=main', *args], cwd=repo, env=environment,
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def repository(folder, relative, files, message):
    repo = folder / relative
    for name, text in files.items():
        write(repo, name, text)
    git(repo, folder, 'init', '-q')
    git(repo, folder, 'add', '-A')
    git(repo, folder, 'commit', '-q', '-m', message)


def make_arriving(folder, ableton=None):
    name = PERSON[0]
    repository(folder, 'code/field-notes', {
        'README.md': '# Field notes\n\nA small tool that turns dated field recordings into a listening log.\n',
        'AGENTS.md': ('# Working on field-notes\n\n'
                      '- Python 3.12, standard library only.\n'
                      '- Run `python3 -m unittest` before you say a change is done.\n'
                      '- Recordings are never edited in place; the log points at them.\n'
                      '- Keep the log format in `log.py` and its test together.\n'),
        'CLAUDE.md': '@AGENTS.md\n',
        'log.py': ('"""A listening log of field recordings."""\nfrom pathlib import Path\n\n\n'
                   'def entries(folder):\n    return sorted(p.name for p in Path(folder).glob("*.wav"))\n'),
        'test_log.py': ('import tempfile, unittest\nfrom pathlib import Path\nfrom log import entries\n\n\n'
                        'class LogTest(unittest.TestCase):\n    def test_lists_recordings_by_name(self):\n'
                        '        with tempfile.TemporaryDirectory() as d:\n            (Path(d) / "b.wav").touch(); (Path(d) / "a.wav").touch()\n'
                        '            self.assertEqual(entries(d), ["a.wav", "b.wav"])\n'),
    }, 'Field notes: a listening log of recordings')
    repository(folder, 'code/tide-sketches', {
        'README.md': '# Tide sketches\n\nGenerative sketches driven by tide tables, played over the Ableton set.\n',
        'AGENTS.md': ('# Agent instructions\n\n'
                      'This is a sketchbook, not a product. Prefer one small file per sketch.\n'
                      'Never commit audio; the set lives in ~/Music/Ableton.\n'),
        'sketches/rise.js': 'export const rise = (hour) => Math.sin((hour / 12.42) * 2 * Math.PI)\n',
        'package.json': json.dumps({'name': 'tide-sketches', 'private': True, 'type': 'module'}, indent=2) + '\n',
    }, 'Tide sketches: the first sketch')
    write(folder, '.claude/settings.json', json.dumps({
        'model': 'sonnet',
        'permissions': {'allow': ['Bash(python3 -m unittest:*)', 'Bash(git status)'], 'deny': ['Read(./.env)']},
    }, indent=2) + '\n')
    write(folder, '.claude/CLAUDE.md', (f'# {name}\n\nI record sound outdoors and write small tools around it.\n'
                                        'Ask before you delete anything under ~/Music.\n'))
    write(folder, '.claude/skills/field-recording-log/SKILL.md', (
        '---\nname: field-recording-log\ndescription: Use when adding a field recording to the listening log, '
        'or when asked what was recorded on a given day.\n---\n\n'
        '# Field recording log\n\n1. Find the recording under ~/Music/Audio.\n'
        '2. Add a dated line to ~/Notes/Recordings.md naming the place and what was heard.\n'
        '3. Never move or rename the recording.\n'))
    write(folder, '.claude/skills/weekly-review/SKILL.md', (
        '---\nname: weekly-review\ndescription: Use on a Friday, or when asked to review the week.\n---\n\n'
        '# Weekly review\n\nRead the week\'s daily notes in the vault, list what moved, and write '
        'Vault/Reviews/<week>.md. Keep it to one screen.\n'))
    write(folder, 'Notes/Recordings.md', ('# Recordings\n\n- 2026-09-12 Estuary at low tide: curlews, a ferry horn.\n'
                                         '- 2026-09-19 Market hall before opening: crates, a radio.\n'))
    write(folder, 'Notes/Ideas.md', '# Ideas\n\n- A set that follows the tide table.\n- Map each recording to where it was made.\n')
    write_wav(folder / 'Music/Audio/estuary-low-tide.wav', 2.0, 220.0)
    write_wav(folder / 'Music/Audio/market-hall.wav', 1.5, 330.0)
    set_path = folder / 'Music/Ableton/Tide Sketch Project/Tide Sketch.als'
    set_path.parent.mkdir(parents=True, exist_ok=True)
    if ableton:
        shutil.copyfile(ableton, set_path)
    else:
        set_path.write_bytes(ableton_set(92, [('AudioTrack', 'Estuary'), ('AudioTrack', 'Market hall'), ('MidiTrack', 'Tide pad')]))
    write(folder, 'Vault/.obsidian/app.json', json.dumps({'alwaysUpdateLinks': True}, indent=2) + '\n')
    write(folder, 'Vault/.obsidian/core-plugins.json', json.dumps(['file-explorer', 'daily-notes', 'backlink', 'graph'], indent=2) + '\n')
    write(folder, 'Vault/Home.md', '# Home\n\n- [[Estuary]]\n- [[Tide tables]]\n- [[Daily/2026-10-20]]\n')
    write(folder, 'Vault/Estuary.md', '# Estuary\n\nRecorded at low tide. See [[Tide tables]].\n')
    write(folder, 'Vault/Tide tables.md', '# Tide tables\n\nHigh water drifts about 50 minutes a day. Used by [[Estuary]].\n')
    write(folder, 'Vault/Daily/2026-10-20.md', '# 2026-10-20\n\nListened back to the estuary take. The ferry horn is the downbeat.\n')


# ---------------------------------------------------------------- operations

def make(root, kind, name, ableton=None):
    manifest = read_manifest(root)
    folder = root / name
    if name in manifest['worlds'] or folder.exists():
        raise Refused(f'{folder} is there already; reset it instead')
    folder.mkdir(parents=True)
    try:
        if kind == 'arriving':
            make_arriving(folder, ableton)
    except BaseException:
        shutil.rmtree(folder)
        raise
    manifest['worlds'][name] = {'kind': kind, 'folder': str(folder), 'kept': False,
                                'made_at': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    write_manifest(root, manifest)
    return folder


def made_world(root, name):
    manifest = read_manifest(root)
    entry = manifest['worlds'].get(name)
    folder = root / name
    if not entry or Path(entry['folder']) != folder:
        raise Refused(f'{name} was not made by this tool under {root}; nothing of it is touched')
    return manifest, entry, folder


def keep(root, name):
    manifest, entry, folder = made_world(root, name)
    if not folder.is_dir():
        raise Refused(f'{folder} is not there to keep')
    busy = in_use(folder)
    if busy:
        raise Refused(f'A candidate is open in {name} ({busy}); quit it first')
    kept = root / KEPT_DIR
    kept.mkdir(exist_ok=True)
    snapshot = kept / f'{name}.tar'
    temporary = snapshot.with_suffix(f'.{os.getpid()}.tmp')
    with tarfile.open(temporary, 'w') as archive:
        archive.add(folder, arcname=name)
    temporary.replace(snapshot)
    entry.update(kept=True, kept_at=datetime.now(timezone.utc).isoformat(timespec='seconds'), snapshot=str(snapshot))
    write_manifest(root, manifest)
    return snapshot


def reset(root, name, ableton=None):
    manifest, entry, folder = made_world(root, name)
    if folder.exists():
        busy = in_use(folder)
        if busy:
            raise Refused(f'A candidate is open in {name} ({busy}); quit it first')
        shutil.rmtree(folder)
    if entry.get('kept'):
        snapshot = Path(entry['snapshot'])
        with tarfile.open(snapshot) as archive:
            members = archive.getmembers()
            if any(not (m.name == name or m.name.startswith(f'{name}/')) for m in members):
                raise Refused(f'{snapshot} holds more than {name}')
            archive.extractall(root, filter='tar')
        return folder
    del manifest['worlds'][name]
    write_manifest(root, manifest)
    return make(root, entry['kind'], name, ableton)


def register(root, name, home):
    _, _, folder = made_world(root, name)
    path = home / '.config/oi-shell-candidate/worlds.json'
    current = json.loads(path.read_text()) if path.exists() else {'schema': REGISTER_SCHEMA, 'current': None, 'worlds': []}
    if current.get('schema') != REGISTER_SCHEMA:
        raise Refused(f'{path} is not {REGISTER_SCHEMA}')
    worlds = [w for w in current.get('worlds', []) if Path(w.get('folder', '')) != folder]
    worlds.append({'name': name, 'folder': str(folder)})
    current['worlds'] = worlds
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(current, indent=2) + '\n')
    temporary.replace(path)
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, default=Path.home() / 'DLW Worlds',
                        help='The folder the worlds are made in (default: ~/DLW Worlds)')
    commands = parser.add_subparsers(dest='command', required=True)
    made = commands.add_parser('make')
    made.add_argument('kind', choices=sorted(KINDS))
    made.add_argument('--as', dest='name', help='Its name (default: Bare or Arriving)')
    made.add_argument('--ableton-set', type=Path, help='Arriving: a set of the person\'s own to copy in, instead of the made one')
    commands.add_parser('keep').add_argument('name')
    again = commands.add_parser('reset')
    again.add_argument('name')
    again.add_argument('--ableton-set', type=Path)
    named = commands.add_parser('register')
    named.add_argument('name')
    named.add_argument('--native-home', type=Path, help='The computer\'s own home whose register names it (default: $HOME)')
    commands.add_parser('list')
    args = parser.parse_args(argv)
    try:
        home = native_home()
        root = check_root(args.root, home)
        root.mkdir(parents=True, exist_ok=True)
        if args.command == 'make':
            folder = make(root, args.kind, world_name(args.name or KINDS[args.kind]), args.ableton_set)
            print(json.dumps({'made': args.kind, 'folder': str(folder), 'launch': f'OI_WORLD_FOLDER="{folder}"'}))
        elif args.command == 'keep':
            print(json.dumps({'kept': args.name, 'snapshot': str(keep(root, world_name(args.name)))}))
        elif args.command == 'reset':
            print(json.dumps({'reset': args.name, 'folder': str(reset(root, world_name(args.name), args.ableton_set))}))
        elif args.command == 'register':
            target = (args.native_home or home).resolve()
            print(json.dumps({'registered': args.name, 'register': str(register(root, world_name(args.name), target))}))
        else:
            print(json.dumps(read_manifest(root), indent=2))
    except Refused as refusal:
        print(f'refused: {refusal}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
