/** Exact input to the existing native independent-axis operation. These
 * phases do not select a form/static aperture or advance either source clock. */
export type NativeAxis=0|1;
export interface NativeAxisPhase {turns:string;half_degrees:number}
export interface NativeSceneAxes {inscription:NativeAxisPhase;lensing:NativeAxisPhase}
export function nativeAxisPhase(value:unknown):NativeAxisPhase {
 const phase=value as Partial<NativeAxisPhase>|null;
 if(!phase||typeof phase.turns!=='string'||phase.turns.length>20||!/^(0|-?[1-9][0-9]*)$/.test(phase.turns)
  ||BigInt(phase.turns)<-(1n<<63n)||BigInt(phase.turns)>(1n<<63n)-1n
  ||typeof phase.half_degrees!=='number'||!Number.isInteger(phase.half_degrees)||phase.half_degrees<0||phase.half_degrees>719)
  throw Error('Native phase requires exact i64 turns and 0–719 half-degrees.');
 return {turns:phase.turns,half_degrees:phase.half_degrees};
}
export function nativeAxisRequest(axis:unknown,phase:unknown):{axis:NativeAxis;phase:NativeAxisPhase} {
 if(axis!==0&&axis!==1)throw Error('Choose inscription (0) or lensing (1).');
 return {axis,phase:nativeAxisPhase(phase)};
}
/** Call only on an already qualified native readback. No absent-phase default. */
export function nativeSceneAxes(clock:unknown):NativeSceneAxes {
 const value=clock as Partial<NativeSceneAxes>|null;
 if(!value)throw Error('The acknowledged native phases are unavailable.');
 return {inscription:nativeAxisPhase(value.inscription),lensing:nativeAxisPhase(value.lensing)};
}
