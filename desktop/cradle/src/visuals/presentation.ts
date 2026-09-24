/** Kernel presentation client. No local library, journal or storage key. */
import type { KernelOp, KernelOutcome, PresentationDocument, PresentationTheme } from "../kernel/types";
import { THEMES } from "@epilogos/oi-design-system/themes/index";
import { convertImportedTheme, validateCustomThemes } from "./customThemes";

export type PresentationApply = (op: KernelOp) => Promise<KernelOutcome | null>;
export interface PresentationState {
  document: PresentationDocument | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  observationError: string | null;
}
export function validatePresentation(raw: PresentationDocument): PresentationDocument {
  if (raw.schema !== "oi.presentation/v1" || !Number.isSafeInteger(raw.revision) || raw.revision < 0) throw new Error("The saved appearance reading is invalid.");
  const custom_themes = validateCustomThemes(raw.custom_themes);
  const theme = raw.theme;
  if (!theme || !["light","dark","system"].includes(theme.appearance) || (theme.id !== null && typeof theme.id !== "string")) throw new Error("The saved appearance selection is invalid.");
  if (theme.id !== null) {
    const entry = [...THEMES,...custom_themes].find(entry => entry.id === theme.id);
    if (!entry || entry.appearance !== theme.appearance) throw new Error("The saved theme is absent from its library or has a different appearance.");
  }
  return {...raw, custom_themes};
}
export class PresentationClient {
  private state: PresentationState = {document:null,loading:true,pending:false,error:null,observationError:null};
  private listeners = new Set<(state:PresentationState)=>void>();
  private reading: Promise<void> | null = null;
  private readAgain = false;
  private apply: PresentationApply;
  private project: (document:PresentationDocument)=>void;
  private failure: ()=>string|null;
  constructor(apply:PresentationApply, project:(document:PresentationDocument)=>void, failure:()=>string|null) {this.apply=apply;this.project=project;this.failure=failure;}
  get = () => this.state;
  subscribe = (listener:(state:PresentationState)=>void) => {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private update(patch:Partial<PresentationState>) {this.state={...this.state,...patch};for(const listener of this.listeners)listener(this.state);}
  private accept(result:KernelOutcome|null) {
    if (!result || result.result !== "presentation_reading") throw new Error(this.failure() || "The kernel did not return the saved appearance.");
    const document = validatePresentation(result.document);
    if (this.state.document && document.revision < this.state.document.revision) return;
    this.project(document);
    this.update({document});
  }
  read = (clearError = true):Promise<void> => {
    if (this.reading) {this.readAgain=true; return this.reading;}
    this.update({loading:true,...(clearError ? {error:null} : {})});
    this.reading = (async()=>{
      try {this.accept(await this.apply({op:"presentation_read"}));}
      catch(error) {this.update({error:String(error)});}
      finally {this.reading=null;this.update({loading:false});if(this.readAgain){this.readAgain=false;void this.read(false);}}
    })();
    return this.reading;
  };
  private async mutate(action:()=>Promise<void>) {
    if (!this.state.document || this.state.pending) return;
    this.update({pending:true,error:null});
    try {await action();} catch(error) {this.update({error:String(error)});} finally {this.update({pending:false});}
  }
  select = (theme:PresentationTheme) => this.mutate(async()=>{this.accept(await this.apply({op:"theme_apply",...theme}));});
  revert = () => this.mutate(async()=>{this.accept(await this.apply({op:"theme_revert"}));});
  remove = (id:string) => this.mutate(async()=>{this.accept(await this.apply({op:"theme_remove",id}));});
  importFile = (text:string,name:string) => this.mutate(async()=>{
    const theme = convertImportedTheme(text,name,this.state.document!.custom_themes);
    this.accept(await this.apply({op:"theme_import",theme}));
    this.accept(await this.apply({op:"theme_apply",id:theme.id,appearance:theme.appearance}));
  });
  async observe(window_id:string,visuals:unknown,arrangement:unknown) {
    try {
      const result=await this.apply({op:"presentation_observe",window_id,visuals,arrangement});
      if (!result || result.result!=="presentation_reading") throw new Error(this.failure() || "The layout observation was not recorded.");
      // Observations do not choose or refresh a theme. Only owner reads do.
      this.update({observationError:null});
    } catch(error) {this.update({observationError:String(error)});}
  }
}
