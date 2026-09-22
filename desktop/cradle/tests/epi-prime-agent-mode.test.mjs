import test from "node:test";
import assert from "node:assert/strict";
import {EPI_PRIME_QL_BODY_REF,modeDefaultAgentBody} from "../src/workspace/agentBody.ts";

test("Epi world carries Prime-QL across its Expressions and Techne apertures",()=>{
  for(const mode of ["epi-logos","expressions","techne"]){
    assert.equal(modeDefaultAgentBody("epi-logos",mode),EPI_PRIME_QL_BODY_REF,mode);
  }
});

test("ordinary Expressions and Techne do not acquire Prime-QL",()=>{
  assert.equal(modeDefaultAgentBody(undefined,"expressions"),undefined);
  assert.equal(modeDefaultAgentBody(undefined,"techne"),undefined);
  assert.equal(modeDefaultAgentBody("other","expressions"),undefined);
  assert.equal(modeDefaultAgentBody("epi-logos","base"),undefined);
});
