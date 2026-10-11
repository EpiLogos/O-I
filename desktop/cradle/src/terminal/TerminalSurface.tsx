import {useEffect,useRef,useState} from "react";
import {Terminal} from "@xterm/xterm";
import {FitAddon} from "@xterm/addon-fit";
import {SerializeAddon} from "@xterm/addon-serialize";
import {invoke} from "@tauri-apps/api/core";
import {registerDocumentCheckpoint} from "../document/frame";
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
 const kernel=useKernel();const host=useRef<HTMLDivElement>(null);const emulator=useRef<Terminal>();const [error,setError]=useState<string>();const [cwd,setCwd]=useState(binding.terminal?.cwd??"");const [exited,setExited]=useState(false);const [archived,setArchived]=useState(false);const [cwdStanding,setCwdStanding]=useState<string>();
 useEffect(()=>{
  if(kernel.transport.kind!=="tauri"||!kernel.snapshot.surfaces[binding.id])return;
  const term=new Terminal({fontSize:12,fontFamily:token("--oi-font-mono"),cursorBlink:true,scrollback:5000,screenReaderMode:true,disableStdin:true,theme:terminalTheme()});
  const fit=new FitAddon();const serial=new SerializeAddon();term.loadAddon(fit);term.loadAddon(serial);term.open(host.current!);fit.fit();emulator.current=term;
  let disposed=false,paused=false,durable=false,lease=0,seq=0,timer=0,lastCheckpoint=0,writing=Promise.resolve(),pollFlight=Promise.resolve();
  let attachmentFailure:unknown;
  const checkpoint=(persist=false)=>lease?invoke<void>("terminal_checkpoint",{id:binding.id,lease,seq,snapshot:serial.serialize(),persist}):Promise.reject(Error("Native terminal attachment is unavailable; keep this view open"));
  const write=(content:string|Uint8Array)=>{writing=new Promise<void>(resolve=>term.write(content,resolve));return writing;};
  const schedule=(delay:number)=>{if(!disposed&&!paused)timer=window.setTimeout(()=>{pollFlight=poll();},delay);};
  const resize=()=>{if(disposed||!host.current?.getClientRects().length)return;fit.fit();if(lease)void invoke("terminal_resize",{id:binding.id,lease,dimensions:{cols:term.cols,rows:term.rows}}).catch(reason=>setError(String(reason)));};
  const observer=new ResizeObserver(resize);observer.observe(host.current!);
  const themeObserver=new MutationObserver(()=>{if(!disposed)term.options.theme=terminalTheme();});themeObserver.observe(document.body,{attributes:true,attributeFilter:["data-theme","data-oi-theme"]});
  let input=Promise.resolve();const data=term.onData(data=>{input=input.then(()=>invoke<void>("terminal_input",{id:binding.id,lease,data})).catch(reason=>setError(String(reason)));});
  const poll=async()=>{
   if(disposed||paused)return;
   try{const out=await invoke<{seq:number;bytes:number[];eof:boolean}>("terminal_poll",{id:binding.id,lease,seq});
    if(disposed)return;
    if(out.bytes.length){await write(new Uint8Array(out.bytes));seq=out.seq;}
    if(Date.now()-lastCheckpoint>250&&out.bytes.length){await checkpoint();lastCheckpoint=Date.now();}
    setExited(out.eof);schedule(out.bytes.length?0:40);
   }catch(reason){if(!disposed)setError(String(reason));}
  };
  const attachment=invoke<{lease:number;seq:number;snapshot:string;cwd:string;durable?:boolean;cwd_standing?:string;archived?:{screen:string;tails:Array<{bytes:number[]}>;cwd_standing:string}} >("terminal_attach",{id:binding.id,cwd:binding.terminal?.cwd??null,command:binding.terminal?.command??null,dimensions:{cols:term.cols,rows:term.rows}}).then(async attached=>{
   lease=attached.lease;seq=attached.seq;durable=attached.durable===true;setCwd(attached.cwd);setCwdStanding(attached.cwd_standing);
   if(attached.archived){
    setArchived(true);if(attached.archived.screen)await write(attached.archived.screen);
    for(const tail of attached.archived.tails)if(tail.bytes.length)await write(new Uint8Array(tail.bytes));
    await write("\r\n[Archived terminal reading; a new native process starts below.]\r\n");
   }else{setArchived(false);}
   if(attached.snapshot)await write(attached.snapshot);
   if(!disposed){term.options.disableStdin=false;resize();if(host.current?.closest(".pane.group.focused")||!host.current?.closest(".pane.group"))term.focus();schedule(0);window.dispatchEvent(new Event("oi:terminal-attached"));}
  }).catch(reason=>{attachmentFailure=reason;if(!disposed)setError(String(reason));});
  const unregister=registerDocumentCheckpoint(binding.id,async()=>{
   if(disposed)throw Error("Terminal view retired before its screen was secured");
   paused=true;clearTimeout(timer);term.options.disableStdin=true;
   try{
    await attachment;
    // No local screen was admitted when the attachment itself failed before
    // issuing a lease. The native all-Terminals barrier independently secures
    // any actual created PTY whose attachment reply could not be delivered.
    if(attachmentFailure){if(!lease)return;throw attachmentFailure;}
    await input;await pollFlight;await writing;
    if(disposed)throw Error("Terminal view retired while securing its screen");
    await checkpoint(durable);
   }catch(reason){if(!disposed)setError(String(reason));throw reason;}
   finally{paused=false;if(!disposed){term.options.disableStdin=false;schedule(0);}}
  });
  return()=>{unregister();disposed=true;clearTimeout(timer);observer.disconnect();themeObserver.disconnect();data.dispose();void attachment.then(()=>pollFlight).then(()=>input).then(()=>writing).then(()=>checkpoint(durable)).catch(()=>{}).finally(()=>term.dispose());emulator.current=undefined;};
 },[binding.id,kernel.transport.kind,!!kernel.snapshot.surfaces[binding.id]]);
 return <section className="terminal-surface" aria-label="Terminal surface" data-terminal-command={binding.terminal?.command?.join(" ")||undefined}><header className="terminal-toolbar"><button onClick={()=>emulator.current?.clear()}>Clear screen</button><button onClick={()=>{const text=emulator.current?.getSelection();if(text)window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"terminal",text,title:binding.title}}));}}>Attach selection @</button></header>{error&&<p role="alert">{error}</p>}{kernel.transport.kind!=="tauri"?<p>Open the desktop app to use its terminal.</p>:<div ref={host} className="terminal-viewport"/>}<footer className="pane-footer terminal-footer" tabIndex={0} aria-label="Terminal status"><span title={cwdStanding==="launch-directory"?"Launch directory; current process cwd has not been observed":cwdStanding==="last-observed-process-cwd"?"Last observed process directory":"Native terminal directory"}>{binding.terminal?.command?.length?binding.terminal.command.join(" "):cwd}</span>{archived&&<span>Archived reading · new process</span>}<span>{binding.terminal?.command?.length?(exited?"Login command exited":"Login command"):(exited?"Shell exited":"Local shell")}</span></footer></section>;
}
