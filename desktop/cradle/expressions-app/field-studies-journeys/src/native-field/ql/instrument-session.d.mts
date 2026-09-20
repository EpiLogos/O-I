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
 setMuted(muted: boolean): any;
 dispose(): void;
}
