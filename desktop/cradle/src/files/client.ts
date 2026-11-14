import {kernelAct,kernelOp,kernelRead} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus, NativeDirectory, NativeFileBytes, NativeFileReading} from "../kernel/types";
/** A listing is answered from the window's held reading until the kernel says the ground moved (kernel/bridge.ts kernelRead).
 * `fresh` asks the owner again and replaces it — the explicit refresh affordance, not an ordinary expansion. */
export async function listFiles(transport:KernelTransportStatus,path:string,fresh=false):Promise<NativeDirectory> {
  const result=await kernelRead(transport,fresh?{op:"files_list",path,fresh}:{op:"files_list",path},{fresh});
  if(result.error || result.outcome?.result!=="directory_read")throw new Error(result.error??"Central did not return a directory reading");
  return result.outcome.directory;
}
/** A file reading, held like a listing; `fresh` for a read that precedes a write or answers an explicit refresh. */
export async function readFile(transport:KernelTransportStatus,location:CentralLocation,fresh=false):Promise<NativeFileReading> {
  const result=await kernelRead(transport,{op:"file_read",location},{fresh});
  if(result.error || result.outcome?.result!=="file_read")throw new Error(result.error??"Central did not return a file reading");
  return result.outcome.reading;
}
/** The binary-safe material read (FND-04): base64 content plus the
 * owner's mime hint. Used for images and any renderer that needs raw
 * bytes rather than the UTF-8 text contract. */
export async function readFileBytes(transport:KernelTransportStatus,location:CentralLocation):Promise<NativeFileBytes> {
  const result=await kernelRead(transport,{op:"file_bytes",location});
  if(result.error || result.outcome?.result!=="file_bytes")throw new Error(result.error??"Central did not return a material reading");
  const {location:loc,revision,byte_len,mime_hint,content_base64,source}=result.outcome;
  return {location:loc,revision,byte_len,mime_hint,content_base64,source};
}

/** What the kernel's `file_operation` op takes (kernel files.rs `FileRead`): a file's history and a recovery's preview. */
export type FileRead={action:"history";limit?:number;before?:number}|{action:"recovery_preview";expected_revision:string;revision:string};
/** A file's save and restore: Central's own Actions (`central.files.write`, `central.files.restore`; O-I #1002). */
export type FileMutationRequest={action:"write";expected_revision:string;content:string}|{action:"restore";expected_revision:string;revision:string};
export type FileRequest=FileRead|FileMutationRequest;
export interface FileMutation {outcome:"created"|"written"|"unchanged"|"conflict";revision?:string;current?:NativeFileReading}
export interface FileChange {cursor:number;previous_revision:string;revision:string;actor:string;actor_kind:string;restored_from?:string}
export interface FileHistory {current_revision:string;entries:FileChange[];more:boolean;next_before:number|null}
export interface FilePreview {revision:string;expected_revision:string;content:string;current_content:string;changed:boolean}
/** One file operation: a reading by the kernel's `file_operation`; a save or a restore as Central's Action through `act`, which names
 * the desktop person its actor when the input names none (kernel files.rs `attributed`). */
export async function fileOperation<T>(transport:KernelTransportStatus,location:CentralLocation,request:FileRequest):Promise<T> {
 if(request.action==="write"||request.action==="restore")return fileMutation<T>(transport,location,request);
 const result=await kernelOp(transport,{op:"file_operation",location,request});
 if(result.error||result.outcome?.result!=="file_operation")throw new Error(result.error??"Central did not return a file operation");
 return result.outcome.data as T;
}
/** A save or a restore (Central's `central.files.write`, `central.files.restore`), asked of the location as the kernel's `Location`
 * carries it. The kernel checks Central's answer names this very location and an outcome Central names (files.rs `unsound_mutation`);
 * a refusal is Central's own words, or the kernel's. */
function fileMutation<T>(transport:KernelTransportStatus,location:CentralLocation,request:FileMutationRequest):Promise<T> {
 if(location?.schema!=="central.path-ref/v1"||!location.ref||!location.root)throw new Error("Unsupported native file location");
 const {schema,ref,root,path}=location,{action,...input}=request;
 return kernelAct<T>(transport,`central.files.${action}`,{location:{schema,ref,root,path},...input});
}

/** Native retained resources never grant write, history or restore authority. */
export async function lastFileReading(transport:KernelTransportStatus,location:CentralLocation):Promise<import("../kernel/types").RetainedFileRecovery>{
 const result=await kernelOp(transport,{op:"file_last_reading",location});
 if(result.outcome?.result!=="file_last_reading")throw Error(result.error??"Native retained reading is unavailable");
 return result.outcome.recovery;
}

/** Resolve an opaque native path reference in its owner; never parse it here. */
export async function resolveFileLocation(transport:KernelTransportStatus,reference:string):Promise<CentralLocation>{
 const result=await kernelRead(transport,{op:"file_resolve",reference});
 if(result.error||result.outcome?.result!=="file_resolved")throw Error(result.error??"Central did not resolve this file");
 if(result.outcome.location.ref!==reference)throw Error("Central redirected the file reference");
 return result.outcome.location;
}
