declare module "@epilogos/oi-design-system/loading" {
 export function createPointClusters(options?:{active?:boolean}):{element:HTMLElement;remove:()=>void;setActive:(active:boolean)=>void};
 export function createLoadingIndicator(options:{label:string;detail?:string;scope?:"inline"|"surface"|"window";active?:boolean}):{element:HTMLElement;remove:()=>void;update:(options:{label?:string;detail?:string;active?:boolean})=>void};
}
