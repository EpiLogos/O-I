/** Open the wiki Constellation focused on one wiki subject. The knowledge panel
 * (`panels/knowledge.tsx`) is the one receiver of `oi:epi-open-knowledge`;
 * this only dispatches the wiki address it admits. `complete` receives the
 * owner's own refusal, when the panel refuses. */
import {constellationRequest} from './centralVertical'

export function openConstellation(subjectRef: string, title: string, complete?: (error?: string) => void): void {
  window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {
    detail: {...constellationRequest(subjectRef, title), ...(complete ? {complete} : {})},
  }))
}
