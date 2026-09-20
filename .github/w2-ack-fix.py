from pathlib import Path
import hashlib
expected={
 'desktop/cradle/src/central/dayForm.ts':'d946c03acaf9a96e760dab42c7cdb95e2c7295116537b993f785ba683314c493',
 'desktop/cradle/kernel/src/flow.rs':'4059c5c18fa3b55c75258c9a9852b333bd45ddc3ed131671ed8f5ed585d90115',
}
for name,digest in expected.items():
 assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest, 'source moved: '+name
p=Path('desktop/cradle/src/central/dayForm.ts');s=p.read_text()
old='const equal=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);'
new='''// JSON object key order is not native source identity. Rust/serde may reorder
// keys on acknowledgement; array order and actual values still matter.
function equal(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>equal(value,b[i]));
 if(!isObject(a)||!isObject(b))return false;
 const keys=Object.keys(a);
 return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&equal(a[key],b[key]));
}'''
assert s.count(old)==1;p.write_text(s.replace(old,new))
p=Path('desktop/cradle/kernel/src/flow.rs');s=p.read_text()
old='''    fn project_of(&self, project: Option<&str>) -> String {
        project.unwrap_or(&self.project_query).to_owned()
    }

'''
assert s.count(old)==1;p.write_text(s.replace(old,''))
