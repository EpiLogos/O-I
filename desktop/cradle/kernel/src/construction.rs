//! Constructive Wiki Actions: the native Wiki owner writes; Central discloses
//! the root, exact file and source revisions. No alternate source store.
use crate::{action::{ActionDispatch, ActionInvocation}, files::{self, Location}, flow::CentralClient, knowledge};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};

pub const APPLY: &str = "aikit.constellation.apply";
pub const APPLY_FACTS: &str = "aikit.wiki.facts.apply";
const FACTS_OP: &str = "aikit wiki-construct facts-apply";
const OP: &str = "aikit wiki-construct apply";
#[path = "construction_source.rs"]
mod source;
use source::Basis;
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    location: Location,
    expected_file_revision: String,
    request: Value,
    #[serde(default)]
    sources: Vec<Basis>,
}
fn refuse(operation: &str, message: impl Into<String>) -> ActionDispatch {
    ActionDispatch::OwnerRefused { owner_operation: operation.into(), message: message.into() }
}
fn owner_error(operation: &str, error: knowledge::CallError) -> ActionDispatch {
    match error {
        knowledge::CallError::Unavailable {detail} => ActionDispatch::OwnerUnavailable {owner_operation:operation.into(),detail},
        knowledge::CallError::Refused {message} => refuse(operation, message),
        knowledge::CallError::Malformed {detail} => refuse(operation, detail),
    }
}
fn relative(path: &str) -> bool {
    !path.is_empty() && Path::new(path).components().all(|p| matches!(p,Component::Normal(_)))
}
fn request_valid(target: &str, input: &Input) -> Result<(),String> {
    let identity_matches = match input.request["schema"].as_str() {
        Some("aikit.constellation-action/v1") => input.request["frame_ref"] == target,
        Some("aikit.wiki-facts-action/v1") => input.request["target"]["ref"] == target
            && matches!(input.request["target"]["kind"].as_str(), Some("node" | "whole")),
        _ => false,
    };
    if !identity_matches {
        return Err("Action target and native Wiki identity disagree".into());
    }
    if input.expected_file_revision.is_empty() || input.sources.len()>256 {
        return Err("An exact register revision and bounded disclosed source basis are required".into());
    }
    if !relative(&input.location.path) || input.location.schema != "central.path-ref/v1" {
        return Err("A Central-disclosed native register location is required".into());
    }
    // Native source/evidence revisions are not a renderer label. Every basis
    // this operation cites must be one of the caller-disclosed source reads.
    fn check(value: &Value, sources: &[Basis], native_facet: bool) -> Result<(),String> {
        match value {
            Value::Object(object) => {
                if let Some(source)=object.get("source_ref").and_then(Value::as_str) {
                    if native_facet {
                        // Canonical PlaceFacet and TemporalFacet have no source_revision field.
                        // Its one supplied Basis is independently re-read below
                        // before invoking the native Wiki writer. This exception
                        // applies only to PlaceSet/TemporalSet facet arrays, never nested evidence.
                        if object.contains_key("source_revision") {
                            return Err("A native facet takes its revision from the supplied source basis, not an extra facet field".into());
                        }
                        let mut matching = sources.iter().filter(|basis| basis.source_ref == source);
                        if source.trim().is_empty() || matching.next().is_none() || matching.next().is_some() {
                            return Err(format!("Facet source {source} requires one unique disclosed source basis"));
                        }
                    } else {
                        let revision=object.get("source_revision").and_then(Value::as_str)
                            .ok_or("A selected source requires its exact owner revision")?;
                        if !sources.iter().any(|s|s.source_ref==source && s.revision==revision) {
                            return Err(format!("Source {source} was not disclosed on this operation's exact basis"));
                        }
                    }
                } else if native_facet {
                    return Err("A native facet requires its native source reference".into());
                }
                for nested in object.values(){check(nested,sources,false)?;}
            }
            Value::Array(values)=>for value in values{check(value,sources,false)?;},
            _ if native_facet => return Err("A native facet must be an object".into()),
            _=>{}
        }
        Ok(())
    }
    // Preserve the recursive rule for the whole request except the exact native
    // PlaceSet/TemporalSet field. A similarly named object elsewhere gains no exemption.
    let request=input.request.as_object().ok_or("Native construction request must be an object")?;
    let mut header=request.clone();
    let changes=header.remove("changes").ok_or("Native construction changes are required")?;
    check(&Value::Object(header),&input.sources,false)?;
    {
        let changes=changes.as_array().ok_or("Native construction changes must be an array")?;
        for change in changes {
            let facet_field=match change["change"].as_str() {
                Some("place_set") => "places",
                Some("temporal_set") => "temporal",
                _ => { check(change,&input.sources,false)?; continue; }
            };
            let fields=change.as_object().ok_or("Native facet change must be an object")?;
            let mut header=fields.clone();
            let places=header.remove(facet_field).ok_or("Native facet values are required")?;
            check(&Value::Object(header),&input.sources,false)?;
            let places=places.as_array().ok_or("Native facet values must be an array")?;
            for place in places { check(place,&input.sources,true)?; }
        }
    }
    Ok(())
}
/// Called only through the existing Action boundary with its Central-resolved
/// context. A payload cannot redirect this operation into a different Wiki.
pub fn invoke(client:&CentralClient,cwd:&Path,project:Option<&str>,invocation:&ActionInvocation)->ActionDispatch{
    let facts = invocation.action == APPLY_FACTS;
    let operation = if facts { FACTS_OP } else { OP };
    let input:Input=match serde_json::from_value(invocation.input.clone().unwrap_or(Value::Null)){
        Ok(input)=>input,Err(e)=>return refuse(operation, format!("Malformed native construction Action: {e}")),
    };
    if input.request["schema"] != if facts { "aikit.wiki-facts-action/v1" } else { "aikit.constellation-action/v1" } {
        return refuse(operation, "The native request does not match this Action");
    }
    if let Err(e)=request_valid(&invocation.target_ref,&input){return refuse(operation, e);}
    let wiki=match client.run(if project.is_some(){"projectcentral.wiki.read"}else{"central.wiki.read"},json!({"project":project})){
        Ok(wiki)=>wiki,Err(e)=>return refuse(operation, e.to_string()),
    };
    if wiki["schema"]!="central.wiki-reading/v1" || wiki["automatic_agent_or_model_invocation"]!=false {
        return refuse(operation, "Central did not disclose the native Wiki register");
    }
    let Some(path)=wiki["source"]["path"].as_str().filter(|p|relative(p)) else{return refuse(operation, "The native Wiki source location is absent");};
    let expected=cwd.join(path);
    let destination=PathBuf::from(&input.location.root).join(&input.location.path);
    if destination!=expected{return refuse(operation, "Construction target is outside the selected native Wiki register");}
    let before=match files::read(client,&input.location){Ok(file)=>file,Err(e)=>return refuse(operation, e)};
    if before.revision!=input.expected_file_revision || wiki["source"]["revision"]!=before.revision {
        return refuse(operation, "wiki_revision_conflict: the register changed; preserve the proposal and reconcile");
    }
    if let Err(e)=source::verify(client,cwd,&input.sources,&input.request){return refuse(operation, e);}
    let Some(path)=expected.to_str() else{return refuse(operation, "The native register path is not UTF-8");};
    let input_bytes=json!({"request":input.request,"basis_content":before.content});
    let mut saved=match knowledge::run_input(cwd,&["wiki-construct",if facts {"facts-apply"} else {"apply"},"--file",path],&input_bytes){
        Ok(saved)=>saved,Err(error)=>return owner_error(operation, error),
    };
    if saved["persisted"]!=true || !matches!(saved["state"].as_str(),Some("saved"|"unchanged")) || (if facts { &saved["target"]["ref"] } else { &saved["frame_ref"] })!=&invocation.target_ref {
        return refuse(operation, "The Wiki owner did not confirm native persistence");
    }
    // Once the native write is acknowledged, failed readback is a read problem,
    // never an instruction to replay the write. Keep its real receipt intact.
    let mut warnings=Vec::new();
    if let Err(e)=source::verify(client,cwd,&input.sources,&input.request){warnings.push(e);}
    match files::read(client,&input.location){
        Ok(file)=>{
            saved["native_file"]=json!({"location":file.location,"revision":file.revision});
            if file.revision==before.revision && saved["state"]=="saved"{warnings.push("The changed Wiki write was not visible through Central readback".into());}
        },
        Err(e)=>warnings.push(format!("Central readback unavailable after native persistence: {e}")),
    }
    if facts {
        if saved["target"] != input.request["target"] || saved["reading"]["object"]["ref"] != invocation.target_ref
            || saved["reading"]["object"]["revision"] != saved["revision"] {
            warnings.push("The acknowledged fact write requires identity/revision reconciliation".into());
        }
        saved["continuity"]=json!(if warnings.is_empty(){"current"}else{"reconciliation_required"});
        saved["continuity_warnings"]=json!(warnings);
        return ActionDispatch::Invoked { owner_operation: operation.into(), data: saved };
    }
    let frame_address=knowledge::Address::Wiki(invocation.target_ref.clone());
    let readback=knowledge::call(cwd,&knowledge::Request::Read{address:frame_address});
    let title=saved["reading"]["construction"]["title"].as_str().unwrap_or(&invocation.target_ref);
    let search=knowledge::call(cwd,&knowledge::Request::Search{query:title.into()});
    let anchor=saved["reading"]["frame"]["constellations"][0]["anchor_ref"].as_str().unwrap_or(&invocation.target_ref);
    let indexed=readback.as_ref().is_ok_and(|v|contains_ref(v,&invocation.target_ref)) && search.as_ref().is_ok_and(|v|contains_ref(v,anchor)||contains_ref(v,&invocation.target_ref));
    saved["indexed_availability_proven"]=json!(indexed);
    saved["readback"]=match readback{Ok(value)=>value,Err(e)=>{warnings.push(format!("Wiki readback: {e}"));Value::Null}};
    saved["search_readback"]=match search{Ok(value)=>value,Err(e)=>{warnings.push(format!("Search readback: {e}"));Value::Null}};
    saved["continuity"]=json!(if warnings.is_empty()&&indexed{"current"}else{"reconciliation_required"});
    saved["continuity_warnings"]=json!(warnings);
    ActionDispatch::Invoked{owner_operation:operation.into(),data:saved}
}
fn contains_ref(value:&Value,reference:&str)->bool{
    match value {
        Value::Object(object)=>object.iter().any(|(key,value)|
            (["ref","ref_id","resource_ref","resource","node_ref","frame_ref","value","subject_ref"].contains(&key.as_str())&&value.as_str()==Some(reference))||contains_ref(value,reference)),
        Value::Array(values)=>values.iter().any(|v|contains_ref(v,reference)),
        _=>false,
    }
}
#[cfg(test)]
mod tests{
    use super::*;
    fn input()->Input{serde_json::from_value(json!({"location":{"schema":"central.path-ref/v1","ref":"native:path","root":"/ground","path":"Control/agents/wiki/wiki.json"},"expected_file_revision":"r1","request":{"schema":"aikit.constellation-action/v1","frame_ref":"wiki:whole","changes":[]}})).unwrap()}
    #[test]fn target_source_and_unknown_fields_fail_closed(){
        assert!(request_valid("wiki:other",&input()).is_err());
        let mut command=input();command.request["changes"]=json!([{"evidence":[{"source_ref":"native:private","source_revision":"r3"}]}]);
        assert!(request_valid("wiki:whole",&command).is_err());
        command.sources.push(Basis{source_ref:"native:private".into(),revision:"r3".into(),location:Some(command.location.clone()),content_encoding:Default::default()});
        assert!(request_valid("wiki:whole",&command).is_ok());
        assert!(!relative("../private"));assert!(!relative("/other/wiki.json"));
        let mut value=serde_json::to_value(&command.request).unwrap();value["unbounded_authority"]=json!(true);
        assert!(serde_json::from_value::<Input>(value).is_err());
    }
    #[test]fn place_set_uses_one_basis_without_exempting_nested_evidence(){
        let mut command=input();
        command.sources.push(Basis{source_ref:"source:place".into(),revision:"r3".into(),location:Some(command.location.clone()),content_encoding:Default::default()});
        let facet=json!({"place_ref":"wiki:place:proof","source_ref":"source:place","precision":"unlocated"});
        command.request["changes"]=json!([{"change":"place_set","participation_ref":"part:proof","places":[facet]}]);
        assert!(request_valid("wiki:whole",&command).is_ok());
        command.request["changes"][0]["places"][0]["source_revision"]=json!("r3");
        assert!(request_valid("wiki:whole",&command).is_err());
        command.request["changes"][0]["places"][0].as_object_mut().unwrap().remove("source_revision");
        command.request["changes"][0]["places"][0]["provenance"]=json!([{"source_ref":"source:place"}]);
        assert!(request_valid("wiki:whole",&command).is_err());
        command.request["changes"][0]["places"][0]["provenance"][0]["source_revision"]=json!("r3");
        assert!(request_valid("wiki:whole",&command).is_ok());
        command.sources.push(Basis{source_ref:"source:place".into(),revision:"r3".into(),location:Some(command.location.clone()),content_encoding:Default::default()});
        assert!(request_valid("wiki:whole",&command).is_err());
        command.sources.clear();
        assert!(request_valid("wiki:whole",&command).is_err());
        command.request["changes"]=json!([{"change":"member_add","member":{"change":"place_set","places":[{"source_ref":"source:place"}]}}]);
        assert!(request_valid("wiki:whole",&command).is_err());
    }
    #[test]fn temporal_set_uses_the_same_exact_basis_without_general_source_exemption(){
        let mut command=input();
        command.sources.push(Basis{source_ref:"source:time".into(),revision:"r5".into(),location:Some(command.location.clone()),content_encoding:Default::default()});
        command.request["changes"]=json!([{"change":"temporal_set","participation_ref":"part:time","temporal":[{"kind":"occurrence","instant":"2024-01-01T00:00:00Z","source_ref":"source:time"}]}]);
        assert!(request_valid("wiki:whole",&command).is_ok());
        command.request["changes"][0]["temporal"][0]["source_revision"]=json!("r5");
        assert!(request_valid("wiki:whole",&command).is_err());
        command.request["changes"][0]["temporal"][0].as_object_mut().unwrap().remove("source_revision");
        command.sources.clear();
        assert!(request_valid("wiki:whole",&command).is_err());
    }
    #[test]fn receipts_and_titles_are_not_indexed_subjects(){
        assert!(!contains_ref(&json!({"state":"routed","title":"wiki:subject"}),"wiki:subject"));
        assert!(contains_ref(&json!({"resource":"wiki:subject"}),"wiki:subject"));
        assert!(contains_ref(&json!({"results":[{"address":{"kind":"wiki","value":"wiki:subject"}}]}),"wiki:subject"));
    }
    #[test]fn fact_targets_keep_exact_identity_and_source_boundaries(){
        let mut command=input();
        command.request=json!({"schema":"aikit.wiki-facts-action/v1","target":{"kind":"node","ref":"wiki:node"},"changes":[{"change":"temporal_set","temporal":[]}]});
        assert!(request_valid("wiki:node",&command).is_ok());
        assert!(request_valid("wiki:register",&command).is_err());
        command.request["target"]["kind"]=json!("whole");
        assert!(request_valid("wiki:node",&command).is_ok());
        command.request["target"]["kind"]=json!("participation");
        assert!(request_valid("wiki:node",&command).is_err());
        command.request["target"]["kind"]=json!("node");
        command.request["changes"][0]["temporal"]=json!([{"kind":"occurrence","instant":"2020-01-01T00:00:00Z","source_ref":"source:time"}]);
        assert!(request_valid("wiki:node",&command).is_err());
        command.sources.push(Basis{source_ref:"source:time".into(),revision:"r5".into(),location:Some(command.location.clone()),content_encoding:Default::default()});
        assert!(request_valid("wiki:node",&command).is_ok());
        command.request["changes"][0]["temporal"][0]["evidence"]=json!([{"source_ref":"source:private","source_revision":"r5"}]);
        assert!(request_valid("wiki:node",&command).is_err());
    }
}
