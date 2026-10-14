/** Lane-4 T22 — the Places lens's search field and its named rows (pure rows in placeSearch.ts). Choosing a
 * place row calls `onChoose`; the mount writes the native spatial focus and re-opens the globe over it. */
import React,{useState} from 'react';
import type {TechneReading} from '../../../src/techne/contract';
import type {PlaceOffer} from '../../../src/techne/m0m5/place/navigation';
import {placeSearchRows} from './placeSearch.js';
import './placeSearchPanel.css';

export function PlaceSearch({reading,onChoose}:{reading:TechneReading;onChoose:(offer:PlaceOffer)=>void}){
 const [query,setQuery]=useState('');
 const rows=placeSearchRows(reading,query);
 return <section className="place-search" aria-label="Search places">
  <label className="place-search-field"><span>Search places</span>
   <input type="search" value={query} placeholder="Find a disclosed place" onChange={event=>setQuery(event.target.value)}/>
  </label>
  <ul className="place-search-rows">
   {rows.map(row=>row.kind==='place'
    ?<li key={row.key}><button type="button" onClick={()=>onChoose(row.offer)}>{row.label}</button><span className="place-search-precision">{row.offer.precision}</span></li>
    :<li key={row.key} className="place-search-none" role="status">{row.label}</li>)}
  </ul>
 </section>;
}
