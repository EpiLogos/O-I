import type {ComponentType} from 'react';
import type {PanelContext,PanelRegistration} from '../../../live-shell/ui/src/shell/panels';
import type {InstrumentDefinition} from '../frame/InstrumentFrame';
/** Receives the shell's existing registerPanel extension. No plugin runtime,
 * global route, store or admission path is introduced by this package. The
 * host supplies a component closure carrying its real bound owner ports. */
export function registerInstrumentEditorPanels(register:(panel:PanelRegistration)=>void,entries:readonly {definition:InstrumentDefinition;component:ComponentType<PanelContext>}[]){
 for(const [index,{definition,component}]of entries.entries())register({id:`instrument-editor.${definition.id}`,title:definition.name,slot:'bottom',component,order:200+index,note:'Bound native instrument · compact and full editor'});
}
