/** Lane-4 T25 — the tour being recorded, held per open Scene for this session only. It is presentation state, like the
 * layer filter: it is not a second store of the tour. Saving a tour to the Scene is OPEN (the native `placeTours` material
 * key, with its write action and kernel validation); until it lands a recorded tour lives here and nowhere else. */
import type {PlaceTourRecord} from './placeTours.js';

export interface PlaceTourSession {recording:boolean;record:PlaceTourRecord}

const sessions=new Map<string,PlaceTourSession>();

/** The session's tour state for one Scene. A Scene never opened in this session reads as not recording, with no stops. */
export function placeTourSessionOf(sceneId:string):PlaceTourSession{
 let session=sessions.get(sceneId);
 if(!session){session={recording:false,record:{stops:[]}};sessions.set(sceneId,session);}
 return session;
}

/** Forgets the recorded tour of one Scene (the owner clears it, or the Scene is removed). */
export function clearPlaceTourSession(sceneId:string):void{sessions.delete(sceneId);}
