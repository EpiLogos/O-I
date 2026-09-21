// Isolated test host, never imported by the production app.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {PersonalWorkbench} from '../src/nara/personal/PersonalWorkbench';
import {relayPrivateIdentity} from '../src/nara/personal/identityHosts';
import '@epilogos/oi-design-system/tokens.css';
const node=document.getElementById('root')!;let root:ReturnType<typeof createRoot>|null=null;
const mount=()=>{root=createRoot(node);root.render(<KernelProvider><PersonalWorkbench binding={{id:'controlled-personal',kind:'nara',title:'Personal'}}/></KernelProvider>);};
mount();const frame=document.getElementById('identity-app') as HTMLIFrameElement;
const dispose=relayPrivateIdentity(frame);
Object.assign(window,{personalTest:{mount,unmount:()=>{root?.unmount();root=null;},dispose,opened:[]}});
window.addEventListener('oi:techne-open-file',(e:Event)=>(window as any).personalTest.opened.push((e as CustomEvent).detail));
