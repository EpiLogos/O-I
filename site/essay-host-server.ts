/** Smoke server: node --experimental-strip-types essay-host-server.ts --mode pages --prefix /O-I --dist dist */
import { startEssayHost, type HostMode } from './essay-host.ts';

function arg(name: string, fallback = ''): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const mode = arg('mode', 'pages');
if (mode !== 'pages' && mode !== 'vercel') throw new Error('--mode must be pages or vercel');
const host = await startEssayHost({
  dist: arg('dist', 'dist'),
  mode: mode as HostMode,
  prefix: arg('prefix', mode === 'pages' ? '/O-I' : ''),
  port: Number(arg('port', '0')),
});
console.log(`essay-host ${host.port}`);
