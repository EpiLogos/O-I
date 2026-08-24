from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f"anchor missing in {path}: expected {count}, got {actual}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count))

# CentralFlowClient applies only AIKit-validated, exact-basis Agent intents.
flow = "desktop/core/src/flow.rs"
insert = '''    pub fn history(&self, flow_ref: &str) -> Result<Value, String> {
        self.run("projectcentral.flow.history", json!({"flow_ref": flow_ref}))
    }
'''
replacement = insert + r'''

    pub fn apply_agent_intent(
        &mut self,
        standing: &FlowStandingContext,
        intent: &aikit_core::FlowMutationIntent,
    ) -> Result<FlowWriteResult, String> {
        aikit_core::apply_flow_mutation(self, standing, intent).map_err(|error| error.to_string())
    }
'''
replace(flow, insert, replacement)

# Export exact AIKit Flow types needed by the native shell; no local redefinition.
lib = "desktop/core/src/lib.rs"
replace(
    lib,
    '''pub use epilogos_factory::build::FactoryBuildSnapshot;\n''',
    '''pub use epilogos_factory::build::FactoryBuildSnapshot;\npub use aikit_core::{\n    FlowAuthorityRef, FlowContextAuthority, FlowMutationIntent, FlowStandingContext,\n    FlowWriteResult, ResourceRef,\n};\n''')

# Flow shell reuses the same native-horizon/runtime readers as ordinary Living Contemplate.
living = "desktop/src-tauri/src/living.rs"
replace(living, "fn current_central_horizon() -> Result<", "pub(crate) fn current_central_horizon() -> Result<")
replace(living, "fn current_model_runtime() -> Result<", "pub(crate) fn current_model_runtime() -> Result<")

# Tauri transport treats omitted authority refs as an ordinary empty set.
shell_flow = "desktop/src-tauri/src/flow.rs"
replace(shell_flow, "#[serde(default)] authority_refs: Vec<FlowAuthorityInput>,", "authority_refs: Option<Vec<FlowAuthorityInput>>,")
replace(shell_flow, "let authority_refs = authority_refs_for(&standing, authority_refs)?;", "let authority_refs = authority_refs_for(&standing, authority_refs.unwrap_or_default())?;", count=2)

# Register Flow commands in the native host without adding state stores.
main = "desktop/src-tauri/src/main.rs"
replace(main, "mod living;\n", "mod flow;\nmod living;\n")
replace(
    main,
    '''            agent_surface_close,\n            living::living_knowledge_status,''',
    '''            agent_surface_close,\n            flow::flow_list,\n            flow::flow_create,\n            flow::flow_open,\n            flow::flow_save,\n            flow::flow_history,\n            flow::flow_bind,\n            flow::flow_contemplate_preflight,\n            flow::flow_contemplate,\n            living::living_knowledge_status,''')

Path("scripts/apply-flow-138-shell.py").unlink()
Path(".github/workflows/flow-138-shell.yml").unlink()
