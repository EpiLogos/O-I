//! Constructive Wiki Actions: the native Wiki owner writes; Central discloses
//! the root, exact file and source revisions. No alternate source store.
use crate::{action::{ActionDispatch, ActionInvocation}, files::{self, Location}, flow::CentralClient, knowledge};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};

pub const APPLY: &str = "aikit.constellation.apply";
const OP: &str = "aikit wiki-construct apply";
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Basis {
    source_ref: String,
    revision: String,
    location: Location,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    location: Location,
    expected_file_revision: String,
    request: Value,
    #[serde(default)]
    sources: Vec<Basis>,
}
fn refuse(message: impl Into<String>) -> ActionDispatch {
    ActionDispatch::OwnerRefused { owner_operation: OP.into(), message: message.into() }
}
fn owner_error(error: knowledge::CallError) -> ActionDispatch {
    match error {
        knowledge::CallError::Unavailable {detail} => ActionDispatch::OwnerUnavailable {owner_operation:OP.into(),detail},
        knowledge::CallError::Refused {message} => refuse(message),
        knowledge::CallError::Malformed {detail} => refuse(detail),
    }
}
fn relative(path: &str) -> bool {
    !path.is_empty() && Path::new(path).components().all(|p| matches!(p,Component::Normal(_)))
}
fn request_valid(target: &str, input: &Input) -> Result<(),String> {
    if input.request["schema"] != "aikit.constellation-action/v1" || input.request["frame_ref"] != target {
        return Err("Action target and native construction identity disagree".into());
    }
    if input.expected_file_revision.is_empty() || input.sources.len()>256 {
        return Err("An exact register revision and bounded disclosed source basis are required".into());
    }
    if !relative(&input.location.path) || input.location.schema != "central.path-ref/v1" {
        return Err("A Central-disclosed native register location is required".into());
    }
    // Native source/evidence revisions are not a renderer label. Every basis
    // this operation cites must be one of the caller-disclosed source reads.
    fn check(value: &Value, sources: &[Basis]) -> Result<(),String> {
        match value {
            Value::Object(object) => {
                if let Some(source)=object.get("source_ref").and_then(Value::as_str) {
                    let revision=object.get("source_revision").and_then(Value::as_str)
                        .ok_or("A selected source requires its exact owner revision")?;
                    if !sources.iter().any(|s|s.source_ref==source && s.revision==revision) {
                        return Err(format!("Source {source} was not disclosed on this operation's exact basis"));
                    }
                }
                for nested in object.values(){check(nested,sources)?;}
            }
            Value::Array(values)=>for value in values{check(value,sources)?;},
            _=>{}
        }
        Ok(())
    }
    check(&input.request,&input.sources)
}
fn verify_sources(client:&CentralClient, sources:&[Basis])->Result<(),String>{
    for source in sources {
        if source.revision.is_empty(){return Err("A source basis has no revision".into());}
        let reading=files::read(client,&source.location)?;
        let actual=reading.source.as_ref().map(|s|s.source_ref.as_str()).unwrap_or(&reading.location.ref_id);
        if actual!=source.source_ref || reading.revision!=source.revision {
            return Err(format!("source_revision_conflict: {} changed or was redirected; inspect and reconcile",source.source_ref));
        }
    }
    Ok(())
}
/// Called only through the existing Action boundary with its Central-resolved
/// context. A payload cannot redirect this operation into a different Wiki.
pub fn invoke(client:&CentralClient,cwd:&Path,project:Option<&str>,invocation:&ActionInvocation)->ActionDispatch{
    let input:Input=match serde_json::from_value(invocation.input.clone().unwrap_or(Value::Null)){
        Ok(input)=>input,Err(e)=>return refuse(format!("Malformed native construction Action: {e}")),
    };
    if let Err(e)=request_valid(&invocation.target_ref,&input){return refuse(e);}
    let wiki=match client.run(if project.is_some(){"projectcentral.wiki.read"}else{"central.wiki.read"},json!({"project":project})){
        Ok(wiki)=>wiki,Err(e)=>return refuse(e.to_string()),
    };
    if wiki["schema"]!="central.wiki-reading/v1" || wiki["automatic_agent_or_model_invocation"]!=false {
        return refuse("Central did not disclose the native Wiki register");
    }
    let Some(path)=wiki["source"]["path"].as_str().filter(|p|relative(p)) else{return refuse("The native Wiki source location is absent");};
    let expected=cwd.join(path);
    let destination=PathBuf::from(&input.location.root).join(&input.location.path);
    if destination!=expected{return refuse("Construction target is outside the selected native Wiki register");}
    let before=match files::read(client,&input.location){Ok(file)=>file,Err(e)=>return refuse(e)};
    if before.revision!=input.expected_file_revision || wiki["source"]["revision"]!=before.revision {
        return refuse("wiki_revision_conflict: the register changed; preserve the proposal and reconcile");
    }
    if let Err(e)=verify_sources(client,&input.sources){return refuse(e);}
    let Some(path)=expected.to_str() else{return refuse("The native register path is not UTF-8");};
    let input_bytes=json!({"request":input.request,"basis_content":before.content});
    let mut saved=match knowledge::run_input(cwd,&["wiki-construct","apply","--file",path],&input_bytes){
        Ok(saved)=>saved,Err(error)=>return owner_error(error),
    };
    if saved["persisted"]!=true || !matches!(saved["state"].as_str(),Some("saved"|"unchanged")) || saved["frame_ref"]!=invocation.target_ref {
        return refuse("The Wiki owner did not confirm native persistence");
    }
    // Once the native write is acknowledged, failed readback is a read problem,
    // never an instruction to replay the write. Keep its real receipt intact.
    let mut warnings=Vec::new();
    if let Err(e)=verify_sources(client,&input.sources){warnings.push(e);}
    match files::read(client,&input.location){
        Ok(file)=>{
            saved["native_file"]=json!({"location":file.location,"revision":file.revision});
            if file.revision==before.revision && saved["state"]=="saved"{warnings.push("The changed Wiki write was not visible through Central readback".into());}
        },
        Err(e)=>warnings.push(format!("Central readback unavailable after native persistence: {e}")),
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
    ActionDispatch::Invoked{owner_operation:OP.into(),data:saved}
}
fn contains_ref(value:&Value,reference:&str)->bool{
    match value {
        Value::Object(object)=>object.iter().any(|(key,value)|
            (["ref","ref_id","resource_ref","node_ref","frame_ref","value","subject_ref"].contains(&key.as_str())&&value.as_str()==Some(reference))||contains_ref(value,reference)),
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
        command.sources.push(Basis{source_ref:"native:private".into(),revision:"r3".into(),location:command.location.clone()});
        assert!(request_valid("wiki:whole",&command).is_ok());
        assert!(!relative("../private"));assert!(!relative("/other/wiki.json"));
        let mut value=serde_json::to_value(&command.request).unwrap();value["unbounded_authority"]=json!(true);
        assert!(serde_json::from_value::<Input>(value).is_err());
    }
    #[test]fn receipts_and_titles_are_not_indexed_subjects(){
        assert!(!contains_ref(&json!({"state":"routed","title":"wiki:subject"}),"wiki:subject"));
        assert!(contains_ref(&json!({"results":[{"address":{"kind":"wiki","value":"wiki:subject"}}]}),"wiki:subject"));
    }
}
