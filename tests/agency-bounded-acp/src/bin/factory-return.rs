#[path = "../factory_return.rs"]
mod factory_return;
use std::path::PathBuf;
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args_os().skip(1).map(PathBuf::from).collect();
    if args.len() != 3 {
        return Err("usage: factory-return <live-acp-evidence-directory> <workcell-proof.json> <new-output-directory>".into());
    }
    let receipt = factory_return::retain_factory_return(&args[0], &args[1], &args[2])?;
    println!("{}", serde_json::to_string(&receipt)?);
    Ok(())
}
