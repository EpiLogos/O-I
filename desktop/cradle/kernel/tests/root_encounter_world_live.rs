//! Read-only replay over the installed owner and its retained local Worlds.
//! The campaign already has a foreign control:root proof World; it is retained,
//! never recreated/deleted to make this test pass.
use oi_cradle_kernel::agency::Client;
use serde_json::Value;
use std::{path::PathBuf, process::Command};

#[test]
#[ignore = "requires the campaign's installed native owner and retained foreign root World"]
fn root_discovery_keeps_native_place_and_excludes_another_local_world() {
    let root=std::fs::canonicalize(std::env::var_os("OI_CENTRAL_ROOT").expect("explicit current ground")).unwrap();
    let oi=std::env::var_os("OI_BIN").map(PathBuf::from).unwrap_or_else(||"oi".into());
    let output=Command::new(oi).args(["aikit","session-space","-C"]).arg(&root)
        .args(["discover","--project","control:root"]).output().unwrap();
    assert!(output.status.success(),"{}",String::from_utf8_lossy(&output.stderr));
    let original:Value=serde_json::from_slice(&output.stdout).unwrap();
    let path=|row:&Value|row["project_contexts"]["control:root"]["basis"]["project_binding"]["locator"]["path"].as_str().map(PathBuf::from);
    let rows=original.as_array().unwrap();
    let foreign:Vec<_>=rows.iter().filter(|row|path(row).is_some_and(|p|std::fs::canonicalize(p).ok().as_ref()!=Some(&root))).collect();
    assert!(!foreign.is_empty(),"Held-out foreign World must actually be retained for this campaign replay");
    let local:Vec<_>=rows.iter().filter(|row|path(row).is_some_and(|p|std::fs::canonicalize(p).ok().as_ref()==Some(&root))).collect();
    assert!(!local.is_empty(),"The current native root conversation must actually exist");
    let filtered=Client::discover().read_project(&root,"control:root").unwrap();
    let selected=filtered.as_array().unwrap();
    for row in &local {assert!(selected.contains(row),"current World source/context must be preserved exactly");}
    for row in &foreign {assert!(!selected.contains(row),"another local World is not this Central's conversation");}
    println!("Native retained roots: {} current, {} other; current row content preserved",local.len(),foreign.len());
}
