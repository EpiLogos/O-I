// A browser subject by its form and its file's name ("Day · 2026-10-08.md"), as the detail head names it (moved from
// central/clipBinding.ts, which re-exports it, so the detail table's head reads it without loading Central's clip binding; O-I #740).
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {subjectWords} from './daySurface'

const FORM: Record<CentralSubjectSelection['kind'], string> = {folder: 'folder', note: 'note', day: 'day'}

/** A browser subject by its form and its file's name ("Day · 2026-10-08.md"), as the detail head names it (ported from
 * CentralClipDetail.tsx centralSubjectName). */
export const centralSubjectName = (subject: CentralSubjectSelection): string => `${FORM[subject.kind][0]!.toUpperCase()}${FORM[subject.kind].slice(1)} · ${subjectWords(subject.path)}`
