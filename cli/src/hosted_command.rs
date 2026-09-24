fn command_hosted(args: &[OsString], contribution: bool) -> Result<i32, String> {
    use oi_cli::hosted;
    let mut words: Vec<String> = args.iter().map(|value| value.to_str().map(str::to_owned).ok_or("Arguments must be UTF-8")).collect::<Result<_, _>>()?;
    words.retain(|word| word != "--json");
    let schema = if contribution { hosted::CONTRIBUTION_SCHEMA } else { hosted::PRESENTATION_SCHEMA };
    let name = if contribution { "contribution" } else { "presentation" };
    let verb = words.first().map(String::as_str).unwrap_or("help");
    if matches!(verb, "help" | "--help" | "-h") {
        println!("oi {name} validate FILE | register FILE | list | show REF [--json]");
        if contribution { println!("oi contribution compile-registry --root DIRECTORY [--metadata] MANIFEST...\nEmits reviewed compile-time source to stdout; registration never loads code."); }
        return Ok(0);
    }
    if verb == "compile-registry" && contribution {
        if words.get(1).map(String::as_str) != Some("--root") || words.len() < 4 { return Err("Expected compile-registry --root DIRECTORY [--metadata] MANIFEST...".into()); }
        let root = PathBuf::from(&words[2]);
        let metadata = words.get(3).map(String::as_str) == Some("--metadata");
        let manifests: Vec<PathBuf> = words[if metadata {4} else {3}..].iter().map(PathBuf::from).collect();
        if manifests.is_empty() { return Err("At least one manifest is required".into()); }
        print!("{}", if metadata {hosted::compile_metadata(&root, &manifests)?} else {hosted::compile_registry(&root, &manifests)?});
        return Ok(0);
    }
    let root = state_path()?.parent().ok_or("Composition state has no parent")?.join("hosted").join(name);
    let result = match (verb, words.len()) {
        ("validate", 2) => {
            let source = PathBuf::from(&words[1]);
            let value = hosted::read(&source)?;
            hosted::validate(&value)?;
            if value["schema"] != schema { return Err(format!("Expected {schema}")); }
            if contribution { hosted::verify_source(&source, &value)?; }
            serde_json::json!({"valid":true,"schema":schema,"document":value})
        },
        ("register", 2) => hosted::register(&root, &PathBuf::from(&words[1]), schema)?,
        ("show", 2) => hosted::show(&root, &words[1])?,
        ("list", 1) => serde_json::to_value(hosted::list(&root)?).map_err(|e| e.to_string())?,
        _ => return Err(format!("Unknown {name} operation or arguments; use oi {name} --help")),
    };
    println!("{}", serde_json::to_string_pretty(&result).map_err(|e| e.to_string())?);
    Ok(0)
}
