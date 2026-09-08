/** D22: presentation only. Forms emit points; the window host owns one clock.
 * Geometry is in viewport coordinates, read on demand (including native bounds).
 * No operation, session, progress, or notification authority lives here. */
const TAU = Math.PI * 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const formNames = Object.freeze(['idle', 'waiting', 'listening', 'searching', 'presence', 'arrival', 'fire', 'water', 'air', 'earth']);
export const gestureDisposition = Object.freeze({resize: 'edge', open: null, close: null, split: null, move: null, save: null});
export function gestureFor(intent) {
  if (!Object.prototype.hasOwnProperty.call(gestureDisposition,intent)) throw new RangeError(`Unknown expression intent: ${intent}`);
  return gestureDisposition[intent];
}
/** Renderer-neutral, bounded point generation. No particle history or growing arrays. */
export function formPoints(name, time, emit, density = 1) {
  if (!formNames.includes(name)) throw new RangeError(`Unknown expression form: ${name}`);
  const count = Math.round(880 * clamp(density, 0, 2));
  for (let i = 0; i < count; i++) {
    const u = hash(i), v = hash(i + 19), a = u * TAU;
    let x, y, alpha;
    switch (name) {
      case 'fire': {
        const p = (u + time * .15) % 1, r = (1-p)**1.3 * 17;
        const angle = (i % 2) * Math.PI + p * 7.5 + time * (i % 2 ? 1.4 : -1.4);
        x = Math.cos(angle)*r + Math.sin(time*.55)*p*p*14 + Math.sin(p*11+time*2.4+v*6)*p*p*9;
        y = 42-p*94 + Math.sin(angle)*r*.18; alpha = (1-p)*(.16+.3*v); break;
      }
      case 'water': {
        x = (((u+time*.055)%1)-.5)*172; y = (v-.5)*28+Math.sin(x*.07-time)*4;
        for (const sign of [-1,1]) {
          const cx = Math.sin(time*.22+sign)*44, cy = sign*8, dx=x-cx, dy=(y-cy)*1.7;
          const k = Math.max(0,1-Math.hypot(dx,dy)/40), angle=k*k*sign*3;
          x=cx+dx*Math.cos(angle)-dy*Math.sin(angle); y=cy+(dx*Math.sin(angle)+dy*Math.cos(angle))/1.7;
        }
        alpha=Math.max(0,1-Math.abs(x)/92)*(.16+.2*(1-Math.abs(v-.5)*2)); break;
      }
      case 'air': {
        const r=6+v*40, angle=a+time*.28;
        x=Math.cos(angle)*r*1.12; y=Math.sin(angle)*r*.58+Math.sin(angle*3+time)*v*2;
        alpha=(1-Math.exp(-r*r/120))*(.06+.3*(1-v)); break;
      }
      case 'earth': {
        const layer=i%8, xx=(u-.5)*46, zz=(v-.5)*46, yy=(layer/7-.5)*46;
        const angle=.64+Math.sin(time*.1)*.03;
        x=xx*Math.cos(angle)-zz*Math.sin(angle); y=yy*.9+(xx*Math.sin(angle)+zz*Math.cos(angle))*.275;
        alpha=[.3,.1,.25,.08,.28,.14,.22,.1][layer]; break;
      }
      case 'listening': {
        const r=Math.sqrt(v); x=Math.cos(a)*r*44;
        y=Math.sin(a)*r*15+v*14+Math.sin(r*22-time*2.4)*Math.exp(-v*2)*1.4;
        alpha=.08+.3*(1-v); break;
      }
      case 'searching': {
        x=(i%54-26.5)*2.2; y=(Math.floor(i/54)-8)*2.2;
        const band=Math.exp(-((x-((time*.32)%1)*120+60)**2)/160);
        alpha=Math.max(0,1-(x/60)**6-(y/27)**6)*(.1+band*.4); break;
      }
      case 'presence': case 'arrival': {
        x=(u-.5)*100; y=(v-.5)*30;
        alpha=Math.exp(-(x*x/1000+y*y/110))*(name==='arrival' ? .34 : .22+.06*Math.sin(time*.8)); break;
      }
      default:
        x=(u-.5)*152; y=v*12-6+Math.sin(x*.05+time*.3)*Math.sin(time*.5)*1.5;
        alpha=(1-Math.abs(x)/80)*Math.exp(-v*2.6)*.35;
    }
    emit(x, y, alpha);
  }
}

const windows = new WeakMap();
export function createExpressionOverlay(host) {
  const doc=host.ownerDocument, win=doc.defaultView;
  if(host===doc.documentElement)host=doc.body;
  if (windows.has(win)) throw new Error('One expression overlay per window');
  const canvas=doc.createElement('canvas'); canvas.className='oi-expression-overlay'; canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  if (!ctx) throw new Error('Expression requires Canvas 2D');
  host.append(canvas);
  const probe=doc.createElement('span'); probe.className='oi-expression-ink'; probe.setAttribute('aria-hidden','true'); host.append(probe);
  const media=win.matchMedia('(prefers-reduced-motion: reduce)');
  const entries=new Map(); let serial=0, raf=0, expiryTimer=0, last=-Infinity, paused=false, disposed=false, sprite, tokens, dpr=1;
  const metrics={frames:0, requests:0, peakEmitters:0, pointCount:0, ink:''};
  const now=()=>win.performance.now()/1000;
  const allowed=()=>!disposed&&!paused&&!doc.hidden;
  function readTheme() {
    const css=win.getComputedStyle(host);
    const number=(name,fallback)=>{const n=parseFloat(css.getPropertyValue(name));return Number.isFinite(n)?n:fallback;};
    tokens={radius:number('--oi-grain-radius',1),alpha:clamp(number('--oi-grain-alpha-max',.34),0,1),density:clamp(number('--oi-grain-density',1),0,2),duration:clamp(number('--oi-gesture-duration',600)/1000,.05,1.5),reach:number('--oi-gesture-reach',14),tempo:number('--oi-form-tempo',.8),fade:Math.max(.01,number('--oi-expression-crossfade',400)/1000),lease:Math.max(1,number('--oi-expression-lease',30000)/1000)};
    const ink=win.getComputedStyle(probe).color; metrics.ink=ink;
    sprite=doc.createElement('canvas');sprite.width=sprite.height=32;
    const paint=sprite.getContext('2d'), gradient=paint.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,ink);gradient.addColorStop(.45,ink);gradient.addColorStop(1,'transparent');
    paint.fillStyle=gradient;paint.fillRect(0,0,32,32);
  }
  function clear() {ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  function rectOf(value) {
    const r=typeof value==='function'?value():value;
    if (!r) return null;
    const x=r.x??r.left, y=r.y??r.top, width=r.width, height=r.height;
    return [x,y,width,height].every(Number.isFinite)&&width>=0&&height>=0?{x,y,width,height}:null;
  }
  function dot(x,y,alpha) {
    const radius=Math.max(2/dpr,tokens.radius);
    ctx.globalAlpha=clamp(alpha,0,tokens.alpha);
    ctx.drawImage(sprite,x-radius,y-radius,radius*2,radius*2);metrics.pointCount++;
  }
  function expire(time) {
    for(const [id,e]of entries) {
      if(time<e.lease&&(e.hold||time<e.end))continue;
      entries.delete(id);
      const rect=e.then?.rect??e.rect;
      if(e.then&&allowed()&&!media.matches&&rectOf(rect))express(e.then.name,{...e.then,rect});
    }
  }
  // One deadline timer expires storage when no visible field requires rAF.
  // It never draws offscreen frames or polls geometry.
  function armExpiry() {
    win.clearTimeout(expiryTimer);expiryTimer=0;
    if(disposed||!entries.size)return;
    const deadline=Math.min(...[...entries.values()].map(e=>e.hold?e.lease:Math.min(e.end,e.lease)));
    expiryTimer=win.setTimeout(()=>{
      expiryTimer=0;expire(now());armExpiry();
      if(!entries.size){win.cancelAnimationFrame(raf);raf=0;clear();}
      else if(media.matches&&allowed())draw(now());
    },Math.max(1,(deadline-now())*1000+2));
  }
  function draw(time) {
    dpr=win.devicePixelRatio||1;
    const w=Math.round(win.innerWidth*dpr),h=Math.round(win.innerHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    clear(); if(!allowed())return false;
    ctx.setTransform(dpr,0,0,dpr,0,0);metrics.pointCount=0;let visible=false;
    expire(time);
    for(const [id,e] of entries) {
      const r=rectOf(e.rect);
      if(!r){entries.delete(id);continue;}
      if(r.x+r.width<0||r.y+r.height<0||r.x>win.innerWidth||r.y>win.innerHeight)continue;
      visible=true;if(time<e.start)continue;
      if(e.form) {
        const scale=Math.min(r.width/180,r.height/110,1), cx=r.x+r.width/2,cy=r.y+r.height/2;
        const mix=media.matches?1:clamp((time-e.changed)/tokens.fade,0,1);
        const render=(name,weight)=>formPoints(name,media.matches?0:(time-e.start)*tokens.tempo,(x,y,a)=>dot(cx+x*scale,cy+y*scale,a*weight),tokens.density);
        if(e.previous&&mix<1)render(e.previous,1-mix);
        render(e.name,mix);if(mix===1)e.previous=null;
      } else if(!media.matches) {
        const p=e.hold ? .45 :clamp((time-e.start)/tokens.duration,0,1);
        const from=rectOf(e.from), travel=from?[r.x-from.x,r.y-from.y]:null;
        let dir=e.dir??travel??[1,0];
        if(travel&&e.dir&&e.lean) {
          const weight=clamp(e.lean,0,1),length=Math.hypot(...travel)||1;
          dir=[dir[0]*(1-weight)+travel[0]/length*weight,dir[1]*(1-weight)+travel[1]/length*weight];
        }
        const len=Math.hypot(...dir)||1,dx=dir[0]/len,dy=dir[1]/len;
        const vertical=Math.abs(dx)>=Math.abs(dy);
        for(let i=0;i<Math.round(48*tokens.density);i++) {
          const u=hash(i+e.id), k=hash(i+e.id+4), phase=e.hold?(u+time*.35)%1:p;
          const ox=vertical?(dx>=0?r.x+r.width:r.x):r.x+u*r.width;
          const oy=vertical?r.y+u*r.height:(dy>=0?r.y+r.height:r.y);
          const reach=2+k*tokens.reach*phase;
          dot(ox+dx*reach-dy*Math.sin(k*7+phase*4)*phase*2,oy+dy*reach+dx*Math.sin(k*7+phase*4)*phase*2,(1-phase)*.16*(1-k)*Math.min(1,phase*5));
        }
      }
    }
    ctx.globalAlpha=1;armExpiry();return visible;
  }
  function frame(ms) {
    raf=0;if(!allowed()||media.matches)return;
    if(ms-last<1000/30){raf=win.requestAnimationFrame(frame);return;}
    last=ms;metrics.frames++;const visible=draw(ms/1000);
    if(visible&&entries.size)raf=win.requestAnimationFrame(frame);
  }
  function schedule() {if(allowed()&&!media.matches&&!raf&&entries.size)raf=win.requestAnimationFrame(frame);}
  function sync() {
    win.cancelAnimationFrame(raf);raf=0;
    if(!allowed()||media.matches)for(const [id,e]of entries)if(!e.form)entries.delete(id);
    armExpiry();
    if(!allowed()||media.matches)draw(now());else if(entries.size)schedule();else clear();
  }
  function express(name,options={}) {
    const form=formNames.includes(name);
    if(!form&&!['edge','raw','breath'].includes(name))throw new RangeError(`Unknown expression: ${name}`);
    const chain=new Set();let next=options.then;
    while(next){if(chain.has(next)||chain.size>=8||!['edge','raw','breath'].includes(next.name))throw new RangeError('Expression chains must contain at most eight known gestures');chain.add(next);next=next.then;}
    if(disposed||!allowed()||(!form&&media.matches))return null;
    if(!rectOf(options.rect))throw new TypeError('Expression requires finite viewport bounds');
    if(entries.size>=64)return null;
    const t=now(), delay=clamp(Number(options.delay)||0,0,2), id=++serial;
    const e={...options,id,name,form,start:t+delay,changed:t,previous:null,end:t+delay+tokens.duration,lease:t+tokens.lease};
    entries.set(id,e);metrics.requests++;metrics.peakEmitters=Math.max(metrics.peakEmitters,[...entries.values()].filter(e=>!e.form).length);
    armExpiry();
    if(media.matches)draw(t);else schedule();
    return id;
  }
  function update(handle,options) {
    const e=entries.get(handle);if(!e)return false;
    if(options.name&&options.name!==e.name) {
      if(!e.form||!formNames.includes(options.name))throw new RangeError('Only forms can morph');
      e.previous=e.name;e.name=options.name;e.changed=now();
    }
    for(const key of ['rect','from','dir','lean'])if(key in options)e[key]=options[key];
    e.lease=now()+tokens.lease;armExpiry();
    if(media.matches)draw(now());else schedule();return true;
  }
  function release(handle) {
    const e=entries.get(handle);if(!e)return;
    if(e.form){entries.delete(handle);sync();}else{e.hold=false;e.start=now();e.end=e.start+tokens.duration;armExpiry();schedule();}
  }
  const onTheme=()=>{readTheme();sync();};
  const observer=new win.MutationObserver(onTheme);
  for(let ancestor=host;ancestor;ancestor=ancestor.parentElement)observer.observe(ancestor,{attributes:true,attributeFilter:['class','style']});
  doc.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
  win.addEventListener('resize',onTheme);win.addEventListener('scroll',sync,true);
  readTheme();clear();
  const api={canvas,express,update,release,pause(value=true){paused=value;sync();},refresh:onTheme,
    inspect:()=>({...metrics,emitters:[...entries.values()].filter(e=>!e.form).length,forms:[...entries.values()].filter(e=>e.form).map(e=>e.name),scheduled:!!raf,paused,reduced:media.matches,entries:entries.size}),
    dispose(){disposed=true;win.cancelAnimationFrame(raf);win.clearTimeout(expiryTimer);raf=0;expiryTimer=0;entries.clear();observer.disconnect();doc.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);win.removeEventListener('resize',onTheme);win.removeEventListener('scroll',sync,true);canvas.remove();probe.remove();windows.delete(win);}};
  windows.set(win,api);return api;
}
