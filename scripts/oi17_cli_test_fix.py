from pathlib import Path

path = Path('cli/tests/cli.rs')
text = path.read_text()
old = '''    let aikit = fake_executable(
        bin.path(),
        "aikit",
        "if [ \\"$1\\" = '--version' ]; then echo 'aikit 1.0.0'; fi",
    );
    for (module, executable) in [("central", ctrl), ("ai-kit", aikit)] {
        let result = output(
            oi(home.path(), bin.path())
                .args(["register", module, "--executable"])
                .arg(executable),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    for module in [
        "actuation",
        "software-factory",
        "workcell",
        "quaternal-logic",
    ] {'''
new = '''    let aikit = fake_executable(
        bin.path(),
        "aikit",
        "if [ \\"$1\\" = '--version' ]; then echo 'aikit 1.0.0'; fi",
    );
    let workcell = fake_executable(
        bin.path(),
        "workcell",
        "if [ \\"$1\\" = '--version' ]; then echo 'workcell 0.1.0'; fi",
    );
    for (module, executable) in [
        ("central", ctrl),
        ("ai-kit", aikit),
        ("workcell", workcell),
    ] {
        let result = output(
            oi(home.path(), bin.path())
                .args(["register", module, "--executable"])
                .arg(executable),
        );
        assert!(result.status.success(), "{}", text(&result.stderr));
    }
    for module in ["actuation", "software-factory", "quaternal-logic"] {'''
if old not in text:
    raise SystemExit('registered-composition fixture not found')
text = text.replace(old, new, 1)
old = '''    assert_eq!(aliases, vec!["ctrl", "kit"]);'''
new = '''    assert_eq!(aliases, vec!["ctrl", "kit", "workcell"]);'''
if old not in text:
    raise SystemExit('alias fixture not found')
text = text.replace(old, new, 1)
old = '''fn install_central_registers_an_existing_compatible_ctrl() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let result = output(oi(home.path(), bin.path()).args(["install", "central"]));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(text(&result.stdout).contains("existing compatible Central"));
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["modules"]["central"]["version"], "ctrl 0.1.0");
}'''
new = '''fn register_central_discovers_an_existing_compatible_ctrl() {
    let home = TempDir::new().unwrap();
    let bin = TempDir::new().unwrap();
    fake_central(bin.path(), 0);
    let result = output(oi(home.path(), bin.path()).args(["register", "central"]));
    assert!(result.status.success(), "{}", text(&result.stderr));
    assert!(text(&result.stdout).contains("Registered: Central"));
    let state: Value =
        serde_json::from_slice(&fs::read(home.path().join("composition.json")).unwrap()).unwrap();
    assert_eq!(state["modules"]["central"]["version"], "ctrl 0.1.0");
}'''
if old not in text:
    raise SystemExit('legacy Central install fixture not found')
text = text.replace(old, new, 1)
path.write_text(text)
