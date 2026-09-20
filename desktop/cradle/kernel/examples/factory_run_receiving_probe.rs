//! Controlled acceptance of the actual TypeScript-composed document on
//! the existing native Kernel and Unix transport. Not a Tauri/Mac/provider
//! observation, and never linked into the shipped application.
#[cfg(unix)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use oi_cradle_kernel::{expression::Request, expression_transport, Kernel, KernelOp};
    use serde_json::{json, Value};
    use std::{io::Read, sync::{Arc, Mutex}};
    let mut raw = String::new();
    std::io::stdin().take(512 * 1024 + 1).read_to_string(&mut raw)?;
    if raw.len() > 512 * 1024 { return Err("input exceeds the native document budget".into()); }
    let document: Value = serde_json::from_str(&raw)?;
    let expression_ref = document["expression_ref"].as_str().ok_or("missing Expression ref")?;
    let root = format!("{expression_ref}:entity:run");
    let expected_subject = document["entities"][&root]["subject"].clone();
    let kernel = Arc::new(Mutex::new(Kernel::discover()));
    let address = std::env::temp_dir().join(format!("factory-run-receiving-{}.sock", std::process::id()));
    let server = expression_transport::serve(&address, move |request| {
        let outcome = kernel.lock().map_err(|_| "kernel lock poisoned".to_string())?.apply(KernelOp::Expression { request })?;
        serde_json::to_value(outcome).map_err(|error| error.to_string())
    }).map_err(std::io::Error::other)?;
    let open: Request = serde_json::from_value(json!({"operation":"open","document":document,"actor":"controlled-factory-receiving-test"}))?;
    let opened = expression_transport::call(&address, &open).map_err(std::io::Error::other)?;
    assert_eq!(opened["ok"], true, "{opened}");
    assert_eq!(opened["outcome"]["result"], "expression");
    assert_eq!(opened["outcome"]["data"]["state"], "ready", "{opened}");
    assert_eq!(opened["outcome"]["data"]["document"]["entities"][&root]["subject"], expected_subject);
    let inspect: Request = serde_json::from_value(json!({"operation":"inspect","expression_ref":expression_ref}))?;
    let readback = expression_transport::call(&address, &inspect).map_err(std::io::Error::other)?;
    assert_eq!(readback["outcome"]["data"]["document"], opened["outcome"]["data"]["document"]);
    let mut invalid = document.clone();
    invalid["entities"][&root]["subject"]["subject_ref"] = json!(expression_ref);
    let bad: Request = serde_json::from_value(json!({"operation":"open","document":invalid,"actor":"controlled-factory-receiving-test"}))?;
    let refused = expression_transport::call(&address, &bad).map_err(std::io::Error::other)?;
    assert_eq!(refused["ok"], false, "Expression-local Run ownership must be refused");
    let unchanged = expression_transport::call(&address, &inspect).map_err(std::io::Error::other)?;
    assert_eq!(unchanged["outcome"]["data"]["document"], readback["outcome"]["data"]["document"]);
    drop(server);
    let disconnected = expression_transport::call(&address, &inspect);
    assert!(disconnected.is_err(), "a disconnected native handler cannot pass");
    println!("{}", json!({"schema":"oi.factory-controlled-native-receiving/v1","standing":"controlled-native-kernel-socket-only","expression_ref":expression_ref,"same_run_readback":true,"invalid_native_owner_refused":true,"disconnected_handler_refused":true,"installed":false,"self_inhabitation":false}));
    Ok(())
}
#[cfg(not(unix))]
fn main() { panic!("native Unix transport acceptance requires Unix"); }
