import type {NativeDomainReading} from './domain';
/** Native-output writing/geometry overlay on the existing stage. Only unit and
 * viewport projection happen here. No independent animation, pose inference,
 * spectral synthesis, glyph table or semantic/source mutation. */
export class NativeDomainView {
  readonly element=document.createElement('section');
  private stamp='';
  constructor(){
    this.element.className='native-domain-output';this.element.hidden=true;
    this.element.setAttribute('aria-label','Native carrier and form reading');
    this.element.innerHTML=`<output data-domain-state></output><svg viewBox="-1.2 -1.2 2.4 2.4" width="76" height="76" role="img" aria-label="Native M1 quadrature and continuous clock"><line data-carrier x1="0" y1="0"/><line data-opposite x1="0" y1="0"/><line data-clock x1="0" y1="0" x2="0" y2="-1"/></svg><strong data-transcription></strong><span data-form-source></span><span data-form-angles></span><span data-physical-form></span><span data-native-clock></span>`;
    Object.assign(this.element.style,{position:'fixed',left:'14px',bottom:'100px',zIndex:'40',maxWidth:'min(320px,45vw)',padding:'8px',background:'var(--paper,#f4f2eb)',color:'var(--ink,#222)',font:'12px/1.4 system-ui',border:'1px solid currentColor',borderRadius:'6px',userSelect:'text'});
    for(const node of this.element.querySelectorAll('line')){node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','.025');}
    this.element.querySelector('[data-clock]')!.setAttribute('stroke-dasharray','.06 .04');
    for(const node of this.element.querySelectorAll('output,strong,span'))(node as HTMLElement).style.display='block';
  }
  update(domain:NativeDomainReading|null,clock:any,status:string,presentedGeneration?:string){
    this.element.hidden=!domain;if(!domain)return;
    const stamp=JSON.stringify([domain,clock,status,presentedGeneration]);if(stamp===this.stamp)return;this.stamp=stamp;
    const set=(selector:string,text:string)=>{this.element.querySelector(selector)!.textContent=text;};
    set('[data-domain-state]',`${status} · native basis ${domain.basis_generation} / presented ${presentedGeneration??'—'}`);
    for(const [selector,pair] of [['[data-carrier]',domain.m1.quadrature],['[data-opposite]',domain.m1.opposite_quadrature]] as const){
      const line=this.element.querySelector(selector)!;line.setAttribute('x2',String(pair[0]));line.setAttribute('y2',String(-pair[1]));
    }
    set('[data-transcription]',`${domain.m3.sequence} · ${domain.m3.rna?'RNA':'DNA'}`);
    set('[data-form-source]',`${domain.m3.codon_ref} · native M3 generation ${domain.m3.generation}`);
    set('[data-form-angles]',`Source form angles: ${domain.m3.angles_deg10.map(a=>a/10).join('°, ')}° (not a physical pose)`);
    const form=domain.m3.physical_form;
    set('[data-physical-form]',form
      ?`Physical form target: ${form.target_kind} · pose ${form.pose_ordinal}/${form.state_count} · ${form.constituent_ref} (${form.standing})`
      :'Physical form actuator unavailable — source angles are not a pose');
    const phase=clock?.inscription,valid=phase&&typeof phase.turns==='string'&&Number.isInteger(phase.half_degrees)&&phase.half_degrees>=0&&phase.half_degrees<720;
    const hand=this.element.querySelector('[data-clock]')!;hand.setAttribute('visibility',valid?'visible':'hidden');
    if(valid){hand.setAttribute('transform',`rotate(${phase.half_degrees/2})`);set('[data-native-clock]',`Continuous inscription: ${phase.turns} turns + ${phase.half_degrees}/2°`);}
    else set('[data-native-clock]','Continuous clock unavailable');
  }
  dispose(){this.element.remove();}
}
