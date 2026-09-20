/** TEST FIXTURES ONLY. Never imported by a production entry point or build. */
import { createWorldPresentation } from '../../shared-field/presentation.mjs';
import { createWorldPresentationProjection } from '../../shared-field/presentation-projection.mjs';
import { createExploreEntry } from '../../shared-field/explore.mjs';
import { projectExpression } from '../../shared-field/expression-projection.mjs';
import { compilePublications } from '../build-publications.mjs';
import { fileURLToPath } from 'node:url';
export const SUBJECT='world:fixture/wiki:subject',COLLECTION='world:fixture/wiki:collection';
const provenance=[{kind:'fixture-source',ref:'source:fixture',source_system:'test',revision:'fixture-r1'}];
export function producerFixtures() {
 const presentation=createWorldPresentation({schema:'oi.world-presentation/v1',presentation_ref:'presentation:fixture',world_ref:'world:fixture',revision:1,title:'Test-only publication',theme:{tokens:{}},provenance,regions:[{region_ref:'reading',role:'reading',bindings:[
  {schema:'oi.presentation-binding/v1',binding_ref:'collection',component_ref:'oi.presentation/wiki-reading/v1',portable_renderer:'oi.presentation/wiki-reading/v1',subject_ref:COLLECTION,props:{title:'Fixture collection',text:'A test-only native collection.',refs:[SUBJECT]},fallback:{title:'Fixture collection'},provenance},
  {schema:'oi.presentation-binding/v1',binding_ref:'subject',component_ref:'oi.presentation/lede/v1',portable_renderer:'oi.presentation/lede/v1',subject_ref:SUBJECT,props:{title:'Fixture subject',text:Array.from({length:36},(_,i)=>`Fixture paragraph ${i+1}. This is explicitly synthetic material used only to test native publication, reading position, keyboard navigation and returning to the same subject. It is not published O:I corpus content.`).join('\n\n')},fallback:{title:'Fixture subject'},provenance}
 ]}]});
 const projection=createWorldPresentationProjection({presentation,projection:{projection_ref:'projection:fixture:source',projection_revision:3,state:'published',subject:{kind:'world',ref:'world:fixture'},source:{system:'test',ref:'source:fixture',revision:'fixture-r1'},publisher_participant_ref:'participant:fixture',published_at:'2026-09-19T00:00:00.000Z',audience:{visibility:'public'},provenance}});
 const entries=[['world:fixture','world','Test-only publication'],[COLLECTION,'wiki-space','Fixture collection'],[SUBJECT,'wiki-node','Fixture subject']].map(([ref,kind,label])=>createExploreEntry({ref,kind,world_ref:'world:fixture',label,summary:'UNSELECTED_ROW_SENTINEL',revision:'fixture-r1',provenance,meta:{private_notes:'PRIVATE_METADATA_SENTINEL'}}));
 const world={schema:'oi.world-publication/v1',world_ref:'world:fixture',field:{field_ref:'field:fixture',kind:'explore',visibility:'public',title:'PRIVATE_FIELD_TITLE_SENTINEL'},projection,presentation,entries,relations:[{from:COLLECTION,to:SUBJECT,relation:'wiki.contains',origin:'wiki',provenance}],readings:{private:'PRIVATE_WRAPPER_SENTINEL'}};
 const expression_ref='expression:fixture:subject',scene_ref=expression_ref+':scene:reading',entity_ref=expression_ref+':entity:subject';
 const document={schema:'oi.expression/v1',expression_ref,revision:2,title:'Fixture subject Expression',scenes:[{scene_ref,revision:1,title:'Fixture reading Scene',entity_refs:[entity_ref]}],entities:{[entity_ref]:{entity_ref,revision:1,title:'Fixture subject',subject:{subject_ref:SUBJECT,native_owner:'test',presentation_role:'thing',sources:[{ref:'source:fixture',revision:'fixture-r1',availability:'available'}],readings:[],actions:[]},parameters:{glyph:{value:'O',automation:null},x:{value:0,automation:null},y:{value:0,automation:null},z:{value:0,automation:null},scale:{value:1,automation:null},share:{value:1,automation:null}}}},relations:{},selection:{scene_ref,entity_ref:null},provenance:[],representations:[]};
 const expression=projectExpression({document,world_ref:'world:fixture',field_ref:'field:fixture-expression',projection_ref:'projection:fixture:expression',projection_revision:4,audience:{visibility:'public'},publisher:{participant_ref:'participant:fixture',identity_ref:'human:fixture'},published_at:'2026-09-19T00:00:00.000Z'});
 return [world,expression];
}
export function browserFixture() {const {seed,editions}=compilePublications(producerFixtures());return {seed,manifests:editions.map(e=>e.manifest),editions};}
if(process.argv[1]===fileURLToPath(import.meta.url)) console.log(JSON.stringify(browserFixture()));
