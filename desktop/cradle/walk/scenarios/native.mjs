import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
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
  const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const bindings=Object.fromEntries(['OI_CENTRAL_CTRL_BIN','OI_AIKIT_BIN','OI_AIKIT_SESSION_SPACE_BIN'].map(name=>{
    const executable=process.env[name];
    if(!executable || !existsSync(executable))return [name,{state:'unresolved',executable:executable??null}];
    let at=dirname(executable),gate=null;
    while(at!==dirname(at)){
      if(existsSync(join(at,'receipt.json'))){const candidate=JSON.parse(readFileSync(join(at,'receipt.json'),'utf8'));if(candidate.schema==='oi.rolling-dev-gate/v1'){gate={receipt:join(at,'receipt.json'),revision:candidate.revision,result:candidate.result};break;}}
      at=dirname(at);
    }
    return [name,{state:'bound',executable,sha256:hash(executable),gate}];
  }));
  const binary=process.platform==='darwin'?`${root}src-tauri/target/debug/bundle/macos/O-I.app/Contents/MacOS/oi-cradle`:`${root}src-tauri/target/debug/oi-cradle`;
  const composition={schema:'oi.cradle-native-verification/v1',verified_at:new Date().toISOString(),bindings,
    native:{executable:binary,sha256:existsSync(binary)?hash(binary):null},
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    locks:Object.fromEntries(['package-lock.json','kernel/Cargo.lock','src-tauri/Cargo.lock'].map(p=>[p,hash(join(root,p))])),
    frontend:Object.fromEntries(readdirSync(`${root}dist/assets`).map(p=>[p,hash(join(root,'dist/assets',p))]))};
  writeFileSync(`${root}walk/artifacts/native-composition.json`,JSON.stringify(composition,null,2)+'\n');
  log('Automatic native composition: artifacts/native-composition.json');
  const scripts = readdirSync(`${root}dist/assets`).filter(n => n.endsWith('.js'));
  check(!scripts.some(n => readFileSync(`${root}dist/assets/${n}`, 'utf8').includes('__cradle')), 'Native frontend excludes the development walk channel');
}
