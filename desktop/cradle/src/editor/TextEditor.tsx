import {
  forwardRef,
  useLayoutEffect,
  useEffect,
  useRef,
  useImperativeHandle,
  useState,
} from "react";
import { basicSetup } from "codemirror";
import { foldAll, unfoldAll, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
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
  undoDepth, redoDepth, selectAll,
} from "@codemirror/commands";
import { openSearchPanel, gotoLine } from "@codemirror/search";
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
import {EditorIcon,type EditorIconName} from "./EditorIcon";
import {EDITOR_LANGUAGES,languageFor,markdownEdit,type EditorLanguage,type EditCommand} from "./commands";
import {contextCues,CONTEXT_CUES_CHANGED,type ContextCue} from "../context/selectionPresentation";

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
  status?(): {undo:boolean;redo:boolean;selected:boolean;language:EditorLanguage;wrap:boolean};
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
const languages = (kind: EditorLanguage) => {
  switch (kind) {
    case "markdown":return markdown();
    case "javascript":return javascript({jsx:true});
    case "typescript":return javascript({typescript:true});
    case "tsx":return javascript({typescript:true,jsx:true});
    case "json":return json();case "html":return html();case "css":return css();
    case "python":return python();case "xml":return xml();default:return [];
  }
};
const contextMarks=StateEffect.define<ContextCue[]>();
const contextHighlights=StateField.define<DecorationSet>({
 create:()=>Decoration.none,
 update(value,tr){
  // Changing the source invalidates the old positions. A fresh owner reading
  // may restore exact matching ranges; never search for another equal quote.
  if(tr.docChanged)value=Decoration.none;
  for(const effect of tr.effects)if(effect.is(contextMarks))value=Decoration.set(effect.value
    .filter(item=>Number.isInteger(item.start)&&Number.isInteger(item.end)&&item.start>=0&&item.end<=tr.state.doc.length&&item.end>item.start&&tr.state.doc.sliceString(item.start,item.end)===item.text)
    .map(item=>Decoration.mark({class:"context-prepared-highlight",attributes:{"data-context-item":item.id,title:"Prepared context — not sent"}}).range(item.start,item.end)),true);
  return value;
 },provide:field=>EditorView.decorations.from(field),
});
interface Props {
  value: string;
  onChange: (value: string) => void;
  binding: SurfaceBinding;
  filename?: string;
  sourceRevision?: string;
  workingCopy?: boolean;
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
    const override=useRef<EditorLanguage>("auto"), wrapped=useRef(true);
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
      status(){const v=view.current;return {undo:!!v&&undoDepth(v.state)>0,redo:!!v&&redoDepth(v.state)>0,selected:!!v&&!v.state.selection.main.empty,language:languageFor(callbacks.current.filename??callbacks.current.binding.location?.path??callbacks.current.binding.title,undefined,override.current),wrap:wrapped.current};},
      command(name) {
        const v = view.current;
        if (!v) return;
        if(name.startsWith("language:")){
          const next=name.slice(9) as EditorLanguage;if(!EDITOR_LANGUAGES.includes(next))return;
          override.current=next;v.dispatch({effects:language.current.reconfigure(languages(languageFor(callbacks.current.filename??callbacks.current.binding.location?.path??callbacks.current.binding.title,undefined,next)))});v.focus();return;
        }
        if(name==="wrap"){wrapped.current=!wrapped.current;v.dispatch({effects:wrap.current.reconfigure(wrapped.current?EditorView.lineWrapping:[])});v.focus();return;}
        if(name==="attach"){attach();return;}
        if(name.startsWith("markdown:")){
          if(v.state.readOnly)return;
          const range=v.state.selection.main;const edit=markdownEdit(v.state.doc.toString(),range.from,range.to,name.slice(9) as EditCommand);
          v.dispatch({changes:{from:edit.from,to:edit.to,insert:edit.insert},selection:{anchor:edit.anchor,head:edit.head},userEvent:"input.format"});v.focus();return;
        }
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
          line: gotoLine, fold: foldAll, unfold: unfoldAll, selectAll,
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
        highlights,contextHighlights,
        editable.current.of(
          EditorState.readOnly.of(!!callbacks.current.readOnly),
        ),
        language.current.of(
          languages(languageFor(callbacks.current.filename ?? callbacks.current.binding.location?.path ?? callbacks.current.binding.title,undefined,override.current)),
        ),
        wrap.current.of(EditorView.lineWrapping),
        EditorView.contentAttributes.of({
          "aria-label": callbacks.current["aria-label"],
          "data-source-ref": callbacks.current.binding.ref ?? "",
          spellcheck: "false",
        }),
        keymap.of([
          ...([['Mod-b','bold'],['Mod-i','italic']] as const).map(([key,command])=>({key,run:()=>{if(api.current.status?.().language!=="markdown")return false;api.current.command(`markdown:${command}`);return true;}})),
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
            const chosen=update.state.selection.main,p=callbacks.current;
            window.dispatchEvent(new CustomEvent("oi:selection-preview",{detail:chosen.empty?undefined:{prepare:p.onAttach,bindingId:p.binding.id,kind:"text",text:update.state.doc.sliceString(chosen.from,chosen.to),start:chosen.from,end:chosen.to,sourceRef:p.binding.ref,revision:p.sourceRevision,workingCopy:p.workingCopy,capturedAt:new Date().toISOString()}}));
            callbacks.current.onSelect?.();
            update.view.requestMeasure({read:v=>{const range=v.state.selection.main;const coords=v.coordsAtPos(range.head);return {selected:!range.empty,bounds:coords?{x:coords.left,y:coords.bottom,width:Math.max(1,coords.right-coords.left),height:coords.bottom-coords.top}:undefined};},write:detail=>{host.current?.dispatchEvent(new CustomEvent("oi:selection-anchor",{bubbles:true,detail}));}});
          }
          host.current?.dispatchEvent(new CustomEvent("oi:editor-status",{bubbles:true}));
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
      const showContext=()=>v.dispatch({effects:contextMarks.of(contextCues(callbacks.current.binding.ref,callbacks.current.binding.id))});
      const reveal=(event:Event)=>{const item=(event as CustomEvent<ContextCue>).detail;if(item.bindingId!==callbacks.current.binding.id&&item.sourceRef!==callbacks.current.binding.ref)return;if(v.state.doc.sliceString(item.start,item.end)!==item.text)return;v.dispatch({selection:{anchor:item.start,head:item.end},effects:EditorView.scrollIntoView(item.start,{y:"center"})});v.focus();};
      window.addEventListener(CONTEXT_CUES_CHANGED,showContext);window.addEventListener("oi:context-reveal",reveal);showContext();
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
        window.removeEventListener(CONTEXT_CUES_CHANGED,showContext);window.removeEventListener("oi:context-reveal",reveal);
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
            EditorState.readOnly.of(!!props.readOnly),
          ),
          language.current.reconfigure(
            languages(languageFor(props.filename ?? props.binding.location?.path ?? props.binding.title,undefined,override.current)),
          ),
        ],
      });
    }, [props.readOnly, props.filename, props.binding.title,mode]);
    useEffect(()=>{const node=host.current?.parentElement;if(!node)return;const add=()=>attach();const command=(event:Event)=>api.current.command((event as CustomEvent<string>).detail);node.addEventListener('oi:attach-selection',add);node.addEventListener('oi:editor-command',command);return()=>{node.removeEventListener('oi:attach-selection',add);node.removeEventListener('oi:editor-command',command);};},[]);
    function attach() {
      const p = callbacks.current,
        a = api.current;
      if (a.selectionStart === a.selectionEnd) return;
      if(view.current&&view.current.state.selection.ranges.length>1){setNotice("Add one exact range at a time; multiple carets are not silently collapsed into one selection.");return;}
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
            revision:p.sourceRevision,
            workingCopy:p.workingCopy,
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
export function EditorCommands({editor,markdown:md=false,readOnly=false}:{editor:React.RefObject<EditorHandle>;markdown?:boolean;readOnly?:boolean}) {
 const [,refresh]=useState(0);
 useEffect(()=>{const change=()=>refresh(n=>n+1);window.addEventListener("oi:editor-status",change);return()=>window.removeEventListener("oi:editor-status",change);},[]);
 const status=editor.current?.status?.();const isMarkdown=status?.language==="markdown"||(!status&&md);
 const tool=(name:string,label:string,icon:EditorIconName,disabled=false,pressed?:boolean)=><button type="button" className="editor-icon-command" key={name} aria-label={label.split(" · ")[0]} title={label} disabled={disabled} aria-pressed={pressed} onClick={()=>editor.current?.command(name)}><EditorIcon name={icon}/><span className="editor-menu-label">{label}</span></button>;
 return <>
  {tool("undo","Undo · Ctrl/⌘Z","undo",readOnly||!status?.undo)}
  {tool("redo","Redo · Ctrl/⌘⇧Z","redo",readOnly||!status?.redo)}
  {tool("find","Find / Replace · Ctrl/⌘F","search")}
  {isMarkdown?<>
   {tool("markdown:bold","Bold · Ctrl/⌘B","bold",readOnly)}{tool("markdown:italic","Italic · Ctrl/⌘I","italic",readOnly)}
   {tool("markdown:strike","Strikethrough","strike",readOnly)}{tool("markdown:code","Inline code","code",readOnly)}
   {tool("markdown:link","Insert link","link",readOnly)}{tool("markdown:image","Insert image","image",readOnly)}
   <select aria-label="Insert Markdown block" value="" disabled={readOnly} onChange={event=>editor.current?.command(`markdown:${event.target.value}`)}><option value="" disabled>Block</option>{[["heading1","Heading 1"],["heading2","Heading 2"],["heading3","Heading 3"],["bullet","Bullet list"],["numbered","Numbered list"],["task","Task list"],["quote","Quote"],["fence","Code block"],["table","Table"],["rule","Divider"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
  </>:<>{tool("indent","Indent","indent",readOnly)}{tool("outdent","Outdent","outdent",readOnly)}{status?.language!=="text"&&tool("comment","Toggle comment","comment",readOnly)}</>}
  {tool("wrap","Wrap lines","wrap",false,status?.wrap??true)}
  <select aria-label="More editor commands" value="" onChange={event=>editor.current?.command(event.target.value)}><option value="" disabled>More</option><option value="line">Go to line</option><option value="fold">Fold all</option><option value="unfold">Unfold all</option><option value="copy">Copy</option><option value="cut" disabled={readOnly}>Cut</option><option value="selectAll">Select all</option></select>
  <select aria-label="Editor language" value={status?.language??"text"} onChange={event=>editor.current?.command(`language:${event.target.value}`)}>{EDITOR_LANGUAGES.map(value=><option key={value} value={value}>{value==="auto"?"Detect language":value}</option>)}</select>
 </>;
}
