/** Display and read-only projection of native source identity, not authority. */
export function sourceBreadcrumb(buffer:{root_register?:boolean;project:string;path?:string}):string {
 if(!buffer.root_register&&!buffer.project)return `Central / [scope unavailable] / ${buffer.path??"[location unavailable]"}`;
 return buffer.root_register?`Central / ${buffer.path??"[location unavailable]"}`:`Central / Work / ${buffer.project} / ${buffer.path??"[location unavailable]"}`;
}
export function sourceSaveLabel(dirty:boolean,nativeDay:boolean):string {
 return nativeDay?(dirty?"Raw-source draft retained; Day uses native Save":"Day form has its own native Save"):(dirty?"Unsaved":"Saved");
}
export interface NativeDaySource {
 schema:"central.contribution-document/v1";kind:"day";document_id:string;
 template_payload:Record<string,unknown>;fields:{id:string;label?:string;template_pointer?:string}[];
}
export function nativeDaySource(canonical:string):NativeDaySource|null {
 try {
  const value:unknown=JSON.parse(canonical);
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const d=value as Record<string,unknown>;
  if(d.schema!=="central.contribution-document/v1"||d.kind!=="day"||typeof d.document_id!=="string"||!d.document_id||!d.template_payload||typeof d.template_payload!=="object"||Array.isArray(d.template_payload)||!Array.isArray(d.fields))return null;
  if(d.fields.some(f=>!f||typeof f!=="object"||typeof f.id!=="string"||(f.template_pointer!==undefined&&typeof f.template_pointer!=="string")))return null;
  return d as unknown as NativeDaySource;
 }catch{return null;}
}
