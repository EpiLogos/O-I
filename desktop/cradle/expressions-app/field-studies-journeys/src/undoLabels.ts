import type {ResearchCardKind,ResearchMaterialAction} from './researchMaterial.js';
/** Names for the one undo history. Every undoable edit says what it is in the
 * app's own voice ("Trim scene 3", "Reorder scenes", "Move object"), so Undo,
 * Redo and their toast can name the edit they reverse. Pure: no DOM, no store. */
export type HistoryDirection='undo'|'redo';

/** A parameter edit is named by the parameter it sets. A bind path the
 * registry does not name falls back to "Set value". */
export function bindingEditLabel(name?:string|null):string{
 const trimmed=name?.trim();
 const word=/^[A-Z][a-z]/.test(trimmed??'')?trimmed!.charAt(0).toLowerCase()+trimmed!.slice(1):trimmed;
 return word?`Set ${word}`:'Set value';
}

/** Every research material action names the card, view or frame it changes. */
const RESEARCH_MATERIAL_LABELS:Record<ResearchMaterialAction['type'],string>={
 'resize':'Resize card',
 'duplicate':'Duplicate card',
 'create-card':'Add card',
 'card-content':'Edit card',
 'card-caption':'Edit card caption',
 'card-style':'Style card',
 'annotation-add':'Add annotation',
 'annotation-remove':'Remove annotation',
 'viewport':'Move view',
 'timeline-layout':'Arrange or style timeline card',
 'frame-save':'Save frame',
 'frame-remove':'Remove frame',
 'frame-title':'Title frame',
 'frame-order':'Reorder frames',
 'view-save':'Save view',
 'view-remove':'Remove view',
 'place-view-save':'Save place view',
 'place-view-remove':'Remove place view',
 'place-layers-set':'Set map layers',
 'place-tour-save':'Save place tour',
 'place-tour-remove':'Remove place tour',
 'timeline-view-save':'Save timeline view',
 'timeline-view-remove':'Remove timeline view',
 'batch':'Edit research material',
};
/** lane-1 A10: an embed or media card is named as what it adds; every other create-card keeps "Add card". */
export function researchMaterialLabel(action:{type:ResearchMaterialAction['type'];kind?:ResearchCardKind;label?:string}):string{
 if(action.type==='batch'&&action.label)return action.label;
 if(action.type==='create-card'&&action.kind==='embed')return 'Add link card';
 if(action.type==='create-card'&&action.kind==='media')return 'Add media card';
 return RESEARCH_MATERIAL_LABELS[action.type];
}

/** A connection's line records (kind, label, sides) are named as the lines they set. */
export function connectionLinesLabel(count:number):string{
 return count===1?'Connection line':'Connection lines';
}

/** A connection act names what it connects: one connection, or several cards at once (drag, import). */
export function connectActLabel(count:number):string{
 return count===1?'Connect':'Connect cards';
}

/** An adoption from outside this editor (another window, the kernel's own reconcile) is named for what it is. */
export const KERNEL_UPDATE_LABEL='Update from the kernel';
/** Why Undo refuses an outside update: the owner holds that change, and this editor has no inverse for it. */
export const OUTSIDE_UPDATE_REASON='it came from outside this editor, and the native owner holds that change; this editor has no inverse for another owner\'s change';

/** What the Undo or Redo toast says about the edit it reversed. */
export function historyToast(direction:HistoryDirection,label:string|null):string{
 if(!label)return direction==='undo'?'Nothing to undo.':'Nothing to redo.';
 return `${direction==='undo'?'Undone':'Redone'}: ${label}.`;
}

/** The accessible name and tooltip of the Undo or Redo control. */
export function historyTitle(direction:HistoryDirection,label:string|null):string{
 const verb=direction==='undo'?'Undo':'Redo';
 return label?`${verb} ${label}`:verb;
}
