// The musical law's role classification, IN the type (L9; QL-MEF #281 §1.3 —
// "Classify each physical or sonic role": a resonating body is not the same
// object as a moving emitter, a collision trigger, an analysis display or a
// symbolic glyph; WORLD-SHELL-DESIGN §18: "every sonic/physical role is
// classified").
//
// The two QL track adapters consume these roles: the audio adapter admits the
// roles whose operative product is sound; the visual/physics adapter admits
// the roles whose operative product is visible physical behaviour; and both
// REFUSE a miscast role by naming the law. An analyser belongs to metering,
// never to either track: it is diagnostic, not musical material.
//
// Pure TypeScript. No React, no adapters here — only the classification.

export type QlSonicRole = 'emitter' | 'resonator' | 'collision-trigger' | 'analyser' | 'visual-only'

export interface QlRoleLaw {
  readonly label: string
  /** What the role produces or receives (§1.3's own sentences, compressed). */
  readonly law: string
  readonly sounds: boolean
  readonly visible: boolean
  /** True for the explicitly-visual-only role: never certified as physical
   * synthesis, and never upgraded by placement (Timeline honesty law). */
  readonly visualOnly: boolean
}

export const QL_ROLE_LAWS: Readonly<Record<QlSonicRole, QlRoleLaw>> = Object.freeze({
  emitter: Object.freeze({
    label: 'moving emitter',
    law: 'trajectory and receiver determine spatial rendering — a moving source is not a resonating body',
    sounds: true, visible: true, visualOnly: false,
  }),
  resonator: Object.freeze({
    label: 'resonating body',
    law: 'excitation plus material, geometry and constraints determine evolving state; audio pickup and visible displacement both derive from that one state (the common-cause law)',
    sounds: true, visible: true, visualOnly: false,
  }),
  'collision-trigger': Object.freeze({
    label: 'collision trigger',
    law: 'contact events explicitly trigger or modulate synthesis — an event, not a voice',
    sounds: true, visible: true, visualOnly: false,
  }),
  analyser: Object.freeze({
    label: 'analyser',
    law: 'measured audio is the input and the display is diagnostic — an analyser is metering, never musical material',
    sounds: false, visible: true, visualOnly: false,
  }),
  'visual-only': Object.freeze({
    label: 'visual-only glyph',
    law: 'visual-only changes remain visual-only; they must not be falsely certified as physical synthesis',
    sounds: false, visible: true, visualOnly: true,
  }),
})

/** The roles the AUDIO track admits: material whose operative product is
 * sound. The analyser is refused (diagnostic), the visual-only glyph is
 * refused (silent by declaration). */
export const QL_AUDIO_ROLES: readonly QlSonicRole[] = Object.freeze(['emitter', 'resonator', 'collision-trigger'])

/** The roles the VISUAL/PHYSICS track admits: material whose operative
 * product is visible physical behaviour — including the honestly-labelled
 * visual-only glyph. The analyser is refused (it belongs to the metering
 * surfaces, not to either track). */
export const QL_PHYSICS_ROLES: readonly QlSonicRole[] = Object.freeze(['emitter', 'resonator', 'collision-trigger', 'visual-only'])
