import {
  forwardRef,
  useLayoutEffect,
  useEffect,
  useRef,
  useImperativeHandle,
  useState,
} from "react";
import { basicSetup } from "codemirror";
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
import "./text-editor.css";
import {useEditorMode} from "./EditorChrome";
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
        highlights,
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
            setSelection(!update.state.selection.main.empty);
              host.current?.dispatchEvent(new CustomEvent("oi:editor-selection",{bubbles:true,detail:{selected:!update.state.selection.main.empty}}));
            callbacks.current.onSelect?.();
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
  return (
    <>
      <button title="Undo · ⌘Z" disabled={readOnly} onClick={() => act("undo")}>
        Undo
      </button>
      <button
        title="Redo · ⇧⌘Z"
        disabled={readOnly}
        onClick={() => act("redo")}
      >
        Redo
      </button>
      <button onClick={() => act("find")}>Find / Replace</button>
      {md ? (
        <>
          <button disabled={readOnly} onClick={() => surround("**")}>
            Bold
          </button>
          <button disabled={readOnly} onClick={() => surround("_")}>
            Italic
          </button>
          <button disabled={readOnly} onClick={() => surround("~~")}>
            Strike
          </button>
          <button disabled={readOnly} onClick={() => surround("`")}>
            Code
          </button>
          <button
            disabled={readOnly}
            onClick={() => surround("[", "](https://)")}
          >
            Link
          </button>
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
          <button disabled={readOnly} onClick={() => act("indent")}>
            Indent
          </button>
          <button disabled={readOnly} onClick={() => act("outdent")}>
            Outdent
          </button>
          <button disabled={readOnly} onClick={() => act("comment")}>
            Comment
          </button>
        </>
      )}
    </>
  );
}
