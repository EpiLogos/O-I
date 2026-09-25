import {docText, waitForDoc, openWorkspaceStrip, recoverArrangement} from '../editor-doc.mjs';
export default async function run({page,baseUrl,check,channel,shot}) {
 await page.goto(baseUrl);await channel('info');
 const raw=JSON.stringify({version:99,active:'held',workspaces:[{id:'held',name:'Held arrangement',writing:'Original writing survives recovery',layout:{root:null,surfaces:{},closedStack:[],focusedGroupId:null,agencyDepth:'panel'}}]});
 // Book writes coalesce (250 ms): let the opening write land before planting.
 const plant=async({journal})=>{await page.waitForTimeout(400);await page.evaluate(([raw,journal])=>{if(!journal)localStorage.removeItem('oi-cradle.book.stage.v1');localStorage.setItem('oi-cradle.workspaces.v1',raw);},[raw,journal]);await page.reload();await channel('info');};
 // WF1 (workspace continuity, 32450cff): an unreadable book never discards
 // the last committed copy — while the publication journal holds one, that
 // copy opens and the footer names the substitution; recovery is not raised.
 await plant({journal:true});
 check((await page.getByLabel('Workspace messages').getAttribute('aria-label')).includes('the last committed copy was opened instead')&&await page.getByRole('button',{name:'Start a fresh arrangement',exact:true,includeHidden:true}).count()===0,'An unsupported book with a committed journal copy opens that copy and names the substitution — no recovery presentation');
 // Recovery proper stands only when no committed copy exists.
 await plant({journal:false});
 // Owner law 2026-09-17: recovery — like every workspace message — stands
 // only in the footer status disclosure. Nothing renders above the shell,
 // and the shell needs no dismiss button: the recovery actions resolve it.
 // The footer is a reveal surface: approach the bottom edge, let it open in
 // flow, then use the arrow — never a document scroll.
 const messages=page.getByLabel('Workspace messages');
 const openMessages=async()=>{await page.locator('.workspace-footer-edge').hover();await page.waitForTimeout(300);await messages.click();};
 await messages.waitFor();
 check(await page.evaluate(()=>{const shell=document.querySelector('.desktop-shell');return !!shell&&shell.previousElementSibling===null;}),'Nothing renders above the shell');
 check(await page.getByRole('region',{name:'Workspace recovery'}).count()===0,'Recovery never renders as a header above the app');
 await openMessages();
 check(await page.getByRole('button',{name:'Start a fresh arrangement',exact:true}).isVisible(),'Recovery actions live in the footer status disclosure');
 await shot('recovery-footer-status-disclosure');
 await page.getByRole('button',{name:'Start a fresh arrangement',exact:true}).click();
 await page.reload();await channel('info');
 check(await page.evaluate(()=>{const shell=document.querySelector('.desktop-shell');return !!shell&&shell.previousElementSibling===null;}),'Explicit fresh arrangement restores normally');
 const backup=await page.evaluate(()=>{const key=localStorage.getItem('oi-cradle.recovery.latest');return JSON.parse(localStorage.getItem(key));});
 check(backup.raw===raw,'Corrupt/unsupported presentation is retained byte for byte before recovery');
 await openWorkspaceStrip(page);
  await recoverArrangement(page);
 await openMessages();
 await page.getByRole('button',{name:'Recover available workspaces',exact:true}).click();
 await page.locator('.draft-surface .cm-content').waitFor({timeout:15000});
 check(await docText(page,'.draft-surface .cm-content')==='Original writing survives recovery','Explicit recovery restores actual held writing');
 await page.reload();await channel('info');
 await page.locator('.draft-surface .cm-content').waitFor({timeout:15000});
 check(await docText(page,'.draft-surface .cm-content')==='Original writing survives recovery','Recovered writing remains durable after another relaunch');
}
