/** Production adapter forwarding/privacy regressions; not hardware evidence. */
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {modules} from './nara-personal-modules.mjs';
import {record} from './nara-personal-fixtures.mjs';
const {mod:m,dispose}=await modules();after(dispose);

for(const method of ['telemetry','inspect','stations']) {
  test(`${method} reads an optional native method once and preserves its receiver`,()=>{
    let reads=0,receiver,args;
    const owner={render(){},dispose(){}};
    Object.defineProperty(owner,method,{get(){
      ++reads;
      // A host capability can disappear between reads. Never call a second,
      // unchecked read merely because the first read yielded a function.
      return reads===1?function(...actual){receiver=this;args=actual;return 'native-result';}:undefined;
    }});
    const port=m.privateIdentityEngine(owner,{canPresent:()=>true,requestFrame(){}});
    const result=port.engine[method](false,'selected');
    assert.equal(result,'native-result');assert.equal(reads,1);
    assert.equal(receiver,owner);assert.deepEqual(args,[false,'selected']);
  });
  test(`${method} stays absent when the native capability is absent`,()=>{
    const port=m.privateIdentityEngine({render(){},dispose(){}},{canPresent:()=>true,requestFrame(){}});
    assert.equal(port.engine[method](),undefined);
  });
  test(`${method} cannot read the native owner during private presentation`,async()=>{
    let reads=0;
    const owner={render(){},dispose(){}};
    Object.defineProperty(owner,method,{get(){++reads;throw new Error('private native method must not be read');}});
    const port=m.privateIdentityEngine(owner,{canPresent:()=>true,requestFrame(){}});
    port.begin(await m.identityPattern(record(),'cymatic'));
    const expected=method==='telemetry'?null:method==='stations'?[]:{private:true,standing:'private-presentation; native source not disclosed'};
    assert.deepEqual(port.engine[method](),expected);assert.equal(reads,0);
    port.end();
  });
}
