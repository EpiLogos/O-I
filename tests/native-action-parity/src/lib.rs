#[cfg(test)]
mod tests {
    use epilogos_factory::action_projection::{
        execute_projected_factory_action, FactoryActionCaller, FactoryActionProjectionKind,
        FactoryActionProjectionReceipt, FactoryActionProjectionRequest,
        ProjectedFactoryActionAuthority, FACTORY_ACTION_PROJECTION_CONTRACT,
    };
    use epilogos_factory::build::{
        CandidateRecord, FactoryBuildSelection, FactoryBuildState,
        REQUEST_MORE_EVIDENCE_ACTION_REF, REQUEST_MORE_EVIDENCE_CAPABILITY_REF,
    };
    use epilogos_factory::build_provider::FactoryBuildFileProvider;
    use epilogos_factory::core::run::{Project, ProjectRef, Run, RunRef};
    use std::fs;
    use std::path::PathBuf;
    use std::str::FromStr;

    const PROJECT: &str = "project:01ARZ3NDEKTSV4RRFFQ69G5FDA";
    const RUN: &str = "run:01ARZ3NDEKTSV4RRFFQ69G5FDB";
    const CANDIDATE: &str = "candidate:01ARZ3NDEKTSV4RRFFQ69G5FDC";
    const AUTHORITY: &str = "authority/oi111-native-action-parity";

    fn state() -> (FactoryBuildState, FactoryBuildSelection) {
        let project_ref = ProjectRef::from_str(PROJECT).unwrap();
        let run_ref = RunRef::from_str(RUN).unwrap();
        let project = Project::new(project_ref.clone());
        let run = Run::new(
            run_ref.clone(),
            project_ref.clone(),
            "O:I consumes one native Factory Action across projections",
            "factory-owner",
        )
        .unwrap();
        let mut state = FactoryBuildState::new(project, run).unwrap();
        state
            .insert_candidate(CandidateRecord {
                run_ref: run_ref.clone(),
                candidate_ref: CANDIDATE.into(),
                revision: 1,
                label: "O:I parity Candidate".into(),
                status: "ready".into(),
                producing_execution_refs: Vec::new(),
                claim_refs: Vec::new(),
                evidence_refs: vec!["evidence:oi111-native-action-parity".into()],
                artifact_refs: Vec::new(),
                preview_ref: None,
                tradeoffs: Vec::new(),
            })
            .unwrap();
        (
            state,
            FactoryBuildSelection {
                project_ref,
                run_ref,
            },
        )
    }

    fn path(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "oi111-native-action-parity-{}-{label}.json",
            std::process::id()
        ))
    }

    fn provider(label: &str) -> (FactoryBuildFileProvider, PathBuf) {
        let (state, selection) = state();
        let path = path(label);
        let _ = fs::remove_file(&path);
        let provider = FactoryBuildFileProvider::create(&path, selection, state).unwrap();
        (provider, path)
    }

    fn request(
        projection_kind: FactoryActionProjectionKind,
        projection_ref: &str,
        caller_ref: &str,
        lineage: Vec<&str>,
    ) -> FactoryActionProjectionRequest {
        FactoryActionProjectionRequest {
            contract: FACTORY_ACTION_PROJECTION_CONTRACT.into(),
            projection_ref: projection_ref.into(),
            caller: FactoryActionCaller {
                caller_ref: caller_ref.into(),
                projection_kind,
                lineage: lineage.into_iter().map(str::to_owned).collect(),
            },
            action_ref: REQUEST_MORE_EVIDENCE_ACTION_REF.into(),
            subject_ref: CANDIDATE.into(),
            run_ref: RUN.into(),
            authority: ProjectedFactoryActionAuthority {
                authority_ref: AUTHORITY.into(),
                native_owner: "factory".into(),
                capability_ref: Some(REQUEST_MORE_EVIDENCE_CAPABILITY_REF.into()),
                capability_granted: true,
                action_authorised: true,
            },
        }
    }

    fn same_native_return(receipts: &[FactoryActionProjectionReceipt]) {
        let first = &receipts[0].native_result;
        for receipt in receipts {
            assert_eq!(receipt.action_ref, REQUEST_MORE_EVIDENCE_ACTION_REF);
            assert_eq!(receipt.subject_ref, CANDIDATE);
            assert_eq!(receipt.run_ref, RUN);
            assert_eq!(receipt.authority_ref, AUTHORITY);
            assert_eq!(receipt.native_result.action_ref, first.action_ref);
            assert_eq!(receipt.native_result.subject_ref, first.subject_ref);
            assert_eq!(receipt.native_result.authority_ref, first.authority_ref);
            assert_eq!(receipt.native_result.previous_revision, first.previous_revision);
            assert_eq!(receipt.native_result.next_revision, first.next_revision);
            assert_eq!(
                receipt.native_result.created_human_request_ref,
                first.created_human_request_ref
            );
        }
    }

    #[test]
    fn oi_consumes_exact_factory_action_identity_handler_authority_lineage_and_return() {
        let (mut human_provider, human_path) = provider("human");
        let (mut agent_provider, agent_path) = provider("agent");
        let (mut headless_provider, headless_path) = provider("headless");

        let human = execute_projected_factory_action(
            &mut human_provider,
            &request(
                FactoryActionProjectionKind::DesktopHuman,
                "projection:oi-desktop/factory-build",
                "human:operator",
                vec!["human:operator"],
            ),
        )
        .unwrap();
        let agent = execute_projected_factory_action(
            &mut agent_provider,
            &request(
                FactoryActionProjectionKind::SituatedAgent,
                "projection:oi-agent/factory-build",
                "agent:mahamaya",
                vec!["human:operator", "agent:mahamaya"],
            ),
        )
        .unwrap();
        let headless = execute_projected_factory_action(
            &mut headless_provider,
            &request(
                FactoryActionProjectionKind::Headless,
                "projection:oi-headless/factory-build",
                "automation:oi111",
                vec!["automation:oi111"],
            ),
        )
        .unwrap();

        assert_eq!(human.caller.lineage, vec!["human:operator"]);
        assert_eq!(
            agent.caller.lineage,
            vec!["human:operator", "agent:mahamaya"]
        );
        assert_eq!(headless.caller.lineage, vec!["automation:oi111"]);
        same_native_return(&[human, agent, headless]);

        for path in [human_path, agent_path, headless_path] {
            let _ = fs::remove_file(path);
        }
    }
}
