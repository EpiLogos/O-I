import React from 'react';
import {createRoot} from 'react-dom/client';
import {PlanDrawer} from '../src/configuration/PlanDrawer';
import {createFixtureConfigPlaneSource} from '../src/configuration/fixtureSource';
import {settingsOf} from '../src/configuration/setupFlow';
import '@epilogos/oi-design-system/tokens.css';
import '../src/cradle.css';
import '../src/workspace/shell.css';
import '../src/workspace/settings/settings-v2.css';
import '../src/configuration/configuration.css';
async function main(){
 const source=await createFixtureConfigPlaneSource();const registry=await source.readRegistry();const settings=settingsOf(registry.mounts);
 const requests=[{setting_ref:'ai-kit:resolution:model.default',scope:{scope_kind:'project',scope_ref:'epilogos/o-i'},value:'sonnet-next'},{setting_ref:'oi:verify:verify.before-run',scope:{scope_kind:'world',scope_ref:null},value:true}];
 let writes=0;const controlled={...source,label:'Controlled C0 owner source: '+('long-readable-owner-reference/'.repeat(8)),async apply(...args){writes++;return source.apply(...args);}};
 window.shellSetup={writes:()=>writes};
 function Page(){const [open,setOpen]=React.useState(true);return <><button onClick={()=>setOpen(true)}>Open setup</button>{open&&<PlanDrawer source={controlled} settings={settings} requests={requests} onClose={()=>setOpen(false)} onApplied={()=>{}}/>}</>;}
 createRoot(document.getElementById('root')!).render(<React.StrictMode><Page/></React.StrictMode>);
}
void main();
