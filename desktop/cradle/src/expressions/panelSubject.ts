/**
 * The subject the common right panel is accompanying, as the composition
 * root hands it to a mode's extra planes (Ta-Onta, Anima, Epii). It is a
 * pointer — a ref, its kind, a title and, for a file, where the file lives
 * so a plane can hold or open it — never a copy of the subject.
 */
import type {CentralLocation} from "../kernel/types";
export interface PanelSubject { ref?: string; kind?: string; title: string; project?: string; location?: CentralLocation }
