// arrangement-actions-probe: the workspace footer's arrangement actions
// (Workbench.ArrangementActions — split right/down, tile, maximize/restore,
// window actions) were composed by the frame and declared on the shell since
// the cradle landed, but never rendered; they render in the footer's
// arrangement row now, deliberately. This probe holds that disposition:
//   A. the controls render in the footer arrangement row (and only there),
//      disabled on an empty workspace exactly as the component declares;
//   B. they OPERATE: split-right opens the second pane, maximize/restore
//      focus the pane and return the arrangement (from a focused group with
//      a surface — a lone split focuses the new EMPTY pane, where the
//      component's own law keeps maximize disabled);
//   C. the keyboard paths the tooltips document (⌘D split, ⌘⌥Enter
//      maximize) are present on the controls.
// Against the standing dev server, no kernel needed (pure layout grammar).
import {chromium} from 'playwright';
const fails=[];
const check=(ok,label,detail='')=>{console.log(`${ok?"ok":"FAIL"} — ${label}${detail?` · ${detail}`:""}`);if(!ok)fails.push(label);};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.addInitScript(()=>{try{sessionStorage.setItem('oi-cradle.welcome.v1','probe');localStorage.setItem('oi-cradle.welcome.v1','probe');}catch{}});
await page.goto('http://localhost:1432/');
await page.waitForSelector('.desktop-shell',{timeout:20000});
await page.waitForTimeout(1200);

const row=page.locator('footer.canvas-arrangement');
const summon=async()=>{await page.locator('.workspace-footer-edge').hover();await page.waitForTimeout(400);};

// --- A. the controls render, declared-law disabled on an empty workspace -
await summon();
const names=['Split active surface right','Split active surface down','Tile all surfaces','Maximize active pane'];
for(const name of names){
  const button=row.locator(`button[aria-label="${name}"]`);
  const count=await button.count();
  const enabled=count?await button.isEnabled():false;
  check(count===1,`the footer renders "${name}" in the arrangement row`,`count=${count}`);
  check(!enabled,`"${name}" is disabled while no surface is active (the declared law)`,`enabled=${enabled}`);
}
// Window actions summons the frame's window menu — it needs no surface and
// the component never disables it.
const windowActions=row.locator('button[aria-label="Window actions"]');
check(await windowActions.count()===1,'the footer renders "Window actions" in the arrangement row');
check(await windowActions.isEnabled(),'"Window actions" is always reachable (a menu summon, no surface needed)');
// and none of them leaked outside the footer row
check(await page.locator('.desktop-centre button[aria-label="Split active surface right"]').count()===0,'the arrangement controls live in the footer row only');

// --- B. they operate: split, then maximize/restore from a focused surface
await page.getByRole('button',{name:'Start writing'}).click();
await page.waitForSelector('.pane.group',{timeout:15000});
await page.waitForTimeout(800);
await summon();
await row.locator('button[aria-label="Split active surface right"]').click();
await page.waitForTimeout(600);
check(await page.locator('.pane.group').count()===2,'Split active surface right opens the second pane','groups='+await page.locator('.pane.group').count());
// a lone split focuses the new empty pane; the declared law keeps maximize
// disabled there — return focus to the surface's pane, then maximize.
await page.locator('.pane.group .tab').first().click();
await page.waitForTimeout(400);
await summon();
const maximize=row.locator('button[aria-label="Maximize active pane"]');
check(await maximize.isEnabled(),'maximize enables once the focused pane holds a surface');
await maximize.click();
await page.waitForTimeout(500);
check(await page.locator('.pane.group[data-maximized="true"]').count()===1,'Maximize active pane focuses the pane','maximized='+await page.locator('.pane.group[data-maximized="true"]').count());
check((await page.locator('.arrangement-state').textContent())==='Focused view','the footer state reads "Focused view" while maximized');
await summon();
await row.locator('button[aria-label="Restore panes"]').click();
await page.waitForTimeout(500);
check(await page.locator('.pane.group[data-maximized="true"]').count()===0,'Restore panes returns the arrangement','maximized='+await page.locator('.pane.group[data-maximized="true"]').count());
check((await page.locator('.arrangement-state').textContent())==='2 groups','the footer state reads "2 groups" after restore');

// --- C. the documented keyboard paths name themselves on the controls ----
check((await row.locator('button[aria-label="Split active surface right"]').getAttribute('title'))==='Split right (⌘D)','split documents its keyboard path (⌘D)');
check((await row.locator('button[aria-label="Maximize active pane"]').getAttribute('title'))==='Maximize / restore (⌘⌥Enter)','maximize documents its keyboard path (⌘⌥Enter)');

console.log(fails.length?`\n${fails.length} FAILURES`:'\nall checks passed');
await browser.close();
process.exit(fails.length?1:0);
