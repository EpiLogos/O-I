import {Journey} from './model';
export function recordRecent(ids:unknown,id:string):string[]{return [id,...(Array.isArray(ids)?ids.filter((v):v is string=>typeof v==='string'&&v!==id):[])].slice(0,24);}
export function recentJourneys(journeys:Journey[],ids:unknown):Journey[]{const order=Array.isArray(ids)?ids.filter((v):v is string=>typeof v==='string'):[];return [...journeys].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);if(ai>=0||bi>=0)return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);return b.updatedAt.localeCompare(a.updatedAt);});}
