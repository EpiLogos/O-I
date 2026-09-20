export class RetainedFieldBinding {
 constructor(simulator: any, options: any);
 readonly targetA: any; readonly targetB: any; readonly lastReceipt: any;
 validate(frame: any): boolean; apply(frame: any): boolean;
 checkpoint(renderer: any): any; restore(renderer: any, checkpoint: any): void;
 dispose(): void;
}
