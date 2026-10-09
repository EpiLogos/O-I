/**
 * Shell icon set, knob, chevrons, skill marks
 *
 * VERBATIM from the icon specimen (owner ruling, 2026-10-09):
 *   Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/icon-cut.html
 * Extracted by evidence/agent-shell-craft-20261009/headless/extract-specimen.mjs —
 * do not redraw by hand; re-run the extractor when the specimen moves.
 */
import type {CSSProperties} from 'react'

const I = {
  link:`<circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2"/>`,
  linkChain:`<path d="M9.5 14.5l-2 2a3.2 3.2 0 0 1-4.5-4.5l2-2M14.5 9.5l2-2a3.2 3.2 0 0 1 4.5 4.5l-2 2M8.5 15.5l7-7"/>`,
  tap:`<path d="M12 15.5V9"/><path d="M8.2 11.2a5 5 0 0 1 7.6 0"/><circle cx="12" cy="17.2" r="1.15" fill="currentColor" stroke="none"/>`,
  metroDots:`<circle cx="8" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="12" r="2.2"/>`,
  metro:`<path d="M8.5 19.5h7M12 19.2 8.2 6.2h7.6L12 19.2"/><circle cx="11.2" cy="11.5" r="1.35" fill="currentColor" stroke="none"/>`,
  follow:`<path d="M4 12h9.5M10.5 8l4 4-4 4"/><path d="M18.5 6.5v11"/>`,
  play:`<path d="M8 5.2v13.6l11.2-6.8z" fill="currentColor" stroke="none"/>`,
  stop:`<rect x="6.5" y="6.5" width="11" height="11" fill="currentColor" stroke="none"/>`,
  rec:`<circle cx="12" cy="12" r="5.6" fill="currentColor" stroke="none"/>`,
  plus:`<path d="M12 6v12M6 12h12"/>`,
  od:`<path d="M8 6.2v11.6l8.6-5.8z" fill="currentColor" stroke="none" opacity=".35"/><path d="M14 8v8M10.5 12h7"/>`,
  cmd:`<path d="M8 9.2a2.2 2.2 0 1 1-2.2-2.2H8v2.2zm0 5.6H5.8A2.2 2.2 0 1 0 8 17.2V14.8zM16 9.2V7a2.2 2.2 0 1 1 2.2 2.2H16zM16 14.8h2.2A2.2 2.2 0 1 1 16 17v-2.2zM8 9.2h8M8 14.8h8"/>`,
  arm:`<path d="M7 17.2V7.5h6.4a3.3 3.3 0 0 1 0 6.6H7"/><circle cx="7" cy="17.6" r="1.7" fill="currentColor" stroke="none"/>`,
  back:`<path d="M19 12H8.5M12.2 8.2 8 12.2l4.2 4"/><path d="M5 6.5v11"/>`,
  capEmpty:`<circle cx="12" cy="12" r="6"/>`,
  cap:`<circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none"/>`,
  loop:`<path d="M16.5 4.2 20 7.6l-3.5 3.4M20 7.6H9.2a4.2 4.2 0 0 0-4.2 4.2M7.5 19.8 4 16.4l3.5-3.4M4 16.4h10.8a4.2 4.2 0 0 0 4.2-4.2"/>`,
  punchIn:`<path d="M6 19.5V5.5M6 8h6.2L10.6 11l1.6 3H6"/>`,
  punchOut:`<path d="M18 19.5V5.5M18 8h-6.2L13.4 11 11.8 14H18"/>`,
  draw:`<path d="M13.6 5.2 18.8 10.4 9.2 20H4.2v-5z"/><path d="M12 6.8 17.2 12"/>`,
  keysOld:`<path d="M5 5h5v14H5zM14 5h5v14h-5z"/>`,
  keys:`<rect x="3.2" y="7" width="5" height="10.5" rx=".8"/><rect x="9.5" y="7" width="5" height="10.5" rx=".8"/><rect x="15.8" y="7" width="5" height="10.5" rx=".8"/>`,
  earth:`<circle cx="12" cy="10.5" r="6.6"/><path d="M5.6 10.5h12.8M12 4.1c2 2.1 2 10.6 0 12.8M12 4.1c-2 2.1-2 10.6 0 12.8"/><path d="M12 17.2v3.2M9.2 20.6h5.6"/>`,
  map:`<circle cx="6.5" cy="15" r="2.3"/><circle cx="17.2" cy="7.5" r="2.3"/><path d="M8.6 13.8 15.2 9"/>`,
  browser:`<circle cx="12" cy="12" r="8"/><path d="M4.2 12h15.6M12 4.2c2.5 2.6 2.5 13 0 15.6M12 4.2c-2.5 2.6-2.5 13 0 15.6"/>`,
  detail:`<rect x="3.5" y="3.5" width="17" height="10"/><rect x="3.5" y="15.5" width="17" height="5"/>`,
  dock:`<path d="M8.2 7.2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3.2 19v-1.6a5 5 0 0 1 10 0V19M15.2 6.4a2.4 2.4 0 0 1 0 5M17.4 13.2a4.2 4.2 0 0 1 2.6 3.6V19"/>`,
  pane:`<rect x="3.5" y="3.5" width="7.2" height="7.2"/><rect x="13.3" y="3.5" width="7.2" height="7.2"/><rect x="3.5" y="13.3" width="7.2" height="7.2"/><rect x="13.3" y="13.3" width="7.2" height="7.2"/>`,
  session:`<path d="M6 3.5v17M12 3.5v17M18 3.5v17"/>`,
  arrangement:`<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>`,
  live:`<path d="M2.5 12h3.2l2.4-6.2 3.6 12.4 2.4-6.2H21.5"/>`,
  diamond:`<path d="M12 3.2 20.6 12 12 20.8 3.4 12z"/>`,
  die:`<rect x="7.2" y="2.2" width="4.2" height="3.8" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="1.2" y="8.2" width="4.2" height="3.8" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="7.2" y="8.2" width="4.2" height="3.8" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="13.2" y="8.2" width="4.2" height="3.8" fill="currentColor" stroke="none"/><rect x="19.2" y="8.2" width="4.2" height="3.8" fill="currentColor" fill-opacity=".4" stroke="none"/><rect x="7.2" y="14.2" width="4.2" height="3.8" fill="currentColor" fill-opacity=".4" stroke="none"/>`,
  hex:`<path d="M12 3.2 19.2 7.4v9.2L12 20.8 4.8 16.6V7.4z"/>`,
  chain:`<rect x="2" y="9" width="5.5" height="6" rx="1"/><rect x="9.2" y="9" width="5.5" height="6" rx="1"/><rect x="16.5" y="9" width="5.5" height="6" rx="1"/><path d="M7.5 12h1.7M14.7 12h1.8"/>`,
  expr:`<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 8.6v6.8M8.6 12h6.8"/>`,
  techne:`<rect x="3.2" y="3.2" width="5" height="5"/><rect x="15.8" y="3.2" width="5" height="5"/><rect x="3.2" y="15.8" width="5" height="5"/><rect x="15.8" y="15.8" width="5" height="5"/><path d="M8.2 5.7h7.6M5.7 8.2v7.6M8.2 18.3h7.6M18.3 8.2v7.6"/>`,
  search:`<circle cx="10.5" cy="10.5" r="5"/><path d="M14.2 14.2 19 19"/>`,
  trav:`<circle cx="6" cy="16" r="2"/><circle cx="16" cy="7" r="2"/><path d="M8 14.5 14 8.6"/>`,
  direct:`<path d="M5 12h8M12 8l5 4-5 4"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,
  journey:`<circle cx="12" cy="12" r="7"/><path d="M8 14.5c2.2-4 5.5-4 8 0"/>`,
  palace:`<path d="M4 19.5V10.5L12 4.5l8 6V19.5z"/><path d="M10 19.5v-5h4v5"/>`,
  contact:`<path d="M7 8h8M12 5l3 3-3 3M17 16H9M12 13l-3 3 3 3"/>`,
  ret:`<path d="M9 8H6.5A3.5 3.5 0 0 0 8 15.2"/><path d="M9 5.5 6 8.2 9 11"/><path d="M10 16.5h8"/>`,
  select:`<path d="M6.5 4.2 6.5 18.2l3.4-3.6 3.2 5.2 2-1.2-3.2-5.2H17z"/>`,
  orbit:`<path d="M16.5 8.2A6.2 6.2 0 1 1 12 5.8"/><path d="M12 3.2v3.2h3"/>`,
  form:`<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>`,
  bind:`<circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4"/>`,
  lib:`<rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/>`,
  placed:`<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="1.6"/>`,
};

/** The specimen's svg() convention, verbatim: sw 1.7 default, round caps. */
export function specimenSvg(inner: string, s = 16, opt?: {sw?: number}): string {
  const sw = opt?.sw ?? 1.7
  const fill = opt && 'fill' in opt && opt.fill ? '' : ' fill="none"'
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"${fill} stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}

export type IconCutName = keyof typeof I

/** React wrapper: renders one specimen icon. */
export function CutIcon({name, size = 16, sw}: {name: IconCutName; size?: number; sw?: number}) {
  return <span
    style={{display: 'inline-flex', lineHeight: 0} as CSSProperties}
    dangerouslySetInnerHTML={{__html: specimenSvg(I[name], size, {sw})}}
  />
}

let KNOBS = 0
function knob(v: number, col = 'var(--accent)', mod?: number): string {
  const id = 'kb' + (++KNOBS);
  const a0 = -135, a1 = 135, a = a0 + (a1 - a0) * v, C = 17;
  const pt = (deg: number, r: number): [number, number] => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
  const f = (n: number) => n.toFixed(2);
  const arc = (from: number, to: number, r: number): string => {
    const [x0, y0] = pt(from, r), [x1, y1] = pt(to, r);
    return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
  };
  const ticks = Array.from({length: 11}, (_, i) => {
    const d = a0 + (a1 - a0) * i / 10, [x0, y0] = pt(d, 15.3), [x1, y1] = pt(d, i % 5 ? 16.2 : 16.9);
    return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  }).join('');
  const [px0, py0] = pt(a, 2.4), [px1, py1] = pt(a, 7.2);
  return `<svg width="34" height="34" viewBox="0 0 34 34">
    <defs><radialGradient id="${id}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#6a6f76"/><stop offset=".55" stop-color="#46494f"/><stop offset="1" stop-color="#2a2c30"/></radialGradient></defs>
    <path d="${ticks}" stroke="var(--text-faint)" stroke-width=".9" stroke-linecap="round"/>
    <path d="${arc(a0, a1, 11.6)}" stroke="var(--bg-0)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    ${v > .005 ? `<path d="${arc(a0, a, 11.6)}" stroke="${col}" stroke-width="2.8" fill="none" stroke-linecap="round"/>` : ''}
    ${mod ? `<path d="${arc(a0, a0 + (a1 - a0) * mod, 14)}" stroke="var(--sel)" stroke-width="1.2" fill="none" stroke-linecap="round"/>` : ''}
    <circle cx="${C}" cy="${C + .9}" r="8.4" fill="#000" fill-opacity=".35"/>
    <circle cx="${C}" cy="${C}" r="8.2" fill="url(#${id})" stroke="#1d1f22" stroke-width=".8"/>
    <circle cx="${C}" cy="${C}" r="6.5" fill="none" stroke="#fff" stroke-opacity=".08"/>
    <path d="M${f(px0)} ${f(py0)}L${f(px1)} ${f(py1)}" stroke="var(--text)" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`;
}


/** React wrapper: the specimen's knob drawing (34px, ticks, value arc,
 * optional modulation arc in --sel). */
export function CutKnob({value, color = 'var(--accent)', mod}: {value: number; color?: string; mod?: number}) {
  return <span
    style={{display: 'inline-flex', lineHeight: 0} as CSSProperties}
    dangerouslySetInnerHTML={{__html: knob(value, color, mod)}}
  />
}

const FOLD = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 3.8 5 6.4 7.6 3.8"/></svg>`;
const POP = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 1.6H8.4V4.2M8.4 1.6 4.6 5.4M7 6.2V8.4H1.6V3H3.8"/></svg>`;

/** React wrappers for the device-head chevrons. */
export function FoldChevron() {
  return <span style={{display: 'inline-flex', lineHeight: 0}} dangerouslySetInnerHTML={{__html: FOLD}} />
}
export function PopGlyph() {
  return <span style={{display: 'inline-flex', lineHeight: 0}} dangerouslySetInnerHTML={{__html: POP}} />
}

const swordAt = (x: number, t: number) => ({
  line: `<circle cx="${x}" cy="${t}" r="2.6"/><path d="M${x-1.6} ${t+2.6}H${x+1.6}V${t+11}H${x-1.6}Z"/><path d="M${x-6.5} ${t+12.5}Q${x-6.5} ${t+11} ${x-5} ${t+11}H${x+5}Q${x+6.5} ${t+11} ${x+6.5} ${t+12.5}Q${x+6.5} ${t+14} ${x+5} ${t+14}H${x-5}Q${x-6.5} ${t+14} ${x-6.5} ${t+12.5}Z"/><path d="M${x-2} ${t+14}V28M${x+2} ${t+14}V28M${x-2} 32.5V52M${x+2} 32.5V52"/>`,
  hatch: `<path d="M${x-1.6} ${t+5.4}L${x+1.6} ${t+4.2}M${x-1.6} ${t+8.4}L${x+1.6} ${t+7.2}M${x} 35V49"/>`,
  small: `<circle cx="${x}" cy="${t+1}" r="3.4"/><path d="M${x} ${t+4.6}V55M${x-5.5} ${t+13}H${x+5.5}"/>`
});

const RACK = [swordAt(18, 9), swordAt(32, 5), swordAt(46, 9)];

const WOOD: Record<string, {tf?: string; line: string; hatch: string; small: string}> = {
  skill: {
    tf: 'rotate(35 32 32)',
    line: `<circle cx="32" cy="7.5" r="3.6"/><path d="M30.2 11.1H33.8L34.2 21.6H29.8Z"/><path d="M19.5 23.6Q21.4 21.2 24 22.4H40Q42.6 21.2 44.5 23.6Q42.6 25.8 40 25H24Q21.4 25.8 19.5 23.6Z"/><path d="M29.4 25V50.5L32 58.5L34.6 50.5V25"/><path d="M32 27.6V49"/>`,
    hatch: `<circle cx="32" cy="7.5" r="1.3"/><path d="M30.1 13.6 33.9 12.4M30 16.2 34 15M29.95 18.8 34.1 17.6M29.9 21.2 34.2 20.1"/><circle cx="32" cy="23.7" r="1.2"/><path d="M33.5 30.5V34M33.5 37.5V41M33.5 44.5V47.5M22.5 23.6H24.5M39.5 23.6H41.5"/>`,
    small: `<circle cx="32" cy="7" r="3.6"/><path d="M32 10.8V58M21 23H43"/>`
  },
  skillset: {
    line: RACK.map(s => s.line).join('') + `<path d="M6 22V52M10.5 22V52M53.5 22V52M58 22V52M6 22Q8.25 17.5 10.5 22M53.5 22Q55.75 17.5 58 22"/><path d="M10.5 28H53.5M10.5 32.5H53.5"/><path d="M3 52H61V57H3Z"/><path d="M7 57V60.5H15V57M49 57V60.5H57V57"/>`,
    hatch: RACK.map(s => s.hatch).join('') + `<path d="M12.5 30.2H15M23.5 30.2H28.5M35.5 30.2H40.5M49 30.2H51.5M7 54.5H13M20 54.5H28M36 54.5H44M51 54.5H57M8.25 25.5V49"/>`,
    small: RACK.map(s => s.small).join('') + `<path d="M6 31H58M3 56H61"/>`
  },
  method: {
    line: `<path d="M4 33Q11 30.8 18 30.6H54V37H48.5Q43.5 38.6 42.5 43.5V48H49.5V53.5H14.5V48H21.5V43.5Q20.5 38.6 16.5 37.4Q10 36.8 4 33Z"/><path d="M22 30.6V27.8H42L46 29.2L42 30.6"/><g transform="rotate(-22 34 16)"><path d="M29 9H39V22H29Z"/><path d="M39 13.6H58.5Q61 15.5 58.5 17.4H39"/></g><path d="M27.5 25.4 23.4 22.2M30.4 23.4 29.4 19M39.2 24.4 43.2 21.2"/>`,
    hatch: `<path d="M17.5 33.2H54M37 40.6V46M39.5 39.8V46M17 50.6H47M2 53.5H14.5M49.5 53.5H62M6 53.5l1.2-3 1 3 1.4-2.4.8 2.4M55 53.5l1.2-2.6 1 2.6 1.2-3 .9 3"/><g transform="rotate(-22 34 16)"><path d="M29 11.6H39M29 19.4H39M44 15.5H55"/></g><circle cx="21.6" cy="25.6" r=".5"/><circle cx="45" cy="24.2" r=".5"/>`,
    small: `<path d="M4 33Q11 31 18 31H54V37H48Q43 38.5 42 44V48H50V54H14V48H22V44Q21 38.5 17 37.5Q10 37 4 33Z"/><g transform="rotate(-22 34 16)"><path d="M28 7H40V22H28Z"/><path d="M40 15.5H60"/></g>`
  },
  methodology: {
    line: `<path d="M12 8H44Q46 8 46 10V52Q46 54 44 54H12Z"/><path d="M46 11L52 16V57.5Q52 59.5 50 59.5H18L12.5 54.5"/><path d="M12 16Q9.6 17.5 12 19M12 29Q9.6 30.5 12 32M12 42Q9.6 43.5 12 45"/><circle cx="28.5" cy="30" r="9.5"/><g transform="rotate(26 28.5 28)"><path d="M28.5 22.6V33.6M25.8 25.2H31.2"/><circle cx="28.5" cy="21.4" r="1.1"/></g><path d="M23 37 24.4 33.6 27.6 32.4 31 32.8 33.6 34.6 34.4 37Z"/><path d="M40.5 26.5H46V33.5H40.5Z"/><path d="M46 27L52 32M46 33L52 38"/>`,
    hatch: `<path d="M16 12H42V50H16Z"/><path d="M12 13.5L17.5 8M40.5 8L46 13.5M12 48.5L17.5 54M40.5 54L46 48.5"/><path d="M47.6 13.4V55.6M49.8 15.4V57.4M15.2 56.2H46.4M17 58H48.6"/><path d="M27.4 33 28.4 35 27.6 37M31.2 33.2 30.6 35.2M43.2 28V32"/>`,
    small: `<path d="M12 8H46V54H12Z"/><path d="M46 11L52 16V59.5H18L12 54"/><circle cx="28.5" cy="30" r="9.5"/><path d="M40.5 26H46V34H40.5Z"/>`
  }
};

export const WOOD_NAMES = {skillset:'Skillset', skill:'Skill', method:'Method', methodology:'Methodology'};

const WOOD_SETS = {blade: WOOD} as const
type WoodSet = keyof typeof WOOD_SETS
type WoodKind = keyof typeof WOOD
type WoodState = 'whole' | 'outline' | 'warn'
let WOOD_SET: WoodSet = 'blade'
function wood(kind: WoodKind, size = 24, state: WoodState = 'whole', set: WoodSet = WOOD_SET): string {
  const g = WOOD_SETS[set][kind];
  if(!g) return '';
  const small = size <= 20;
  const sw = size >= 64 ? 1.35 : size >= 32 ? 1.15 : small ? 1.2 : 1.1;
  const col = state === 'warn' ? 'var(--stall)' : 'currentColor';
  const body = small ? g.small : g.line + (size >= 28 ? `<g stroke-width="${(sw * .72).toFixed(2)}">${g.hatch}</g>` : '');
  return `<svg class="wood${state === 'outline' ? ' dim' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><g${g.tf ? ` transform="${g.tf}"` : ''}>${body}</g></svg>`;
}


/** React wrapper: one skill mark at the specimen's reduction rules
 * (hatching from 28px, the small drawing at 20px and below). */
export function SkillMark({kind, size = 14, state}: {kind: 'skill' | 'skillset' | 'method' | 'methodology'; size?: number; state?: 'whole' | 'outline' | 'warn'}) {
  return <span
    style={{display: 'inline-flex', lineHeight: 0} as CSSProperties}
    dangerouslySetInnerHTML={{__html: wood(kind, size, state ?? 'whole')}}
  />
}
