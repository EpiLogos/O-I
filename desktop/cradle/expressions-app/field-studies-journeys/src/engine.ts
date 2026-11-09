import {TransportState} from '../../src/engine/transportState';
import {Scene,Vec3} from './model.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {Camera} from './camera.js';
/** All document writes belong to the shell. Adapters never create their own clock or UI. */
export interface EngineFrame {
 formationGeometryProjection?:import('../../src/engine/formationGeometryProjection').FormationGeometryProjection|null;
 localizedResonanceProjection?:import('../../src/engine/localizedResonanceProjection').LocalizedResonanceProjection|null;
 forceEmitterProjection?:import('../../src/engine/forceRuntime').ForceEmitterProjection|null;
 entitySoundProjection?:(scene:Readonly<Scene>)=>Readonly<Scene>;
 connections?:readonly ConnectionBinding[];selectedConnection?:string|null;
 scene:Readonly<Scene>;scaffold?:'off'|'axis'|'grid';authoringRevision?:number;liveRevision?:number;simTime:number;delta:number;params:Readonly<Record<string,number>>;
 camera:Readonly<Camera>;pointer:{active:boolean;world:Vec3};selectedIds:ReadonlyArray<string>;
}
export interface EngineCapabilities {name:string;kind:'preview'|'production';parameters:ReadonlyArray<string>;physicalResonance:boolean;runtimeCheckpoints:boolean;exactSeek:boolean;notes:ReadonlyArray<string>}
export type PointerEffectKind='pulse'|'implode'|'vortex'|'shove';
export type EngineCommand={type:'reset-field'}|{type:'recover-context'}|{type:'reset-phases'}|{type:'disperse';strength:number}|{type:'fire-automation';id:string;delay?:number}|{type:'pointer-effect';kind:PointerEffectKind;strength:number;radius:number;x:number;y:number;z:number};
export interface FieldEngineAdapter {
 hitEntity?(x:number,y:number):string|null;
 hitConnection?(x:number,y:number):ConnectionBinding|null;
 inspectConnections?():unknown;
 transportState?():TransportState|undefined;
 restoreTransport?(state:TransportState):void;
 command?(command:EngineCommand):void;
 readonly canvas:HTMLCanvasElement;
 readonly capabilities:EngineCapabilities;
 /** One step of the field at the frame. `draw` false (O-I #747 round 896 1V, F1): the engine steps, its physics, its automation and its
  * contact read-back, and draws nothing, while its host shows it none; absent or true, it steps and draws. */
 render(frame:EngineFrame,draw?:boolean):void;
 resize(width:number,height:number,pixelRatio:number):void;
 needsRender?():boolean;
 /** Whether the GPU is still on the field's last step (PointCloudField.gpuBehind): a step drawn on a timer, which no animation frame
  * paces, is taken undrawn while it is (O-I #747 round 896 1V, F3). */
 gpuBehind?():boolean;
 telemetry?():any;
 /** The pitches the torus plays now, read from the native owner (DLW §20.14 Frequency driver = Torus). Absent: the engine has no torus drive. */
 setTorusPlay?(reading:import('../../src/engine/torusDrive').TorusPlayReading|null):void;
 /** The node the controller offers for the symbols' voices to listen to (DLW §20.2: a symbol's voice carries part of the torus's sound), in the controller's audio context; null while no instrument is open. */
 setTorusTap?(tap:import('./native-field/symbolVoices').TorusTap|null):void;
 /** The torus's voices that sound, as force points read each tick (O-I 851); null while no instrument is open. */
 setTorusVoices?(source:(()=>readonly import('../../src/engine/forceRuntime').ForceEmitterState[])|null):void;
 /** The contacts of the field's particles the engine read back since the last take, while the scene's Collisions strike is On (DLW §20.2
  * Field; O-I 856), and whether it listens and can make any. Absent: the engine reads back no contacts. */
 takeContacts?():{contacts:readonly import('../../src/engine/pairwiseSchedule').FieldContact[];standing:import('../../src/engine/pairwiseSchedule').ContactStanding}|null;
 /** The plate as the body laid flat while the instrument holds the field, and the drive the pulse is tuned to (O-I 851). */
 plateBody?():{flat:boolean;pulseHz:number|null};
 capture?(width:number,height:number):HTMLCanvasElement;
 withCleanFrame?<T>(copy:()=>T):T;
 inspect?(readParticles?:boolean):unknown;
 projectNative?(point:Vec3):unknown;
 stations?():Array<{id?:string;index:number;name:string;frequencyHz:number;m:number;n:number;color:string;energy?:number;semanticNodeId?:string;affinity?:number}>;
 dispose():void;
}
export type EngineFactory=(canvas:HTMLCanvasElement)=>FieldEngineAdapter;
declare global {interface Window {
 OI_ENGINE_FACTORY?:EngineFactory;
 __JOURNEY__?:unknown;
 __START_PRESENTATION__?:boolean;
 __FIELD_STUDIES__?:any;
}}
