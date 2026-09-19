import { useEffect, useState } from 'react';
import ShellApp from './ShellApp';
import { LibraryApp } from '../library/LibraryApp';
import './public-entrance.css';

function inLibrary(){const route=location.hash.replace(/^#\/?/,'').split('?')[0];return route.startsWith('library')||['oi','products','research','shared-field','build'].includes(route);}
/** Keep the accepted hero shell intact. This is a host/route choice, not a
 * new World, document, reader session or desktop state owner. */
export default function PublicApp(){
 const [library,setLibrary]=useState(()=>{if(!location.hash){const old=location.pathname.split('/').pop()?.replace('.html','');if(old&&['oi','products','research','shared-field','build','library'].includes(old))history.replaceState(null,'',`#/library${old==='products'||old==='library'?'':'/'+old}`);}return inLibrary();});
 useEffect(()=>{const route=()=>setLibrary(inLibrary());window.addEventListener('hashchange',route);return()=>window.removeEventListener('hashchange',route);},[]);
 return library?<LibraryApp/>:<ShellApp/>;
}
