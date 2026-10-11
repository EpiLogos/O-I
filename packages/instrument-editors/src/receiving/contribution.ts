import type {HostedSurfaceDescriptor,HostedMountProps,RegisteredHostedSurface} from '../../../../desktop/cradle/src/contributions/contracts';
import type {ComponentType} from 'react';
import type {InstrumentDefinition} from '../frame/InstrumentFrame';
import type {EditorConstraints} from '../frame/presentation';
/** Additive presentation information on the existing compiled contribution.
 * Registration/admission, native bindings and retained mounts remain owned by
 * the host's current contribution registry. */
export interface InstrumentEditorDescriptor extends HostedSurfaceDescriptor{
 editorPresentation:EditorConstraints;
 targetIds:readonly string[];
}
export function instrumentEditorContribution(definition:InstrumentDefinition,owner:string,Component:ComponentType<HostedMountProps>):RegisteredHostedSurface&{descriptor:InstrumentEditorDescriptor}{
 if(!owner.trim())throw Error('A native contribution requires its disclosed owner.');
 return {descriptor:{descriptor_ref:`oi.instrument-editor:${definition.id}`,contribution_ref:'oi.instrument-editors',owner,revision:1,kind:`instrument-editor.${definition.id}`,title:definition.name,retention:'mounted',region:'canvas',editorPresentation:definition.constraints,targetIds:definition.targetIds},Component};
}
