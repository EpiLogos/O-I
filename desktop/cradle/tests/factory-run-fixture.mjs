// Controlled test data only. Never a shipped Run or self-inhabitation receipt.
export function readings() {
  const run={contract:'factory.run-reading/v1',runRef:'run:repair',revision:7,projectRef:'project:oi',
    provenance:{factoryStateRevision:10,subjectRevision:7,owner:'software-factory'},
    lifecycle:'active',destination:'Repair the original discrepancy',owningJourneyRefs:['journey:repair'],
    runMap:{runRef:'run:repair',topologyRevision:3,nodes:{
      run:{id:'run',kind:'destination',label:'Original discrepancy',state:'open',semanticRef:null},
      'a:b':{id:'a:b',kind:'work',label:'Implementation',state:'active',semanticRef:'unit:repair'},
      'a/b':{id:'a/b',kind:'gate',label:'Independent replay',state:'waiting',semanticRef:'unit:verify'},
      future:{id:'future',kind:'future_native_kind',label:'Native extension',state:'unknown',semanticRef:null},
    },edges:[{from:'run',to:'a:b',relation:'requires'},{from:'a:b',to:'a/b',relation:'branches_to'},
      {from:'a/b',to:'future',relation:'converges_to'},{from:'future',to:'run',relation:'returns_to'}]},
    actions:[{actionRef:'action:inspect',label:'Inspect native Run',authorityOwner:'software-factory',subjectKinds:['run']},
      {actionRef:'action:recognise',label:'Recognise candidate',authorityOwner:'person',subjectKinds:['candidate']}],
  };
  const units={contract:'factory.workflow-unit-list-reading/v1',projectRef:'project:oi',provenance:{buildStateRevision:10},units:[
    {workflowUnitRef:'unit:repair',key:'repair',locator:'source:repair#unit'},
    {workflowUnitRef:'unit:verify',key:'verify',locator:'source:repair#verify'},
  ]};
  const receipt={ownerRef:'actuation',contract:'owner.receipt/v1',operationRef:'operation:tool-result',receiptRef:'receipt:result',sourceRevision:'owner:4',phase:'returned',evidenceRefs:['evidence:tool'],payload:{tool:'read_file',result:'original discrepancy'}};
  const a={attemptRef:'a:b',taskRef:'task:repair',workflowUnitRef:'unit:repair',executionRef:'execution:repair',
    disposition:{participant:{agentRef:'agent:implementer',agencyRef:'agency:repair',worldBindingRef:'world:local',sourceRef:'source:agent',sourceRevision:'agent:2'},
      body:{agentSessionRef:'session:repair',sessionSpaceRef:'space:repair',harnessRef:'harness:admitted',modelRef:'model:selected',providerRef:'provider:chosen',routeRef:'route:chosen',workcellRef:'workcell:actual'},
      placement:{nowRef:'now:bounded',policyRef:'policy:actual',policyRevision:'policy:2',authorityRef:'authority:actual'},contextRefs:['context:operative']},
    observations:[receipt,{...receipt,phase:'uncertain'}],verifications:[
      {verificationRef:'verification:one',ownerRef:'independent-verifier',sourceRevision:'source:4',outcome:'failed',evidenceRefs:['evidence:failure']},
      {verificationRef:'verification:two',ownerRef:'independent-verifier',sourceRevision:'source:5',outcome:'passed',evidenceRefs:['evidence:replay']}],
    tracking:[{factRef:'tracking:day',kind:'day',ownerRef:'central',subjectRef:'day:original',sourceRevision:'day:3',evidenceRefs:['evidence:day']}],
    failureEvidenceRefs:['evidence:failure'],readableReturn:{returnRef:'return:repair',summary:'Changed source; independent replay still required',artifactRefs:['artifact:patch'],evidenceRefs:['evidence:tests'],receivingRef:'receiving:original',receivingSourceRevision:'day:3'}};
  const attempt={contract:'factory.attempt-reading/v1',runRef:run.runRef,revision:10,runRevision:7,topologyRevision:3,
    workflowKey:'repair',workflowSourceRef:'source:repair',workflowSourceRevision:'source:4',workflowSourceDigest:'digest:4',sourceCurrent:true,
    attempts:[a,{...structuredClone(a),attemptRef:'attempt:retry',readableReturn:{returnRef:'return:retry',summary:'Later contradictory Return',artifactRefs:['artifact:retry'],evidenceRefs:['evidence:retry']}}],legs:{'unit:repair':{state:'returned'},'unit:verify':{state:'waiting'}}};
  return {run,units,attempt,statePath:'/controlled/owner-state.json'};
}
