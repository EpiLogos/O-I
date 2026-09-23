import {writeFile,readFile} from "node:fs/promises";
import {blankPage,renderPage} from "../src/personal/page.mjs";
for(const family of ["beings","things","goal","vision"]){
 const path=new URL(`oi-${family}.html`,import.meta.url), html=renderPage(blankPage(family));
 if(process.argv.includes("--check")){if(await readFile(path,"utf8")!==html)throw new Error(`${path.pathname}: stale reference carrier`);}
 else await writeFile(path,html);
}
