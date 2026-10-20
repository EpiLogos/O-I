// Vendor the agent's face from the face rig (Work/face-rig, github EpiLogos/face-rig) into the shell's served files, so the
// Answer (and later the Agent) draws the newest face live, from the shell's own origin: no network, no CDN.
//
//   node scripts/sync-face.mjs                     copy the face and build public/face/face.html
//   node scripts/sync-face.mjs --check             exit 1 when public/face has drifted from REVISION.json, from its own
//                                                  build, or (where the rig is on this machine) from the rig
//   node scripts/sync-face.mjs --from <face-rig>   read the rig from another checkout (or set FACE_RIG=<face-rig>)
//
// Do not edit the vendored files by hand; re-run the sync when the face moves.
//
// What lands in packages/live-shell/ui/public/face/ (Vite copies public/ into ui-dist, so the hosted frame and the native
// candidate serve it at app/face/; the gallery serves the same directory):
// - facerig2.html, face-core.js, face-speech.js: the rig's face page and the face itself, byte for byte. The polygon mesh
//   (FACE.pix), the muscles, the jaw, the springs and every layer are the rig's own; nothing here redraws or replaces them.
// - face-rig.css: the face page's own <style> blocks, verbatim and in order, moved into a file. The native candidate's
//   webview gives every inline <style> a nonce and then refuses inline style attributes and styles made at run time
//   (tauri-utils inject_nonce_token), and the face draws its svg with an inline style; a page with no inline style keeps
//   the face as the rig draws it.
// - face-embed.css: the face alone on a transparent ground. The rig page's header, its controls, its speech box and its
//   anatomy overlay are not drawn; the live face fills the frame. Adapted from face-rig-chat/public/face-embed.css.
// - face-embed.js: the face's own life switch (`motion`) follows a request for reduced motion. Nothing is remembered: the
//   shell keeps no rig setting (face-rig-chat's face-embed.js stores the rig's pads; this does not).
// - face.html: facerig2.html with its styles linked from face-rig.css and face-embed.css and face-embed.js loaded after the
//   face's two scripts. FaceStage (src/agent/FaceStage.tsx) loads it in an iframe and drives it through the face's own
//   bounded surface, window.FACE_RIG_CHAT (face-speech.js).
// - REVISION.json: the rig commit the face files come from, its date, whether they were dirty there, and the sha-256 of
//   every file above. tests/face-stage.test.mjs fails when a file differs from it.
//
// Running the sync twice writes the same bytes.

import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const UI = join(here, '..')
export const OUT = join(UI, 'public', 'face')
const REPO = join(UI, '..', '..', '..')
/** Where the rig stands: beside the repository (Work/O-I, Work/face-rig), or from a seat (worktrees/env-N/o-i). */
const RIG_CANDIDATES = [join(REPO, '..', 'face-rig'), join(REPO, '..', '..', '..', 'Work', 'face-rig'), '/Users/admin/Central/Work/face-rig']

/** The rig's files, vendored byte for byte. */
export const VERBATIM = ['facerig2.html', 'face-core.js', 'face-speech.js']
/** The files the sync builds. */
export const BUILT = ['face-rig.css', 'face-embed.css', 'face-embed.js', 'face.html']
export const REVISION = 'REVISION.json'

export const EMBED_CSS = `/* The face alone, as the shell hosts it (FaceStage, packages/live-shell/ui/src/agent/FaceStage.tsx). Built by
   packages/live-shell/ui/scripts/sync-face.mjs: do not edit by hand. The rig page's header, its controls, its speech box and
   its anatomy overlay are not drawn; the live face fills the frame, centred, on a transparent ground, with room left round it
   for the head's own turns and the jaw's drop (most below). Adapted from face-rig-chat/public/face-embed.css. */
html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important;color-scheme:dark}
.plate{position:fixed!important;inset:0!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;overflow:hidden!important}
header.top,#speech-box,.dev.facedev>.dh,.fd-col>.fd-chips,.fd-pads,.fd-mxw,.fd-side,.anat{display:none!important}
#device-body,.dev.facedev,.fd,.fd-col{display:block!important;position:static!important;width:100%!important;height:100%!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important}
#fd-face{position:absolute!important;inset:2% 5% 8%!important;display:block!important}
#fd-face svg.pface{display:block!important;width:100%!important;height:100%!important}
`

export const EMBED_JS = `/* The face as the shell hosts it (FaceStage, packages/live-shell/ui/src/agent/FaceStage.tsx). Built by
   packages/live-shell/ui/scripts/sync-face.mjs: do not edit by hand. Loaded after face-core.js and face-speech.js, it shares
   their globals. The shell keeps no rig setting: nothing here is remembered. A request for reduced motion turns the face's own
   life off (its \`motion\`: the drift, the breath, the small movements and the idle gestures, face-core.js faceTick); every
   state the shell puts it in still shows. */
(() => {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const life = () => {
    const face = typeof LIVE_FACES === 'undefined' ? null : LIVE_FACES.find(f => f.el && f.el.closest('#fd-face'));
    if (face) face.motion = !(query && query.matches);
  };
  life();
  if (query && typeof query.addEventListener === 'function') query.addEventListener('change', life);
})();
`

const STYLE = /<style>([\s\S]*?)<\/style>\n?/g
const HEADER = '<!-- The face as the shell hosts it: built from facerig2.html (EpiLogos/face-rig) by\n     packages/live-shell/ui/scripts/sync-face.mjs. Do not edit by hand; re-run the sync when the face moves. -->\n'

/** The built files, from the rig's face page. Throws when the page no longer has the shape the embed is built on, so a change
 * in the rig is looked at rather than shipped half-hidden. Pure. */
export function buildEmbed(rigHtml) {
  const styles = [...rigHtml.matchAll(STYLE)].map(m => m[1])
  if (!styles.length) throw new Error('facerig2.html has no <style> block: the embed is built on its styles')
  if (!rigHtml.startsWith('<!DOCTYPE html>\n')) throw new Error('facerig2.html no longer opens with <!DOCTYPE html>')
  const scripts = [...rigHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  const order = scripts.map(m => m[0])
  if (scripts.some(m => m[1].trim()) || order.join('\n') !== '<script src="face-core.js"></script>\n<script src="face-speech.js"></script>') {
    throw new Error(`facerig2.html's scripts changed (${order.join(' ')}): the embed loads face-core.js then face-speech.js, nothing inline`)
  }
  let first = true
  const linked = rigHtml.replace(STYLE, () => {
    if (!first) return ''
    first = false
    return '<link rel="stylesheet" href="face-rig.css">\n<link rel="stylesheet" href="face-embed.css">\n'
  })
  const html = linked
    .replace('<!DOCTYPE html>\n', `<!DOCTYPE html>\n${HEADER}`)
    .replace('<script src="face-speech.js"></script>', '<script src="face-speech.js"></script>\n<script src="face-embed.js"></script>')
  if (/<style\b/.test(html.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error('face.html would carry an inline <style>')
  return {
    'face-rig.css': `/* facerig2.html's own <style> blocks, verbatim and in order (EpiLogos/face-rig). Built by\n   packages/live-shell/ui/scripts/sync-face.mjs: do not edit by hand. */\n${styles.join('\n')}`,
    'face-embed.css': EMBED_CSS,
    'face-embed.js': EMBED_JS,
    'face.html': html,
  }
}

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** REVISION.json for a set of files ({name: bytes}) and the rig's provenance. Pure. */
export function revisionOf(files, provenance) {
  const names = Object.keys(files).sort()
  return `${JSON.stringify({
    schema: 'oi.vendored-face/v1',
    source: 'EpiLogos/face-rig',
    note: 'Vendored by packages/live-shell/ui/scripts/sync-face.mjs. Do not edit these files by hand; re-run the sync when the face moves.',
    commit: provenance.commit,
    date: provenance.date,
    dirty: provenance.dirty,
    verbatim: VERBATIM,
    built: BUILT,
    files: Object.fromEntries(names.map(name => [name, sha256(files[name])])),
  }, null, 2)}\n`
}

/** Where the vendored face differs from its REVISION.json and from its own build: a list of findings, empty when it holds. */
export function driftOf(dir = OUT) {
  const found = []
  if (!existsSync(join(dir, REVISION))) return [`${REVISION} is missing: run node scripts/sync-face.mjs`]
  const revision = JSON.parse(readFileSync(join(dir, REVISION), 'utf8'))
  const listed = Object.keys(revision.files ?? {}).sort()
  const expected = [...VERBATIM, ...BUILT].sort()
  if (listed.join() !== expected.join()) found.push(`${REVISION} lists ${listed.join(', ')}, not ${expected.join(', ')}`)
  const present = readdirSync(dir).filter(name => name !== REVISION).sort()
  for (const name of present) if (!expected.includes(name)) found.push(`${name} is not the sync's: remove it or re-run the sync`)
  for (const name of expected) {
    if (!existsSync(join(dir, name))) { found.push(`${name} is missing`); continue }
    const hash = sha256(readFileSync(join(dir, name)))
    if (hash !== revision.files?.[name]) found.push(`${name} differs from ${REVISION} (edited by hand, or the sync did not finish)`)
  }
  if (existsSync(join(dir, 'facerig2.html'))) {
    const built = buildEmbed(readFileSync(join(dir, 'facerig2.html'), 'utf8'))
    for (const [name, text] of Object.entries(built)) {
      if (existsSync(join(dir, name)) && readFileSync(join(dir, name), 'utf8') !== text) found.push(`${name} is not what the sync builds from facerig2.html`)
    }
  }
  return found
}

function git(rig, args) {
  try {
    return execFileSync('git', ['-C', rig, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
  } catch {
    return null
  }
}

/** The rig commit the face files come from (the last that touched them), its date, and whether they differ from it there. */
function provenanceOf(rig) {
  const log = git(rig, ['log', '-1', '--format=%H%n%cI', '--', ...VERBATIM])
  const [commit = null, date = null] = log ? log.split('\n') : []
  const status = git(rig, ['status', '--porcelain', '--', ...VERBATIM])
  return {commit, date, dirty: status === null ? null : status.length > 0}
}

function rigOf(argv) {
  const at = argv.indexOf('--from')
  const given = at >= 0 ? argv[at + 1] : process.env.FACE_RIG
  const candidates = given ? [resolve(given)] : RIG_CANDIDATES
  return candidates.find(dir => VERBATIM.every(name => existsSync(join(dir, name)))) ?? null
}

function filesFrom(rig) {
  const files = Object.fromEntries(VERBATIM.map(name => [name, readFileSync(join(rig, name))]))
  const built = buildEmbed(files['facerig2.html'].toString('utf8'))
  for (const [name, text] of Object.entries(built)) files[name] = Buffer.from(text, 'utf8')
  return files
}

function sync(rig) {
  const files = filesFrom(rig)
  const provenance = provenanceOf(rig)
  mkdirSync(OUT, {recursive: true})
  for (const name of readdirSync(OUT)) if (!(name in files) && name !== REVISION) rmSync(join(OUT, name))
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(OUT, name), bytes)
  writeFileSync(join(OUT, REVISION), revisionOf(files, provenance))
  const short = provenance.commit ? provenance.commit.slice(0, 7) : 'no git'
  console.log(`face synced from ${rig} at ${short}${provenance.dirty ? ' (the face files are dirty there)' : ''} → ${OUT}`)
}

function check(rig) {
  const found = driftOf()
  if (rig) {
    const files = filesFrom(rig)
    for (const name of VERBATIM) {
      if (existsSync(join(OUT, name)) && sha256(readFileSync(join(OUT, name))) !== sha256(files[name])) found.push(`${name} differs from the rig (${rig}): the face moved; re-run the sync`)
    }
    const revision = existsSync(join(OUT, REVISION)) ? JSON.parse(readFileSync(join(OUT, REVISION), 'utf8')) : {}
    const provenance = provenanceOf(rig)
    if (provenance.commit && revision.commit !== provenance.commit) found.push(`${REVISION} names ${revision.commit}, the rig's face is at ${provenance.commit}`)
  }
  if (found.length) {
    console.error(`the vendored face has drifted:\n  ${found.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`the vendored face holds${rig ? ` (and matches ${rig})` : ''}`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const argv = process.argv.slice(2)
  const rig = rigOf(argv)
  if (argv.includes('--check')) check(rig)
  else if (!rig) {
    console.error(`the face rig was not found — looked in:\n  ${(process.env.FACE_RIG ? [process.env.FACE_RIG] : RIG_CANDIDATES).join('\n  ')}\npass --from <face-rig> or set FACE_RIG`)
    process.exit(1)
  } else sync(rig)
}
