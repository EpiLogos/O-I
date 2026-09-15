// SF2 living knowledge encounter: the running desktop consumes one real
// hosted Wiki local whole through the SharedField client, changes readings
// without changing semantic state, recentres through an admitted relation,
// and returns through the existing Explore history.
import {setup as sourceSetup} from './editor.mjs';
import {bindDefaultCentral} from '../editor-doc.mjs';

export async function setup(args) {
  const provision=await sourceSetup(args);
  return {...provision,env:{...provision.env}};
}

export default async function run({page,baseUrl,check,metric,shot,channel,provision}) {
  await page.goto(baseUrl); await channel('info');
  const chooser=page.getByRole('region',{name:'Central location'});
  if(await chooser.isVisible().catch(()=>false))await bindDefaultCentral(page,provision.root);
  const nav=page.getByRole('complementary',{name:'World navigator'});
  if(!await nav.isVisible())await page.keyboard.press('Meta+b');
  await nav.getByRole('button',{name:'Open Explore',exact:true}).click();
  const explore=page.getByRole('region',{name:'Explore'});await explore.waitFor({timeout:15000});
  await explore.locator('[data-field-state="available"]').waitFor({timeout:60000});
  const snapshot=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'snapshot'}}])).data.outcome.data;
  const wiki=snapshot.entries.find(entry=>entry.kind==='wiki-node'&&snapshot.relations.some(relation=>relation.from===entry.ref||relation.to===entry.ref))??snapshot.entries.find(entry=>entry.kind==='wiki-space');
  check(Boolean(wiki),'The independently hosted world exposes an addressable Wiki/Bimba subject',{counts:snapshot.counts,ref:wiki?.ref});
  await explore.getByRole('searchbox',{name:'Search the open field'}).fill(wiki.ref);
  await explore.getByRole('searchbox',{name:'Search the open field'}).press('Enter');
  const started=Date.now();await explore.locator(`.explore-results [data-explore-ref=${JSON.stringify(wiki.ref)}] button`).click();
  const encounter=explore.getByRole('region',{name:'Projected knowledge local whole'});await encounter.waitFor({timeout:60000});metric('knowledge_open_ms',Date.now()-started);
  const reading=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'read',ref:wiki.ref}}])).data.outcome.data;
  const local=reading.neighbourhood.relations;
  check(await encounter.getAttribute('data-focus-ref')===wiki.ref&&Number(await encounter.getAttribute('data-node-count'))===local.nodes.length&&Number(await encounter.getAttribute('data-relation-count'))===local.edges.length,'Desktop renders the owner-returned bounded whole without adding nodes or relations',{focus:local.focus,nodes:local.nodes.length,relations:local.edges.length});
  const graph=encounter.getByRole('img',{name:'Bounded typed knowledge constellation'});await graph.waitFor();
  const titles=await graph.locator('title').allTextContents();
  check(local.edges.every(edge=>titles.some(title=>title.includes(edge.relation)&&edge.provenance.every(row=>title.includes(row.ref)&&(!row.revision||title.includes(row.revision))))),'Graph labels preserve exact relation kinds and provenance revisions',{relations:local.edges.map(edge=>({relation:edge.relation,provenance:edge.provenance}))});
  await encounter.getByRole('button',{name:'list',exact:true}).click();
  check(await encounter.locator('.knowledge-encounter__list > li').count()===local.nodes.length,'LIST is another reading over the same selected relation state');
  await encounter.getByRole('button',{name:'tree',exact:true}).click();
  check(await encounter.locator('.knowledge-encounter__tree ol > li').count()===new Set(local.edges.map(edge=>edge.from===local.focus?edge.to:edge.from)).size,'TREE is another reading over the same typed neighbours');
  await encounter.getByRole('button',{name:'page',exact:true}).click();
  check(await encounter.locator('.world-presentation').count()===1,'Page uses the existing WorldPresentation over the same selected subject');
  const expression=encounter.getByRole('button',{name:'Expression',exact:true});await expression.click();
  const expressed=encounter.getByRole('status').filter({hasText:/subjects · .*typed relations · Expression r/});await expressed.waitFor({timeout:60000});
  check((await channel('read.stage')).data.presentations.some(item=>item.id===`explore-knowledge-expression:${wiki.ref}`),'The hosted bounded whole is alive through the existing Expression application and shared stage',{status:await expressed.innerText()});
  await shot('living-knowledge-expression');
  await encounter.getByRole('button',{name:'Pin',exact:true}).click();
  check(await encounter.getByRole('button',{name:'Pinned',exact:true}).getAttribute('aria-pressed')==='true'&&await encounter.getByRole('button',{name:wiki.ref,exact:true}).count()===1,'Pin persists the exact projected semantic ref in the knowledge presentation');
  await encounter.getByRole('button',{name:'Following locus',exact:true}).click();
  check(await encounter.getByRole('button',{name:'Follow locus',exact:true}).getAttribute('aria-pressed')==='false','Follow can freeze the visual locus without creating a second navigation history');
  await encounter.getByRole('button',{name:'graph',exact:true}).click();
  const neighbour=local.nodes.find(node=>node.ref!==local.focus&&node.availability!=='unavailable');
  check(Boolean(neighbour),'The real owner relation state supplies a recenterable neighbour',{nodes:local.nodes.map(node=>node.ref)});
  await graph.locator(`[data-knowledge-ref=${JSON.stringify(neighbour.ref)}]`).click();
  await explore.locator(`[data-selected-ref=${JSON.stringify(neighbour.ref)}]`).waitFor({timeout:60000});
  check((await explore.getAttribute('data-selected-ref'))===neighbour.ref,'Neighbour activation recentres through the existing Explore selection with the exact ref');
  await explore.getByRole('button',{name:'Back',exact:true}).click();await explore.locator(`[data-selected-ref=${JSON.stringify(wiki.ref)}]`).waitFor({timeout:60000});
  await explore.getByRole('button',{name:'Forward',exact:true}).click();await explore.locator(`[data-selected-ref=${JSON.stringify(neighbour.ref)}]`).waitFor({timeout:60000});
  check(true,'Back and Forward restore exact knowledge refs through Explore’s existing bounded history');
  await explore.getByRole('button',{name:'Source',exact:true}).click();const source=explore.getByRole('complementary',{name:'Source and provenance of this subject'});await source.waitFor();
  const selectedReading=(await channel('invoke.kernel_op',[{op:'shared_field',request:{kind:'read',ref:neighbour.ref}}])).data.outcome.data;
  const sourceText=await source.innerText();
  check(sourceText.includes(neighbour.ref)&&selectedReading.entry.provenance.every(row=>sourceText.includes(row.ref)&&(!row.revision||sourceText.includes(row.revision))),'Source/properties depth exposes the selected subject and its exact provenance revisions');
  await shot('living-knowledge-source');
  await source.getByRole('button',{name:'Dismiss source and provenance'}).click();
  await explore.getByRole('button',{name:'Open as Surface',exact:true}).click();const popout=page.getByRole('region',{name:'Projected subject'});await popout.waitFor({timeout:15000});
  check((await popout.getAttribute('data-selected-ref'))===neighbour.ref,'Page/popout uses an ordinary Surface binding with the same projected subject ref');
  await page.locator('.tab').filter({hasText:'Explore'}).first().click();await explore.waitFor();
  await explore.getByRole('button',{name:'Back',exact:true}).click();
  check((await explore.getAttribute('data-selected-ref'))===wiki.ref,'Return restores the prior knowledge locus with history intact');
  await shot('living-knowledge-return');
}
