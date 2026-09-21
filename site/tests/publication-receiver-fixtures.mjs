/** Large native input generated ONLY for executable browser contract tests. */
import { fileURLToPath } from 'node:url';
import { producerFixtures, SUBJECT, COLLECTION } from './publication-fixtures.mjs';
import { compilePublications } from '../build-publications.mjs';
export function largePublication(count=1875) {
 const inputs=producerFixtures(),world=inputs[0];
 const bindings=world.projection.representation.payload.regions[0].bindings;
 const reading=bindings.find(b=>b.subject_ref===SUBJECT);
 const entry=world.entries.find(e=>e.ref===SUBJECT);
 for(let i=0;i<count;i++) {
  const ref=`world:fixture/wiki:node-${String(i).padStart(4,'0')}`,label=`Record ${String(i).padStart(4,'0')}`;
  bindings.push({...structuredClone(reading),binding_ref:`member-${i}`,subject_ref:ref,props:{title:label,text:`Test-only native reading for ${label}.\n\nThis generated fixture never enters the deployable publication.`}});
  world.entries.push({...structuredClone(entry),ref,label});
  world.relations.push({...structuredClone(world.relations[0]),from:COLLECTION,to:ref});
 }
 const {seed,editions}=compilePublications(inputs);
 return {seed,manifests:editions.map(e=>e.manifest),editions};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(largePublication()));
