import type { Edition, NativeBodyDescriptor } from './model.mjs';
export interface Camera {mode:string;yaw:number;pitch:number;zoom:number;panX:number;panY:number;[key:string]:unknown}
export class PublicField {
 constructor(canvas:HTMLCanvasElement,onError:(error:string)=>void,onPositions:(positions:{ref:string;x:number;y:number}[])=>void,onTick:(delta:number)=>void);
 camera:Camera;setScene(composition:Edition['publication']['composition'],sceneRef:string,camera?:Partial<Camera>,nativeJourney?:any,nativeSceneMap?:Record<string,string>):void;
 setActive(active:boolean):void;setPlaying(playing:boolean):void;setSelected(ref:string):void;
 view(change:Partial<Camera>):void;home():void;recover():void;dispose():void;
 inspect():{frames:number;active:boolean;playing:boolean;camera:Camera;scene?:string};
}
export function loadNativeJourney(descriptor:NativeBodyDescriptor):Promise<{journey:any;sceneMap:Record<string,string>}|null>;
export function projectComposition(composition:Edition['publication']['composition'],sceneRef:string,nativeJourney?:any,nativeSceneMap?:Record<string,string>):unknown;
