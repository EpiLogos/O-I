/**
 * The sidebar plane primitives (owner commission 2026-09-22, build item 4):
 * `SideSection` and `SideRow` are the ONE dense-row grammar for the
 * accompanying panel's planes — Factory's Run/Agents/Context pattern and the
 * Ta-Onta modes' planes present their groups and rosters through these
 * instead of ad-hoc per-mode markup. They live in src/shared/ so any mode
 * plane and the shell compose the same grammar; type, colour and spacing are
 * entirely --oi-* / --oi-shell-* tokens. Hit bounds stay at or above
 * --oi-desktop-hit-target; no surface here styles a scrollbar.
 */
import type {ReactNode} from "react";
import {Glyph,type GlyphName} from "../workspace/Glyph";
import "./side.css";

/** One titled group of sidebar material: a small heading over its body. */
export function SideSection({label,glyph,children,actions,className}:{label:string;glyph?:GlyphName;children:ReactNode;actions?:ReactNode;className?:string}) {
  return <section className={`oi-side-section${className?` ${className}`:""}`} aria-label={label}>
    <h4>{glyph&&<Glyph name={glyph} size={12}/>}{label}{actions}</h4>
    {children}
  </section>;
}

/** One dense sidebar row: optional leading glyph, a title line, a quiet meta
 * line, then trailing content (state marks, actions) the caller supplies. */
export function SideRow({glyph,leading,title,meta,children,...rest}:{
  glyph?:GlyphName;
  /** Extra content rendered ahead of the title (a presence dot, a status
   * mark) when the standard glyph slot does not fit the material. */
  leading?:ReactNode;
  title:ReactNode;
  meta?:ReactNode;
  children?:ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>,"title">) {
  return <button type="button" className="oi-side-row" {...rest}>
    {glyph&&<Glyph name={glyph} size={12}/>}
    {leading}
    {typeof title==="string"?<span className="oi-side-row-title">{title}</span>:title}
    {meta!==undefined&&meta!==null&&meta!==""&&<span className="oi-side-step-meta">{meta}</span>}
    {children}
  </button>;
}

/** The row list a plane stacks SideRows (or row cards) into. */
export function SideRows({children,...rest}:{children:ReactNode} & React.HTMLAttributes<HTMLUListElement>) {
  return <ul className="oi-side-rows" {...rest}>{children}</ul>;
}
