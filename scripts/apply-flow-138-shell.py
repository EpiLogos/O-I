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

# Consumer-side proof that Flow placement is owner-described rather than captured
# by the first-party ProjectCentral/now convention.
test_anchor = '''    #[cfg(unix)]
    #[test]
    fn blank_create_and_human_write_use_exact_central_owner_actions() {
'''
test = r'''    #[test]
    fn retained_notes_container_preserves_flow_identity_without_path_capture() {
        let record = CentralFlowRecord {
            flow_ref: "central:flow:project:test:notes-thread".into(),
            source_ref: "central:source:project:test:notes/thread.md".into(),
            path: "notes/2026-08-24-0340.md".into(),
            created_at_unix_seconds: 1,
            current_revision: "r7".into(),
            lifecycle: "active".into(),
            title: None,
            scope_ref: "project:test".into(),
            privacy: "inherits-source-authority".into(),
            revisions: vec![],
        };
        let descriptor = CentralFlowClient::descriptor(&record).unwrap();
        assert_eq!(descriptor.flow_ref.as_str(), record.flow_ref);
        assert_eq!(descriptor.source_ref.as_str(), record.source_ref);
        assert_eq!(descriptor.revision.as_str(), "r7");
        assert_eq!(descriptor.container_hint.as_deref(), Some("notes/2026-08-24-0340.md"));
        assert_eq!(descriptor.provider.as_str(), CENTRAL_FLOW_PROVIDER_REF);
    }

'''
replace(flow, test_anchor, test + test_anchor)

# Source-audit tests inspect production code only. Fixture implementations inside
# the test module may legitimately use std::fs, and the forbidden spellings in
# assertions must not make the audit match itself.
replace(
    flow,
    '''        let source = include_str!("flow.rs");
        assert!(!source.contains("fs::write"));
        assert!(!source.contains("OpenOptions"));
''',
    '''        let source = include_str!("flow.rs").split("\\n#[cfg(test)]").next().unwrap();
        assert!(!source.contains("fs::write"));
        assert!(!source.contains("OpenOptions"));
''',
)

# Export exact AIKit Flow types needed by the native shell; no local redefinition.
lib = "desktop/core/src/lib.rs"
replace(
    lib,
    "pub use epilogos_factory::build::FactoryBuildSnapshot;\n",
    "pub use epilogos_factory::build::FactoryBuildSnapshot;\n"
    "pub use aikit_core::{\n"
    "    FlowAuthorityRef, FlowContextAuthority, FlowMutationIntent, FlowStandingContext,\n"
    "    FlowWriteResult, ResourceRef,\n"
    "};\n",
)

# Flow shell reuses the same native-horizon/runtime readers as ordinary Living Contemplate.
living = "desktop/src-tauri/src/living.rs"
replace(living, "fn current_central_horizon() -> Result<", "pub(crate) fn current_central_horizon() -> Result<")
replace(living, "fn current_model_runtime() -> Result<", "pub(crate) fn current_model_runtime() -> Result<")

# Tauri transport treats omitted authority refs as an ordinary empty set.
shell_flow = "desktop/src-tauri/src/flow.rs"
replace(shell_flow, "#[serde(default)] authority_refs: Vec<FlowAuthorityInput>,", "authority_refs: Option<Vec<FlowAuthorityInput>>,")
replace(
    shell_flow,
    "let authority_refs = authority_refs_for(&standing, authority_refs)?;",
    "let authority_refs = authority_refs_for(&standing, authority_refs.unwrap_or_default())?;",
    count=2,
)

# Flow uses the shared native-document Canvas Surface. Flow-specific code retains
# source/context chrome only; owner revision/save/conflict semantics stay outside
# the editor component.
ui = "desktop/ui/src/flow-workbench.tsx"
replace(
    ui,
    "import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';\n",
    "import { NativeDocumentEditor } from './native-document-editor';\n"
    "import { type WorkbenchEvidence, type WorkbenchSemanticRef } from './workbench-native';\n",
)
replace(
    ui,
    "methods: Array<{ method: string; source: string; revision?: string }>;\n",
    "methods: Array<{ method: string; resolution: unknown }>;\n",
)
replace(
    ui,
    '''      <textarea
        className="oi-flow__editor"
        aria-label="Current Flow"
        value={buffer}
        onChange={(event) => setBuffer(event.target.value)}
        placeholder=""
        spellCheck
      />''',
    '''      <NativeDocumentEditor
        className="oi-flow__editor"
        ariaLabel="Current Flow"
        value={buffer}
        onChange={setBuffer}
      />''',
)
replace(
    ui,
    "<button type=\"button\" disabled={busy !== ''} onClick={() => void bind()}>Bind current AgentSession</button>",
    "<button type=\"button\" disabled={busy !== '' || dirty} onClick={() => void bind()}>Bind current AgentSession</button>",
)

# A Flow selection carries both stable FlowRef and its owner SourceRef. Living
# Knowledge remains keyed by native source/resource refs, so presentation matches
# both without changing either identity.
living_model = "desktop/ui/src/living-wiki-model.ts"
replace(
    living_model,
    '''export function relatedLivingState(reading: LivingWikiDesktopReading, resourceRef?: string) {
  if (!resourceRef) return { changed: [], affected: [], paths: [], pending: false };
  const changed = reading.changed.filter((entry) => entry.source_ref === resourceRef);
  const affected = [
    ...reading.impact.direct.affected.filter(
      (entry) => entry.resource === resourceRef || entry.source === resourceRef,
    ),
    ...reading.impact.transitive.filter(
      (entry) => entry.resource === resourceRef || entry.root_source === resourceRef,
    ),
  ];
  const paths = reading.impact.paths.filter(
    (entry) => entry.resource === resourceRef || entry.root_source === resourceRef,
  );
  return {
    changed,
    affected,
    paths,
    pending: reading.impact.pending_integration.includes(resourceRef),
  };
}
''',
    '''export function relatedLivingState(
  reading: LivingWikiDesktopReading,
  resourceRef?: string,
  sourceRef?: string,
) {
  const refs = new Set([resourceRef, sourceRef].filter((value): value is string => Boolean(value)));
  if (!refs.size) return { changed: [], affected: [], paths: [], pending: false };
  const changed = reading.changed.filter((entry) => refs.has(entry.source_ref));
  const affected = [
    ...reading.impact.direct.affected.filter(
      (entry) => refs.has(entry.resource) || refs.has(entry.source),
    ),
    ...reading.impact.transitive.filter(
      (entry) => refs.has(entry.resource) || refs.has(entry.root_source),
    ),
  ];
  const paths = reading.impact.paths.filter(
    (entry) => refs.has(entry.resource) || refs.has(entry.root_source),
  );
  const relatedResources = new Set([
    ...refs,
    ...affected.map((entry) => entry.resource),
    ...paths.map((entry) => entry.resource),
  ]);
  return {
    changed,
    affected,
    paths,
    pending: reading.impact.pending_integration.some((resource) => relatedResources.has(resource)),
  };
}
''',
)

living_ui = "desktop/ui/src/living-wiki.tsx"
replace(
    living_ui,
    "    () => reading ? relatedLivingState(reading, selection?.ref) : null,\n    [reading, selection?.ref],\n",
    "    () => reading ? relatedLivingState(reading, selection?.ref, selection?.provenance.source) : null,\n    [reading, selection?.ref, selection?.provenance.source],\n",
)

living_test = "desktop/ui/src/living-wiki-model.test.mjs"
alias_test_anchor = "test('freshness language preserves moved-basis semantics instead of declaring falsehood', () => {\n"
alias_test = '''test('FlowRef selection relates through its native owner SourceRef without identity collapse', () => {
  const reading = fixture();
  const sourceRef = 'central:source:project:test:notes/thread.md';
  reading.changed[0].source_ref = sourceRef;
  reading.impact.direct.changed_sources = [sourceRef];
  reading.impact.direct.affected[0].source = sourceRef;
  reading.impact.transitive[0].root_source = sourceRef;
  reading.impact.paths[0].root_source = sourceRef;

  const related = relatedLivingState(
    reading,
    'central:flow:project:test:thread',
    sourceRef,
  );
  assert.equal(related.changed.length, 1);
  assert.equal(related.affected.length, 2);
  assert.equal(related.paths.length, 1);
  assert.equal(related.pending, true);

  const flowIdentityOnly = relatedLivingState(reading, 'central:flow:project:test:thread');
  assert.equal(flowIdentityOnly.changed.length, 0);
});

'''
replace(living_test, alias_test_anchor, alias_test + alias_test_anchor)

# Register Flow commands in the native host without adding state stores.
main = "desktop/src-tauri/src/main.rs"
replace(main, "mod living;\n", "mod flow;\nmod living;\n")
replace(
    main,
    "            agent_surface_close,\n            living::living_knowledge_status,",
    "            agent_surface_close,\n"
    "            flow::flow_list,\n"
    "            flow::flow_create,\n"
    "            flow::flow_open,\n"
    "            flow::flow_save,\n"
    "            flow::flow_history,\n"
    "            flow::flow_bind,\n"
    "            flow::flow_contemplate_preflight,\n"
    "            flow::flow_contemplate,\n"
    "            living::living_knowledge_status,",
)

Path("scripts/apply-flow-138-shell.py").unlink()
Path(".github/workflows/flow-138-shell.yml").unlink()
