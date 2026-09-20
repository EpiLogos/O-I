/** Native title constraints apply only to presentation labels. The original
 * source, Return and evidence remain byte-for-byte in the owner snapshot.
 * Never apply this function to a subject ref, source revision or digest. */
export function nativeRunDisplayTitle(value:string):string {
  const clean=value.replace(/[\u0000-\u001f\u007f-\u009f]/g," ").trim()||"Untitled";
  const encoder=new TextEncoder();
  if(encoder.encode(clean).length<=4096)return clean;
  let bytes=0;let title="";
  for(const character of clean){const length=encoder.encode(character).length;if(bytes+length>4093)break;title+=character;bytes+=length;}
  return `${title}…`;
}
