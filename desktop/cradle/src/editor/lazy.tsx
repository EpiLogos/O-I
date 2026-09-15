/**
 * The code editor is the heaviest body in the desktop (CodeMirror and its
 * language packs). It is loaded on first use, not at startup: these
 * wrappers keep the TextEditor/EditorCommands contract (including the
 * imperative EditorHandle ref) and split the editor into its own chunk.
 */
import {forwardRef,lazy,Suspense,type ComponentPropsWithoutRef} from "react";
import type {EditorHandle} from "./TextEditor";

const EditorImpl=lazy(()=>import("./TextEditor").then((module)=>({default:module.TextEditor})));
const CommandsImpl=lazy(()=>import("./TextEditor").then((module)=>({default:module.EditorCommands})));

type EditorProps=ComponentPropsWithoutRef<typeof EditorImpl>;
type CommandsProps=ComponentPropsWithoutRef<typeof CommandsImpl>;

export const TextEditor=forwardRef<EditorHandle,EditorProps>(function LazyTextEditor(props,ref) {
 return <Suspense fallback={null}><EditorImpl {...props} ref={ref}/></Suspense>;
});

export function EditorCommands(props:CommandsProps) {
 return <Suspense fallback={null}><CommandsImpl {...props}/></Suspense>;
}

export type {EditorHandle};
