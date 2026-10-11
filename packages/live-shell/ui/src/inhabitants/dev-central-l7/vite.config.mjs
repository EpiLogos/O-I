// Vite config for the Central family L7 harness (dev-central-l7/ only,
// ticket L7). It serves the Central devices + the detail craft, and its one
// middleware plays the MACHINE-LEVEL declared reads (`/machine-read`): the
// seat instrument's status and read-only git state, each labelled with the
// exact boundary operation it ran. Kernel ops are NOT played here — the
// harness passes the LIVE walk-bridge URL to the page (`?kernel=`), so the
// devices read the real owners; refused ops are shown verbatim.
//
// Read-only law: the middleware executes only the three whitelisted
// read-only commands below, bound to loopback, harness-only. It mutates
// nothing — never the live NOW field, never the register, never git state.
//
// Harness config, not the shell build (the ui package's own
// `tsc --noEmit && vite build` remains the shell build, untouched). Same
// pattern as the inhabitant-rack harness (src/inhabitants/dev/vite.config.mjs).
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

/** The whitelisted machine reads. Each entry IS the boundary operation, named
 * exactly as the devices will display it. Paths are derived from this file's
 * location in the seat — never absolute machine constants. */
const seatRoot = join(here, '..', '..', '..', '..', '..'); // .../Work/O-I (the seat checkout)
const MACHINE_READS = {
  'seat-status': {
    boundaryOp: 'seat status (Control/user/workcell/seat)',
    command: () => run('seat', ['status'], {timeout: 30000, maxBuffer: 4 * 1024 * 1024}),
  },
  'worktree-list': {
    boundaryOp: 'git worktree list --porcelain (seat checkout)',
    command: () => run('git', ['-C', seatRoot, 'worktree', 'list', '--porcelain'], {timeout: 20000, maxBuffer: 4 * 1024 * 1024}),
  },
  'branch-refs': {
    boundaryOp: 'git for-each-ref refs/heads (seat checkout)',
    command: () => run('git', ['-C', seatRoot, 'for-each-ref', 'refs/heads', '--format=%(refname:short)%09%(objectname)%09%(worktreepath)'], {timeout: 20000, maxBuffer: 4 * 1024 * 1024}),
  },
};

export default defineConfig({
  root: here,
  logLevel: 'error',
  server: {
    port: 5204,
    strictPort: true,
    host: '127.0.0.1',
  },
  plugins: [{
    name: 'central-l7-machine-reads',
    configureServer(server) {
      server.middlewares.use('/machine-read', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({refused: 'machine reads answer POST only'}));
          return;
        }
        let body = '';
        request.on('data', chunk => { body += chunk; });
        request.on('end', async () => {
          let kind = '';
          try { kind = JSON.parse(body).kind ?? ''; } catch { /* refused below */ }
          const read = MACHINE_READS[kind];
          if (!read) {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({refused: `unknown machine read "${kind}" — the middleware executes only its whitelisted reads`}));
            return;
          }
          try {
            const {stdout} = await read.command();
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({boundaryOp: read.boundaryOp, stdout}));
          } catch (error) {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({boundaryOp: read.boundaryOp, stdout: '', refused: String(error.message ?? error)}));
          }
        });
      });
    },
  }],
});
