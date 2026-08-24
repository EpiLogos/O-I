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
    '''pub use epilogos_factory::build::FactoryBuildSnapshot;
''',
    '''pub use epilogos_factory::build::FactoryBuildSnapshot;
pub use aikit_core::{
    FlowAuthorityRef, FlowContextAuthority, FlowMutationIntent, FlowStandingContext,
    FlowWriteResult, ResourceRef,
};
''')

# Flow shell reuses the same native-horizon/runtime readers as ordinary Living Contemplate.
living = "desktop/src-tauri/src/living.rs"
replace(living, "fn current_central_horizon() -> Result<", "pub(crate) fn current_central_horizon() -> Result<")
replace(living, "fn current_model_runtime() -> Result<", "pub(crate) fn current_model_runtime() -> Result<")

# Register Flow commands in the native host without adding state stores.
main = "desktop/src-tauri/src/main.rs"
replace(main, "mod living;\n", "mod flow;\nmod living;\n")
replace(
    main,
    '''            agent_surface_close,
            living::living_knowledge_status,''',
    '''            agent_surface_close,
            flow::flow_list,
            flow::flow_create,
            flow::flow_open,
            flow::flow_save,
            flow::flow_history,
            flow::flow_bind,
            flow::flow_contemplate_preflight,
            flow::flow_contemplate,
            living::living_knowledge_status,''')

Path("scripts/apply-flow-138-shell.py").unlink()
Path(".github/workflows/flow-138-shell.yml").unlink()
