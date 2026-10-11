import type {InstrumentDefinition} from './frame/InstrumentFrame';
const placements=['rack','dock','floating','focused','popout'] as const;
const define=(id:string,name:string,full:[number,number],targetIds:string[],aspect:'free'|'wide'|'square'='free'):InstrumentDefinition=>({id:`techne.${id}`,name,targetIds,constraints:{compact:{width:440,height:230,minWidth:280,minHeight:170},full:{width:full[0],height:full[1],minWidth:640,minHeight:440},aspect,resize:'viewport',focusTargets:[({project:'[aria-label="Graph query"]',canvas:'[aria-label="Canvas editor"] [role="button"]',timeline:'[aria-label="Timeline editor"] button',journey:'[aria-label="Journey editor"] [role="button"]',places:'[aria-label="Places editor"] button',palace:'[aria-label="Rooms and guided path"] [role="button"]'} as Record<string,string>)[id]??'input,select,button','input,textarea,select,button','canvas,[role="button"]'],placements}});
/** Source target identifiers remain qualified by their original lane. These
 * are traceability, not pass claims or a second capability inventory. */
export const PROJECT_GRAPH=define('project','Project / Graph',[1100,720],['lane-1:C1','lane-1:C2','lane-1:C3','lane-1:C4','lane-1:D1','lane-1:D2','lane-1:D3']);
export const CANVAS=define('canvas','Canvas',[1100,720],[...Array.from({length:10},(_,i)=>`lane-1:A${i+1}`),...Array.from({length:4},(_,i)=>`lane-1:B${i+1}`),'lane-1:D1','lane-1:D2']);
export const TIMELINE=define('timeline','Timeline',[1200,700],Array.from({length:25},(_,i)=>`lane-2:T${i+1}`),'wide');
export const JOURNEY=define('journey','Journey',[1200,760],Array.from({length:13},(_,i)=>`lane-5:T${i+1}`),'wide');
export const PLACES=define('places','Places',[1150,760],Array.from({length:30},(_,i)=>`lane-4:T${i+1}`));
export const PALACE=define('palace','Palace',[1100,740],Array.from({length:11},(_,i)=>`lane-5:T${i+14}`));
export const TECHNE_EDITORS=[PROJECT_GRAPH,CANVAS,TIMELINE,JOURNEY,PLACES,PALACE] as const;

/** Current native automation group editor. Target traceability is reported in
 * SOURCE-TARGETS.md; no programme-wide acceptance is implied by registration. */
export const MODULATION:InstrumentDefinition={id:'expressions.modulation',name:'Modulation',targetIds:[],constraints:{compact:{width:440,height:260,minWidth:320,minHeight:210},full:{width:1160,height:760,minWidth:680,minHeight:460},aspect:'wide',resize:'reflow',focusTargets:['[aria-label="Modulation rate"]','[role="slider"]'],placements}};
