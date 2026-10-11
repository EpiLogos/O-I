import type {Scene} from './editor.ts';
import {NATIVE_BINDINGS, entityTargets, type AutomationTarget, type NativeBinding, getParamDef, entityParamDefs} from './parameters';

export type NativeRackTarget = {kind: 'field'; path: string} | {kind: 'entity'; entity_ref: string; path: string};
export type NativeRackScope = {kind: 'field'} | {kind: 'entity'; entity_ref: string};
export interface NativeRackMapping {id: string; target: NativeRackTarget; min: number; max: number; unit: string; law: 'linear' | 'log'}
export interface NativeRackMacro {id: string; name: string; value: number; mappings: NativeRackMapping[]}
export interface NativeRackVariation {id: string; name: string; values: Record<string, number>; excluded: string[]}
export interface NativeParameterRack {schema: 'oi.parameter-rack/v1'; id: string; title: string; scope: NativeRackScope; macros: NativeRackMacro[]; excluded: string[]; variations: NativeRackVariation[]}
export interface NativeRackState {schema: 'oi.parameter-racks/v1'; racks: NativeParameterRack[]}
export type NativeRackScene = Scene & {parameterRacks?: NativeRackState};
export type NativeRackChange =
  | {kind: 'rack-set'; rack: NativeParameterRack}
  | {kind: 'rack-remove'; rack_id: string}
  | {kind: 'rack-macro-value'; rack_id: string; macro_id: string; value: number}
  | {kind: 'rack-exclusions'; rack_id: string; macro_ids: string[]}
  | {kind: 'rack-variation-capture'; rack_id: string; variation_id: string; name: string}
  | {kind: 'rack-variation-recall'; rack_id: string; variation_id: string}
  | {kind: 'rack-variation-remove'; rack_id: string; variation_id: string};

const ID = /^[a-zA-Z0-9_.:-]{1,160}$/;
function object(value: unknown, allowed: string[], required = allowed): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Rack data must be an object.');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(row, key))) throw Error('Rack data contains missing or unsupported fields.');
  return row;
}
function identity(value: unknown): asserts value is string {if (typeof value !== 'string' || (!ID.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value))) throw Error('Invalid rack identity.');}
function name(value: unknown): asserts value is string {if (typeof value !== 'string' || !value.trim() || value.length > 160) throw Error('Rack names require 1–160 characters.');}
function fraction(value: unknown): asserts value is number {if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw Error('Macro values must be between 0 and 1.');}
function refs(value: unknown, ids: Set<string>): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 16 || new Set(value).size !== value.length || value.some(id => typeof id !== 'string' || !ids.has(id))) throw Error('Rack exclusions must name unique existing macros.');
}
export function rackDiscretePath(path: string) {return ['medium.iterations', 'medium.gridRes', 'particleCount', 'cymatics.modeCount', 'relational.attractorCount', 'toroidalMorph.toroidalWinding', 'toroidalMorph.poloidalWinding'].includes(path);}

/** Native refs are resolved against this exact Scene's occurrence reading.
 * No positional index, label, stale view id or imported fallback definition
 * can silently become a rack target. */
export function resolveNativeRackTarget(scene: Scene, occurrences: Readonly<Record<string, string>>, target: NativeRackTarget): (NativeBinding & {target: string}) | AutomationTarget {
  if (target.kind === 'field') {
    object(target, ['kind', 'path']);
    const binding = NATIVE_BINDINGS.find(value => value.path === target.path);
    if (!binding) throw Error('This Field parameter has no admitted native mapping.');
    return {...binding, target: 'field.' + binding.key};
  }
  object(target, ['kind', 'entity_ref', 'path']);
  if (target.kind !== 'entity' || typeof target.entity_ref !== 'string' || !target.entity_ref || target.entity_ref.length > 1024) throw Error('Invalid native rack target.');
  const ids = Object.keys(occurrences).filter(id => occurrences[id] === target.entity_ref && scene.entities.some(entity => entity.id === id));
  if (ids.length !== 1) throw Error('The mapped native entity is absent or ambiguous in this Scene.');
  const binding = entityTargets(scene).find(value => value.entityId === ids[0] && value.key === target.path);
  if (!binding) throw Error('This entity parameter has no admitted native mapping.');
  return binding;
}

export function validateNativeRackState(value: unknown, scene: Scene, occurrences: Readonly<Record<string, string>>): NativeRackState {
  if (value === undefined) return {schema: 'oi.parameter-racks/v1', racks: []};
  const state = object(value, ['schema', 'racks']);
  if (state.schema !== 'oi.parameter-racks/v1' || !Array.isArray(state.racks) || state.racks.length > 32) throw Error('Invalid native rack collection.');
  const rackIds = new Set<string>();
  for (const raw of state.racks) {
    const rack = object(raw, ['schema', 'id', 'title', 'scope', 'macros', 'excluded', 'variations']);
    identity(rack.id); name(rack.title);
    if (rack.schema !== 'oi.parameter-rack/v1' || rackIds.has(rack.id)) throw Error('Invalid or duplicate native rack.');
    rackIds.add(rack.id);
    const scope = rack.scope as NativeRackScope;
    object(scope, scope?.kind === 'field' ? ['kind'] : ['kind', 'entity_ref']);
    if (scope.kind !== 'field' && scope.kind !== 'entity') throw Error('Invalid native rack scope.');
    if (scope.kind === 'entity' && (typeof scope.entity_ref !== 'string' || !scope.entity_ref.trim() || scope.entity_ref.length > 1024)) throw Error('Invalid native entity scope.');
    if (!Array.isArray(rack.macros) || !rack.macros.length || rack.macros.length > 16 || !Array.isArray(rack.variations) || rack.variations.length > 128) throw Error('Rack macro or variation budget exceeded.');
    const macros = new Set<string>(), mappings = new Set<string>(), targets = new Set<string>();
    for (const rawMacro of rack.macros) {
      const macro = object(rawMacro, ['id', 'name', 'value', 'mappings']);
      identity(macro.id); name(macro.name); fraction(macro.value);
      if (macros.has(macro.id) || !Array.isArray(macro.mappings) || macro.mappings.length > 64) throw Error('Invalid or duplicate rack macro.');
      macros.add(macro.id);
      for (const rawMapping of macro.mappings) {
        const mapping = object(rawMapping, ['id', 'target', 'min', 'max', 'unit', 'law']);
        identity(mapping.id);
        if (mappings.has(mapping.id) || mappings.size >= 256) throw Error('Invalid or duplicate rack mapping.');
        mappings.add(mapping.id);
        const target = mapping.target as NativeRackTarget;
        object(target, target?.kind === 'field' ? ['kind', 'path'] : ['kind', 'entity_ref', 'path']);
        const definition = target.kind === 'field' ? getParamDef(target.path) : target.kind === 'entity' ? entityParamDefs(0, {}).find(value => value.path === 'entities.0.' + target.path) : undefined;
        if (!definition) throw Error('This parameter has no admitted native mapping.');
        if (target.kind === 'entity' && Object.entries(occurrences).some(([id, ref]) => ref === target.entity_ref && scene.entities.some(entity => entity.id === id))) resolveNativeRackTarget(scene, occurrences, target);
        if (scope.kind !== target.kind || scope.kind === 'entity' && (target.kind !== 'entity' || scope.entity_ref !== target.entity_ref)) throw Error('Rack mappings must remain in their explicit Field or entity scope.');
        if (targets.has((target.kind === 'field' ? 'field:' + target.path : 'entity:' + target.entity_ref + ':' + target.path))) throw Error('A rack parameter cannot be driven by two macros.');
        targets.add((target.kind === 'field' ? 'field:' + target.path : 'entity:' + target.entity_ref + ':' + target.path));
        if (mapping.unit !== (definition.unit ?? 'scalar') || !['linear', 'log'].includes(String(mapping.law)) || typeof mapping.min !== 'number' || typeof mapping.max !== 'number' || ![mapping.min, mapping.max].every(v => Number.isFinite(v) && v >= definition.hardMin && v <= definition.hardMax)) throw Error('Rack mapping range exceeds the native parameter bounds.');
        if (mapping.law === 'log' && (mapping.min <= 0 || mapping.max <= 0)) throw Error('Logarithmic mapping requires positive endpoints.');
        if (rackDiscretePath(target.path) && (!Number.isInteger(mapping.min) || !Number.isInteger(mapping.max))) throw Error('Discrete native mappings require integer endpoints.');
      }
    }
    refs(rack.excluded, macros);
    const variations = new Set<string>();
    for (const rawVariation of rack.variations) {
      const variation = object(rawVariation, ['id', 'name', 'values', 'excluded']);
      identity(variation.id); name(variation.name);
      if (variations.has(variation.id)) throw Error('Duplicate rack variation.');
      variations.add(variation.id);
      const values = object(variation.values, [...macros]);
      for (const value of Object.values(values)) fraction(value);
      refs(variation.excluded, macros);
    }
  }
  return structuredClone(value) as NativeRackState;
}

export function nativeRackMappingValue(mapping: NativeRackMapping, fractionValue: number): number {
  fraction(fractionValue);
  const value = fractionValue === 0 ? mapping.min : fractionValue === 1 ? mapping.max : mapping.law === 'log' ? Math.exp(Math.log(mapping.min) + fractionValue * (Math.log(mapping.max) - Math.log(mapping.min))) : mapping.min + fractionValue * (mapping.max - mapping.min);
  if (!Number.isFinite(value)) throw Error('Rack mapping produced a non-finite value.');
  return value;
}
