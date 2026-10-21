// The faces: creatures as the faces of agent types, environs as the faces of process types (manual §19.4, §19.14, §19.15, §25.6).
// A device draws a face from a figure or a pattern and a run state; nothing here reads an owner.
export {CreatureFace, FigureThumb, Glyph, useReducedMotion, type CreatureFaceProps} from './CreatureFace'
export {CrewFace, type CrewFaceProps, type CrewMember} from './CrewFace'
export {EnvironStage, type StageProps} from './EnvironStage'
export {TakesGrove, type Take, type TakeState} from './TakesGrove'
export {TypeBand, TypeWell, type TypeBandProps} from './TypeBand'
export {FAMILIES, HAZARDS, PATTERNS, RUN_STATES, countOf, hazardOf, isCrew, presetRows, type Pattern, type RunState} from './agency'
export {FACE_OF, FIGURES, INK, built, elementColour, faceOf, figureOf, type Figure} from './figures'
export {recordingFromThread, stateOfThread, type Recording, type ThreadRow} from './runs'
