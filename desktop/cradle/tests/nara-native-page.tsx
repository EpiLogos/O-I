// Test host only: the production component, no fixture injection into it.
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {NaraSurface} from '../src/nara/NaraSurface';
import '@epilogos/oi-design-system/tokens.css';
let root:Root|null=null;
const host=window as unknown as {naraNativeTest:{mount():void;unmount():void}};
host.naraNativeTest={
  mount(){root=createRoot(document.getElementById('root')!);root.render(<KernelProvider><NaraSurface binding={{id:'nara-native-test',kind:'nara',title:'Nara'}}/></KernelProvider>);},
  unmount(){root?.unmount();root=null;},
};
host.naraNativeTest.mount();
