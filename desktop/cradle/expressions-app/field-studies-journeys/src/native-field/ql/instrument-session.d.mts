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
 /** A played excitation: strike named scene voices by native mode reference, amplitude in modal metres. */
 strike(strikes: Array<{mode_ref: string; amplitude: [number, number]}>): Promise<any>;
 /** A strike at points of the torus (QL-MEF #342 `strike-at`): each voice is excited by its own shape at each (theta, phi) in [0, 2π); 1..64 points
  * are one act, refused whole when a point is off the sheet or an impulse passes the material policy. */
 strikeAt(points: Array<{theta: number; phi: number; amplitude: [number, number]}>): Promise<any>;
 /** Frozen copy of every admitted owner act and the aggregate advance data plane. */
 journal(): any;
 readonly lastInfluence: any;
 personal(input?: any): Promise<any>;
 setMuted(muted: boolean): any;
 dispose(): void;
}
