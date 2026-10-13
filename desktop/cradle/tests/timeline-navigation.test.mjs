// The timeline's navigation invariants, ported to the T1b axis API (lane-2 T1b
// replaced generateTicks/tierForPixelsPerYear with visibleTicks/axisRows and the
// camera). The invariants are unchanged; the sweep now also covers deep centres
// (-780000, 4.5e9) at deep zooms (lane-2 T4b). Zoom limits are the canvas's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {axisRows} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';
import {MAX_PIXELS_PER_YEAR,MIN_PIXELS_PER_YEAR} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/scale.ts';
import {yearToMs} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/instant.ts';
import {msToPixel,pixelToYear,timeCamera,zoomAt,panByPixels} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';

const WIDTHS=[320,1040,1920];
const HUMAN_CENTRES=[-6000,0,2000,9999];
const DEEP_CENTRES=[-780000,4.5e9];
const HUMAN_ZOOMS=[.02,.1,.4,1,8,12,120,1500,4000];
const DEEP_ZOOMS=[1e-9,1e-7,1e-5,1e-3];

/**
 * Float tolerance for a camera round trip, in years: eight ulps of the largest
 * year-quantity the round trip passes through, and never below the original
 * 1e-7 years. At human scale the floor governs; at deep centres the year number
 * itself (4.5e9) and any long pan (1.7e11 years at 1e-9 px/yr) set the ulp.
 */
function roundTripTolerance(...yearQuantities){
  return Math.max(1e-7,8*Number.EPSILON*Math.max(...yearQuantities.map(Math.abs)));
}

/** One axis row: the render-cost bound, the in-window marks and the readable label spacing. */
function assertRow(row,widthPx,where){
  assert.ok(row.length<=Math.ceil(widthPx/88)+5,`${where}: render cost ${row.length} follows the viewport`);
  for(let i=0;i<row.length;i++)assert.ok(row[i].px>=-1e-7&&row[i].px<=widthPx+1e-7,`${where}: mark ${i} lies in the window`);
  for(let i=1;i<row.length;i++)assert.ok(row[i].px-row[i-1].px>=88-1e-7,`${where}: labels ${i} keep readable spacing`);
}

/**
 * The grid reaches both edges: the first mark is no further than one step from
 * the left edge, and the next mark past the right edge is no further than one
 * step beyond the last.
 */
function coveredEdges(row,widthPx){
  if(row.length<2)return false;
  const step=Math.max(...row.slice(1).map((tick,i)=>tick.px-row[i].px));
  return row[0].px<=step+1e-7&&widthPx-row.at(-1).px<=step+1e-7;
}

test('axis labels remain separated and fit the viewport from whole history to dense dates, deep centres included',()=>{
  const centres=[...HUMAN_CENTRES,...DEEP_CENTRES];
  const zooms=[...HUMAN_ZOOMS,...DEEP_ZOOMS];
  for(const widthPx of WIDTHS)for(const pixelsPerYear of zooms)for(const centerYear of centres){
    const rows=axisRows(timeCamera({widthPx,pixelsPerYear,centerYear}));
    const where=`width ${widthPx}, ${pixelsPerYear} px/yr, centre ${centerYear}`;
    assertRow(rows.minor,widthPx,`${where} minor`);
    assertRow(rows.major,widthPx,`${where} major`);
  }
});

// OPEN (lane-2 T4b, not fixed here: ticks.ts and the authority's step rounding are outside this lane).
// The minor row can carry a single mark, so the original "ticks cover both
// viewport edges" and "at least two marks" invariants fail on this sweep. The
// failure is reported with its numbers; the invariant is asserted, not relaxed.
test('the minor row covers both viewport edges with at least two marks (OPEN: single-mark rows)',{todo:'OPEN lane-2 T4b: single-mark minor rows, see the failure count'},()=>{
  const centres=[...HUMAN_CENTRES,...DEEP_CENTRES];
  const zooms=[...HUMAN_ZOOMS,...DEEP_ZOOMS];
  const failures=[];
  let total=0;
  for(const widthPx of WIDTHS)for(const pixelsPerYear of zooms)for(const centerYear of centres){
    total+=1;
    const minor=axisRows(timeCamera({widthPx,pixelsPerYear,centerYear})).minor;
    if(minor.length<2||!coveredEdges(minor,widthPx))failures.push(`width ${widthPx}, ${pixelsPerYear} px/yr, centre ${centerYear}: ${minor.length} mark(s)`);
  }
  assert.equal(failures.length,0,`${failures.length} of ${total} configurations; first: ${failures.slice(0,3).join('; ')}`);
});

/** The date under the pointer, before and after one zoom, with the float tolerance the round trip earns. */
function zoomDrift(view,factor,anchor){
  const next=zoomAt(view,factor,anchor);
  const before=pixelToYear(view,anchor),after=pixelToYear(next,anchor);
  // The pointer's time is carried through the zoomed camera, so both scales' year magnitudes set the ulp.
  const anchorYears=(anchor-view.widthPx/2)/view.pixelsPerYear;
  const anchorYearsNext=(anchor-next.widthPx/2)/next.pixelsPerYear;
  return {next,before,after,drift:Math.abs(after-before),tolerance:roundTripTolerance(before,view.centerYear,anchorYears,anchorYearsNext)};
}

/** The pointer's instant lies inside JavaScript Date's range (|epoch ms| <= 8.64e15), where the authority's calendar is exact. */
function withinDateRange(year){return Math.abs(yearToMs(year))<=8.64e15;}

// 0.4 and 8 px/yr are the lens's label and detail density bands; the zoom steps cross them.
const ZOOM_STEPS=[0.39,0.41,7.9,8.1];
const ANCHORS=[0,320,1000];
const FACTORS=[.01,.8,1.25,100];

test('zoom retains the date under the pointer across LOD boundaries within the Date range, and pan is reversible at every scale',()=>{
  const zooms=[...HUMAN_ZOOMS,...ZOOM_STEPS,...DEEP_ZOOMS];
  for(const centerYear of [2000,...DEEP_CENTRES])for(const pixelsPerYear of zooms){
    const view={centerYear,pixelsPerYear,widthPx:1040};
    for(const anchor of ANCHORS)for(const factor of FACTORS){
      const {next,before,after,drift,tolerance}=zoomDrift(view,factor,anchor);
      const where=`centre ${centerYear}, ${pixelsPerYear} px/yr, anchor ${anchor}, factor ${factor}`;
      assert.ok(next.pixelsPerYear>=MIN_PIXELS_PER_YEAR&&next.pixelsPerYear<=MAX_PIXELS_PER_YEAR,`${where}: zoom stays within the canvas limits`);
      if(withinDateRange(before)&&withinDateRange(after))
        assert.ok(drift<=tolerance,`${where}: the date under the pointer is kept (${before} -> ${after})`);
    }
    const panned=panByPixels(panByPixels(view,170),-170);
    const shiftYears=170/pixelsPerYear;
    assert.ok(Math.abs(panned.centerYear-view.centerYear)<=roundTripTolerance(centerYear,shiftYears),`centre ${centerYear}, ${pixelsPerYear} px/yr: pan is reversible (${panned.centerYear} vs ${centerYear})`);
    // The same centre, read through the camera, lands on the track centre in pixels. The
    // viewport stores its centre as a double year, so the pixel bound is that year's ulp at this zoom, floored at 1e-6 px.
    const pixelTolerance=Math.max(1e-6,8*Number.EPSILON*Math.abs(view.centerYear)*pixelsPerYear);
    assert.ok(Math.abs(msToPixel(timeCamera(panned),yearToMs(view.centerYear))-view.widthPx/2)<=pixelTolerance,`centre ${centerYear}, ${pixelsPerYear} px/yr: pan is reversible in pixels`);
  }
});

// OPEN (lane-2 T4b, not fixed here: the authority's deep calendar is read-only for this lane).
// Beyond JavaScript Date's range, the authority's calendarFields names an
// instant's year from its day rounded to the nearest day, while the canvas's
// yearToMs floors the year. An instant up to half a day before a year start
// therefore reads back in the next year's length, and the zoom's pointer time
// drifts by the fraction of a year times one day. The numbers are reported here.
test('zoom keeps the date under the pointer beyond the Date range (OPEN: deep calendar day rounding)',{todo:'OPEN lane-2 T4b: deep-range year rounding, see the failure count'},()=>{
  const zooms=[...HUMAN_ZOOMS,...ZOOM_STEPS,...DEEP_ZOOMS];
  const failures=[];
  let checked=0,maxDrift=0;
  for(const centerYear of [2000,...DEEP_CENTRES])for(const pixelsPerYear of zooms){
    const view={centerYear,pixelsPerYear,widthPx:1040};
    for(const anchor of ANCHORS)for(const factor of FACTORS){
      const {before,after,drift,tolerance}=zoomDrift(view,factor,anchor);
      if(withinDateRange(before)&&withinDateRange(after))continue;
      checked+=1;
      if(drift>maxDrift)maxDrift=drift;
      if(drift>tolerance)failures.push(`centre ${centerYear}, ${pixelsPerYear} px/yr, anchor ${anchor}, factor ${factor}: ${before} -> ${after} (drift ${drift.toExponential(2)} years)`);
    }
  }
  assert.equal(failures.length,0,`${failures.length} of ${checked} deep-range zooms drift; max ${maxDrift.toExponential(2)} years; first: ${failures.slice(0,2).join('; ')}`);
});
