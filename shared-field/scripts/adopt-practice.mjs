#!/usr/bin/env node
/**
 * Adopt an offered Skill or Method into this reader's own AIKit.
 *
 *   # from a hosted reading of the practice in your own field view
 *   OI_SHARED_FIELD_TARGET=… shared-field/spacetimedb/field.sh <<<'{"kind":"read","ref":"<practice ref>"}' > practice.json
 *   node shared-field/scripts/adopt-practice.mjs --reading practice.json --adopter participant:…
 *
 *   # or from a publication bundle (publish-world.mjs --out)
 *   node shared-field/scripts/adopt-practice.mjs --bundle out/bundle.json --ref skill/ql/darshana --adopter participant:…
 *
 *   --root <dir>                 default ${OI_STATE_HOME:-~/.local/state/oi}/adopted-practices
 *   --adapt <text>               an intentional local difference, applied as an AIKit Skill Usage Overlay
 *   --adapt-file <file>          the same, read from a UTF-8 Markdown file
 *   --scope <scope>              overlay scope (default global)
 *   --adopted-at <iso>           fixed adoption time (default now)
 *
 * AIKit runs as `${OI_AIKIT_BIN:-aikit}` with this process's environment, so
 * `AIKIT_HOME` selects which AIKit home adopts it, and with `--root` as its
 * working directory so no project scope is picked up by accident.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { adoptPractice } from '../practice-adoption.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--reading': args.reading = value; index += 1; break;
      case '--bundle': args.bundle = value; index += 1; break;
      case '--ref': args.ref = value; index += 1; break;
      case '--adopter': args.adopter = value; index += 1; break;
      case '--root': args.root = value; index += 1; break;
      case '--adapt': args.adapt = value; index += 1; break;
      case '--adapt-file': args.adaptFile = value; index += 1; break;
      case '--scope': args.scope = value; index += 1; break;
      case '--adopted-at': args.adoptedAt = value; index += 1; break;
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!args.reading === !args.bundle) throw new Error('pass exactly one of --reading <hosted reading> or --bundle <bundle.json> --ref <practice ref>');
  if (args.bundle && !args.ref) throw new Error('--bundle needs --ref');
  if (!args.adopter) throw new Error('--adopter <participant ref> is required: adoption is someone\'s deliberate act');
  if (args.adapt && args.adaptFile) throw new Error('pass --adapt or --adapt-file, not both');
  return args;
}

function aikit(words, cwd) {
  const program = process.env.OI_AIKIT_BIN ?? 'aikit';
  const result = spawnSync(program, [...words, '--json'], { cwd, encoding: 'utf8', env: process.env });
  if (result.error) throw new Error(`${program} could not run (${result.error.message}); put aikit on PATH or name it with OI_AIKIT_BIN`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`aikit ${words.slice(0, 3).join(' ')} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (envelope.ok !== true) return { refused: envelope.error ?? { message: 'refused without an error body' } };
  return { data: envelope.data };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? join(process.env.OI_STATE_HOME ?? join(homedir(), '.local', 'state', 'oi'), 'adopted-practices'));
  mkdirSync(root, { recursive: true });
  const input = JSON.parse(readFileSync(args.reading ?? args.bundle, 'utf8'));
  const result = adoptPractice(input, {
    ref: args.ref,
    root,
    adopter_participant_ref: args.adopter,
    adaptation: args.adaptFile ? readFileSync(args.adaptFile, 'utf8') : args.adapt,
    scope: args.scope,
    adopted_at: args.adoptedAt,
  }, {
    fs: {
      read: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
      write: (path, text) => writeFileSync(path, text),
      mkdir: (path) => mkdirSync(path, { recursive: true }),
    },
    aikit: (words) => aikit(words, root),
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(2);
}
