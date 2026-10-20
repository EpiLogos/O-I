// Generator version 2 (T-PROCEDURAL-BODY). STEP 1 PLACEHOLDER: the contract surface stands first so that the engine and the system can code against it; until
// the field lands (the next commit) version 2 is drawn by the legacy code, which is what the version-2 tests (red) say it must stop doing.
import * as legacy from './bodyLegacy'
import type {BodyImage, BodyLook, WorldBodyRecord} from './body'

export const heightAt = (record: WorldBodyRecord, x: number, y: number, z: number): number => legacy.heightAt(record, x, y, z)
export const seaHeight = (record: WorldBodyRecord): number => legacy.seaHeight(record)
export const bodyImage = (record: WorldBodyRecord, width: number, _look?: BodyLook): BodyImage => legacy.bodyImage(record, width)
export const landShare = (record: WorldBodyRecord, width: number): number => legacy.landShare(record, width)
export const cloudImage = (record: WorldBodyRecord, width: number, _look?: BodyLook): BodyImage => legacy.cloudImage(record, width)
export const airOf = (record: WorldBodyRecord, _look?: BodyLook): number => legacy.airOf(record)
export const bodyDisc = (record: WorldBodyRecord, size: number, _look?: BodyLook, _timeMs?: number | null): BodyImage => legacy.bodyDisc(record, size)
