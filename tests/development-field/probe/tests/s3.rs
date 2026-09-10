//! Accepted S3 over the same native Development Field specimen; no #123 freeze.
use std::{error::Error,fs,path::{Path,PathBuf},process::{Command,Output}};
use serde_json::{json,Value};
use aikit_adapters::{central_development_field::project_development_field_resources,native_git::NativeGitProvider,runner::SystemRunner};
use aikit_core::{project::ProjectRef,resource::*};
use epilogos_factory::development_field::DevelopmentField;
use ql_core::{CallerProvenance,QlCoordinate,QlFace,QlPosition,RelationFieldComposition,ShapeBinding,ShapeRelationBinding,StructuralConstellation,StructuralParticipation};
type Result<T> = std::result::Result<T,Box<dyn Error>>;
fn load(p:&Path)->Result<Value>{Ok(serde_json::from_slice(&fs::read(p)?)?)}
fn write(p:&Path,v:&impl serde::Serialize)->Result<()>{fs::write(p,serde_json::to_vec_pretty(v)?)?;Ok(())}
fn text<'a>(v:&'a Value,k:&str)->&'a str{v[k].as_str().unwrap_or_else(||panic!("missing {k}"))}
fn coord(c:QlCoordinate)->Value{json!({"position":c.position.value(),"face":match c.face{QlFace::Direct=>"direct",QlFace::Conjugate=>"conjugate"}})}
fn cli(bin:&Path,project:&Path,home:&Path,central:&Path,out:&Path,label:&str,args:&[String])->Result<Output>{
    let result=Command::new(bin).arg("--json").args(args).current_dir(project).env("AIKIT_HOME",home).env("CENTRAL_ROOT",central).env_remove("AIKIT_CONTEXT_ID").output()?;
    fs::write(out.join(format!("s3-{label}.stdout")),&result.stdout)?;
    fs::write(out.join(format!("s3-{label}.stderr")),&result.stderr)?;Ok(result)
}
#[test]
fn accepted_s3_consumes_same_specimen_and_matches_native_cli()->Result<()>{
    let root=PathBuf::from(std::env::var("DF_HARNESS_ROOT")?);
    let out=PathBuf::from(std::env::var("DF_S3_EVIDENCE")?);let s=out.join("specimen");
    let cut=load(&root.join("tests/development-field/cut.json"))?;
    let revision=|id:&str|cut["owners"].as_array().unwrap().iter().find(|o|o["id"]==id).unwrap()["revision"].as_str().unwrap();
    let input=load(&s.join("actuation-input.json"))?;
    let prior=load(&s.join("bounded-conformance.json"))?;
    assert_eq!(prior["status"],"passed");assert_eq!(prior["cut"],cut);
    let factory=load(&s.join("factory-after.json"))?;
    let field:DevelopmentField=serde_json::from_value(factory["field"].clone())?;field.validate()?;
    let source=load(&s.join("central-source.json"))?;
    let central_reading=load(&s.join("central-s1.json"))?;
    let base=load(&s.join("aikit-git-base.json"))?;
    let project=PathBuf::from(text(&base["repository"],"repository_root"));
    let central=project.parent().unwrap().parent().unwrap();
    let binary=root.join(".development-field-owners/ai-kit/target/debug/aikit");
    let home=out.join("s3-home");fs::create_dir_all(&home)?;
    let project_ref=ProjectRef::parse(text(&input["specimen"],"projectRef"))?;
    let source_ref=text(&central_reading,"source_ref");
    let self_ref=format!("central:self:{}",project_ref.as_str());
    let tier_ref=format!("central:tier:{}:1",project_ref.as_str());
    let subjects=vec![ResourceRef::parse(&self_ref)?,ResourceRef::parse(&tier_ref)?,ResourceRef::parse(source_ref)?,ResourceRef::parse("source:fixture:not-supplied")?];
    let mut args=vec!["development-field".into(),"--base".into(),text(&input,"baseRevision").into(),"--expect-aikit-revision".into(),revision("ai-kit").into()];
    for subject in &subjects{args.extend(["--ref".into(),subject.to_string()]);}
    let output=cli(&binary,&project,&home,central,&out,"native",&args)?;
    assert!(output.status.success(),"{}\n{}",String::from_utf8_lossy(&output.stdout),String::from_utf8_lossy(&output.stderr));
    let envelope:Value=serde_json::from_slice(&output.stdout)?;
    let native:DevelopmentFieldReading=serde_json::from_value(envelope["data"].clone())?;
    assert_eq!(native.version,DEVELOPMENT_FIELD_READING_VERSION);
    assert_eq!(native.executable_basis.source_revision.as_ref().unwrap().as_str(),revision("ai-kit"));assert!(!native.executable_basis.source_dirty);
    assert_eq!(native.central_self_description.availability.state,DevelopmentFieldAvailabilityState::Available);
    assert!(native.central_self_description.self_description_refs.iter().any(|r|r.as_str()==self_ref));
    let native_git=native.git.as_ref().unwrap();
    assert_eq!(native_git.world.project,project_ref);
    assert_eq!(native_git.world.repository.head.as_str(),text(&input,"baseRevision"));
    assert_eq!(native_git.base_revision.as_ref().unwrap().as_str(),text(&input,"baseRevision"));
    assert!(native_git.current_diff_from_base.as_ref().unwrap().patch.is_empty());
    write(&s.join("aikit-s3-native-packet.json"),&native)?;
    // Invoke the actual Central Action. Authored standing remains in native
    // annotations; SourceAuthority here describes an observation of that source.
    let records=project_development_field_resources(&SystemRunner::new(),central,&project)?;
    let observed=records.iter().find(|r|r.descriptor.id.as_str()==source_ref).unwrap();
    assert_eq!(observed.descriptor.annotations.get("central.provenance").unwrap(),"human-adopted");
    assert_eq!(observed.descriptor.annotations.get("central.standing").unwrap(),"authored-human-position");
    assert_eq!(observed.descriptor.sources[0].revision.as_ref().unwrap().as_str(),text(&source["revision"],"revision"));
    assert_eq!(observed.descriptor.sources[0].authority,Some(SourceAuthority::Observed));
    let mut index=MemoryResourceIndex::default();for record in &records{index.insert(record.clone());}
    let git=NativeGitProvider::new()?.development_field_basis(&project_ref,&project.display().to_string(),Some(VersionRevision::new(text(&input,"baseRevision"))),256*1024)?;
    let core=read_development_field(&index,&DevelopmentFieldReadRequest{subjects:subjects.clone(),limit:16},native.executable_basis.clone(),Ok(Some(git)));
    assert_eq!(core.subjects,native.subjects,"native core/CLI subject, owner, revision and availability parity");
    assert_eq!(core.central_self_description,native.central_self_description);assert_eq!(core.git,native.git);
    let stale=cli(&binary,&project,&home,central,&out,"stale",&["development-field".into(),"--expect-aikit-revision".into(),"not-the-built-revision".into()])?;
    assert!(!stale.status.success());assert!(String::from_utf8_lossy(&stale.stdout).contains("resource.development_field_executable_revision_mismatch"));
    // Bind the actual returned Field over the same native QL address field.
    let member=|reference:&str,pos:u8|StructuralParticipation::new(reference,QlPosition::new(pos).unwrap(),QlFace::Direct).unwrap();
    let row=StructuralConstellation::new(&field.field_ref,vec![member(source_ref,0),member(&field.targets.plan_ref,1)],vec![])?;
    let col=StructuralConstellation::new("whole:fixture:return",vec![member(text(&input["specimen"],"activityRef"),0),member(text(&input["specimen"],"returnRef"),1)],vec![])?;
    let shape=RelationFieldComposition::compose(&row,&col)?;
    assert_eq!(shape.shape_ref(),text(&load(&s.join("ql-carrier.json"))?,"shape_ref"));
    let relation=ShapeRelationBinding::new(shape.addresses[1],"relation:fixture:answers-to",vec![text(&source["revision"],"revision").into()])?;
    let ql=ShapeBinding::new(&field.field_ref,shape.shape_ref(),&field.field_ref,vec![source_ref.into(),field.targets.plan_ref.clone()],row.members.clone(),vec![relation],
        Some("derivation:fixture:returned-field".into()),Some(shape.operator_ref().into()),vec![text(&input["specimen"],"returnRef").into()],
        CallerProvenance::new("caller:fixture:conformance",source_ref,"standing:deterministic-fixture")?)?;
    ql.validate_relation_field(&shape)?;
    // Mechanical wire projection of QL-owned fields, not another shape algebra.
    let wire=json!({"contract_ref":QL_STRUCTURAL_CARRIER_CONTRACT_REF,"contract_revision":revision("quaternal-logic"),
        "subject_ref":ql.subject_ref,"shape_ref":ql.shape_ref,"whole_ref":ql.whole_ref,"basis_refs":ql.basis_refs,
        "members":ql.members.iter().map(|m|json!({"subject_ref":m.subject_ref,"coordinate":coord(m.coordinate)})).collect::<Vec<_>>(),
        "relation_bindings":ql.relation_bindings.iter().map(|r|json!({"address":{"row":coord(r.address.row),"column":coord(r.address.column)},"relation_ref":r.relation_ref,"evidence_refs":r.evidence_refs})).collect::<Vec<_>>(),
        "derivation_ref":ql.derivation_ref,"operator_ref":ql.operator_ref,"return_refs":ql.return_refs,
        "provenance":{"caller_ref":ql.provenance.caller_ref,"source_ref":ql.provenance.source_ref,"standing_ref":ql.provenance.standing_ref}});
    let carrier:QlShapeBindingCarrier=serde_json::from_value(wire.clone())?;assert_eq!(serde_json::to_value(&carrier)?,wire);
    let mut binding=DevelopmentFieldBinding::new(DevelopmentFieldCarrierKind::Plan);binding.shape_binding=Some(carrier.clone());
    for (relation,key) in [("factory:run","runRef"),("factory:journey","journeyRef"),("factory:commission","commissionRef")]{binding.relations.push(DevelopmentFieldRelation::new(relation,ResourceRef::parse(text(&input["specimen"],key))?)?);}
    binding.relations.push(DevelopmentFieldRelation::new("factory:plan",ResourceRef::parse(&field.targets.plan_ref)?)?);
    binding.relations.push(DevelopmentFieldRelation::new("factory:return",ResourceRef::parse(text(&input["specimen"],"returnRef"))?)?);
    for material in input["material"].as_array().unwrap(){
        let workspace=material["binding_graph"]["bindings"].as_array().unwrap().iter().find(|b|text(b,"logical_ref").starts_with("workspace:")).unwrap();
        binding.material_refs.push(WorkcellMaterialRef{material_ref:ResourceRef::parse(text(workspace,"material_ref"))?,workcell_ref:ResourceRef::parse(text(material,"workcell_ref"))?,source_ref:None,source_revision:None});
    }
    let mut descriptor=ResourceDescriptor::new(ResourceRef::parse(&field.field_ref)?,ResourceKind::ContextSource,"Returned Field","Native Factory fixture; no human Recognition");
    descriptor.owner=Some(OwnerRef::parse("factory:development-field")?);descriptor.sources=observed.descriptor.sources.clone();
    let record=DevelopmentFieldCarrierProjection{descriptor,binding:binding.clone()}.into_record()?;
    assert!(record.providers.is_empty());assert!(binding.relations.iter().all(|r|r.relation.starts_with("factory:")),"QL relation assertions remain QL carrier data");
    index.insert(record.clone());
    let request=DevelopmentFieldReadRequest{subjects:vec![record.descriptor.id.clone()],limit:16};
    let packet=read_development_field(&index,&request,native.executable_basis.clone(),Ok(native.git.clone()));
    assert_eq!(packet.subjects[0].shape_binding.as_ref(),Some(&carrier));assert_eq!(packet.subjects[0].declared_relations,binding.relations);
    assert_eq!(packet.subjects[0].material_refs,binding.material_refs);
    assert_ne!(packet.subjects[0].material_refs[0].material_ref.as_str(),text(&input["specimen"],"runRef"));
    let encoded=serde_json::to_vec(&packet)?;let decoded:DevelopmentFieldReading=serde_json::from_slice(&encoded)?;
    assert_eq!(packet,decoded);assert_eq!(encoded,serde_json::to_vec(&decoded)?);
    let mut unsupported=binding.clone();unsupported.shape_binding.as_mut().unwrap().contract_ref="ql:unsupported".into();assert!(attach_development_field_binding(&mut record.clone(),&unsupported).is_err());
    let mut unattributed=binding.clone();unattributed.shape_binding.as_mut().unwrap().relation_bindings[0].evidence_refs.clear();assert!(attach_development_field_binding(&mut record.clone(),&unattributed).is_err());
    let mut corrupt=record.clone();corrupt.descriptor.annotations.insert(DEVELOPMENT_FIELD_BINDING_ANNOTATION.into(),"not-json".into());
    let mut bad_index=MemoryResourceIndex::default();bad_index.insert(corrupt);
    assert_eq!(read_development_field(&bad_index,&request,native.executable_basis.clone(),Ok(None)).subjects[0].availability.state,DevelopmentFieldAvailabilityState::Unavailable);
    let mut refs=subjects;refs.push(record.descriptor.id.clone());
    let bounded=read_development_field(&index,&DevelopmentFieldReadRequest{subjects:refs.clone(),limit:1},native.executable_basis.clone(),Ok(None));refs.reverse();
    assert!(bounded.truncated);assert_eq!(bounded,read_development_field(&index,&DevelopmentFieldReadRequest{subjects:refs,limit:1},native.executable_basis.clone(),Ok(None)));
    write(&s.join("aikit-s3-owner-projections.json"),&records)?;write(&s.join("aikit-s3-returned-field-packet.json"),&packet)?;
    write(&s.join("aikit-development-field.json"),&json!({"status":"passed","schema":"oi.development-field-S3-conformance/v1",
        "cut_sha256":std::env::var("DF_CUT_SHA256")?,"owners":cut["owners"],"field_ref":field.field_ref,
        "native_central_action":true,"native_cli_core_parity":true,"exact_executable_revision":revision("ai-kit"),"stable_ql_contract":QL_STRUCTURAL_CARRIER_CONTRACT_REF,
        "scope":"same-specimen Central S1 CLI/core parity and native Factory-return/QL/Workcell public projection seam",
        "source_projection_standing":"observed S1 output; authored provenance and standing retained in native annotations",
        "material_lifecycle":"earlier prepared and now released fixture worlds; references are not live material claims",
        "P":"not-exercised","M":"not-exercised","H":"not-exercised","QL_123":"not-frozen"}))?;Ok(())
}
