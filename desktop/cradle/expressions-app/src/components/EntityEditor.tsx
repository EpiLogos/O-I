/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, MapPin, MapPinOff } from 'lucide-react';
import {
  Entity,
  Shape,
  ShapeKind,
  SequenceLink,
  EntitySequence,
  EntityForceMode,
  SequenceAdvance,
  SequenceOrder,
  makeLink,
  newId,
} from '../engine/fieldModel';
import { ChainEasing, CompositionTelemetry } from '../engine/types';
import { CANONICAL_CHAKRAS } from '../engine/chakraSystem';
import { CHAIN_PRESETS } from '../engine/glyphLibrary';
import { ParamRow } from './ParamRow';
import { GlyphPicker } from './GlyphPicker';

interface EntityEditorProps {
  entity: Entity;
  onUpdate: (patch: Partial<Entity>) => void;
  telemetry: CompositionTelemetry | null;
  isLight: boolean;
}

const shapeLabel = (s: Shape): string => {
  if (s.kind === 'glyph') return s.text || '·';
  if (s.kind === 'yantra') return CANONICAL_CHAKRAS.find((c) => c.id === s.yantraId)?.name.split(' ')[0] || 'yantra';
  return `${Math.round(s.frequencyHz ?? 396)}Hz`;
};

export const EntityEditor: React.FC<EntityEditorProps> = ({ entity, onUpdate, telemetry, isLight }) => {
  const [glyphDraft, setGlyphDraft] = useState(entity.shape.text ?? '');
  const [isGlyphFocused, setIsGlyphFocused] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkTextDraft, setLinkTextDraft] = useState('');
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGlyphFocused) setGlyphDraft(entity.shape.text ?? '');
  }, [entity.shape.text, entity.id, isGlyphFocused]);

  const selectCls = `flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${
    isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'
  }`;
  const inputCls = `px-1.5 py-1 rounded text-[9.5px] font-mono border outline-none ${
    isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'
  }`;
  const chip = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-[8.5px] font-mono uppercase border transition-all ${
      active ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'border-inherit opacity-55 hover:opacity-100'
    }`;

  const isFormation = entity.kind === 'formation';
  const stations = telemetry?.cymatic?.stations ?? [];
  const seqState = telemetry?.sequences.find((s) => s.entityId === entity.id) ?? null;

  // ---------------- Shape ----------------
  const setShapeKind = (kind: ShapeKind) => {
    const shape: Shape = { kind };
    if (kind === 'glyph') shape.text = entity.shape.text || 'O';
    else if (kind === 'yantra') shape.yantraId = entity.shape.yantraId || CANONICAL_CHAKRAS[0].id;
    else shape.frequencyHz = entity.shape.frequencyHz || 396;
    onUpdate({ shape });
  };
  const commitGlyph = () => {
    const v = glyphDraft.trim() || 'O';
    setGlyphDraft(v);
    if (v !== (entity.shape.text ?? '')) onUpdate({ shape: { ...entity.shape, text: v } });
  };
  const glyphKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    else if (e.key === 'Escape') {
      setGlyphDraft(entity.shape.text ?? '');
      (e.target as HTMLInputElement).blur();
    }
  };

  // ---------------- Sequence ----------------
  const seq = entity.sequence;
  const links = seq.links;
  const updateSequence = (patch: Partial<EntitySequence>) => onUpdate({ sequence: { ...seq, ...patch } });
  const setLinks = (next: SequenceLink[]) => updateSequence({ links: next });
  const addLink = (shape: Shape) => {
    setLinks([...links, makeLink(shape)]);
    setLinkTextDraft('');
  };
  const removeLink = (id: string) => setLinks(links.filter((l) => l.id !== id));
  const duplicateLink = (l: SequenceLink) => setLinks([...links, { ...l, id: newId('link') }]);
  const moveLink = (id: string, dir: 1 | -1) => {
    const idx = links.findIndex((l) => l.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= links.length) return;
    const next = [...links];
    [next[idx], next[j]] = [next[j], next[idx]];
    setLinks(next);
  };
  const updateLink = (id: string, patch: Partial<SequenceLink>) => setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const togglePositionKeyframe = (l: SequenceLink) => {
    const hasPos = l.x !== undefined || l.y !== undefined || l.z !== undefined;
    updateLink(l.id, hasPos ? { x: undefined, y: undefined, z: undefined } : { x: entity.x, y: entity.y, z: entity.z });
  };

  const applyTextPreset = (presetId: string) => {
    const preset = CHAIN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    // Single update: two consecutive onUpdate calls would each spread the stale sequence and drop the links
    updateSequence({
      links: preset.chain.map((text) => makeLink({ kind: 'glyph', text })),
      advance: 'time',
      order: 'loop',
      easing: preset.recommendedEasing ?? seq.easing,
      hold: preset.recommendedHold ?? seq.hold,
      transition: preset.recommendedTransition ?? seq.transition,
    });
  };
  const applyKundaliniPreset = () => {
    const next = [...CANONICAL_CHAKRAS].reverse().map((c) => makeLink({ kind: 'glyph', text: c.seedSyllable }, { x: c.x, y: -c.y }));
    updateSequence({ links: next, advance: 'time', order: 'loop' });
  };

  return (
    <div className="space-y-2.5">
      {/* Identity */}
      <div className={`p-2 rounded border space-y-1.5 ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
        <div className="flex items-center gap-1.5">
          <input type="checkbox" checked={entity.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked })} className="w-3 h-3 accent-cyan-400" />
          <input
            type="text"
            value={entity.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={`${inputCls} flex-1 min-w-0 bg-transparent border-transparent hover:border-inherit focus:border-inherit font-bold`}
          />
          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${entity.kind === 'pin' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            {entity.kind}
          </span>
        </div>
      </div>

      {/* Position */}
      <div>
        <span className="text-[9px] font-mono uppercase opacity-60 block mb-0.5">Position</span>
        <ParamRow label="X" value={entity.x} onChange={(v) => onUpdate({ x: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
        <ParamRow label="Y" value={entity.y} onChange={(v) => onUpdate({ y: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
        <ParamRow label="Z" value={entity.z} onChange={(v) => onUpdate({ z: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
        {isFormation && (
          <>
            <ParamRow label="Scale" value={entity.scale} onChange={(v) => onUpdate({ scale: v })} min={0.02} max={4} hardMin={0.001} hardMax={100} step={0.01} />
            <ParamRow label="Share" value={entity.share} onChange={(v) => onUpdate({ share: v })} min={0.05} max={10} hardMin={0.001} hardMax={1000} step={0.05} title="Relative particle share among enabled formations" />
          </>
        )}
      </div>

      {/* Shape (formations only) */}
      {isFormation && (
        <div className="pt-1.5 border-t border-inherit/40 space-y-1">
          <span className="text-[9px] font-mono uppercase opacity-60 block">Shape</span>
          <div className="flex items-center gap-1">
            {(['glyph', 'yantra', 'cymatic'] as ShapeKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setShapeKind(k)} className={chip(entity.shape.kind === k)}>
                {k}
              </button>
            ))}
          </div>
          {entity.shape.kind === 'glyph' && (
            <>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  maxLength={64}
                  value={glyphDraft}
                  onFocus={() => setIsGlyphFocused(true)}
                  onChange={(e) => setGlyphDraft(e.target.value)}
                  onBlur={() => {
                    setIsGlyphFocused(false);
                    commitGlyph();
                  }}
                  onKeyDown={glyphKeyDown}
                  placeholder="glyph or word"
                  className={`${inputCls} flex-1 text-center font-bold`}
                  title="Type a glyph or word · Enter or click away to bake"
                />
                <button type="button" onClick={() => setShowShapePicker((s) => !s)} className={chip(showShapePicker)}>
                  Browse
                </button>
              </div>
              {showShapePicker && <GlyphPicker isLight={isLight} onPick={(char) => onUpdate({ shape: { ...entity.shape, text: char } })} />}
            </>
          )}
          {entity.shape.kind === 'yantra' && (
            <select
              value={entity.shape.yantraId ?? CANONICAL_CHAKRAS[0].id}
              onChange={(e) => onUpdate({ shape: { ...entity.shape, yantraId: e.target.value } })}
              className={selectCls}
            >
              {CANONICAL_CHAKRAS.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {entity.shape.kind === 'cymatic' && (
            <ParamRow
              label="Template Freq"
              value={entity.shape.frequencyHz ?? 396}
              onChange={(v) => onUpdate({ shape: { ...entity.shape, frequencyHz: v } })}
              min={20}
              max={4000}
              hardMin={1}
              hardMax={100000}
              step={1}
              decimals={0}
              unit="Hz"
            />
          )}
        </div>
      )}

      {/* Sequence (formations only) */}
      {isFormation && (
        <div className="pt-1.5 border-t border-inherit/40 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase opacity-60">Sequence {links.length > 0 ? `(${links.length} links)` : '(static)'}</span>
            {seqState && (
              <span className="text-[8.5px] font-mono opacity-60 tabular-nums">
                #{seqState.linkIndex + 1}→#{seqState.nextIndex + 1} · {Math.round(seqState.progress * 100)}% · {seqState.phase}
              </span>
            )}
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {links.map((l, i) => {
              const hasPos = l.x !== undefined || l.y !== undefined || l.z !== undefined;
              const isCurrent = seqState?.linkIndex === i;
              return (
                <div key={l.id} className={`rounded border ${isCurrent ? 'border-cyan-500/60' : 'border-inherit'} bg-stone-500/5`}>
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <span className="text-[8px] font-mono opacity-40 w-4 shrink-0">#{i + 1}</span>
                    <span className="text-[11px] font-bold flex-1 truncate">{shapeLabel(l.shape)}</span>
                    <button type="button" title={hasPos ? 'Remove position keyframe' : 'Add position keyframe'} onClick={() => togglePositionKeyframe(l)} className={`p-0.5 ${hasPos ? 'text-cyan-400' : 'opacity-40 hover:opacity-80'}`}>
                      {hasPos ? <MapPin className="w-2.5 h-2.5" /> : <MapPinOff className="w-2.5 h-2.5" />}
                    </button>
                    <button type="button" onClick={() => moveLink(l.id, -1)} disabled={i === 0} className="p-0.5 opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowUp className="w-2.5 h-2.5" /></button>
                    <button type="button" onClick={() => moveLink(l.id, 1)} disabled={i === links.length - 1} className="p-0.5 opacity-50 hover:opacity-100 disabled:opacity-20"><ArrowDown className="w-2.5 h-2.5" /></button>
                    <button type="button" onClick={() => duplicateLink(l)} className="p-0.5 opacity-50 hover:opacity-100"><Copy className="w-2.5 h-2.5" /></button>
                    <button type="button" onClick={() => removeLink(l.id)} className="p-0.5 text-red-400 opacity-50 hover:opacity-100"><Trash2 className="w-2.5 h-2.5" /></button>
                    <button type="button" onClick={() => setExpandedLinkId(expandedLinkId === l.id ? null : l.id)} className="text-[8px] opacity-50 hover:opacity-100 px-1">{expandedLinkId === l.id ? '▲' : '▼'}</button>
                  </div>
                  {expandedLinkId === l.id && (
                    <div className="px-2 pb-1.5 space-y-1">
                      <input
                        type="text"
                        value={l.shape.text ?? ''}
                        onChange={(e) => updateLink(l.id, { shape: { ...l.shape, text: e.target.value } })}
                        className={`${inputCls} w-full text-center`}
                        placeholder="glyph or word"
                      />
                      {hasPos && (
                        <>
                          <ParamRow label="X" value={l.x ?? 0} onChange={(v) => updateLink(l.id, { x: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
                          <ParamRow label="Y" value={l.y ?? 0} onChange={(v) => updateLink(l.id, { y: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
                          <ParamRow label="Z" value={l.z ?? 0} onChange={(v) => updateLink(l.id, { z: v })} min={-1200} max={1200} hardMin={-20000} hardMax={20000} step={5} decimals={0} unit="px" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {links.length === 0 && (
              <div className="p-1.5 rounded border border-dashed border-inherit text-center opacity-50 text-[9px] font-mono">
                Static shape — add links to sequence through shapes.
              </div>
            )}
          </div>

          {/* Add link */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={linkTextDraft}
              onChange={(e) => setLinkTextDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkTextDraft.trim()) addLink({ kind: 'glyph', text: linkTextDraft.trim() });
              }}
              placeholder="add link: glyph or word"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={() => linkTextDraft.trim() && addLink({ kind: 'glyph', text: linkTextDraft.trim() })}
              className="p-1 rounded bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => setShowLinkPicker((s) => !s)} className={chip(showLinkPicker)}>
              Browse
            </button>
          </div>
          {showLinkPicker && <GlyphPicker isLight={isLight} compact onPick={(char) => addLink({ kind: 'glyph', text: char })} />}

          {/* Presets */}
          <div className="flex items-center gap-1 flex-wrap text-[8.5px] font-mono uppercase pt-0.5">
            <span className="opacity-50 mr-0.5">Presets</span>
            <button type="button" onClick={() => applyTextPreset('platonic_polygons')} className="px-1.5 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20">Platonic polygons</button>
            <button type="button" onClick={() => applyTextPreset('zodiac_ecliptic')} className="px-1.5 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20">Zodiac 12</button>
            <button type="button" onClick={() => applyTextPreset('nordic_runes')} className="px-1.5 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20">Runes</button>
            <button type="button" onClick={applyKundaliniPreset} className="px-1.5 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20">Kundalini ascent</button>
          </div>

          {/* Timing */}
          <div className="pt-1 border-t border-inherit/40 space-y-1">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-mono uppercase opacity-70 w-16 shrink-0">Advance</span>
              <select value={seq.advance} onChange={(e) => updateSequence({ advance: e.target.value as SequenceAdvance })} className={selectCls}>
                <option value="off">Off (manual)</option>
                <option value="time">Timeline</option>
                <option value="morphCycle">Morph cycle</option>
              </select>
            </div>
            {seq.advance === 'time' && (
              <>
                <ParamRow label="Hold" value={seq.hold} onChange={(v) => updateSequence({ hold: v })} min={0} max={30} hardMin={0} hardMax={3600} step={0.05} unit="s" />
                <ParamRow label="Transition" value={seq.transition} onChange={(v) => updateSequence({ transition: v })} min={0.05} max={30} hardMin={0.02} hardMax={3600} step={0.05} unit="s" />
              </>
            )}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-mono uppercase opacity-70 w-16 shrink-0">Easing</span>
              <select value={seq.easing} onChange={(e) => updateSequence({ easing: e.target.value as ChainEasing })} className={selectCls}>
                <option value="smoothstep">Smooth</option>
                <option value="linear">Linear</option>
                <option value="kineticSnap">Snap</option>
                <option value="whip">Whip</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-mono uppercase opacity-70 w-16 shrink-0">Order</span>
              <select value={seq.order} onChange={(e) => updateSequence({ order: e.target.value as SequenceOrder })} className={selectCls}>
                <option value="loop">Loop</option>
                <option value="pingpong">Ping-pong</option>
                <option value="random">Random</option>
              </select>
            </div>
            <ParamRow label="Jitter" value={seq.jitter} onChange={(v) => updateSequence({ jitter: v })} min={0} max={1} hardMin={0} hardMax={3} step={0.02} />
            <ParamRow label="Impulse" value={seq.impulse} onChange={(v) => updateSequence({ impulse: v })} min={0} max={5} hardMin={0} hardMax={20} step={0.05} />
            <ParamRow label="Phase Offset" value={seq.phaseOffset} onChange={(v) => updateSequence({ phaseOffset: v })} min={-4} max={4} hardMin={-1000} hardMax={1000} step={0.01} unit="cyc" />
            <ParamRow label="Rate Mul" value={seq.rateMul} onChange={(v) => updateSequence({ rateMul: v })} min={-5} max={5} hardMin={-100} hardMax={100} step={0.01} />
          </div>
        </div>
      )}

      {/* Forces */}
      <div className="pt-1.5 border-t border-inherit/40 space-y-1">
        <span className="text-[9px] font-mono uppercase opacity-60 block">Forces</span>
        <div className="flex items-center gap-1">
          {(['none', 'attract', 'repel', 'vortex'] as EntityForceMode[]).map((m) => (
            <button key={m} type="button" onClick={() => onUpdate({ forces: { ...entity.forces, mode: m } })} className={chip(entity.forces.mode === m)}>
              {m}
            </button>
          ))}
        </div>
        <ParamRow label="Strength" value={entity.forces.strength} onChange={(v) => onUpdate({ forces: { ...entity.forces, strength: v } })} min={-20} max={20} hardMin={-1000} hardMax={1000} step={0.1} />
        <ParamRow label="Radius" value={entity.forces.radius} onChange={(v) => onUpdate({ forces: { ...entity.forces, radius: v } })} min={20} max={2000} hardMin={5} hardMax={20000} step={5} decimals={0} unit="px" />
        <ParamRow label="Spin" value={entity.forces.spin} onChange={(v) => onUpdate({ forces: { ...entity.forces, spin: v } })} min={-20} max={20} hardMin={-1000} hardMax={1000} step={0.1} />
      </div>

      {/* Colour */}
      <div className="pt-1.5 border-t border-inherit/40 space-y-1">
        <span className="text-[9px] font-mono uppercase opacity-60 block">Colour</span>
        <div className="flex items-center gap-1.5">
          <input type="color" value={entity.tint} onChange={(e) => onUpdate({ tint: e.target.value })} className="w-5 h-5 rounded border-0 p-0 bg-transparent cursor-pointer" />
          <span className="text-[8.5px] font-mono opacity-60">{entity.tint}</span>
        </div>
        <ParamRow label="Tint Weight" value={entity.tintWeight} onChange={(v) => onUpdate({ tintWeight: v })} min={0} max={1} hardMin={0} hardMax={1} step={0.01} />
      </div>

      {/* Station link */}
      <div className="pt-1.5 border-t border-inherit/40">
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[10px] font-mono uppercase opacity-70 w-20 shrink-0">Station</span>
          <select
            value={entity.stationIndex ?? ''}
            onChange={(e) => onUpdate({ stationIndex: e.target.value === '' ? undefined : Number(e.target.value) })}
            className={selectCls}
          >
            <option value="">— none —</option>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const st = stations.find((s) => s.index === i);
              return (
                <option key={i} value={i}>
                  {st ? `${st.name} · ${Math.round(st.frequencyHz)} Hz` : `Station ${i}`}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
};
