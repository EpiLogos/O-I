import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export default async function run({ check, metric, log }) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const start = Date.now();
  const args = ['tauri', 'build', '--debug'];
  if (process.platform === 'darwin') args.push('--bundles', 'app');
  else args.push('--no-bundle');
  execFileSync('npx', args, { cwd: root, encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, WALK: '0' } });
  metric('native_build_ms', Date.now() - start);
  check(true, 'Real Tauri frontend hook and native build complete');
  if (process.platform === 'darwin') {
    const contents = `${root}src-tauri/target/debug/bundle/macos/O-I.app/Contents`;
    check(existsSync(`${contents}/MacOS/oi-cradle`), 'O-I.app contains the native executable');
    const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', `${contents}/Info.plist`], { encoding: 'utf8' }));
    check(plist.CFBundleName === 'O-I' && plist.CFBundleIdentifier === 'org.epilogos.oi.cradle', 'Bundle preserves product name and application identity');
  } else log('macOS bundle verification not applicable on this host');
  const scripts = readdirSync(`${root}dist/assets`).filter(n => n.endsWith('.js'));
  check(!scripts.some(n => readFileSync(`${root}dist/assets/${n}`, 'utf8').includes('__cradle')), 'Native frontend excludes the development walk channel');
}
