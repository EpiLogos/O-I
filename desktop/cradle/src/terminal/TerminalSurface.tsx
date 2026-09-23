import {useEffect,useRef,useState} from "react";
import {Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";
import {SerializeAddon} from "@xterm/addon-serialize";
import {invoke} from "@tauri-apps/api/core";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
/* The xterm theme is read from the host body's computed `--oi-*` roles (tokens.css `.oi-desktop` /
 * `[data-theme="dark"]`, plus a theme-library entry's `[data-oi-theme]` block), never a literal
 * palette, and re-read when the host flips either attribute. A theme entry may carry the ANSI
 * 16 (`--oi-terminal-ansi-*`); the house appearances leave them unset and xterm keeps its own. */
const token=(name:string)=>getComputedStyle(document.body).getPropertyValue(name).trim();
const camel=(role:string)=>role.split("-").map((part,index)=>index?part[0].toUpperCase()+part.slice(1):part).join("");
const ANSI_ROLES=["black","red","green","yellow","blue","magenta","cyan","white","bright-black","bright-red","bright-green","bright-yellow","bright-blue","bright-magenta","bright-cyan","bright-white"];
const terminalTheme=()=>{
  const theme:Record<string,string>={
    background:token("--oi-canvas-ground"),
    foreground:token("--oi-foreground"),
    cursor:token("--oi-terminal-cursor")||token("--oi-foreground"),
    selectionBackground:token("--oi-terminal-selection")||token("--oi-accent-soft"),
  };
  const ansi=ANSI_ROLES.map(role=>token(`--oi-terminal-ansi-${role}`));
  ansi.forEach((color,index)=>{if(color)theme[camel(ANSI_ROLES[index])]=color;});
  return theme;
};
export function TerminalSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const host=useRef<HTMLDivElement>(null);const emulator=useRef<Terminal>();const [error,setError]=useState<string>();const [cwd,setCwd]=useState(binding.terminal?.cwd??"");const [exited,setExited]=useState(false);
 useEffect(()=>{
  if(kernel.transport.kind!=="tauri"||!kernel.snapshot.surfaces[binding.id])return;
  const term=new Terminal({fontSize:12,fontFamily:token("--oi-font-mono"),cursorBlink:true,scrollback:5000,screenReaderMode:true,disableStdin:true,theme:terminalTheme()});
  const fit=new FitAddon();const serial=new SerializeAddon();term.loadAddon(fit);term.loadAddon(serial);term.open(host.current!);fit.fit();emulator.current=term;
  let disposed=false,lease=0,seq=0,timer=0,lastCheckpoint=0,writing=Promise.resolve();
  const checkpoint=()=>lease?invoke("terminal_checkpoint",{id:binding.id,lease,seq,snapshot:serial.serialize()}):Promise.resolve();
  const resize=()=>{if(disposed||!host.current?.getClientRects().length)return;fit.fit();if(lease)void invoke("terminal_resize",{id:binding.id,lease,dimensions:{cols:term.cols,rows:term.rows}}).catch(reason=>setError(String(reason)));};
  const observer=new ResizeObserver(resize);observer.observe(host.current!);
  const themeObserver=new MutationObserver(()=>{if(!disposed)term.options.theme=terminalTheme();});themeObserver.observe(document.body,{attributes:true,attributeFilter:["data-theme","data-oi-theme"]});
  let input=Promise.resolve();const data=term.onData(data=>{input=input.then(()=>invoke<void>("terminal_input",{id:binding.id,lease,data})).catch(reason=>setError(String(reason)));});
  const poll=async()=>{
   if(disposed)return;
   try{const out=await invoke<{seq:number;bytes:number[];eof:boolean}>("terminal_poll",{id:binding.id,lease,seq});
    if(disposed)return;
    if(out.bytes.length){writing=new Promise<void>(resolve=>term.write(new Uint8Array(out.bytes),resolve));await writing;seq=out.seq;}
    if(Date.now()-lastCheckpoint>250&&out.bytes.length){await checkpoint();lastCheckpoint=Date.now();}
    setExited(out.eof);if(!disposed)timer=window.setTimeout(poll,out.bytes.length?0:40);
   }catch(reason){if(!disposed)setError(String(reason));}
  };
  const attachment=invoke<{lease:number;seq:number;snapshot:string;cwd:string}>("terminal_attach",{id:binding.id,cwd:binding.terminal?.cwd??null,command:binding.terminal?.command??null,dimensions:{cols:term.cols,rows:term.rows}}).then(async attached=>{
   lease=attached.lease;seq=attached.seq;setCwd(attached.cwd);
   if(attached.snapshot){writing=new Promise<void>(resolve=>term.write(attached.snapshot,resolve));await writing;}
   if(!disposed){term.options.disableStdin=false;resize();if(host.current?.closest(".pane.group.focused")||!host.current?.closest(".pane.group"))term.focus();void poll();window.dispatchEvent(new Event("oi:terminal-attached"));}
  }).catch(reason=>{if(!disposed)setError(String(reason));});
  return()=>{disposed=true;clearTimeout(timer);observer.disconnect();themeObserver.disconnect();data.dispose();void attachment.then(()=>writing).then(checkpoint).catch(()=>{}).finally(()=>term.dispose());emulator.current=undefined;};
 },[binding.id,kernel.transport.kind,!!kernel.snapshot.surfaces[binding.id]]);
 return <section className="terminal-surface" aria-label="Terminal surface" data-terminal-command={binding.terminal?.command?.join(" ")||undefined}><header className="terminal-toolbar"><button onClick={()=>emulator.current?.clear()}>Clear screen</button><button onClick={()=>{const text=emulator.current?.getSelection();if(text)window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"terminal",text,title:binding.title}}));}}>Attach selection @</button></header>{error&&<p role="alert">{error}</p>}{kernel.transport.kind!=="tauri"?<p>Open the desktop app to use its terminal.</p>:<div ref={host} className="terminal-viewport"/>}<footer className="pane-footer terminal-footer" tabIndex={0} aria-label="Terminal status"><span>{binding.terminal?.command?.length?binding.terminal.command.join(" "):cwd}</span><span>{binding.terminal?.command?.length?(exited?"Login command exited":"Login command"):(exited?"Shell exited":"Local shell")}</span></footer></section>;
}
