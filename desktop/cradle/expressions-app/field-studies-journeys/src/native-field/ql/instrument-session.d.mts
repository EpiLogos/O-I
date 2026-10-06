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
 /** A played excitation: strike named scene voices by native mode reference, amplitude in modal metres. */
 strike(strikes: Array<{mode_ref: string; amplitude: [number, number]}>): Promise<any>;
 /** Frozen copy of every admitted owner act and the aggregate advance data plane. */
 journal(): any;
 readonly lastInfluence: any;
 personal(input?: any): Promise<any>;
 setMuted(muted: boolean): any;
 dispose(): void;
}
