//! Native Central -> AIKit provenance checks; these do not claim human acceptance.
use std::{collections::BTreeMap, error::Error, fs};
use aikit_core::{
    context::ContextDescriptor,
    context_resolution::{compose_context_resolution, ContextResolution, RequestedActors},
    policy::ManagedPolicy,
    project::{ProjectBinding, ProjectBindingLocator, ProjectConstituentRef, ProjectRef},
    resolve::{resolution_hash, ResolvedView},
    resource::{Eligibility, MemoryResourceIndex, ResourceDescriptor, ResourceKind, ResourceRecord,
        ResourceRef, ResourceSource, SourceAuthority, SourceRef, SourceRevision, SourceState},
    session_space_application::ContextResolutionEvidence,
};
use serde_json::json;

type Result<T> = std::result::Result<T, Box<dyn Error>>;

fn compose(view: &ResolvedView, binding: &ProjectBinding, source_ref: &str,
           revision: &str, observed: bool) -> Result<ContextResolution> {
    let mut descriptor = ResourceDescriptor::new(ResourceRef::parse(source_ref)?,
        ResourceKind::ContextSource, "Authored intent", "Native Central read");
    descriptor.sources.push(ResourceSource {
        source: SourceRef::parse(source_ref)?, authority: Some(SourceAuthority::Authored),
        revision: Some(SourceRevision::parse(revision)?), locator: None, state: SourceState::Available,
    });
    if observed {
        // This identity belongs to this test's observation, not to Central authorship.
        // A native read is observed; it does not turn the author's claim into observed truth.
        descriptor.sources.push(ResourceSource {
            source: SourceRef::parse("observation:fixture:native-central-source-read")?,
            authority: Some(SourceAuthority::Observed),
            revision: Some(SourceRevision::parse(revision)?), locator: None, state: SourceState::Available,
        });
    }
    let mut record = ResourceRecord::new(descriptor);
    record.eligibility = Eligibility::Eligible;
    let mut resources = MemoryResourceIndex::default();
    resources.insert(record);
    Ok(compose_context_resolution(view, binding.clone(), &[], &resources, RequestedActors::default()))
}

#[test]
fn authored_provenance_and_observed_basis_are_distinct_and_roundtrip() -> Result<()> {
    let root = std::env::temp_dir().join(format!("oi-df-source-snapshot-{}", std::process::id()));
    fs::create_dir(&root)?;
    let central = root.join("Central");
    let project = central.join("Work/specimen");
    central_ctrl::root::initialize_central(&central)?;
    fs::create_dir_all(&project)?;
    let project_ref = ProjectRef::parse("project:01ARZ3NDEKTSV4RRFFQ69G5FAV")?;
    central_ctrl::projectcentral_ops::initialize_projectcentral(&central, &project, "01ARZ3NDEKTSV4RRFFQ69G5FAV")?;
    fs::write(project.join("ProjectCentral/user/intent.md"), "Authored fixture intent, revision one.\n")?;
    let horizon = central_ctrl::read_project_change_horizon(&project, None)?;
    let source_ref = horizon.sources.iter().find(|s| s.binding.path.ends_with("/intent.md"))
        .ok_or("Central did not expose its native authored source")?.binding.source_ref.clone();
    let first = central_ctrl::read_world_source(&project, &source_ref)?;
    let context = ContextDescriptor::for_project(&project);
    let policy = ManagedPolicy::default();
    let active = BTreeMap::new();
    let overlays = BTreeMap::new();
    let view = ResolvedView {
        hash: resolution_hash(&context, &policy, &active, &overlays), context, policy, active,
        declared: BTreeMap::new(), unavailable: BTreeMap::new(), selection_log: vec![],
        catalog_index: BTreeMap::new(), skill_usage_overlays: overlays, warnings: vec![],
        catalog_revision: "catalog:empty-fixture".into(), properties: BTreeMap::new(),
    };
    let binding = ProjectBinding::new(project_ref.clone(), ProjectConstituentRef::parse(&source_ref)?,
        ProjectBindingLocator::LocalDirectory { path: project.clone() });
    let authored = compose(&view, &binding, &source_ref, &first.revision.revision, false)?;
    let observed = compose(&view, &binding, &source_ref, &first.revision.revision, true)?;
    assert!(authored.observed_source_resources.is_empty());
    assert_eq!(observed.observed_source_resources.len(), 1);
    let authored_source = &observed.observed_source_resources[0].sources[0];
    let read_observation = &observed.observed_source_resources[0].sources[1];
    assert_eq!(authored_source.authority, Some(SourceAuthority::Authored));
    assert_eq!(authored_source.source.as_str(), source_ref);
    assert_eq!(read_observation.authority, Some(SourceAuthority::Observed));
    assert_ne!(authored_source.source, read_observation.source);
    assert_eq!(authored_source.revision, read_observation.revision);
    let evidence = ContextResolutionEvidence::from_resolution(&observed)?;
    let encoded = serde_json::to_vec(&observed)?;
    let decoded: ContextResolution = serde_json::from_slice(&encoded)?;
    assert_eq!(encoded, serde_json::to_vec(&decoded)?);
    assert_eq!(ContextResolutionEvidence::from_resolution(&decoded)?, evidence);

    // Native source CAS makes a second actual fixture read available. No real human EX is claimed.
    central_ctrl::write_world_source(&project, &source_ref, &first.revision.revision,
        "Authored fixture intent, revision two.\n", "human:fixture", "human", None)?;
    let second = central_ctrl::read_world_source(&project, &source_ref)?;
    assert_ne!(first.revision.revision, second.revision.revision);
    assert!(central_ctrl::write_world_source(&project, &source_ref, &first.revision.revision,
        "stale", "human:fixture", "human", None).is_err());
    let changed = compose(&view, &binding, &source_ref, &second.revision.revision, true)?;
    let changed_evidence = ContextResolutionEvidence::from_resolution(&changed)?;
    assert_ne!(evidence.reference, changed_evidence.reference);
    assert_eq!(evidence.basis.resolver_hash, changed_evidence.basis.resolver_hash);
    assert_eq!(evidence.project(), changed_evidence.project());
    assert_eq!(changed.observed_source_resources[0].sources[0].authority, Some(SourceAuthority::Authored));

    // Display copies are not substituted for the once-observed basis after composition.
    let mut display_only = observed.clone();
    display_only.context_sources[0].resource.descriptor.sources[0].revision =
        Some(SourceRevision::parse(&second.revision.revision)?);
    assert_eq!(ContextResolutionEvidence::from_resolution(&display_only)?, evidence);
    let authored_second = compose(&view, &binding, &source_ref, &second.revision.revision, false)?;
    assert_eq!(ContextResolutionEvidence::from_resolution(&authored)?.reference,
               ContextResolutionEvidence::from_resolution(&authored_second)?.reference);
    if let Some(out) = std::env::var_os("DF_SNAPSHOT_EVIDENCE") {
        fs::write(out, serde_json::to_vec_pretty(&json!({
            "schema": "oi.development-field-source-snapshot-conformance/v1", "status": "passed",
            "cut_sha256": std::env::var("DF_CUT_SHA256").ok(),
            "source_ref": source_ref, "first_source": first, "second_source": second,
            "first_resolution": evidence, "second_resolution": changed_evidence,
            "authored_standing_preserved": true, "observed_snapshot_revision_changes_evidence_ref": true,
            "display_copy_is_not_observed_snapshot": true, "roundtrip_bytes_equal": true,
            "stale_CAS_rejected": true, "P": "not-exercised", "M": "not-exercised", "H": "not-exercised"
        }))?)?;
    }
    fs::remove_dir_all(root)?;
    Ok(())
}
