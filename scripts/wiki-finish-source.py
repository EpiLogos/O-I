"""Finish the reviewed Wiki integration on its sole-writer branch.

Main's agent-root operations are preserved; duplicate declarations caused by
formatting are reconciled explicitly. Any different conflict stops this helper.
No workflow contents are rewritten by the runner's restricted token.
"""
from pathlib import Path
import re
import subprocess
root = Path(__file__).resolve().parents[1]
main = 'bba4b4f7167f0019cc2d45761b24e86c0eb6a88e'
subprocess.run(['git','fetch','origin',main],check=True)
merged = subprocess.run(['git','merge','--no-ff','--no-commit',main])
if merged.returncode:
    conflicts=subprocess.check_output(['git','diff','--name-only','--diff-filter=U']).decode().splitlines()
    if conflicts != ['desktop/cradle/kernel/src/lib.rs']:
        raise RuntimeError(f'Unreviewed conflicts: {conflicts}')
    path=root/conflicts[0]
    text=path.read_text()
    pattern=rf'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> {main}\n'
    blocks=list(re.finditer(pattern,text,re.S))
    if len(blocks)!=3:
        raise RuntimeError('The reviewed three kernel conflicts changed')
    expected=[
        'pub mod graph;\npub mod encounter;\npub mod agency;\npub mod agent_definition;\npub mod being;\n',
        '    AgencyRead { project: String },\n    AgentDefinition { project: Option<String>, request: agent_definition::Request },\n',
        '                let cwd=self.agent_location((!project.is_empty()).then_some(project.as_str()))?;\n                let project_ref=self.agent_project_ref(&project,&cwd)?;\n',
    ]
    if any(block.group(2)!=wanted for block,wanted in zip(blocks,expected)):
        raise RuntimeError('Main side is not the reviewed Agent definition/root-scope change')
    if blocks[0].group(1) or blocks[1].group(1) or 'Project is outside Central' not in blocks[2].group(1):
        raise RuntimeError('Wiki side is not the reviewed equivalent-declaration/child-only branch')
    replacements=['pub mod agent_definition;\n','    AgentDefinition { project: Option<String>, request: agent_definition::Request },\n',expected[2]]
    for block,replacement in reversed(list(zip(blocks,replacements))):
        text=text[:block.start()]+replacement+text[block.end():]
    path.write_text(text)
    subprocess.run(['git','add',conflicts[0]],check=True)

updates={}
def change(path,old,new):
    text=updates.get(path,(root/path).read_text())
    if text.count(old)!=1:
        raise RuntimeError(f'{path}: expected one reviewed source anchor')
    updates[path]=text.replace(old,new,1)
base='desktop/cradle/src/knowledge/'
change(base+'KnowledgeSurface.tsx','import {useCallback,',"import {emphasizeGraph} from './graphEmphasis';\nimport {useCallback,")
change(base+'KnowledgeSurface.tsx','  const filtered=useMemo(', '  const emphasis=useMemo(()=>emphasizeGraph(nodes,filters.emphasis),[nodes,filters.emphasis]);\n  const filtered=useMemo(')
change(base+'KnowledgeSurface.tsx','<GraphCanvas nodes=','<GraphCanvas emphasis={emphasis} nodes=')
change(base+'GraphCanvas.tsx','interface Props {',"interface Props {emphasis?:ReadonlyMap<string,{label:string;color:string}>;")
change(base+'GraphCanvas.tsx','ctx!.fillStyle=selected?accent:ink;ctx!.fill();','ctx!.fillStyle=selected?accent:(p.emphasis?.get(node.ref)?.color??ink);ctx!.fill();')
change(base+'GraphCanvas.tsx','props.contextual,props.labels,props.arrows]','props.contextual,props.labels,props.arrows,props.emphasis]')
change(base+'GraphCanvas.tsx','data-knowledge-ref={node.ref} aria-pressed=','data-knowledge-ref={node.ref} aria-label={props.emphasis?.has(node.ref)?`Open ${node.label} · emphasis ${props.emphasis.get(node.ref)!.label}`:undefined} aria-pressed=')
change(base+'GraphFilters.tsx',"import {useState} from 'react';","import {useState} from 'react';\nimport {GraphViewDetails} from './GraphViewDetails';")
change(base+'GraphFilters.tsx',"filters.context !== 'structure');","filters.context !== 'structure' || filters.collapsed.length);")
change(base+'GraphFilters.tsx','      <div className="knowledge-filter-row"><input aria-label="Saved graph view name"','      <GraphViewDetails reading={reading} filters={filters} onChange={onChange}/>\n      <div className="knowledge-filter-row"><input aria-label="Saved graph view name"')
change(base+'GraphFilters.tsx','onClick={()=>onChange(defaultGraphFilters())}>Clear filters','onClick={()=>onChange({...defaultGraphFilters(),emphasis:filters.emphasis})}>Clear filters')
change(base+'GraphFilters.tsx','    {result.partialFormations.length > 0','''    {!!filters.emphasis?.length&&<div className="knowledge-emphasis-legend" aria-label="Graph emphasis legend">{filters.emphasis.filter(group=>group.enabled).map(group=><span key={group.id}><i style={{backgroundColor:group.color}} aria-hidden="true"/>{group.label}</span>)}</div>}
    {result.collapsedFormations.length>0&&<p className="knowledge-filter-summary">{result.collapsedFormations.length} folded wholes · {result.collapsedSubjects.size} subjects and {result.foldedEdges} incident connections hidden by folding. Membership is unchanged.</p>}
    {result.partialFormations.length > 0''')
change(base+'WikiConstructionPanel.tsx',"if (alive.current && presentation.current === active) setNotice('The live constellation is rendered. Select a body or relation to inspect its native identity.');","if (alive.current && presentation.current === active) {host.current?.scrollIntoView({block:'nearest'}); setNotice('The live constellation is rendered. Select a body or relation to inspect its native identity.');}")
# Test actual production material, and wait for native effects instead of timing.
p='desktop/cradle/tests/wiki-constructive-page.tsx'
change(p,"import '@epilogos/oi-design-system/tokens.css';","import '@epilogos/oi-design-system/tokens.css';\nimport '@epilogos/oi-design-system/desktop.css';\nimport '../src/rest.css';\nimport '../src/cradle.css';")
change(p,'<button onClick={()=>setComposer(undefined)}>Return to Wiki','<button className="oi-action" onClick={()=>setComposer(undefined)}>Return to Wiki')
p='desktop/cradle/tests/wiki-constructive-browser.mjs'
change(p,"import {chromium} from 'playwright';","import {chromium,webkit} from 'playwright';\nconst engineName=process.env.WIKI_BROWSER==='webkit'?'webkit':'chromium';")
change(p,"out=resolve(root,'tests/artifacts/wiki-constructive');","out=resolve(root,'tests/artifacts/wiki-constructive',engineName);")
change(p,"browser=await chromium.launch({headless:true});", "browser=await (engineName==='webkit'?webkit:chromium).launch({headless:true});receipt.browser={name:engineName,version:browser.version()};")
change(p,"receipt={scope:","receipt={scope:") if False else None
change(p," await page.screenshot({path:resolve(out,'live-constellation.png')});", " await drawer.locator('.wiki-construction-stage').scrollIntoViewIfNeeded();\n const stageBounds=await drawer.locator('.wiki-construction-stage').boundingBox();\n check(stageBounds&&stageBounds.width>200&&stageBounds.height>150&&stageBounds.y<960,'The actual live Stage is visible in its working surface');\n await page.screenshot({path:resolve(out,'live-constellation.png')});")
change(p," await page.waitForTimeout(150);\n await composer.getByLabel('Glyph'", " await page.waitForFunction(()=>!document.querySelector('[aria-label=\"Expression composition\"] fieldset:disabled'));\n await composer.getByLabel('Glyph'")
change(p," await page.waitForTimeout(150);\n const edited=", " await page.waitForFunction(()=>!document.querySelector('[aria-label=\"Expression composition\"] fieldset:disabled'));\n const edited=")
# The renderer may persist asynchronously: inspect actual native state with a
# bounded polling predicate instead of assuming completion after 150 ms.
change(p," const edited=await op({op:'expression',request:{operation:'inspect',expression_ref:expressionRef}});", " let edited;const editDeadline=Date.now()+10000;\n do {edited=await op({op:'expression',request:{operation:'inspect',expression_ref:expressionRef}});if(Object.values(edited.data.document.entities).some(entity=>entity.parameters.x?.value===173&&entity.parameters.glyph?.value==='∴'))break;await new Promise(resolve=>setTimeout(resolve,50));}while(Date.now()<editDeadline);")
p='desktop/cradle/tests/wiki-reader-browser.mjs'
change(p,"   await page.getByLabel('Saved graph view name').fill('Opening view');", "   await page.locator('.knowledge-emphasis-controls > summary').click();\n   await page.getByLabel('Emphasis group name').fill('Opening marks');\n   await page.getByRole('button',{name:'Add emphasis group',exact:true}).click();\n   check(await page.getByLabel('Graph emphasis legend').innerText()==='Opening marks',`${name}: named emphasis is visible outside its controls`);\n   await page.getByLabel('Saved graph view name').fill('Opening view');")
change(p,"   check(errors.length===0,", "   check(await page.getByLabel('Graph emphasis legend').innerText()==='Opening marks',`${name}: emphasis restores with the saved view without source writes`);\n   check(errors.length===0,")
for path,text in updates.items():
    (root/path).write_text(text)
    print(path)
