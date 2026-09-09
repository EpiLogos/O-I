import {docText, waitForDoc} from '../editor-doc.mjs';
import {setup as sourceSetup} from './editor.mjs';
import {mkdtempSync,readFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function setup(args) {
 const p=await sourceSetup(args),home=mkdtempSync(join(tmpdir(),'oi-ground-ui-'));
 return {...p,home,env:{...p.env,OI_HOME:home},cleanup:()=>{p.cleanup();rmSync(home,{recursive:true,force:true});}};
}
export default async function run({page,baseUrl,check,channel,provision:p,shot}) {
 await page.goto(baseUrl);await channel('info');
 await page.getByRole('button',{name:'Start writing',exact:true}).click();
 const writing=page.locator('.draft-surface .cm-content');
 await writing.waitFor({timeout:15000});
 await writing.fill('Keep this arrangement while selecting the next Central.');
 await waitForDoc(page,'Keep this arrangement while selecting the next Central.','.draft-surface .cm-content',15000);
 await page.getByRole('button',{name:'System',exact:true}).click();
 const chooser=page.getByRole('region',{name:'Central location'});
 await chooser.getByText('No default Central selected',{exact:true}).waitFor();
 const input=chooser.getByRole('textbox',{name:'Existing Central path'});
 await input.fill(p.projectRoot);await chooser.getByRole('button',{name:'Recognize',exact:true}).click();
 await chooser.getByText('unrecognized',{exact:true}).waitFor();
 check(await chooser.getByRole('button',{name:'Use as default Central'}).isDisabled(),'An ordinary project cannot be selected as a recognized Central');
 await input.fill(p.root);await chooser.getByRole('button',{name:'Recognize',exact:true}).click();
 await chooser.getByText('recognized',{exact:true}).waitFor();
 check(await chooser.getByRole('button',{name:'Use as default Central'}).isEnabled(),'Actual native recognition enables explicit binding');
 await chooser.getByRole('button',{name:'Use as default Central'}).click();
 await chooser.getByText(/Default Central saved/).waitFor();
 const composition=JSON.parse(readFileSync(join(p.home,'composition.json'),'utf8'));
 // Native recognition canonicalizes the path (macOS resolves the tmp root's
 // /var symlink to /private/var); compare against that same canonical form,
 // never the raw pre-resolution string, so this asserts the owner's actual
 // identity rather than a coincidence of this OS's tmpdir layout.
 check(composition.personal_ground===realpathSync(p.root),'Explicit UI selection updates the isolated native suite binding');
 // System is a real canvas surface (D11): opening it leaves the austere
 // Rest shape entirely (Rest only renders at zero open surfaces), so the
 // prior local writing draft is not visible *behind* it — it is preserved
 // underneath and reappears once the System surface is closed and the
 // canvas returns to zero surfaces.
 await page.getByRole('button',{name:'Close System'}).click();
 check(await docText(page,'.draft-surface .cm-content')==='Keep this arrangement while selecting the next Central.','Binding a default preserves the existing open arrangement and writing');
 for(const [path,content] of p.originals)check(readFileSync(join(p.projectRoot,path),'utf8')===content,`Recognition and binding preserve actual source ${path}`);
 await page.reload();await channel('info');
 // The default Central is now recognized and bound, so Rest's own boot-phase
 // gate (ground-unrecognised/-inaccessible) no longer auto-surfaces the
 // chooser inline — it is reached the same explicit way as before: the
 // sidebar's System surface.
 await page.getByRole('button',{name:'System',exact:true}).click();
 await page.getByRole('region',{name:'Central location'}).getByText(realpathSync(p.root),{exact:true}).waitFor();
 check(true,'Reload discloses the actual saved default');
 await shot('native-recognition-default-binding');
}
