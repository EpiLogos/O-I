/// <reference path="./browserAttributes.d.ts" />
export {InstrumentFrame,createInstrumentPresentation} from './frame/InstrumentFrame';
export type {InstrumentDefinition,InstrumentFrameProps} from './frame/InstrumentFrame';
export {InstrumentPresentation,sameTarget} from './frame/presentation';
export type {EditorCheckpoint,EditorTarget,EditorConstraints,EditorDepth,EditorPlacement,EditorPresentationHost} from './frame/presentation';
export {GraphEditor} from './graph/GraphEditor';
export type {GraphEditorProps} from './graph/GraphEditor';
export {CanvasEditor} from './canvas/CanvasEditor';
export {TimelineEditor,PlacesEditor} from './research/ResearchEditor';
export type {ResearchEditorProps,ResearchEditorView,ResearchEvidenceContext} from './research/ResearchEditor';
export {JourneyEditor} from './journey/JourneyEditor';
export type {JourneyEditorHost,JourneyEditorProps,JourneyBasis} from './journey/JourneyEditor';
export * from './definitions';
export {registerInstrumentEditorPanels} from './receiving/panels';
export {instrumentEditorContribution} from './receiving/contribution';
export type {InstrumentEditorDescriptor} from './receiving/contribution';
export type {CanvasEditorProps} from './canvas/CanvasEditor';

export {ModulationEditor} from './modulation/ModulationEditor';
export type {ModulationHost,ModulationEditorProps} from './modulation/ModulationEditor';
export {modulationOwnerPort} from './receiving/modulationOwner';
export {JourneyPhrase} from './receiving/journeyPhrase';
export type {JourneyPhraseOwner} from './receiving/journeyPhrase';

export {instrumentSurfaceOwner} from './receiving/surfaceOwner';
export type {InstrumentSurfaceOwner} from './receiving/surfaceOwner';
