export interface ContentNode { id:string;title:string;level:number;body:string;children:ContentNode[] }
export function parsePublicContent(source:string):ContentNode[];
