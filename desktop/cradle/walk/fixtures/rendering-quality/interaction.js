document.querySelector('#classic').textContent='Ready';
for(const [id,delta] of [['add',1],['subtract',-1]])document.getElementById(id).onclick=()=>{const out=document.getElementById('count');out.textContent=String(Number(out.textContent)+delta)};
document.getElementById('bridge').textContent=window.__TAURI_INTERNALS__?'EXPOSED':'Not exposed';
fetch(new URL('data.json',document.baseURI)).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(d=>document.getElementById('data').textContent=d.status).catch(()=>document.getElementById('data').textContent='Unavailable');
