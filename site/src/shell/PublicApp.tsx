import { useEffect, useState } from 'react';
import ShellApp from './ShellApp';
import { LibraryApp } from '../library/LibraryApp';
import PublicLibrary from '../library/PublicLibrary';
import { isPublicationRoute, publicationHref } from '../library/publication-model.mjs';
import './public-entrance.css';

function surface(){
 if(isPublicationRoute(location.hash))return 'publication';
 const route=location.hash.replace(/^#\/?/,'').split('?')[0];
 return route.startsWith('library')||['oi','products','research','shared-field','build'].includes(route)?'library':'home';
}
/** One public entrance. Native subject addresses consume Explore, while the
 * accepted hero and existing site-edition/direct-route reader stay intact. */
export default function PublicApp(){
 const [view,setView]=useState(()=>{
  if(!location.hash){
   const ref=new URLSearchParams(location.search).get('ref');
   const old=location.pathname.split('/').pop()?.replace('.html','');
   if(ref)history.replaceState(null,'',location.pathname+publicationHref({ref:ref.slice(0,2048)}));
   else if(old&&['oi','products','research','shared-field','build','library'].includes(old))history.replaceState(null,'',`#/library${old==='products'||old==='library'?'':'/'+old}`);
  }
  return surface();
 });
 useEffect(()=>{const route=()=>setView(surface());window.addEventListener('hashchange',route);window.addEventListener('popstate',route);return()=>{window.removeEventListener('hashchange',route);window.removeEventListener('popstate',route);};},[]);
 return view==='publication'?<PublicLibrary/>:view==='library'?<LibraryApp/>:<ShellApp/>;
}
