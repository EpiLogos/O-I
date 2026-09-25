import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(new URL('./PROVENANCE.json',import.meta.url),'utf8'));
let count=0;
for(const [path,expected] of Object.entries(manifest.files)){
  const actual=createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
  const admitted=manifest.patches?.[path]?.adapted_sha256 ?? expected;
  if(actual!==admitted)throw new Error(`Research Canvas source changed without an explicit provenance update: ${path}`);
  count++;
}
console.log(`Verified ${count} Research Canvas files from ${manifest.revision}; ${Object.keys(manifest.patches??{}).length} explicit capability adaptations.`);
