import {validateReading,type TechneReading,type TechneSourceProvenance} from '../../../../desktop/cradle/src/techne/contract';
import {facetRange,domainOfSpans,type FacetSpan} from '../../../../desktop/cradle/src/techne/m0m5/timeline/scale';
import {precisionMarker} from '../../../../desktop/cradle/src/techne/m0m5/place/project';

export interface ResearchFacet {
 ref:string|null;kind:'time'|'place';label:string;precision:string;
 uncertainty:string|null;sourceRef:string|null;provenance:readonly TechneSourceProvenance[];
 span?:FacetSpan;marker?:ReturnType<typeof precisionMarker>;
}
/** An aperture over the native reading. Anonymous continuity receives no ref. */
export function researchOverview(raw:unknown){
 const validation=validateReading(raw);
 if(!validation.valid)throw Error(`Invalid native research reading: ${validation.errors.join('; ')}`);
 const reading=raw as TechneReading;
 const provenance=(ref:string|null,sourceRef:string|null)=>(reading.provenance??[]).filter(row=>row.source_ref===sourceRef||ref!==null&&row.selector?.unit==='other'&&row.selector.value===ref);
 const temporal:ResearchFacet[]=(reading.temporal??[]).map(facet=>({
  ref:facet.facet_ref??null,kind:'time',label:facet.instant??(facet.interval?`${facet.interval.from??'open'} — ${facet.interval.to??'open'}`:facet.day_ref??facet.now_ref??facet.session_ref??facet.run_ref??'Unpositioned continuity'),
  precision:facet.precision??(facet.interval?`${facet.interval.from_precision??'not disclosed'} / ${facet.interval.to_precision??'not disclosed'}`:'not disclosed'),uncertainty:facet.uncertainty??null,sourceRef:facet.source_ref??null,
  provenance:provenance(facet.facet_ref??null,facet.source_ref??null),span:facetRange(facet),
 }));
 const spatial:ResearchFacet[]=(reading.spatial??[]).map(facet=>({
  ref:facet.place_ref,kind:'place',label:facet.identity?.names?.[0]?.name??facet.place_ref,precision:facet.precision,uncertainty:facet.uncertainty??null,sourceRef:facet.source_ref??null,
  provenance:provenance(facet.place_ref,facet.source_ref??null),marker:precisionMarker(facet.precision),
 }));
 return {reading,temporal,spatial,domain:domainOfSpans(temporal.map(facet=>facet.span!))};
}
export function temporalBand(span:FacetSpan,domain:{fromMs:number;toMs:number},width:number){
 if(!Number.isFinite(width)||width<=0)throw Error('A time overview requires a positive finite width.');
 if(!span.positioned)return null;
 const duration=domain.toMs-domain.fromMs;
 const x=(value:number)=>duration===0?width/2:Math.max(0,Math.min(width,(value-domain.fromMs)/duration*width));
 const from=x(span.fromMs??domain.fromMs),to=x(span.toMs??domain.toMs);
 return {x:Math.min(from,to),width:Math.abs(to-from),openFrom:span.fromMs===null,openTo:span.toMs===null};
}
