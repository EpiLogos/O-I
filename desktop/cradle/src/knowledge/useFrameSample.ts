import {useEffect,type RefObject} from 'react';
/** Development-only local frame observation. No telemetry or agent channel. */
export function useFrameSample(ref:RefObject<HTMLElement>) {
  useEffect(()=>{
    if(!(import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV||!ref.current)return;
    let frame=0,active=false;
    const sample=()=>{if(active)return;active=true;const intervals:number[]=[];let start=0,previous=0;const tick=(time:number)=>{if(!start)start=time;if(previous)intervals.push(time-previous);previous=time;if(time-start<1500){frame=requestAnimationFrame(tick);return;}active=false;intervals.sort((a,b)=>a-b);console.info('C4 graph frame sample',JSON.stringify({frames:intervals.length,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],over33ms:intervals.filter(t=>t>33).length}));};frame=requestAnimationFrame(tick);};
    const el=ref.current;el.addEventListener('pointerdown',sample);return()=>{el.removeEventListener('pointerdown',sample);cancelAnimationFrame(frame);};
  },[ref]);
}
