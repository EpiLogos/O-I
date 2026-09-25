import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTicks} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/ticks.ts';
import {tierForPixelsPerYear} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/scale.ts';
import {pixelToYear,zoomAt,panByPixels} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/viewport.ts';

test('axis labels remain separated and cover the visible range from whole history to dense dates',()=>{
  for(const widthPx of [320,1040,1920])for(const pixelsPerYear of [.02,.1,.4,1,8,12,120,1500,4000])for(const centerYear of [-6000,0,2000,9999]){
    const viewport={widthPx,pixelsPerYear,centerYear};
    const ticks=generateTicks(viewport,tierForPixelsPerYear(pixelsPerYear));
    assert.ok(ticks.length>=2);
    assert.ok(ticks[0].px<=0 && ticks.at(-1).px>=widthPx,'ticks cover both viewport edges');
    assert.ok(ticks.length<=Math.ceil(widthPx/88)+5,'render cost follows the viewport, not the time span');
    for(let i=1;i<ticks.length;i++)assert.ok(ticks[i].px-ticks[i-1].px>=88-1e-7,'labels have readable spacing');
  }
});

test('zoom retains the date under the pointer across LOD boundaries and pan is reversible',()=>{
  for(const pixelsPerYear of [.02,.4,8,120,1500,4000])for(const anchor of [0,320,1000]){
    const view={centerYear:2000,pixelsPerYear,widthPx:1040};
    for(const factor of [.01,.8,1.25,100]){
      const next=zoomAt(view,factor,anchor);
      assert.ok(Math.abs(pixelToYear(next,anchor)-pixelToYear(view,anchor))<1e-7);
      assert.ok(next.pixelsPerYear>=.02 && next.pixelsPerYear<=4000);
    }
    assert.ok(Math.abs(panByPixels(panByPixels(view,170),-170).centerYear-view.centerYear)<1e-7);
  }
});
