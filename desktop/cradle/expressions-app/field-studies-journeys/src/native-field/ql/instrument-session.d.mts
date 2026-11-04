export class InstrumentSession {
 constructor(options: any);
 readonly reading: any;
 start(periodMs?: number): void;
 hold(reason?: string): any;
 pump(): Promise<any>;
 present(): any;
 recover(reason: string): Promise<any>;
 operate(command: any): Promise<any>;
 inspect(): Promise<any>;
 influence(): Promise<any>;
 /** The Ta-Onta procedural stage's scoped disclosure (ql.stage-state/v1): a read on the one owner. */
 stageState(): Promise<any>;
 /** The Tarot score reads (`score-resolve` {basis} / `score-state` {}): the held `ql.tarot-score/v1` with its currentness and the
  * event it was resolved against, or the owner's named refusal as data. A read: the field never advances. */
 score(command: any): Promise<{refused: true; error: string} | {refused: false; score: any; current: boolean; resolved_event_ref: string}>;
 /** A played excitation: strike named scene voices by native mode reference, amplitude in modal metres; now, or at `at_samples_elapsed`,
  * the exact sample cursor of the owner's continuation it lands at (O-I #809), refused when behind the acknowledged cursor. */
 strike(strikes: Array<{mode_ref: string; amplitude: [number, number]}>, when?: {at_samples_elapsed?: string}): Promise<any>;
 /** A strike at points of the torus (QL-MEF #342 `strike-at`): each voice is excited by its own shape at each (theta, phi) in [0, 2π); 1..64 points
  * are one act, refused whole when a point is off the sheet or an impulse passes the material policy. */
 strikeAt(points: Array<{theta: number; phi: number; amplitude: [number, number]}>, when?: {at_samples_elapsed?: string}): Promise<any>;
 /** The Torus's M1′ session (`ql.m1-prime-session/v1`, O-I #850): every setting, the band, the pulse, the shape, the comma and the
  * notes. A read: the field never advances. */
 torusState(): Promise<any>;
 /** One edit of the Torus session (rate, tempo_bpm, fundamental, carrier, shape, tuning, polyphony); the owner refuses in words.
  * Only a Fundamental change moves the owner (one modes continuation). `at_samples_elapsed`, as for a strike (O-I 855): for a later sample
  * it waits, moving nothing, and the block that reaches that sample makes it there (its reply's torus_set_landed). */
 torusSet(edit: Record<string, unknown>, options?: {at_samples_elapsed?: string}): Promise<any>;
 /** Jankó keys strike their moving points on the tuning in force: one strike at points, one generation; receipt as lastTorusPlay. */
 torusPlay(keys: Array<{row: number; column: number}>, options?: {amplitude?: [number, number]; at_samples_elapsed?: string}): Promise<any>;
 /** Release keys from the count of notes; the body rings on, no native state moves. */
 torusRelease(keys: Array<{row: number; column: number}>): Promise<any>;
 /** The Torus as it rings (`ql.torus-checkpoint/v1`, O-I #855): the body's state, form, forces, comma and seeds at the acknowledged
  * sample. A read: the field never advances. */
 torusCheckpoint(): Promise<any>;
 /** Ring the Torus again from a checkpoint the owner gave: one owner act (one to four generations), refused in words when the
  * checkpoint is not of this body. */
 torusRestore(checkpoint: Record<string, unknown>): Promise<any>;
 /** A take rendered offline on a second owner of the scene (`ql.torus-render/v1`, O-I #855): from a checkpoint, or continuing the last
  * render, `frames` of sound with each act made at its sample. A read: this owner neither moves nor sounds. */
 torusRender(take: {checkpoint?: object; continues?: string; frames: number;
  acts?: Array<{action: 'strike'; at_samples_elapsed: string; keys: Array<{row: number; column: number}>; amplitude: [number, number]}
   | {action: 'release'; at_samples_elapsed: string; keys: Array<{row: number; column: number}>}
   | {action: 'set'; at_samples_elapsed: string; edit: object}>}): Promise<any>;
 /** Where the Torus is heard from (`ql.torus-receiver/v1`, O-I 856): a place, [x, y, z] metres in the frame the targets are drawn in,
  * is the listener's own context; null is the world's. A receiving setting: the body, its clock and its generation stand, nothing is
  * presented, and it is never journaled. Answers the context and each voice's gain, never the place. */
 torusReceiver(place: readonly [number, number, number] | null): Promise<{schema: 'ql.torus-receiver/v1'; context: 'world' | 'personal';
  gains: Array<{mode_ref: string; gain: number}>; law: string}>;
 /** The Torus session reading the last Torus acknowledgement carried, or null before any. */
 readonly lastTorus: any;
 /** The last played Torus act's receipt (ql.torus-play/v1), or null before any. */
 readonly lastTorusPlay: any;
 /** Frozen copy of every admitted owner act and the aggregate advance data plane. */
 journal(): any;
 readonly lastInfluence: any;
 /** The last stage act's own receipt (ql.stage-receipt/v1), or null before any. */
 readonly lastStageReceipt: any;
 personal(input?: any): Promise<any>;
 setMuted(muted: boolean): any;
 dispose(): void;
}
