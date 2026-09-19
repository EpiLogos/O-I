import {
  forwardRef,
  useLayoutEffect,
  useEffect,
  useRef,
  useImperativeHandle,
  useState,
} from "react";
import { basicSetup } from "codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  EditorView,
  Decoration,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import {
  undo,
  redo,
  indentMore,
  indentLess,
  toggleComment,
  historyField,
} from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { xml } from "@codemirror/lang-xml";
import type { SurfaceBinding } from "../surface/types";
import { preparedSnapshot, preparedSubscribe, type PreparedItem } from "../context/prepared";
import { Glyph } from "../workspace/Glyph";
import "./text-editor.css";
import {useEditorMode} from "./EditorChrome";

// basicSetup's defaultHighlightStyle is a light-only fallback. Installing
// an explicit highlighter replaces that whole fallback, so retain its tag
// families and text semantics while taking every colour from the host.
const sourceHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: "var(--oi-syntax-meta)" },
  { tag: [tags.link, tags.url], color: "var(--oi-syntax-link)", textDecoration: "underline" },
  { tag: tags.heading, color: "var(--oi-syntax-heading)", textDecoration: "underline", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.keyword, color: "var(--oi-syntax-keyword)" },
  { tag: [tags.atom, tags.bool, tags.contentSeparator, tags.labelName], color: "var(--oi-syntax-atom)" },
  { tag: [tags.literal, tags.inserted], color: "var(--oi-syntax-literal)" },
  { tag: [tags.string, tags.deleted], color: "var(--oi-syntax-string)" },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: "var(--oi-syntax-special)" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: "var(--oi-syntax-definition)" },
  { tag: tags.local(tags.variableName), color: "var(--oi-syntax-variable)" },
  { tag: [tags.typeName, tags.namespace, tags.className], color: "var(--oi-syntax-type)" },
  { tag: [tags.special(tags.variableName), tags.macroName], color: "var(--oi-syntax-special)" },
  { tag: tags.comment, color: "var(--oi-syntax-comment)" },
  { tag: tags.invalid, color: "var(--oi-syntax-invalid)", textDecoration: "underline wavy" },
]);
export interface EditorHandle {
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly selectionDirection: "forward" | "backward";
  focus(): void;
  setSelectionRange(start: number, end: number, direction?: string): void;
  setRangeText(text: string, start: number, end: number, mode?: string): void;
  closest<T extends Element>(selector: string): T | null;
  contains(node: Node | null): boolean;
  command(name: string): void;
}
const editorMemory = new Map<
  string,
  { doc: string; state: unknown; top: number }
>();
const mark = StateEffect.define<{ from: number; to: number; color: string }>();
const highlights = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects)
      if (effect.is(mark)) {
        const { from, to, color } = effect.value;
        value = value.update({ filter: (a, b) => b <= from || a >= to });
        if (color && to > from)
          value = value.update({
            add: [
              Decoration.mark({
                class: `text-highlight highlight-${color}`,
              }).range(from, to),
            ],
            sort: true,
          });
      }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});
/** Prepared-context cues (owner direction 2026-09-19): a quiet, non-persisted
 * decoration over each range that is currently staged as a context item.
 * Presentation only — never written into the document, never saved with the
 * editor view, removed the moment the item is. */
const refreshCues = StateEffect.define<null>();
const cueClass = "context-prepared-cue";
function cueDecorations(items: readonly PreparedItem[], state: EditorState): DecorationSet {
  const ranges: { from: number; to: number; id: string }[] = [];
  for (const item of items) {
    if (item.start === undefined || item.end === undefined) continue;
    if (item.end > state.doc.length) continue;
    if (state.sliceDoc(item.start, item.end) !== item.text) continue;
    ranges.push({ from: item.start, to: item.end, id: item.id });
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  let set = Decoration.none;
  for (const range of ranges)
    set = set.update({
      add: [
        Decoration.mark({ class: cueClass, "data-prepared-id": range.id }).range(range.from, range.to),
      ],
      sort: true,
    });
  return set;
}
const contextCues = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(refreshCues)) return cueDecorations(preparedSnapshot(), tr.state);
    if (tr.docChanged) return cueDecorations(preparedSnapshot(), tr.state);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});
const languages = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "markdown":
      return markdown();
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return javascript({
        typescript: ext.startsWith("ts"),
        jsx: ext.endsWith("x"),
      });
    case "json":
      return json();
    case "html":
    case "htm":
      return html();
    case "css":
      return css();
    case "py":
      return python();
    case "xml":
    case "svg":
      return xml();
    default:
      return [];
  }
};
interface Props {
  value: string;
  onChange: (value: string) => void;
  binding: SurfaceBinding;
  filename?: string;
  readOnly?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
  onAttach?: () => void;
  className?: string;
  "aria-label": string;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}
export const TextEditor = forwardRef<EditorHandle, Props>(
  function TextEditor(props, ref) {
    const mode=useEditorMode();
    const host = useRef<HTMLDivElement>(null),
      view = useRef<EditorView>();
    const callbacks = useRef(props);
    callbacks.current = props;
    const external = useRef(false);
    const editable = useRef(new Compartment()),
      language = useRef(new Compartment()),
      wrap = useRef(new Compartment());
    const [, setSelection] = useState(false),
      [notice, setNotice] = useState("");
    const modeRef = useRef(mode); modeRef.current = mode;
    const [chip, setChip] = useState<{ x: number; y: number }>();
    const api = useRef<EditorHandle>({
      get value() {
        return view.current?.state.doc.toString() ?? "";
      },
      get selectionStart() {
        return view.current?.state.selection.main.from ?? 0;
      },
      get selectionEnd() {
        return view.current?.state.selection.main.to ?? 0;
      },
      get selectionDirection() {
        return (view.current?.state.selection.main.anchor ?? 0) >
          (view.current?.state.selection.main.head ?? 0)
          ? "backward"
          : "forward";
      },
      focus() {
        view.current?.focus();
      },
      setSelectionRange(start, end, direction) {
        const v = view.current;
        if (!v) return;
        const max = v.state.doc.length;
        start = Math.max(0, Math.min(max, start));
        end = Math.max(start, Math.min(max, end));
        v.dispatch({
          selection:
            direction === "backward"
              ? { anchor: end, head: start }
              : { anchor: start, head: end },
        });
      },
      setRangeText(text, start, end) {
        const v = view.current;
        if (!v || v.state.readOnly) return;
        v.dispatch({
          changes: { from: start, to: end, insert: text },
          selection: { anchor: start + text.length },
          userEvent: "input",
        });
      },
      closest(selector) {
        return host.current?.closest(selector) ?? null;
      },
      contains(node) {
        return !!host.current?.contains(node);
      },
      command(name) {
        const v = view.current;
        if (!v) return;
        if(name==='copy'||name==='cut'){
          const {from,to}=v.state.selection.main;const basis=v.state.doc;const text=basis.sliceString(from,to);if(!text)return;
          void navigator.clipboard.writeText(text).then(()=>{if(name==='cut'&&!v.state.readOnly&&v.state.doc===basis){v.dispatch({changes:{from,to,insert:''},selection:{anchor:from},userEvent:'delete.cut'});v.focus();}}).catch(()=>{v.focus();if(!document.execCommand(name))setNotice('Clipboard access was unavailable. Use the keyboard shortcut.');});return;
        }
        if (name === "context-add") { attach(); return; }
        if (name.startsWith("highlight-")) {
          const { from, to } = v.state.selection.main;
          v.dispatch({
            effects: mark.of({
              from,
              to,
              color: name === "highlight-clear" ? "" : name.slice(10),
            }),
          });
          v.focus();
          return;
        }
        const commands: Record<string, (v: EditorView) => boolean> = {
          undo,
          redo,
          indent: indentMore,
          outdent: indentLess,
          comment: toggleComment,
          find: openSearchPanel,
        };
        commands[name]?.(v);
        v.focus();
      },
    });
    useImperativeHandle(ref, () => api.current, []);
    useLayoutEffect(() => {
      const extensions = [
        basicSetup,
        syntaxHighlighting(sourceHighlightStyle),
        highlights,
        contextCues,
        editable.current.of(
          EditorState.readOnly.of(!!callbacks.current.readOnly),
        ),
        language.current.of(
          languages(
            callbacks.current.filename ?? callbacks.current.binding.title,
          ),
        ),
        wrap.current.of(EditorView.lineWrapping),
        EditorView.contentAttributes.of({
          "aria-label": callbacks.current["aria-label"],
          "data-source-ref": callbacks.current.binding.ref ?? "",
          spellcheck: "false",
        }),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              callbacks.current.onSave?.();
              return true;
            },
          },
          {
            key: "Mod-Shift-2",
            run: () => {
              attach();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !external.current)
            callbacks.current.onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const { from, to } = update.state.selection.main;
            const selected = from !== to;
            setSelection(selected);
            host.current?.dispatchEvent(new CustomEvent("oi:editor-selection", {
              bubbles: true,
              detail: {
                selected,
                ...(selected ? { text: update.state.sliceDoc(from, to), start: from, end: to, sourceRef: callbacks.current.binding.ref } : {}),
              },
            }));
            callbacks.current.onSelect?.();
            if (selected && modeRef.current === "writing" && !update.state.readOnly && view.current) {
              const coords = view.current.coordsAtPos(to);
              const box = host.current!.getBoundingClientRect();
              setChip(coords ? { x: Math.min(coords.left - box.left, box.width - 96), y: coords.bottom - box.top } : undefined);
            } else setChip(undefined);
          }
        }),
      ];
      const prior = editorMemory.get(callbacks.current.binding.id);
      const state =
        prior?.doc === callbacks.current.value
          ? EditorState.fromJSON(
              prior.state,
              { extensions },
              { history: historyField },
            )
          : EditorState.create({ doc: callbacks.current.value, extensions });
      const v = new EditorView({ parent: host.current!, state });
      view.current = v;
      // The rendered line elements are virtualised, so the DOM is not the
      // document. A read-only accessor on the host lets a walk read what
      // CodeMirror actually holds. It exposes nothing but text.
      (host.current as HTMLElement & { __oiDocument?: () => string }).__oiDocument = () =>
        v.state.doc.toString();
      setSelection(!v.state.selection.main.empty);
      const restoreScroll = requestAnimationFrame(() => {
        if (prior?.doc === callbacks.current.value)
          v.scrollDOM.scrollTop = prior.top;
      });
      const storageKey = `oi-editor-view:${callbacks.current.binding.ref ?? callbacks.current.binding.id}`;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (saved?.doc === v.state.doc.toString()) {
          for (const h of saved.marks ?? [])
            if (
              Number.isInteger(h.from) &&
              Number.isInteger(h.to) &&
              h.from >= 0 &&
              h.to <= v.state.doc.length &&
              ["yellow", "green", "blue", "rose"].includes(h.color)
            )
              v.dispatch({ effects: mark.of(h) });
        }
      } catch {}
      return () => {
        cancelAnimationFrame(restoreScroll);
        editorMemory.delete(callbacks.current.binding.id);
        editorMemory.set(callbacks.current.binding.id, {
          doc: v.state.doc.toString(),
          state: v.state.toJSON({ history: historyField }),
          top: v.scrollDOM.scrollTop,
        });
        if (editorMemory.size > 40)
          editorMemory.delete(editorMemory.keys().next().value!);
        const marks: unknown[] = [];
        v.state
          .field(highlights)
          .between(0, v.state.doc.length, (from, to, decoration) => {
            marks.push({
              from,
              to,
              color: decoration.spec.class.replace(
                "text-highlight highlight-",
                "",
              ),
            });
          });
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ doc: v.state.doc.toString(), marks }),
          );
        } catch {}
        v.destroy();
        view.current = undefined;
      };
    }, [props.binding.id]);
    useEffect(() => {
      const v = view.current;
      if (v && v.state.doc.toString() !== props.value) {
        external.current = true;
        v.dispatch({
          changes: { from: 0, to: v.state.doc.length, insert: props.value },
        });
        external.current = false;
      }
    }, [props.value]);
    useEffect(() => {
      view.current?.dispatch({
        effects: [
          editable.current.reconfigure(
            EditorState.readOnly.of(!!props.readOnly||mode==="context"),
          ),
          language.current.reconfigure(
            languages(props.filename ?? props.binding.title),
          ),
        ],
      });
    }, [props.readOnly, props.filename, props.binding.title,mode]);
    useEffect(()=>{const node=host.current?.parentElement;if(!node)return;const add=()=>attach();const command=(event:Event)=>api.current.command((event as CustomEvent<string>).detail);node.addEventListener('oi:attach-selection',add);node.addEventListener('oi:editor-command',command);return()=>{node.removeEventListener('oi:attach-selection',add);node.removeEventListener('oi:editor-command',command);};},[]);
    // Prepared-context cues redraw from the staging store; a change anywhere
    // (add, remove, source edit elsewhere) refreshes this editor's ranges.
    useEffect(()=>{
      const refresh=()=>view.current?.dispatch({effects:refreshCues.of(null)});
      refresh();
      return preparedSubscribe(refresh);
    },[]);
    // Reveal a prepared item at the source: exact range selected, centred.
    useEffect(()=>{
      const reveal=(event:Event)=>{
        const detail=(event as CustomEvent<{sourceRef?:string;start?:number;end?:number}>).detail;
        const v=view.current;if(!v||!detail)return;
        const own=callbacks.current.binding.ref;
        if(detail.sourceRef&&own&&detail.sourceRef!==own)return;
        if(detail.start===undefined||detail.end===undefined)return;
        v.focus();
        v.dispatch({selection:{anchor:detail.start,head:detail.end},effects:EditorView.scrollIntoView(detail.start,{y:"center"})});
      };
      window.addEventListener("oi:reveal-prepared",reveal);
      return()=>window.removeEventListener("oi:reveal-prepared",reveal);
    },[]);
    useEffect(()=>{setChip(undefined);},[mode,props.readOnly]);
    function attach() {
      const p = callbacks.current,
        a = api.current;
      if (a.selectionStart === a.selectionEnd) return;
      if (p.onAttach) {
        p.onAttach();
        return;
      }
      window.dispatchEvent(
        new CustomEvent("oi:context-candidate", {
          detail: {
            bindingId: p.binding.id,
            kind: "text",
            text: a.value.slice(a.selectionStart, a.selectionEnd),
            start: a.selectionStart,
            end: a.selectionEnd,
            sourceRef: p.binding.ref,
            location: p.binding.location,
          },
        }),
      );
    }
    return (
      <div className="text-editor" onContextMenu={props.onContextMenu}>
        <div ref={host} className="text-editor-host" />
        {chip && mode === "writing" && !props.readOnly && (
          <button
            type="button"
            className="context-chip"
            style={{ left: chip.x, top: chip.y }}
            title="Add selection to context (Shift-Cmd-2)"
            aria-label="Add selection to context"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { attach(); setChip(undefined); }}
          >
            <Glyph name="context" size={11} />
            Context
          </button>
        )}

        {notice && (
          <p role="status">
            {notice}
            <button onClick={() => setNotice("")}>Dismiss</button>
          </p>
        )}
      </div>
    );
  },
);
export function EditorCommands({
  editor,
  markdown: md = false,
  readOnly = false,
}: {
  editor: React.RefObject<EditorHandle>;
  markdown?: boolean;
  readOnly?: boolean;
}) {
  const act = (name: string) => editor.current?.command(name);
  const surround = (left: string, right = left) => {
    const e = editor.current;
    if (!e) return;
    const start = e.selectionStart,
      end = e.selectionEnd;
    e.setRangeText(left + e.value.slice(start, end) + right, start, end);
    e.setSelectionRange(start + left.length, end + left.length);
    e.focus();
  };
  type GlyphName = React.ComponentProps<typeof Glyph>["name"];
  // Compact icon controls (owner direction 2026-09-19): every tool keeps its
  // name, tooltip and real keyboard equivalent; the command behind each one
  // is the same implementation the writing menu and the keymap route to.
  // The editor itself holds the selection across toolbar use.
  const tool = (name: string, glyph: GlyphName, title: string, run: () => void, disabled = readOnly) =>
    <button key={name} aria-label={title} title={title} disabled={disabled} onClick={run}><Glyph name={glyph} size={13} /></button>;
  return (
    <>
      {tool("undo", "undo", "Undo (Cmd-Z)", () => act("undo"))}
      {tool("redo", "redo", "Redo (Shift-Cmd-Z)", () => act("redo"))}
      {tool("find", "search", "Find / Replace (Cmd-F)", () => act("find"), false)}
      {md ? (
        <>
          {tool("bold", "bold", "Bold", () => surround("**"))}
          {tool("italic", "italic", "Italic", () => surround("_"))}
          {tool("strike", "strike", "Strikethrough", () => surround("~~"))}
          {tool("inline-code", "code", "Code", () => surround("`"))}
          {tool("link", "link", "Link", () => surround("[", "](https://)"))}
          <select
            aria-label="Insert block"
            disabled={readOnly}
            value=""
            onChange={(e) => {
              surround(e.target.value, "");
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Block
            </option>
            <option value="# ">Heading 1</option>
            <option value="## ">Heading 2</option>
            <option value="### ">Heading 3</option>
            <option value="- ">Bullet list</option>
            <option value="1. ">Numbered list</option>
            <option value="- [ ] ">Task list</option>
            <option value="> ">Quote</option>
          </select>
        </>
      ) : (
        <>
          {tool("indent", "indent", "Indent", () => act("indent"))}
          {tool("outdent", "outdent", "Outdent", () => act("outdent"))}
          {tool("comment", "comment", "Toggle comment (Cmd-/)", () => act("comment"))}
        </>
      )}
    </>
  );
}
