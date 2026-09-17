/** Real Expression application + browser controls: no stub transport or
 * substituted renderer. The runner supplies a fresh native kernel. */
export {setup} from './expression-page.mjs';

export default async function run({page,baseUrl,bridgeUrl,check,shot,channel,metric}) {
  const request=async request=>{
    const response=await fetch(`${bridgeUrl}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request})});
    const envelope=await response.json();
    if(!envelope.ok||envelope.outcome?.result!=='expression')throw new Error(JSON.stringify(envelope));
    return envelope.outcome.data;
  };
  await page.goto(baseUrl);await channel('info');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('oi:expression-compose',{detail:{}})));
  const editor=page.getByRole('region',{name:'Expression composition'});
  await editor.getByLabel('Expression title').fill('Sources in relation');
  await editor.getByRole('button',{name:'New Expression',exact:true}).click();
  await editor.getByRole('button',{name:'Add Thing',exact:true}).click();
  await editor.getByRole('button',{name:'Thing 1',exact:true}).click();
  const x=editor.getByLabel('Entity x',{exact:true});await x.waitFor();
  const expressionRef=await editor.getAttribute('data-expression-ref');
  const inspect=async()=>(await request({operation:'inspect',expression_ref:expressionRef})).document;
  let document=await inspect();const entityRef=document.selection.entity_ref;
  check(!!entityRef,'Selecting the entity in the UI retains its real native identity');
  await x.fill('42');await x.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.expression-inspector')?.disabled);
  document=await inspect();
  check(document.entities[entityRef].parameters.x.value===42,'Enter commits a numeric edit through the real owner operation');
  const revision=document.revision;
  await x.fill('');await x.press('Tab');
  await editor.getByText('Enter a finite number for x. The saved value is unchanged.',{exact:true}).waitFor();
  check(await x.getAttribute('aria-invalid')==='true','An empty numeric edit has an accessible explanation');
  check((await inspect()).revision===revision,'Invalid numeric text does not advance the native document');
  await x.focus();await x.press('Escape');
  check(await x.inputValue()==='42'&&await x.getAttribute('aria-invalid')===null,'Escape restores the current owner value and clears the invalid state');
  await x.focus();await x.fill('81');
  const advanced=await request({operation:'edit',expression_ref:expressionRef,expected_revision:revision,actor:'agent:expression-control-walk',changes:[{change:'parameter_set',entity_ref:entityRef,parameter:'x',value:64}]});
  if(advanced.state!=='ready')throw new Error(JSON.stringify(advanced));
  await x.press('Tab');
  await editor.getByRole('button',{name:/Apply Entity x to revision/}).waitFor();
  check(await x.inputValue()==='81'&&(await inspect()).entities[entityRef].parameters.x.value===64,'A concurrent owner revision preserves the human draft without overwriting the new value');
  check(await editor.locator('label button').count()===0,'Recovery actions sit outside input labels and remain distinct keyboard controls');
  await editor.getByRole('button',{name:'Use current Entity x',exact:true}).click();
  check(await x.inputValue()==='64','Use current accepts the owner value after a revision conflict');
  // Restore the draft, advance its basis again, and explicitly apply against
  // the newer revision. This exercises both real conflict recovery choices.
  document=await inspect();await x.focus();await x.fill('96');
  await request({operation:'edit',expression_ref:expressionRef,expected_revision:document.revision,actor:'agent:expression-control-walk',changes:[{change:'parameter_set',entity_ref:entityRef,parameter:'x',value:72}]});
  await x.press('Tab');
  await editor.getByRole('button',{name:/Apply Entity x to revision/}).click();
  await page.waitForFunction(()=>!document.querySelector('.expression-inspector')?.disabled);
  check((await inspect()).entities[entityRef].parameters.x.value===96,'Explicit retry commits the preserved draft against the current native revision');
  const order=await editor.evaluate(el=>{
    const inspector=el.querySelector('.expression-inspector'),pedagogy=el.querySelector('.expression-pedagogy');
    return Boolean(inspector.compareDocumentPosition(pedagogy)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(order,'Selecting an entity discloses its controls before the deeper pedagogical apparatus');
  document=await inspect();
  await request({operation:'edit',expression_ref:expressionRef,expected_revision:document.revision,actor:'human:expression-editor',changes:Array.from({length:8},(_,index)=>({change:'scene_create',scene_ref:`${expressionRef}:scene:inspection-${index}`,title:`Source relationship ${index+1}`}))});
  // Re-open through the app's composition entry so a remote revision is read.
  await page.getByRole('button',{name:'Conversation',exact:true}).click();
  await page.evaluate(expressionRef=>window.dispatchEvent(new CustomEvent('oi:expression-compose',{detail:{expressionRef}})),expressionRef);
  await editor.getByRole('button',{name:'Source relationship 8',exact:true}).waitFor();
  for(const scheme of ['light','dark']){
    await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});
    await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(expected=>(document.body.dataset.theme??'light')===expected,scheme);
    await shot(`expression-${scheme}`);
  }
  for(const width of [1000,760,640,639]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await editor.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,fields:[...el.querySelectorAll('.expression-inspector input')].map(input=>({width:input.getBoundingClientRect().width,right:input.getBoundingClientRect().right,hostRight:el.getBoundingClientRect().right}))}));
    check(geometry.scrollWidth<=geometry.width+1&&geometry.fields.every(field=>field.width>0&&field.right<=field.hostRight+1),`Expression controls fit their actual container at ${width}px`,geometry);
    metric(`editor_width_at_${width}`,geometry.width);
  }
  await shot('expression-narrow');
}
