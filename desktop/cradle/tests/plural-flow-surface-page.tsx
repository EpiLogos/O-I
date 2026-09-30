// Fixture host only: the production FlowSurface, participants panel, thread
// view and owner client run unmodified against the test kernel.
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {FlowSurface} from '../src/flow/FlowSurface';
import '@epilogos/oi-design-system/tokens.css';
import '@epilogos/oi-design-system/desktop.css';
import '../src/rest.css';
import '../src/cradle.css';
import '../src/workspace/shell.css';
import '../src/agent/agent.css';
const path=new URLSearchParams(location.search).get('path')??'Work/demo/flow.html';
const binding={id:'flow',kind:'flow' as const,ref:`central:source:${path}`,title:path.split('/').pop()!,project:'demo',location:{root:'central',path,ref:`central:source:${path}`}};
document.getElementById('root')!.classList.add('desktop-shell');
createRoot(document.getElementById('root')!).render(<KernelProvider><main style={{display:'flex',height:'100vh',minHeight:0}}><div data-binding-id={binding.id} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}><FlowSurface binding={binding}/></div></main></KernelProvider>);
