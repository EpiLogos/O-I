import { useEffect, useState } from 'react';
import ShellApp from './ShellApp';
import { LibraryApp } from '../library/LibraryApp';
import './public-entrance.css';

/** Where the Return-of-Zero publication shelf lived before it was retired
 * (2026-10-06). Its Expressions now live in the essay field's Library view. */
const ESSAY_LIBRARY = './essay/?view=library';

/** Addresses the retired shelf answered: #/library?published=1…, ?ref=… and
 * explore.html?ref=… (the native-subject address of the old Explore route). */
function isRetiredShelfAddress(){
 const hash=location.hash;
 if(/^#\/?library\?/.test(hash)){
  const keys=new URLSearchParams(hash.split('?')[1]||'');
  if(['published','ref','collection_ref'].some(key=>keys.has(key)))return true;
 }
 if(!hash){
  if(new URLSearchParams(location.search).has('ref'))return true;
  if(location.pathname.split('/').pop()?.replace('.html','')==='explore')return true;
 }
 return false;
}
function surface(){
 const route=location.hash.replace(/^#\/?/,'').split('?')[0];
 return route.startsWith('library')||['oi','products','research','shared-field','build'].includes(route)?'library':'home';
}
/** One public entrance. The accepted hero and the site-edition/direct-route
 * reader stay; the retired publication addresses continue into the essay field. */
export default function PublicApp(){
 const [view,setView]=useState(()=>{
  if(isRetiredShelfAddress()){
   // A visitor with an old address lands on the essay field's Library view,
   // not a dead page. replace(): the retired address does not stay in history.
   location.replace(new URL(ESSAY_LIBRARY,location.href).href);
   return 'redirecting';
  }
  if(!location.hash){
   const old=location.pathname.split('/').pop()?.replace('.html','');
   if(old&&['oi','products','research','shared-field','build','library'].includes(old))history.replaceState(null,'',`#/library${old==='products'||old==='library'?'':'/'+old}`);
  }
  return surface();
 });
 useEffect(()=>{
  const route=()=>{
   if(isRetiredShelfAddress()){location.replace(new URL(ESSAY_LIBRARY,location.href).href);return;}
   setView(surface());
  };
  window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
  return()=>{window.removeEventListener('hashchange',route);window.removeEventListener('popstate',route);};
 },[]);
 return view==='redirecting'?<p role="status">Opening the essay field…</p>:view==='library'?<LibraryApp/>:<ShellApp/>;
}
