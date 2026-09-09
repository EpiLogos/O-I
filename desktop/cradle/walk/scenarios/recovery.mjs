import {docText, waitForDoc, openWorkspaceStrip} from '../editor-doc.mjs';
export default async function run({page,baseUrl,check,channel}) {
 await page.goto(baseUrl);await channel('info');
 const raw=JSON.stringify({version:99,active:'held',workspaces:[{id:'held',name:'Held arrangement',writing:'Original writing survives recovery',layout:{root:null,surfaces:{},closedStack:[],focusedGroupId:null,agencyDepth:'panel'}}]});
 await page.evaluate(raw=>localStorage.setItem('oi-cradle.workspaces.v1',raw),raw);
 await page.reload();await channel('info');
 await page.getByRole('region',{name:'Workspace recovery'}).waitFor();
 const backup=await page.evaluate(()=>{const key=localStorage.getItem('oi-cradle.recovery.latest');return JSON.parse(localStorage.getItem(key));});
 check(backup.raw===raw,'Corrupt/unsupported presentation is retained byte for byte before recovery');
 await page.getByRole('button',{name:'Start a fresh arrangement',exact:true}).click();
 await page.reload();await channel('info');
 check(await page.getByRole('region',{name:'Workspace recovery'}).count()===0,'Explicit fresh arrangement restores normally');
 check(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).raw,backup.key)===raw,'Fresh arrangement and relaunch cannot overwrite retained original bytes');
 await openWorkspaceStrip(page);
  await page.getByLabel('Workspace actions',{exact:true}).click();await page.getByRole('button',{name:'Recover saved arrangement',exact:true}).click();
 await page.getByRole('button',{name:'Recover available workspaces',exact:true}).click();
 await page.locator('.draft-surface .cm-content').waitFor({timeout:15000});
 check(await docText(page,'.draft-surface .cm-content')==='Original writing survives recovery','Explicit recovery restores actual held writing');
 await page.reload();await channel('info');
 await page.locator('.draft-surface .cm-content').waitFor({timeout:15000});
 check(await docText(page,'.draft-surface .cm-content')==='Original writing survives recovery','Recovered writing remains durable after another relaunch');
}
