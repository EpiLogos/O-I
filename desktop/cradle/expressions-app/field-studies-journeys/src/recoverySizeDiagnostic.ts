/** Presentation only. The native error, NativeWorking notice and NativeStatus
 * remain byte-for-byte raw. Unknown/future/malformed errors are not rewritten. */
const SCHEMA='oi.recovery-size-diagnostic/v1';
const MARKER='\n[oi.recovery-size-diagnostic/v1] ';
const MAX_SUFFIX=16*1024, BASIS=8*1024*1024, PUBLIC=5*BASIS;
type ObjectValue=Record<string,unknown>;
export interface RecoverySizeDiagnostic {firstLine:string;raw:string;diagnostic:ObjectValue;metadataAvailable:boolean}
const object=(v:unknown):v is ObjectValue=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(v:ObjectValue,wanted:readonly string[])=>Object.keys(v).length===wanted.length&&wanted.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const member=(v:unknown,values:readonly unknown[])=>values.includes(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const optionalCount=(v:unknown)=>v===null||count(v);
const hash=(v:unknown)=>v===null||(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v));
function measurement(v:unknown,limit:number,required=true):boolean{
 if(v===null)return !required;
 if(!object(v)||!keys(v,['status','serialized_utf8_bytes','serialized_utf8_bytes_at_least','measurement_limit_bytes','sha256'])||v.measurement_limit_bytes!==limit||!optionalCount(v.serialized_utf8_bytes)||!optionalCount(v.serialized_utf8_bytes_at_least)||!hash(v.sha256))return false;
 switch(v.status){
  case 'complete':return count(v.serialized_utf8_bytes)&&v.serialized_utf8_bytes<=limit&&v.serialized_utf8_bytes_at_least===null&&typeof v.sha256==='string';
  case 'exact_size_over_bound_hash_not_measured':return count(v.serialized_utf8_bytes)&&v.serialized_utf8_bytes>limit&&v.serialized_utf8_bytes_at_least===null&&v.sha256===null;
  case 'over_bound_partial_not_fully_measured':return v.serialized_utf8_bytes===null&&v.serialized_utf8_bytes_at_least===limit+1&&v.sha256===null;
  case 'serialization_refused_not_fully_measured':return v.serialized_utf8_bytes===null&&v.serialized_utf8_bytes_at_least===null&&v.sha256===null;
  default:return false;
 }
}
function context(v:unknown):boolean{
 return v===null||(object(v)&&keys(v,['operation','scope','kind','requested_address_sha256','cas_applicable','expected_revision'])
 &&member(v.operation,['read','list','find_checkpoint','write','remove'])&&member(v.scope,['expressions','techne'])
 &&member(v.kind,[null,'draft','checkpoint'])&&hash(v.requested_address_sha256)&&optionalCount(v.expected_revision)
 &&v.cas_applicable===member(v.operation,['write','remove'])
 &&(v.cas_applicable||v.expected_revision===null)&&((v.operation==='find_checkpoint')===(v.kind===null)));
}
const FULL_KEYS=['schema','diagnostic_status','failure_branch','operation_context','record_address_sha256','record_scope','record_kind','record_revision','record_revision_role','cas_guard','public_value','components','remainder_with_null_component_roots','remainder_formula_bytes','remainder_measurement_matches_formula','raw_record','stored_candidate','stored_candidate_admitted_current_operation','stored_candidate_status','images','limits','private_values_disclosed'] as const;
function fullDiagnostic(v:ObjectValue,message:string):boolean{
 if(!keys(v,FULL_KEYS)||!member(v.diagnostic_status,['measured_at_native_size_refusal','partial_measurement_at_native_size_refusal'])||!member(v.failure_branch,['inbound_component_preflight','component_preflight','write_without_image_dictionary','write_image_dictionary_storage','legacy_raw_value_decode'])||!context(v.operation_context)||!hash(v.record_address_sha256)||!member(v.record_scope,['expressions','techne'])||!member(v.record_kind,['draft','checkpoint'])||!optionalCount(v.record_revision)||v.record_revision_role!==(v.failure_branch==='legacy_raw_value_decode'?'stored':v.failure_branch==='inbound_component_preflight'?'unallocated_inbound':'proposed_not_acknowledged')||((v.failure_branch==='inbound_component_preflight')!==(v.record_revision===null))||v.private_values_disclosed!==false||v.stored_candidate_admitted_current_operation!==false)return false;
 if(member(v.failure_branch,['inbound_component_preflight','component_preflight'])!==(message==='Expanded recovery component exceeds 8 MiB before material cloning'))return false;
 const expectedCAS=v.operation_context===null?'not_qualified_until_store_request_context':
  (object(v.operation_context)&&v.operation_context.operation==='write'&&v.failure_branch==='inbound_component_preflight')?'not_reached_inbound_validation_refused':
  (object(v.operation_context)&&member(v.operation_context.operation,['write','remove'])&&v.failure_branch==='legacy_raw_value_decode')?'not_reached_existing_record_decode_refused':
  (object(v.operation_context)&&v.operation_context.operation==='write'&&v.failure_branch!=='legacy_raw_value_decode')?'passed_before_size_refusal':'not_applicable';
 if(v.cas_guard!==expectedCAS||!member(v.stored_candidate_status,['existing_raw_bytes_refused','candidate_not_written','not_materialised']))return false;
 const publicLimit=v.record_kind==='checkpoint'?PUBLIC:BASIS;
 if(!object(v.limits)||!keys(v.limits,['component_and_remainder_bytes','stored_record_bytes','scope_bytes','scope_records','diagnostic_public_measurement_bytes','diagnostic_raw_measurement_bytes','diagnostic_metadata_utf8_bytes'])||v.limits.component_and_remainder_bytes!==BASIS||v.limits.stored_record_bytes!==BASIS+2048||v.limits.scope_bytes!==64*1024*1024||v.limits.scope_records!==256||v.limits.diagnostic_public_measurement_bytes!==publicLimit||v.limits.diagnostic_raw_measurement_bytes!==PUBLIC+2048||v.limits.diagnostic_metadata_utf8_bytes!==MAX_SUFFIX)return false;
 if(!measurement(v.public_value,publicLimit)||!measurement(v.remainder_with_null_component_roots,BASIS)||!measurement(v.raw_record,PUBLIC+2048,false)||!measurement(v.stored_candidate,BASIS+2048,false)||!optionalCount(v.remainder_formula_bytes)||!member(v.remainder_measurement_matches_formula,[null,true,false]))return false;
 const paths=['/view/document','/view/journey','/pending/request','/pending/submitted/journey'];
 if(!Array.isArray(v.components)||v.components.length!==(v.record_kind==='checkpoint'?4:0)||!v.components.every((row,index)=>object(row)&&keys(row,['path','present','measurement'])&&row.path===paths[index]&&typeof row.present==='boolean'&&measurement(row.measurement,BASIS,row.present)&&(!row.present?row.measurement===null:true)))return false;
 const images=v.images;if(!object(images)||!keys(images,['eligible_occurrences','eligible_data_url_utf8_bytes_with_repetition','eligible_unique','eligible_unique_data_url_utf8_bytes','repeated_unique','unique_metrics_status','actual_candidate_dictionary_entries','diagnostic_unique_tracking_limit'])||!['eligible_occurrences','eligible_data_url_utf8_bytes_with_repetition','eligible_unique','eligible_unique_data_url_utf8_bytes','repeated_unique','actual_candidate_dictionary_entries'].every(k=>optionalCount(images[k]))||images.diagnostic_unique_tracking_limit!==4096||!member(images.unique_metrics_status,['complete','more_than_4096_unique_images_not_retained_in_diagnostic','not_walked_public_measurement_incomplete_or_over_bound']))return false;
 const imageFields=['eligible_occurrences','eligible_data_url_utf8_bytes_with_repetition','eligible_unique','eligible_unique_data_url_utf8_bytes','repeated_unique'];
 if(count(images.actual_candidate_dictionary_entries)&&images.actual_candidate_dictionary_entries>4096)return false;
 const publicMeasurement=v.public_value as ObjectValue,remainder=v.remainder_with_null_component_roots as ObjectValue;
 if(publicMeasurement.status!=='complete'){
  if(images.unique_metrics_status!=='not_walked_public_measurement_incomplete_or_over_bound'||imageFields.some(k=>images[k]!==null))return false;
 }else{
  if(images.unique_metrics_status==='not_walked_public_measurement_incomplete_or_over_bound'||!count(images.eligible_occurrences)||!count(images.eligible_data_url_utf8_bytes_with_repetition))return false;
  if(images.unique_metrics_status==='complete'){
   if(!count(images.eligible_unique)||!count(images.eligible_unique_data_url_utf8_bytes)||!count(images.repeated_unique)||images.eligible_unique>4096||images.eligible_unique>images.eligible_occurrences||images.repeated_unique>images.eligible_unique||images.eligible_unique_data_url_utf8_bytes>images.eligible_data_url_utf8_bytes_with_repetition)return false;
  }else if(['eligible_unique','eligible_unique_data_url_utf8_bytes','repeated_unique'].some(k=>images[k]!==null))return false;
 }
 const componentRows=v.components as ObjectValue[];
 const complete=publicMeasurement.status==='complete'&&remainder.status==='complete'&&componentRows.every(row=>!row.present||(object(row.measurement)&&row.measurement.status==='complete'));
 if(v.diagnostic_status!==(complete?'measured_at_native_size_refusal':'partial_measurement_at_native_size_refusal'))return false;
 let removed=0,known=true;for(const row of componentRows){if(!row.present)continue;if(!object(row.measurement)||!count(row.measurement.serialized_utf8_bytes)){known=false;break;}removed+=row.measurement.serialized_utf8_bytes-4;}
 const formula=known&&count(publicMeasurement.serialized_utf8_bytes)?publicMeasurement.serialized_utf8_bytes-removed:null;
 if(v.remainder_formula_bytes!==formula||v.remainder_measurement_matches_formula!==(formula!==null&&count(remainder.serialized_utf8_bytes)?formula===remainder.serialized_utf8_bytes:null))return false;
 const candidateStatus=v.failure_branch==='legacy_raw_value_decode'?'existing_raw_bytes_refused':v.stored_candidate===null?'not_materialised':'candidate_not_written';
 if(v.stored_candidate_status!==candidateStatus)return false;
 const overBasis=(m:unknown)=>object(m)&&((count(m.serialized_utf8_bytes)&&m.serialized_utf8_bytes>BASIS)||(count(m.serialized_utf8_bytes_at_least)&&m.serialized_utf8_bytes_at_least>BASIS));
 if(member(v.failure_branch,['inbound_component_preflight','component_preflight'])&&!overBasis(remainder)&&!componentRows.some(row=>row.present&&overBasis(row.measurement)))return false;
 if(member(v.failure_branch,['write_without_image_dictionary','legacy_raw_value_decode'])&&!overBasis(publicMeasurement))return false;
 if(v.failure_branch==='write_without_image_dictionary'&&images.actual_candidate_dictionary_entries!==0)return false;
 if(v.failure_branch==='write_image_dictionary_storage'&&(!object(v.stored_candidate)||!count(v.stored_candidate.serialized_utf8_bytes)||v.stored_candidate.serialized_utf8_bytes<=BASIS+2048||!count(images.actual_candidate_dictionary_entries)||images.actual_candidate_dictionary_entries===0))return false;

 return true;
}
export function readRecoverySizeDiagnostic(raw:string):RecoverySizeDiagnostic|null{
 // Refuse before parse/allocation; bounded schema metadata consists of ASCII
 // names, hashes, booleans and integers. No public/private body is admitted.
 if(raw.length>MAX_SUFFIX+256)return null;
 const at=raw.indexOf(MARKER);if(at<0||raw.indexOf(MARKER,at+MARKER.length)!==-1)return null;
 const firstLine=raw.slice(0,at),message=firstLine.startsWith('Native recovery was not adopted: ')?firstLine.slice('Native recovery was not adopted: '.length):firstLine;
 if(!member(message,['Recovery record exceeds 8 MiB','Expanded recovery component exceeds 8 MiB before material cloning']))return null;
 const body=raw.slice(at+MARKER.length);if(new TextEncoder().encode(body).byteLength>MAX_SUFFIX)return null;
 let v:unknown;try{v=JSON.parse(body);}catch{return null;}
 // Canonical compact JSON refuses duplicated raw keys and trailing material.
 // This is local metadata recognition, not an authenticity/owner proof.
 if(!object(v)||v.schema!==SCHEMA||JSON.stringify(v)!==body)return null;
 if(v.diagnostic_status==='metadata_format_refused'){
  const admitted=keys(v,['schema','diagnostic_status'])||(keys(v,['schema','diagnostic_status','operation_context','cas_guard'])&&context(v.operation_context)&&v.cas_guard==='not_applicable');
  return admitted?{firstLine,raw,diagnostic:v,metadataAvailable:false}:null;
 }
 return fullDiagnostic(v,message)?{firstLine,raw,diagnostic:v,metadataAvailable:true}:null;
}
export function recoveryFailureMessage(raw:string,inspectAvailable=false):string{
 const parsed=readRecoverySizeDiagnostic(raw);if(!parsed)return raw;
 return parsed.firstLine+(inspectAvailable?(parsed.metadataAvailable?' Open Inspect failure for the native size diagnostic.':' The native size diagnostic could not be formatted; Inspect failure retains the refusal.'):'');
}
export function recoveryFailureInspectHTML(raw:string,escape:(text:string)=>string):string{
 if(!readRecoverySizeDiagnostic(raw))return '';
 return `<details data-native-recovery-diagnostic><summary>Inspect failure</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto">${escape(raw)}</pre></details>`;
}
