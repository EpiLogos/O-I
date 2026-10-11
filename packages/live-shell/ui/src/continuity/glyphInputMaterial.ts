import type {Entity,NativeEditorChange,NativeEditorReading,SequenceStep} from '@epilogos/expressions-boundary/editor'
import type {NativeInputMaterial} from './nativeInputs'
import {WORLD_SCALE} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters'

/** Retain the original native edit, including compound state/layer values.
 * This is an input adapter; no native mutation or alternate evaluator lives
 * here. Invalid unfinished text remains recoverable without a made-up value. */
export function glyphInputMaterial(reading:NativeEditorReading,entity:Entity,step:SequenceStep,label:string,identity:string,text:string,initial:string):NativeInputMaterial {
  const basis={...reading.basis},field=label==='Field custom font stack'||label==='Manual blend · cycles'||label==='Field dwell · ratio'
  const target={scope:field?'field' as const:'entity' as const,entity_id:field?null:entity.id,entity_ref:field?null:reading.entityOccurrences[entity.id]??null,
    step_id:field?null:step.id,parameter:null,family:`glyph:${identity}`,axis:null}
  let changes:NativeEditorChange[]=[]
  const numeric=text.trim()!==''&&Number.isFinite(Number(text)),value=Number(text)
  const sequence:Record<string,string>={'Rate':'rateMul','Phase · cycles':'phaseOffset','Impulse':'impulse','Jitter':'jitter'}
  if(sequence[label]&&numeric)changes=[{kind:'sequence-settings',entity_id:entity.id,step_id:step.id,values:{[sequence[label]]:value}}]
  else if(numeric&&(label==='Hold · s'||label==='Transition · s'))changes=[{kind:'step-timing',entity_id:entity.id,step_id:step.id,[label==='Hold · s'?'hold':'transition']:value}]
  else if(numeric&&(label==='Manual blend · cycles'||label==='Field dwell · ratio'))changes=[{kind:'parameter',target:label==='Manual blend · cycles'?'field.thetaOffset':'field.morphDwell',value}]
  else if(numeric&&/^Offset [XYZ]$/.test(label))changes=[{kind:'step-position',entity_id:entity.id,step_id:step.id,position:{x:step.position?.x??0,y:step.position?.y??0,z:step.position?.z??0,[label.slice(-1).toLowerCase()]:value}}]
  else if(label==='Field custom font stack')changes=[{kind:'field-font',values:{fontFamily:text}}]
  else if(label==='ASCII drawing'&&step.source?.kind==='ascii')changes=[{kind:'step-source',entity_id:entity.id,step_id:step.id,shape:step.shape,source:{kind:'ascii',ascii:{...step.source.ascii,text}}}]
  else if(step.objectState) {
    const state=structuredClone(step.objectState)
    let supported=true
    if(label==='State tint')state.tint=text
    else if(!numeric)supported=false
    else if(label==='Width')state.size.x=value
    else if(label==='Height')state.size.y=value
    else if(label==='Rotation · °')state.rotation=value
    else if(label==='Scale')state.scale=value
    else if(label==='Tint weight')state.tintWeight=value
    else if(label==='State radius · px')state.force.radius=value/WORLD_SCALE
    else if(label==='State force')state.force.strength=value
    else if(label==='State spin')state.force.spin=value
    else supported=false
    if(supported)changes=[{kind:'step-overrides',entity_id:entity.id,step_id:step.id,operation:'capture',values:state}]
  }
  const layers=structuredClone(step.layers??entity.layers??[])
  const layer=layers.find(row=>identity===`${row.id}:depth`||identity===`${row.id}:scale`||label===`Layer ${row.id} text`||label===`Layer ${row.id} ASCII drawing`)
  if(layer) {
    if(label==='Depth'&&numeric)layer.z=value
    else if(label==='Layer scale'&&numeric)layer.scale=value
    else if(label===`Layer ${layer.id} text`)layer.text=text
    else if(label===`Layer ${layer.id} ASCII drawing`&&layer.source?.kind==='ascii')layer.source={kind:'ascii',ascii:{...layer.source.ascii,text}}
    else return {basis,target,input:{kind:'text',text,initial}}
    changes=[{kind:'step-layers',entity_id:entity.id,step_id:step.id,layers}]
  }
  if(!changes.length)return {basis,target,input:{kind:'text',text,initial}}
  return {basis,target,input:{kind:'gesture',gesture:{editor:'glyph',label,identity,text,initial},changes:JSON.parse(JSON.stringify(changes))}}
}
