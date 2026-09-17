/** Semantic cue leases projected into the window's existing native field.
 * No canvas, animation clock, particle generator or retained-field lease. */
import {formNames, type ExpressionOptions, type FormName} from "@epilogos/oi-design-system/expression";
import {MAX_FORMATIONS} from "@epilogos/oi-design-system/expressions-engine/engine/fieldModel.mjs";
import {blankScene, entity} from "@epilogos/oi-design-system/expressions-engine/shell/model.mjs";
import {nativeExport} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import {defaultCamera, stageScale, unproject} from "@epilogos/oi-design-system/expressions-engine/shell/camera.mjs";
import type {EngineSurface} from "./engineSurface";

const PRESENTATION = "oi-semantic-cues";
const GLYPHS: Record<FormName, string> = {idle:"·", waiting:"…", listening:"O", searching:"⌕", presence:"O", arrival:"+", fire:"△", water:"≈", air:"○", earth:"□"};
const STILL = new Set<FormName>(["idle", "waiting", "presence", "earth"]);
type Cue = ExpressionOptions & {id:number;name:string;form:boolean;start:number;end:number;lease:number};

export class NativeCues {
  private entries = new Map<number, Cue>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private disposed = false;
  private signature = "";
  private requests = 0;
  private peakEmitters = 0;
  private readonly win: Window;
  private readonly doc: Document;
  private readonly reduced: MediaQueryList;

  constructor(private surface: EngineSurface, private nextId: () => number, private blocked: () => boolean, private fail: (message:string) => void) {
    this.doc = surface.canvas.ownerDocument;
    this.win = this.doc.defaultView!;
    this.reduced = this.win.matchMedia("(prefers-reduced-motion: reduce)");
    this.win.addEventListener("resize", this.refresh);
    this.win.addEventListener("scroll", this.refresh, true);
    this.doc.addEventListener("visibilitychange", this.refresh);
    this.reduced.addEventListener("change", this.refresh);
  }

  private now() { return this.win.performance.now(); }
  private token(name:string, fallback:number) { const value=parseFloat(this.win.getComputedStyle(this.doc.body).getPropertyValue(name));return Number.isFinite(value)?value:fallback; }
  private rect(value:ExpressionOptions["rect"]) {
    const rect=typeof value==="function"?value():value;
    if(!rect)return null;
    const {x,y,width,height}=rect;
    return [x,y,width,height].every(Number.isFinite)&&width>0&&height>0?{x,y,width,height}:null;
  }
  private arm() {
    clearTimeout(this.timer);this.timer=undefined;
    if(this.disposed||!this.entries.size)return;
    const now=this.now(),deadlines=[...this.entries.values()].flatMap(c=>[c.hold?c.lease:Math.min(c.end,c.lease),...(c.start>now?[c.start]:[])]);
    this.timer=setTimeout(this.refresh,Math.max(1,Math.min(...deadlines)-now+2));
  }
  private expire() {
    const now=this.now();
    for(const [id,cue] of this.entries) {
      if(now<cue.lease&&(cue.hold||now<cue.end))continue;
      this.entries.delete(id);
      if(cue.then&&!this.doc.hidden&&!this.reduced.matches)this.express(cue.then.name,{...cue.then,rect:cue.then.rect??cue.rect});
    }
  }
  express(name:string,options:ExpressionOptions):number|null {
    const form=(formNames as readonly string[]).includes(name);
    if(!form&&!["edge","raw","breath"].includes(name))throw new RangeError(`Unknown expression: ${name}`);
    const chain=new Set<ExpressionOptions>();let next=options.then;
    while(next){if(chain.has(next)||chain.size>=8||!["edge","raw","breath"].includes(next.name))throw new RangeError("Expression chains require at most eight known gestures");chain.add(next);next=next.then;}
    if(this.disposed||this.doc.hidden||(!form&&this.reduced.matches))return null;
    if(!this.rect(options.rect))throw new TypeError("Expression requires finite, nonempty viewport bounds");
    if(this.entries.size>=MAX_FORMATIONS)return null;
    const now=this.now(),id=this.nextId(),delay=Math.max(0,Math.min(2,options.delay??0))*1000;
    this.entries.set(id,{...options,id,name,form,start:now+delay,end:now+delay+this.token("--oi-gesture-duration",600),lease:now+this.token("--oi-expression-lease",30000)});
    this.requests++;this.peakEmitters=Math.max(this.peakEmitters,[...this.entries.values()].filter(c=>!c.form).length);
    this.refresh();return id;
  }
  update(handle:number|null,options:Partial<ExpressionOptions>&{name?:FormName}):boolean {
    if(handle===null)return false;
    const cue=this.entries.get(handle);if(!cue)return false;
    if(options.name){if(!cue.form||!(formNames as readonly string[]).includes(options.name))throw new RangeError("Only known forms can change");cue.name=options.name;}
    for(const key of ["rect","from","dir","lean"] as const)if(key in options)Object.assign(cue,{[key]:options[key]});
    cue.lease=this.now()+this.token("--oi-expression-lease",30000);this.refresh();return true;
  }
  release(handle:number|null) {
    if(handle===null||!this.entries.has(handle))return;
    const cue=this.entries.get(handle)!;
    if(cue.form)this.entries.delete(handle);
    else {cue.hold=false;cue.end=this.now()+this.token("--oi-gesture-duration",600);}
    this.refresh();
  }
  /** Foreground admission preempts only our own field, never its semantic handles. */
  suspend() {
    if(this.active){this.active=false;this.surface.release(PRESENTATION);this.surface.canvas.style.zIndex="";}
    this.signature="";
  }
  refresh = () => {
    if(this.disposed)return;
    if(this.reduced.matches)for(const [id,cue] of this.entries)if(!cue.form)this.entries.delete(id);
    this.expire();this.arm();
    if(this.blocked()||this.doc.hidden){this.suspend();return;}
    const width=this.win.innerWidth,height=this.win.innerHeight,now=this.now();
    const visible=[...this.entries.values()].flatMap(cue=>{
      const rect=this.rect(cue.rect);
      return rect&&cue.start<=now&&rect.x+rect.width>=0&&rect.y+rect.height>=0&&rect.x<width&&rect.y<height?[{cue,rect}]:[];
    });
    if(!visible.length){this.suspend();return;}
    const signature=JSON.stringify({width,height,reduced:this.reduced.matches,items:visible.map(({cue,rect})=>({id:cue.id,name:cue.name,rect}))});
    if(signature===this.signature){this.surface.canvas.style.zIndex="var(--oi-z-stage-overlay)";return;}
    const scene=blankScene("Application cues");scene.id=PRESENTATION;
    scene.field.params.count=4096;scene.field.params.size=1.1;scene.field.params.opacity=.7;
    scene.engine={...(scene.engine as Record<string,unknown>),resonanceEnabled:false,morphEnabled:false,relationalEnabled:false};
    scene.entities=visible.map(({cue,rect})=>{
      const position=unproject(rect.x+rect.width/2,rect.y+rect.height/2,defaultCamera(),width,height);
      const formation=entity(cue.name,cue.form?GLYPHS[cue.name as FormName]:(rect.height>rect.width?"I":"—"),position);
      formation.id=`cue-${cue.id}`;
      const scale=stageScale(width,height);
      formation.size={x:Math.max(.008,rect.width/scale*.8),y:Math.max(.008,rect.height/scale*.8)};
      return formation;
    });
    try {
      this.surface.presentConfig(PRESENTATION,nativeExport(scene).config,PRESENTATION,[],"host");
      this.active=true;this.signature=signature;
      this.surface.setBackdrop("transparent");this.surface.canvas.style.zIndex="var(--oi-z-stage-overlay)";
      this.surface.setForceMotion(false);
      const animated=!this.reduced.matches&&visible.some(({cue})=>!cue.form||!STILL.has(cue.name as FormName));
      this.surface.setPaused(!animated);
      if(!animated) {
        // Static cues have no settling clock. Materialise the new native
        // targets, then place this cue-owned field directly on them. The
        // foreground/reservation gate above excludes every retained field.
        this.surface.command({type:"reset-field"});
        this.surface.renderOnce(PRESENTATION);
      }
    } catch(error) {this.fail(error instanceof Error?error.message:String(error));}
  };
  inspect() {
    const telemetry=this.active?this.surface.telemetry() as {config?:{particleCount?:number};background?:string}|null:null;
    return {frames:this.surface.frameCount,requests:this.requests,peakEmitters:this.peakEmitters,
      pointCount:telemetry?.config?.particleCount??0,ink:this.win.getComputedStyle(this.doc.body).getPropertyValue("--oi-foreground").trim(),
      emitters:[...this.entries.values()].filter(c=>!c.form).length,forms:[...this.entries.values()].filter(c=>c.form).map(c=>c.name),
      scheduled:this.active&&this.surface.isScheduled,paused:this.active&&this.surface.isPaused,reduced:this.reduced.matches,entries:this.entries.size};
  }
  dispose() {
    this.disposed=true;clearTimeout(this.timer);this.entries.clear();this.suspend();
    this.win.removeEventListener("resize",this.refresh);this.win.removeEventListener("scroll",this.refresh,true);this.doc.removeEventListener("visibilitychange",this.refresh);this.reduced.removeEventListener("change",this.refresh);
  }
}
