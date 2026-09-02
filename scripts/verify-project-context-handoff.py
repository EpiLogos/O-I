#!/usr/bin/env python3
"""Prove the current native Project Context handoff without copying owner schemas.

The proof deliberately consumes the owner crates at the exact revisions pinned by
`surfaces.json`:

Central source identity / bounded Intent ref
    -> AIKit ContextResolutionEvidence / ContextResolutionRef
    -> Factory BoundedIntentCondition on one Run
    -> Factory BoundedIntentReturn preserving the exact source + P4 ref

O:I does not define another ContextResolution or Factory return type. This verifier
only composes the public owner APIs and emits an evidence receipt.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SURFACES = ROOT / "surfaces.json"


def fail(message: str) -> None:
    raise SystemExit(f"project-context handoff verification failed: {message}")


def run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command), flush=True)
    return subprocess.run(command, cwd=cwd, text=True, check=False)


def surface(product_id: str) -> dict:
    with SURFACES.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    found = next((item for item in data.get("surfaces", []) if item.get("id") == product_id), None)
    if found is None:
        fail(f"missing surface pin for {product_id}")
    return found


def checkout(surface_record: dict, destination: Path) -> str:
    repository = surface_record.get("repository")
    revision = surface_record.get("docs_ref")
    if not isinstance(repository, str) or not repository.startswith("https://github.com/"):
        fail(f"invalid repository {repository!r}")
    if not isinstance(revision, str) or len(revision) != 40:
        fail(f"invalid revision {revision!r}")
    if run(["git", "init", "--quiet", str(destination)]).returncode != 0:
        fail(f"git init failed for {repository}")
    if run(["git", "-C", str(destination), "remote", "add", "origin", repository]).returncode != 0:
        fail(f"remote add failed for {repository}")
    if run(["git", "-C", str(destination), "fetch", "--depth", "1", "origin", revision]).returncode != 0:
        fail(f"exact revision fetch failed for {repository}@{revision}")
    if run(["git", "-C", str(destination), "checkout", "--quiet", "--detach", "FETCH_HEAD"]).returncode != 0:
        fail(f"checkout failed for {repository}@{revision}")
    head = subprocess.check_output(["git", "-C", str(destination), "rev-parse", "HEAD"], text=True).strip()
    if head != revision:
        fail(f"checked out {head}, expected {revision}")
    return revision


RUST_MAIN = r'''
use std::collections::BTreeMap;
use std::path::PathBuf;

use aikit_core::context::ContextDescriptor;
use aikit_core::context_resolution::{
    ContextResolution, ProjectionIntent, RetrievalPlan, CONTEXT_RESOLUTION_VERSION,
};
use aikit_core::policy::ManagedPolicy;
use aikit_core::project::{
    ProjectBinding, ProjectBindingLocator, ProjectConstituentRef, ProjectRef,
};
use aikit_core::resolve::{resolution_hash, ResolvedView};
use aikit_core::resource::ResourceRef;
use aikit_core::session_space_application::ContextResolutionEvidence;
use epilogos_factory::core::run::RunRef;
use epilogos_factory::project_development::{
    BoundedIntentCondition, BoundedIntentReturn, IntentCriterionEvaluation,
    IntentCriterionState, ProjectDevelopmentError, ProjectDevelopmentLedger,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Central owns this source identity/body. The suite handoff carries only the
    // source ref into Factory; neither AIKit nor Factory is allowed to rename it.
    let intent_source_ref = "central:source:intent:oi155-w11".to_string();
    let success_ref = "central:success:oi155-w11".to_string();

    let context = ContextDescriptor::for_project("/tmp/oi155-w11");
    let policy = ManagedPolicy::default();
    let active = BTreeMap::new();
    let overlays = BTreeMap::new();
    let hash = resolution_hash(&context, &policy, &active, &overlays);
    let deterministic = ResolvedView {
        context: context.clone(),
        policy,
        active,
        declared: BTreeMap::new(),
        unavailable: BTreeMap::new(),
        selection_log: vec![],
        catalog_index: BTreeMap::new(),
        skill_usage_overlays: overlays,
        warnings: vec![],
        hash,
        catalog_revision: "catalog:oi155-w11".into(),
        properties: BTreeMap::new(),
    };

    let project = ProjectRef::parse("project:oi155-w11")?;
    let project_binding = ProjectBinding::new(
        project,
        ProjectConstituentRef::parse("source:working-tree")?,
        ProjectBindingLocator::LocalDirectory {
            path: PathBuf::from("/tmp/oi155-w11"),
        },
    );
    let resolution = ContextResolution {
        version: CONTEXT_RESOLUTION_VERSION.into(),
        project_binding,
        deterministic,
        profiles: vec![],
        scopes: vec![],
        agent: None,
        agency: None,
        host: None,
        capabilities: vec![],
        actions: vec![],
        context_sources: vec![],
        model_candidates: vec![],
        harness_candidates: vec![],
        execution_offers: vec![],
        projection: ProjectionIntent {
            targets: vec![],
            active_capabilities: vec![],
        },
        retrieval: RetrievalPlan {
            context_sources: vec![ResourceRef::parse("project:context-source:intent")?],
        },
        warnings: vec![],
    };

    let p4 = ContextResolutionEvidence::from_resolution(&resolution)?;
    let p4_ref = p4.reference.to_string();
    assert!(p4_ref.starts_with("context-resolution/"));

    let run_ref: RunRef = "run:01ARZ3NDEKTSV4RRFFQ69G5FAV".parse()?;
    let mut ledger = ProjectDevelopmentLedger::new(run_ref.clone());
    ledger.set_intent(BoundedIntentCondition {
        run_ref: run_ref.clone(),
        condition_ref: "condition:oi155-w11".into(),
        intent_source_ref: intent_source_ref.clone(),
        focus_ref: Some("focus:oi155-w11".into()),
        success_condition_refs: vec![success_ref.clone()],
        constraint_refs: vec!["constraint:no-owner-collapse".into()],
        context_resolution_ref: p4_ref.clone(),
    })?;

    ledger.set_intent_return(BoundedIntentReturn {
        run_ref: run_ref.clone(),
        return_ref: "return:oi155-w11".into(),
        intent_source_ref: intent_source_ref.clone(),
        context_resolution_ref: p4_ref.clone(),
        artifact_refs: vec!["artifact:oi155-w11".into()],
        claim_refs: vec!["claim:oi155-w11".into()],
        evidence_refs: vec!["evidence:oi155-w11".into()],
        criterion_evaluations: vec![IntentCriterionEvaluation {
            criterion_ref: success_ref,
            state: IntentCriterionState::Satisfied,
            evidence_refs: vec!["evidence:oi155-w11".into()],
        }],
    })?;

    assert_eq!(ledger.intent.as_ref().unwrap().intent_source_ref, intent_source_ref);
    assert_eq!(ledger.intent.as_ref().unwrap().context_resolution_ref, p4_ref);
    assert_eq!(ledger.intent_return.as_ref().unwrap().intent_source_ref, intent_source_ref);
    assert_eq!(ledger.intent_return.as_ref().unwrap().context_resolution_ref, p4_ref);

    // Factory must refuse a P5 return that silently swaps the AIKit P4 evidence.
    let mut mismatch = ProjectDevelopmentLedger::new(run_ref.clone());
    mismatch.set_intent(BoundedIntentCondition {
        run_ref: run_ref.clone(),
        condition_ref: "condition:oi155-w11-mismatch".into(),
        intent_source_ref: intent_source_ref.clone(),
        focus_ref: None,
        success_condition_refs: vec![],
        constraint_refs: vec![],
        context_resolution_ref: p4_ref.clone(),
    })?;
    let error = mismatch
        .set_intent_return(BoundedIntentReturn {
            run_ref,
            return_ref: "return:oi155-w11-mismatch".into(),
            intent_source_ref: intent_source_ref.clone(),
            context_resolution_ref: "context-resolution/not-the-run-basis".into(),
            artifact_refs: vec![],
            claim_refs: vec![],
            evidence_refs: vec![],
            criterion_evaluations: vec![],
        })
        .unwrap_err();
    assert!(matches!(error, ProjectDevelopmentError::ContextResolutionMismatch { .. }));

    println!("{{\"schema\":\"oi.project-context-handoff-evidence/v1\",\"intent_source_ref\":\"{}\",\"context_resolution_ref\":\"{}\",\"run_ref\":\"{}\",\"return_ref\":\"return:oi155-w11\",\"p4_mismatch_refused\":true}}", intent_source_ref, p4_ref, ledger.run_ref);
    Ok(())
}
'''


def verify(receipt_path: Path | None) -> int:
    started = time.time()
    temp_root = Path(tempfile.mkdtemp(prefix="oi-project-context-handoff-"))
    result = {
        "schema": "oi.project-context-handoff-run/v1",
        "status": "failed",
        "central_revision": None,
        "aikit_revision": None,
        "factory_revision": None,
        "evidence": None,
        "elapsed_seconds": None,
    }
    try:
        central = surface("central")
        aikit = surface("ai-kit")
        factory = surface("software-factory")
        # Central's exact main is independently exercised by the current-main matrix.
        # Pin it in this receipt so the P3 source owner is part of the same evidence set.
        result["central_revision"] = central.get("docs_ref")
        result["aikit_revision"] = checkout(aikit, temp_root / "ai-kit")
        result["factory_revision"] = checkout(factory, temp_root / "factory")

        witness = temp_root / "witness"
        (witness / "src").mkdir(parents=True)
        cargo = textwrap.dedent(
            f'''\
            [package]
            name = "oi-project-context-handoff-witness"
            version = "0.0.0"
            edition = "2021"
            publish = false

            [dependencies]
            aikit-core = {{ path = {json.dumps(str(temp_root / 'ai-kit' / 'crates' / 'aikit-core'))} }}
            epilogos-factory = {{ path = {json.dumps(str(temp_root / 'factory' / 'factory'))} }}
            '''
        )
        (witness / "Cargo.toml").write_text(cargo, encoding="utf-8")
        (witness / "src" / "main.rs").write_text(RUST_MAIN, encoding="utf-8")

        completed = subprocess.run(
            ["cargo", "run", "--quiet"],
            cwd=witness,
            text=True,
            stdout=subprocess.PIPE,
            stderr=None,
            check=False,
        )
        if completed.returncode != 0:
            fail(f"native AIKit→Factory witness exited {completed.returncode}")
        lines = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
        if not lines:
            fail("native witness returned no evidence")
        evidence = json.loads(lines[-1])
        if evidence.get("schema") != "oi.project-context-handoff-evidence/v1":
            fail(f"unexpected witness evidence {evidence!r}")
        if not evidence.get("p4_mismatch_refused"):
            fail("Factory did not prove P4 mismatch refusal")
        result["evidence"] = evidence
        result["status"] = "passed"
        return 0
    finally:
        result["elapsed_seconds"] = round(time.time() - started, 3)
        if receipt_path is not None:
            receipt_path.parent.mkdir(parents=True, exist_ok=True)
            receipt_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        if os.environ.get("OI_KEEP_CONTEXT_HANDOFF_CHECKOUT") != "1":
            shutil.rmtree(temp_root, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    return verify(args.receipt)


if __name__ == "__main__":
    sys.exit(main())
