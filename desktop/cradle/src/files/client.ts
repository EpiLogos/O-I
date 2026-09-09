import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus, NativeDirectory, NativeFileBytes, NativeFileReading} from "../kernel/types";
export async function listFiles(transport:KernelTransportStatus,path:string):Promise<NativeDirectory> {
  const result=await kernelOp(transport,{op:"files_list",path});
  if(result.error || result.outcome?.result!=="directory_read")throw new Error(result.error??"Central did not return a directory reading");
  return result.outcome.directory;
}
export async function readFile(transport:KernelTransportStatus,location:CentralLocation):Promise<NativeFileReading> {
  const result=await kernelOp(transport,{op:"file_read",location});
  if(result.error || result.outcome?.result!=="file_read")throw new Error(result.error??"Central did not return a file reading");
  return result.outcome.reading;
}
/** The binary-safe material read (FND-04): base64 content plus the
 * owner's mime hint. Used for images and any renderer that needs raw
 * bytes rather than the UTF-8 text contract. */
export async function readFileBytes(transport:KernelTransportStatus,location:CentralLocation):Promise<NativeFileBytes> {
  const result=await kernelOp(transport,{op:"file_bytes",location});
  if(result.error || result.outcome?.result!=="file_bytes")throw new Error(result.error??"Central did not return a material reading");
  const {location:loc,revision,byte_len,mime_hint,content_base64}=result.outcome;
  return {location:loc,revision,byte_len,mime_hint,content_base64};
}

export type FileRequest={action:"write";expected_revision:string;content:string}|{action:"history";limit?:number;before?:number}|{action:"recovery_preview"|"restore";expected_revision:string;revision:string};
export interface FileMutation {outcome:"written"|"unchanged"|"conflict";revision?:string;current?:NativeFileReading}
export interface FileChange {cursor:number;previous_revision:string;revision:string;actor:string;actor_kind:string;restored_from?:string}
export interface FileHistory {current_revision:string;entries:FileChange[];more:boolean;next_before:number|null}
export interface FilePreview {revision:string;expected_revision:string;content:string;current_content:string;changed:boolean}
export async function fileOperation<T>(transport:KernelTransportStatus,location:CentralLocation,request:FileRequest):Promise<T> {
 const result=await kernelOp(transport,{op:"file_operation",location,request});
 if(result.error||result.outcome?.result!=="file_operation")throw new Error(result.error??"Central did not return a file operation");
 return result.outcome.data as T;
}
