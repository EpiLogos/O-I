// expressions-host-bridge-probe: the strongest browser proof available —
// the walk bridge (the same typed kernel seam as the desktop) serves the
// hosted application's bytes, and the centre's frame actually navigates to
// the application's entry and loads it. The Tauri build serves the same
// bytes through oi-material://.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
const cradleRoot = new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const PORT = 4196, BRIDGE_PORT = 4197;
// the bridge (typed kernel seam) and a dev server with the bridge baked
// (bridge.ts law: the VITE_KERNEL_BRIDGE env is one of the two legal ways)
const bridge = spawn('cargo', ['run','--quiet','--manifest-path',join(cradleRoot,'kernel/Cargo.toml'),'--bin','walk-bridge','--',`127.0.0.1:${BRIDGE_PORT}`], {cwd: cradleRoot, detached: true, stdio: ['ignore','ignore','ignore']});
const vite = spawn('node', ['node_modules/.bin/vite', '--port', String(PORT), '--strictPort'], {cwd: cradleRoot, detached: true, stdio: ['ignore','ignore','ignore'], env: {...process.env, VITE_KERNEL_BRIDGE: `http://127.0.0.1:${BRIDGE_PORT}`}});
const teardown = () => { try { process.kill(-bridge.pid, 'SIGTERM'); } catch {} ; try { process.kill(-vite.pid, 'SIGTERM'); } catch {} };
process.on('exit', teardown);
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
  try { const response = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/health`); if (response.ok) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 500));
}
while (Date.now() < deadline) {
  try { const response = await fetch(`http://localhost:${PORT}/`); if (response.ok) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 500));
}
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto(`http://localhost:${PORT}/`,{timeout:40000});
await page.waitForSelector('.desktop-shell',{timeout:40000});
await page.waitForTimeout(1500);
await page.locator('.world-mode-strip [data-mode="expressions"]').click();
await page.waitForTimeout(3000);
const state = await page.locator('.pcd-host').getAttribute('data-state');
console.log('host state:', state);
if(state==='ready'){
  const pcd = page.frames().find(frame => frame.url() !== `http://localhost:${PORT}/` && frame.url() !== 'about:blank');
  console.log('frame url:', pcd ? pcd.url().slice(0, 90) : 'none');
  if(pcd){
    await pcd.waitForLoadState('domcontentloaded').catch(()=>{});
    const title = await pcd.title().catch(()=>'');
    const hasApp = await pcd.evaluate(() => !!document.querySelector('#root, #app, canvas, main')).catch(()=>false);
    console.log('app frame title:', title, '· app root present:', hasApp);
    await page.screenshot({path:'/tmp/pcd-bridge.png'});
  }
} else {
  const note=await page.locator('.pcd-host-refusal').innerText().catch(()=>'');
  console.log('refusal:', note.replace(/\s+/g,' ').slice(0,120));
}
console.log('errors:', errors.length?errors.slice(0,3):'none');
await browser.close();
