//! A bounded native-owner contract specimen. This is not installed-suite or
//! live-model acceptance and does not freeze QL #123 intelligence.
use std::{collections::{BTreeMap, BTreeSet}, error::Error, fs, path::{Path, PathBuf}, process::Command};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{json, Value};
use aikit_adapters::native_git::NativeGitProvider;
use aikit_core::{context::ContextDescriptor, context_resolution::{compose_context_resolution, RequestedActors},
    policy::ManagedPolicy, project::{ProjectBinding, ProjectBindingLocator, ProjectConstituentRef},
    resolve::{resolution_hash, ResolvedView}, resource::{CreateWorktreeRequest, Eligibility, MemoryResourceIndex,
        ResourceDescriptor, ResourceKind, ResourceRecord, ResourceRef, ResourceSource, SourceAuthority,
        SourceRef, SourceRevision, SourceState, VersionDiffRequest, VersionedWorldProvider},
    session_space_application::ContextResolutionEvidence};
use epilogos_factory::{core::run::{ProjectRef, RunRef, WorkflowUnitRef}, journey::JourneyRef,
    development_field::*, git_development::*, project_development::ProjectDevelopmentLedger,
    project_development_store::{FileProjectDevelopmentStore, ProjectDevelopmentStore}};
use epilogos_workcell_control::{ControlClient, ControlService, ControlTransport, DirectTransport, LengthPrefixedTransport};
use epilogos_workcell_core::{AffordanceRequirement, DemandRef, DesiredMaterialState, ExecutionDemand, ExternalRef,
    OutputRequirement, PersistenceScope, RetentionExpectation, WorkcellRef, WorkspaceAccess, WorkspaceRequirement};
use epilogos_workcell_runtime::{CollapsedLocalConfig, CollapsedLocalWorkcell};
use epilogos_workcell_wire::decode_world;
use ql_core::{CallerProvenance, QlFace, QlPosition, RelationFieldComposition, ShapeBinding,
    ShapeRelationBinding, StructuralConstellation, StructuralParticipation};
mod central_s1;
type Result<T> = std::result::Result<T, Box<dyn Error>>;
fn text<'a>(v: &'a Value, key: &str) -> &'a str { v[key].as_str().unwrap_or_else(|| panic!("missing {key}")) }
fn write(path: &Path, value: &impl Serialize) -> Result<()> { fs::write(path, serde_json::to_vec_pretty(value)?)?; Ok(()) }
fn roundtrip<T: Serialize + DeserializeOwned>(value: &T) -> Result<T> {
    let encoded = serde_json::to_vec(value)?;
    let decoded = serde_json::from_slice(&encoded)?;
    assert_eq!(encoded, serde_json::to_vec(&decoded)?);
    Ok(decoded)
}
fn git(path: &Path, args: &[&str]) -> Result<String> {
    let out = Command::new("git").arg("-C").arg(path).args(args)
        .env("GIT_AUTHOR_NAME", "Development Field fixture").env("GIT_AUTHOR_EMAIL", "fixture@example.invalid")
        .env("GIT_COMMITTER_NAME", "Development Field fixture").env("GIT_COMMITTER_EMAIL", "fixture@example.invalid")
        .env("GIT_AUTHOR_DATE", "2026-01-01T00:00:00Z").env("GIT_COMMITTER_DATE", "2026-01-01T00:00:00Z")
        .output()?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).to_string().into()); }
    Ok(String::from_utf8(out.stdout)?.trim().into())
}
fn prepare<T: ControlTransport>(client: &mut ControlClient<T>, demand: &ExecutionDemand) -> Result<Value> {
    let plan = client.plan(demand)?;
    assert_eq!(plan["status"], "satisfiable");
    let prepared = client.prepare(demand)?;
    let decoded = decode_world(&serde_json::to_string(&prepared)?)?;
    assert_eq!(decoded.subjects, demand.subjects);
    let inspected = client.inspect(&decoded.world_ref)?;
    assert_eq!(decode_world(&serde_json::to_string(&inspected)?)?.subjects, demand.subjects);
    Ok(roundtrip(&prepared)?)
}
fn binding(prepared: &Value, prefix: &str) -> Value {
    prepared["binding_graph"]["bindings"].as_array().unwrap().iter()
        .find(|b| text(b, "logical_ref").starts_with(prefix)).unwrap().clone()
}
fn workspace(prepared: &Value) -> PathBuf { PathBuf::from(text(&binding(prepared, "workspace:")["properties"], "path")) }
fn native_binding(prepared: &Value, source_revision: &str) -> DevelopmentMaterialBinding {
    let b = binding(prepared, "workspace:");
    DevelopmentMaterialBinding { owner: "workcell".into(), binding_ref: text(&b, "binding_ref").into(),
        provider_ref: Some(text(&b, "provider_ref").into()), revision: None,
        // The Workcell implementation SHA is source provenance, not a material revision.
        provenance_refs: vec![text(prepared, "world_ref").into(), format!("source:workcell:{source_revision}")] }
}
fn close<T: ControlTransport>(client: &mut ControlClient<T>, prepared: &Value) -> Result<Value> {
    let world = decode_world(&serde_json::to_string(prepared)?)?;
    let observed = client.observe(&world.world_ref)?;
    for observation in observed["observations"].as_array().unwrap() {
        let original = prepared["binding_graph"]["bindings"].as_array().unwrap().iter()
            .find(|b| b["logical_ref"] == observation["logical_ref"]).unwrap();
        assert_eq!(observation["detail"]["provider_ref"], original["provider_ref"]);
        assert_eq!(observation["detail"]["material_ref"], original["material_ref"]);
    }
    let collected = client.collect(&world.world_ref)?;
    assert!(collected["outputs"].as_array().unwrap().iter().any(|o| o["logical_ref"] == "logs:run/conformance.txt"));
    let released = client.release(&world.world_ref)?;
    assert_eq!(released["disposition"], "released");
    let after = client.inspect(&world.world_ref)?;
    let after_world = decode_world(&serde_json::to_string(&after)?)?;
    assert_eq!(after_world.subjects, world.subjects);
    assert_eq!(after_world.world_ref, world.world_ref);
    for (before, after) in world.binding_graph.bindings.iter().zip(after_world.binding_graph.bindings.iter()) {
        assert_eq!(before.binding_ref, after.binding_ref);
        assert_eq!(before.material_ref, after.material_ref);
        assert_eq!(before.provider_ref, after.provider_ref);
        assert_eq!(format!("{:?}", after.presence), "Released");
    }
    let reconciled = client.reconcile(&[DesiredMaterialState { logical_ref: "affordance:shell".into(), desired: "present".into() }])?;
    assert_eq!(reconciled["deltas"][0]["action"], "rematerialise");
    Ok(json!({"observed":observed,"collected":collected,"released":released,"after":after,"reconciled":reconciled}))
}
fn main() -> Result<()> {
    let harness = PathBuf::from(std::env::var("DF_HARNESS_ROOT")?);
    let owners = harness.join(".development-field-owners");
    let out = PathBuf::from(std::env::var("DF_EVIDENCE_ROOT")?);
    fs::create_dir_all(&out)?;
    let spec: Value = serde_json::from_slice(&fs::read(harness.join("tests/development-field/specimen.json"))?)?;
    let cut: Value = serde_json::from_slice(&fs::read(harness.join("tests/development-field/cut.json"))?)?;
    let revision = |id: &str| cut["owners"].as_array().unwrap().iter().find(|o| o["id"] == id).unwrap()["revision"].as_str().unwrap();
    let central = out.join("ground/Central");
    let project = central.join("Work/specimen");
    central_ctrl::root::initialize_central(&central)?;
    fs::create_dir_all(&project)?;
    central_ctrl::projectcentral_ops::initialize_projectcentral(&central, &project, text(&spec,"projectRef").strip_prefix("project:").unwrap())?;
    fs::write(project.join("ProjectCentral/user/intent.md"), text(&spec,"authoredText"))?;
    let self_reading = central_s1::bind(&central, &project, &out, text(&spec,"projectRef"))?;
    let horizon = central_ctrl::read_project_change_horizon(&project, None)?;
    let source_ref = horizon.sources.iter().find(|s| s.binding.path.ends_with("/intent.md")).unwrap().binding.source_ref.clone();
    let source = central_ctrl::read_world_source(&project, &source_ref)?;
    assert_eq!(source.content, text(&spec,"authoredText"));
    assert_eq!(source.world_ref, text(&spec,"projectRef"));
    assert!(!source.automatic_agent_or_model_invocation);
    assert!(central_ctrl::read_world_source(&project,"central:source:not-participating").is_err());
    assert!(central_ctrl::write_world_source(&project, &source_ref, &source.revision.revision, "forged", "agent:fixture", "agent", Some(text(&spec,"agentSessionRef").into())).is_err());
    assert!(central_ctrl::write_world_source(&project, &source_ref, "revision:stale", "stale", "human:fixture", "human", None).is_err());
    write(&out.join("central-source.json"), &source)?;

    let member = |reference: &str, pos: u8| StructuralParticipation::new(reference, QlPosition::new(pos).unwrap(), QlFace::Direct).unwrap();
    let row = StructuralConstellation::new(text(&spec,"fieldRef"), vec![member(&source_ref,0), member(text(&spec,"planRef"),1)], vec![])?;
    let col = StructuralConstellation::new("whole:fixture:return", vec![member(text(&spec,"activityRef"),0),member(text(&spec,"returnRef"),1)], vec![])?;
    let shape = RelationFieldComposition::compose(&row,&col)?;
    assert_eq!(shape.cardinality(), (2,2,4));
    assert!(ShapeRelationBinding::new(shape.addresses[0], "relation:unsupported", vec![]).is_err());
    let attributable = ShapeRelationBinding::new(shape.addresses[1], "relation:fixture:answers-to", vec![source.revision.revision.clone()])?;
    let carrier = ShapeBinding::new(text(&spec,"fieldRef"), shape.shape_ref(), text(&spec,"fieldRef"),
        vec![source_ref.clone(),text(&spec,"planRef").into()], vec![], vec![attributable],
        Some("derivation:fixture:carrier".into()),Some(shape.operator_ref().into()),vec![],
        CallerProvenance::new("caller:fixture:conformance", &source_ref,"standing:deterministic-fixture")?)?;
    carrier.validate_relation_field(&shape)?;
    assert_eq!(carrier.relation_bindings.len(),1);
    let reversed = StructuralConstellation::new(text(&spec,"fieldRef"),row.members.iter().cloned().rev().collect(),vec![])?;
    assert_eq!(shape.addresses,RelationFieldComposition::compose(&reversed,&col)?.addresses);
    write(&out.join("ql-carrier.json"), &json!({"shape_ref":shape.shape_ref(),"operator_ref":shape.operator_ref(),
        "source_refs":[source_ref,text(&spec,"planRef")],"address_count":shape.addresses.len(),"attributed_relation_count":carrier.relation_bindings.len(),
        "source_revision":source.revision.revision,"scope":"stable-carrier-only; no #123 intelligence acceptance"}))?;

    // Caller-supplied native resource records remain explicit fixture inputs.
    // The S3-specific Central/QL packet adapter is a separate whole-suite gate.
    let context = ContextDescriptor::for_project(&project);
    let policy = ManagedPolicy::default();
    let active = BTreeMap::new();
    let overlays = BTreeMap::new();
    let deterministic = ResolvedView { hash:resolution_hash(&context,&policy,&active,&overlays), context,policy,active,
        declared:BTreeMap::new(),unavailable:BTreeMap::new(),selection_log:vec![],catalog_index:BTreeMap::new(),
        skill_usage_overlays:overlays,warnings:vec![],catalog_revision:"catalog:empty-fixture".into(),properties:BTreeMap::new() };
    let project_ref = aikit_core::project::ProjectRef::parse(text(&spec,"projectRef"))?;
    let project_binding = ProjectBinding::new(project_ref.clone(),ProjectConstituentRef::parse(&source_ref)?,
        ProjectBindingLocator::LocalDirectory {path:project.clone()});
    let mut descriptor = ResourceDescriptor::new(ResourceRef::parse(&source_ref)?,ResourceKind::ContextSource,"Development intent","Native Central source");
    descriptor.sources.push(ResourceSource { source:SourceRef::parse(&source_ref)?,authority:Some(SourceAuthority::Authored),
        revision:Some(SourceRevision::parse(&source.revision.revision)?),locator:None,state:SourceState::Available });
    let mut record=ResourceRecord::new(descriptor); record.eligibility=Eligibility::Eligible;
    let mut resources=MemoryResourceIndex::default(); resources.insert(record);
    let resolution=compose_context_resolution(&deterministic,project_binding,&[],&resources,RequestedActors::default());
    let resolution_evidence=ContextResolutionEvidence::from_resolution(&resolution)?;
    assert_eq!(resolution_evidence.project().as_str(),text(&spec,"projectRef"));
    assert_eq!(resolution.context_sources[0].resource.descriptor.sources[0].source.as_str(),source_ref);
    let resolution_copy=roundtrip(&resolution)?;
    assert_eq!(ContextResolutionEvidence::from_resolution(&resolution_copy)?.reference,resolution_evidence.reference);
    let copied_source = &resolution_copy.context_sources[0].resource.descriptor.sources[0];
    assert_eq!(copied_source.authority, Some(SourceAuthority::Authored));
    assert_eq!(copied_source.revision.as_ref().unwrap().as_str(), source.revision.revision);
    // A logical context reference is not the checksum of every payload. Carry
    // the exact owner revision as a separate fact; do not mutate native standing
    // or invent a hash contract to make a test green.
    write(&out.join("aikit-resolution.json"),&resolution)?;
    write(&out.join("aikit-resolution-evidence.json"),&resolution_evidence)?;
    write(&out.join("exact-source-basis.json"),&json!({"project_ref":project_ref.as_str(),
        "source_ref":source_ref,"source_revision":source.revision.revision,
        "context_resolution_ref":resolution_evidence.reference.to_string(),
        "context_ref_is_payload_checksum":false,"authority":"authored","source_CAS_negative_passed":true}))?;

    fs::write(project.join(".gitignore"),".central/\n")?;
    git(&project,&["init","-q","-b","main"])?;
    git(&project,&["add","."])?; git(&project,&["commit","-qm","authored fixture basis"])?;
    let git_provider=NativeGitProvider::new()?;
    let base=git_provider.inspect(&project_ref,&project.display().to_string())?;
    assert!(base.working.is_clean());
    assert_eq!(base.repository.head.as_str().len(),40);
    let mut demand=ExecutionDemand::new(DemandRef::new("demand:fixture:development")?);
    for (role,key) in [("project","projectRef"),("run","runRef"),("agent","agentRef"),("agency","agencyRef"),("field","fieldRef")] {
        demand=demand.with_subject(role,ExternalRef::new(text(&spec,key))?);
    }
    demand=demand.with_subject("suite",ExternalRef::new(format!("suite:source-cut:{}",std::env::var("DF_CUT_SHA256")?))?);
    demand.workspace=Some(WorkspaceRequirement {source:None,revision:None,access:WorkspaceAccess::Writable});
    demand.affordances.required.push(AffordanceRequirement::new("shell")?);
    demand.outputs.required.push(OutputRequirement::new("logs:run")?);
    demand.persistence=Some(PersistenceScope::Ephemeral); demand.retention=RetentionExpectation::Release;
    let mut service_a=ControlService::new(CollapsedLocalWorkcell::new(CollapsedLocalConfig::new(WorkcellRef::new("workcell:fixture:local-a")?,out.join("material-a")))?);
    let mut service_b=ControlService::new(CollapsedLocalWorkcell::new(CollapsedLocalConfig::new(WorkcellRef::new("workcell:fixture:local-b")?,out.join("material-b")))?);
    let mut client_a=ControlClient::new(DirectTransport::new(&mut service_a));
    let mut client_b=ControlClient::new(LengthPrefixedTransport::new(&mut service_b));
    let a=prepare(&mut client_a,&demand)?; let b=prepare(&mut client_b,&demand)?;
    let material_a=native_binding(&a,revision("workcell")); let material_b=native_binding(&b,revision("workcell"));
    assert_ne!(material_a.binding_ref,material_b.binding_ref);
    let wt_a=workspace(&a).join("git"); let wt_b=workspace(&b).join("git");
    let initial=git_provider.create_worktree(&project_ref,&project.display().to_string(),&CreateWorktreeRequest {path:wt_a.display().to_string(),base:base.repository.head.clone(),branch:None})?;
    assert_eq!(initial.repository.head,base.repository.head);
    let factory_project:ProjectRef=text(&spec,"projectRef").parse()?;
    let run:RunRef=text(&spec,"runRef").parse()?;
    let journey:JourneyRef=text(&spec,"journeyRef").parse()?;
    let unit:WorkflowUnitRef=text(&spec,"workflowUnitRef").parse()?;
    let mut registry=GitDevelopmentRegistry::default();
    let base_record=GitDevelopmentBase { project_ref:factory_project.clone(),run_ref:run.clone(),candidate_ref:"candidate:fixture:implementation".into(),
        repository_ref:"repository:fixture:source".into(),base_revision:base.repository.head.as_str().into(),base_worktree_clean:true,
        source_basis_refs:vec![source_ref.clone(),source.revision.revision.clone()],structural_ground_refs:vec![shape.shape_ref()] };
    let initial_binding=GitWorktreeBinding {provider_ref:initial.provider.provider.to_string(),worktree_ref:"git-worktree:fixture:a".into(),
        repository_ref:base_record.repository_ref.clone(),current_revision:initial.repository.head.as_str().into(),branch:None,
        material_host_ref:Some(text(&a,"workcell_ref").into()),locator:Some(wt_a.display().to_string()),clean:initial.working.is_clean(),conflicts:vec![]};
    let world=registry.begin("git-development:fixture",base_record,initial_binding)?.clone();
    let mut field=DevelopmentField::new(text(&spec,"fieldRef"),factory_project,run.clone(),journey,text(&spec,"commissionRef"),vec![unit],
        text(&spec,"requiredDifference"),DevelopmentFieldTargets {plan_ref:text(&spec,"planRef").into(),ux_refs:vec!["ux:fixture:portable-cut".into()],capability_refs:vec![],
            source_refs:vec![source_ref.clone()],self_description_refs:vec![text(&self_reading,"source_ref").into()]},
        BTreeSet::from([DevelopmentEvidenceGrade::D,DevelopmentEvidenceGrade::C,DevelopmentEvidenceGrade::P,DevelopmentEvidenceGrade::M,DevelopmentEvidenceGrade::H]),
        DevelopmentGitBasis::from_git_world(&world))?;
    let no_ql={let mut x=field.clone();x.git_basis.structural_ground_refs.clear();x}; no_ql.validate()?;
    field.set_aikit_operative(AikitOperativeReferences {resolution_ref:resolution_evidence.reference.to_string(),praxis_condition_ref:None,
        execution_disposition_refs:vec![],agent_refs:vec![text(&spec,"agentRef").into()],agent_set_refs:vec![],profile_ref:None,harness_ref:None,
        harness_composition_ref:None,session_space_ref:None,agent_session_refs:vec![],source_basis_refs:vec![source_ref.clone(),source.revision.revision.clone()],
        provider_ref:"aikit".into(),provider_revision:revision("ai-kit").into()})?;
    field.record_material_binding(material_a.clone())?; field.record_material_binding(material_b.clone())?;
    let mut collapsed=material_a.clone();collapsed.binding_ref=field.git_basis.initial_worktree_ref.clone().unwrap();
    assert!(field.record_material_binding(collapsed).is_err());
    write(&out.join("factory-before.json"),&field)?;

    let result=Command::new("node").arg("-e").arg("require('node:fs').writeFileSync('implementation.txt','preserved\\n')").current_dir(&wt_a).output()?;
    assert!(result.status.success());
    assert!(!git_provider.inspect(&project_ref,&wt_a.display().to_string())?.working.is_clean());
    git(&wt_a,&["add","implementation.txt"])?;git(&wt_a,&["commit","-qm","fixture implementation"])?;
    let implemented=git_provider.inspect(&project_ref,&wt_a.display().to_string())?;
    let relocated=git_provider.create_worktree(&project_ref,&project.display().to_string(),&CreateWorktreeRequest {path:wt_b.display().to_string(),base:implemented.repository.head.clone(),branch:None})?;
    assert_eq!(relocated.repository.head,implemented.repository.head);
    assert_eq!(relocated.project,initial.project);
    assert_eq!(fs::read_to_string(wt_b.join("implementation.txt"))?,"preserved\n");
    registry.rebind_material("git-development:fixture",GitWorktreeBinding {provider_ref:relocated.provider.provider.to_string(),worktree_ref:"git-worktree:fixture:b".into(),
        repository_ref:world.base.repository_ref.clone(),current_revision:relocated.repository.head.as_str().into(),branch:None,
        material_host_ref:Some(text(&b,"workcell_ref").into()),locator:Some(wt_b.display().to_string()),clean:true,conflicts:vec![]})?;
    let difference=git_provider.diff(&wt_b.display().to_string(),&VersionDiffRequest {from:base.repository.head.clone(),to:relocated.repository.head.clone(),path:None,max_bytes:65536})?;
    assert!(!difference.truncated); assert!(difference.patch.contains("preserved"));
    write(&out.join("aikit-git-base.json"),&base)?;write(&out.join("aikit-git-result.json"),&relocated)?;
    write(&out.join("aikit-git-difference.json"),&difference)?;
    let input=json!({"specimen":spec,"field":field,"centralSource":source,"material":[a,b],"worktrees":[wt_a,wt_b],
        "baseRevision":base.repository.head.as_str(),"resultRevision":relocated.repository.head.as_str(),"resolutionRef":resolution_evidence.reference.to_string()});
    write(&out.join("actuation-input.json"),&input)?;
    let node=Command::new("node").arg(harness.join("tests/development-field/actuation-witness.mjs"))
        .arg(owners.join("actuation")).arg(out.join("actuation-input.json")).arg(out.join("actuation-output.json")).output()?;
    fs::write(out.join("actuation-process.log"),[node.stdout.as_slice(),node.stderr.as_slice()].concat())?;
    if !node.status.success(){return Err(String::from_utf8_lossy(&node.stderr).to_string().into())}
    let actual:Value=serde_json::from_slice(&fs::read(out.join("actuation-output.json"))?)?;
    let activity=&actual["activity"];
    assert_eq!(activity["run_ref"],spec["runRef"]);assert_eq!(activity["journey_ref"],spec["journeyRef"]);
    assert_eq!(activity["plan_ref"],spec["planRef"]);assert_eq!(activity["actor"]["agent_ref"],spec["agentRef"]);
    let return_evidence=GitReturnEvidence {schema:GIT_RETURN_EVIDENCE_SCHEMA.into(),base_revision:base.repository.head.as_str().into(),
        result_revision:relocated.repository.head.as_str().into(),commits:vec![relocated.repository.head.as_str().into()],diff_ref:Some("evidence:fixture:git-difference".into()),
        uncommitted_diff_ref:None,changed_paths:vec!["implementation.txt".into()],verification_evidence_refs:vec!["evidence:fixture:implementation-check".into()],
        claim_refs:vec![],conflicts:vec![],provider_ref:relocated.provider.provider.to_string(),material_host_ref:Some(text(&b,"workcell_ref").into())};
    let mut wrong_base=return_evidence.clone();wrong_base.base_revision="revision:wrong".into();
    assert!(registry.return_difference("git-development:fixture",wrong_base).is_err());
    let returned_world=registry.return_difference("git-development:fixture",return_evidence)?;
    assert_eq!(returned_world.base,world.base);
    assert!(returned_world.recognition.is_none());
    let mut returned=DevelopmentFieldReturn::from_git_world(text(&spec,"returnRef"),returned_world)?;
    returned.material_binding_refs=vec![material_a.binding_ref.clone(),material_b.binding_ref.clone()];
    returned.actualities=vec![DevelopmentActualityReferences {execution_correlation_ref:"execution-correlation:fixture".into(),
        actuation_ref:Some(text(activity,"actuation_ref").into()),agency_ref:Some(text(&activity["actor"],"agency_ref").into()),
        agent_session_ref:Some(text(activity,"agent_session_ref").into()),activity_refs:vec![text(activity,"activity_ref").into()],
        return_refs:vec![text(&actual["returned"],"return_ref").into()]}];
    returned.evidence=vec![DevelopmentEvidenceStanding {grade:DevelopmentEvidenceGrade::D,owner:"oi-conformance-fixture".into(),
        evidence_refs:vec!["evidence:fixture:implementation-check".into()],source_refs:vec![source_ref.clone()],human_ex_ref:None}];
    returned.candidates=vec![DevelopmentCandidateLineage {candidate_ref:"candidate:fixture:implementation".into(),evidence_refs:vec!["evidence:fixture:implementation-check".into()],recognition_refs:vec![]}];
    let mut forged_h=returned.clone();forged_h.evidence[0].grade=DevelopmentEvidenceGrade::H;
    assert!(field.record_return(forged_h).is_err());
    field.record_return(returned)?;
    field.validate()?;
    let field:DevelopmentField=roundtrip(&field)?;
    assert_eq!(field.remaining_proof_grades(),BTreeSet::from([DevelopmentEvidenceGrade::C,DevelopmentEvidenceGrade::P,DevelopmentEvidenceGrade::M,DevelopmentEvidenceGrade::H]));
    let mut ledger=ProjectDevelopmentLedger::new(run.clone());ledger.set_development_field(field.clone())?;
    let store=FileProjectDevelopmentStore::new(out.join("factory-ledger"));store.save(&ledger)?;drop(store);
    let persisted=FileProjectDevelopmentStore::new(out.join("factory-ledger")).load(&run)?.unwrap();
    assert_eq!(persisted,ledger);
    assert_eq!(central_ctrl::read_world_source(&project,&source_ref)?.revision,source.revision);
    for prepared in [&a,&b] {
        let log_binding=binding(prepared,"output:");
        fs::write(PathBuf::from(text(&log_binding["properties"],"path")).join("conformance.txt"),"native-boundary fixture passed\n")?;
    }
    git_provider.remove_worktree(&project_ref,&project.display().to_string(),&wt_a.display().to_string())?;
    git_provider.remove_worktree(&project_ref,&project.display().to_string(),&wt_b.display().to_string())?;
    let lifecycle_a=close(&mut client_a,&a)?;let lifecycle_b=close(&mut client_b,&b)?;
    write(&out.join("workcell-lifecycle.json"),&json!({"placements":"two local roots; not VM/cloud isolation proof","a":{"prepared":a,"lifecycle":lifecycle_a},"b":{"prepared":b,"lifecycle":lifecycle_b}}))?;
    write(&out.join("factory-after.json"),&field.reading())?;
    write(&out.join("bounded-conformance.json"),&json!({"schema":"oi.development-field-bounded-conformance/v1","status":"passed",
        "specimen":spec,"cut":cut,"native_relation_scope":["Central self/tier/UX source/ref/revision → native AIKit ContextResolution with explicit caller inputs","AIKit exact Git → Factory DevelopmentField",
        "Factory refs → Workcell demand/material/lifecycle","Workcell material relocation → Actuation fixture Agency/Activity/Return","Actuation Return → Factory evidence/candidate persistence","QL stable partial-whole attributable carrier"],
        "negative_cases":["non-participating source","Agent mutation of human ground","stale source CAS","unsupported QL semantic relation","worktree/material identity collapse","wrong returned Git base","H without human EX","agent-only Central EX","invalid tier"],
        "C":"bounded-native-relations-only","whole_development_field_C":"not-established","P":"not-exercised","M":"not-exercised","H":"not-exercised",
        "remaining_current_cut_gates":["O-I#212 active-suite receipt/dispatch in joined specimen","ai-kit#261 native DevelopmentField-specific Central/QL adapter and packet readings"],
        "deferred_upstream":"QL-MEF#123 final Vāk/C′/Wiki/Context-Frame semantics"}))?;
    println!("Bounded native relation specimen passed; whole Development Field C remains explicitly unestablished.");
    Ok(())
}
