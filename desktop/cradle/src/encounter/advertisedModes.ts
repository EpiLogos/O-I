/**
 * The permission modes each connection's harness advertised the last time
 * this app read one of its sessions (10-SIDEBARS §4.1, amendment A2).
 *
 * AIKit's default-mode setting (`ai-kit:permissions:permissions.default-mode`)
 * maps a harness — named by its encounter provider id — to one of the modes
 * that harness itself advertises; AIKit never defines a mode, and the only
 * place a harness says which modes it offers is a live session (ACP
 * `session/new` modes). Settings therefore offers, per connection, exactly the
 * modes that connection was seen offering, with when it was seen — an
 * observation, never a catalogue. Per-viewer convenience memory: it may be
 * empty, and nothing is claimed when it is.
 */
import type {NativeModeOption} from "./nativeMode";

export interface AdvertisedModes {provider:string;label:string;modes:NativeModeOption[];seenAt:number}

const listeners=new Set<()=>void>();
// These are session observations, not browser-owned capability declarations.
// A reload starts unknown until a native session advertises its modes again.
let held:Record<string,AdvertisedModes>={};

/** Record what a connection's harness advertised (an empty list is recorded too: "offers none"). */
export function recordAdvertisedModes(provider:string,label:string,modes:NativeModeOption[],now=Date.now()):void {
 if(!provider)return;
 const all=held;
 const next={provider,label,modes:modes.map(({id,name})=>({id,name})),seenAt:now};
 const prior=all[provider];
 if(prior&&prior.label===next.label&&JSON.stringify(prior.modes)===JSON.stringify(next.modes)&&now-prior.seenAt<60_000)return;
 all[provider]=next;
 for(const listener of listeners)listener();
}

export function advertisedModes():AdvertisedModes[] {
 return Object.values(held).sort((a,b)=>a.label.localeCompare(b.label)||a.provider.localeCompare(b.provider));
}

export function watchAdvertisedModes(listener:()=>void):()=>void {listeners.add(listener);return()=>{listeners.delete(listener);};}

/** Tests only. */
export function resetAdvertisedModesForTest():void {held={};listeners.clear();}
