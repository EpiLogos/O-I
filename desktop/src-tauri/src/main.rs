use oi_desktop_core::{
    host_native_contribution, ActionAuthorityGrant, BridgeCallClass, BridgeCaller, BridgePolicy,
    DesktopHost, FactoryActionRoundTrip, FactoryBuildSnapshot, HostedContribution,
    LocalFactoryHost, NativeContributionReading, SemanticRef, ShellDestination, ShellSnapshot,
    SurfaceActionEmission, FACTORY_BUILD_CONTRIBUTION_REF,
};
use serde::Deserialize;
use std::env;
use std::sync::Mutex;
use tauri::State;

const CONTRIBUTION_FIXTURES: &str = include_str!("../../fixtures/native-contributions.json");

#[derive(Deserialize)]
struct ContributionFixtures {
    schema: String,
    contributions: Vec<NativeContributionReading>,
}

struct AppState {
    host: Mutex<DesktopHost>,
    contributions: Mutex<Vec<HostedContribution>>,
    factory: Mutex<Option<LocalFactoryHost>>,
}

#[tauri::command]
fn shell_snapshot(state: State<'_, AppState>) -> Result<ShellSnapshot, String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .snapshot(BridgeCaller::ShellUi)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn contribution_catalog(state: State<'_, AppState>) -> Result<Vec<HostedContribution>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DiscloseContributions)
        .map_err(|error| error.to_string())?;
    Ok(state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?
        .clone())
}

#[tauri::command]
fn factory_build_snapshot(
    state: State<'_, AppState>,
) -> Result<Option<FactoryBuildSnapshot>, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::ObserveFactoryBuild)
        .map_err(|error| error.to_string())?;
    let mut factory = state
        .factory
        .lock()
        .map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let Some(factory) = factory.as_mut() else {
        return Ok(None);
    };
    let observation = factory.refresh()?;
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(observation.snapshot)
}

#[tauri::command]
fn dispatch_factory_action(
    state: State<'_, AppState>,
    emission: SurfaceActionEmission,
    grant: ActionAuthorityGrant,
) -> Result<FactoryActionRoundTrip, String> {
    BridgePolicy
        .authorize(BridgeCaller::ShellUi, BridgeCallClass::DispatchFactoryAction)
        .map_err(|error| error.to_string())?;
    let mut factory = state
        .factory
        .lock()
        .map_err(|_| "Factory provider lock poisoned".to_owned())?;
    let factory = factory
        .as_mut()
        .ok_or_else(|| "no Factory-owned local provider is configured".to_owned())?;
    let round_trip = factory.dispatch(&emission, &grant)?;
    let observation = factory.observe()?;
    replace_factory_contribution(&state, observation.contribution)?;
    Ok(round_trip)
}

#[tauri::command]
fn select_semantic_ref(state: State<'_, AppState>, subject: SemanticRef) -> Result<(), String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .select(BridgeCaller::ShellUi, subject)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_destination(
    state: State<'_, AppState>,
    destination: ShellDestination,
) -> Result<(), String> {
    state
        .host
        .lock()
        .map_err(|_| "desktop host lock poisoned".to_owned())?
        .open_destination(BridgeCaller::ShellUi, destination)
        .map_err(|error| error.to_string())
}

fn load_contribution_fixtures() -> Result<Vec<HostedContribution>, String> {
    let fixtures: ContributionFixtures = serde_json::from_str(CONTRIBUTION_FIXTURES)
        .map_err(|error| format!("invalid desktop host-reading fixtures: {error}"))?;
    if fixtures.schema != "oi.desktop-host-reading-fixtures/v1" {
        return Err(format!(
            "unsupported desktop host-reading fixture schema `{}`",
            fixtures.schema
        ));
    }
    fixtures
        .contributions
        .into_iter()
        .map(|contribution| host_native_contribution(None, contribution))
        .collect()
}

fn load_local_factory() -> Result<Option<LocalFactoryHost>, String> {
    let state_path = env::var("OI_FACTORY_BUILD_STATE").ok();
    let project_ref = env::var("OI_FACTORY_PROJECT_REF").ok();
    let run_ref = env::var("OI_FACTORY_RUN_REF").ok();
    match (state_path, project_ref, run_ref) {
        (None, None, None) => Ok(None),
        (Some(state_path), Some(project_ref), Some(run_ref)) => LocalFactoryHost::open_refs(
            state_path,
            &project_ref,
            &run_ref,
        )
        .map(Some),
        _ => Err(
            "local Factory provider requires OI_FACTORY_BUILD_STATE, OI_FACTORY_PROJECT_REF and OI_FACTORY_RUN_REF together"
                .into(),
        ),
    }
}

fn replace_factory_contribution(
    state: &State<'_, AppState>,
    contribution: HostedContribution,
) -> Result<(), String> {
    let mut contributions = state
        .contributions
        .lock()
        .map_err(|_| "contribution catalog lock poisoned".to_owned())?;
    replace_factory_contribution_in(&mut contributions, contribution);
    Ok(())
}

fn replace_factory_contribution_in(
    contributions: &mut Vec<HostedContribution>,
    contribution: HostedContribution,
) {
    contributions.retain(|entry| {
        entry.contribution.contribution_ref != FACTORY_BUILD_CONTRIBUTION_REF
    });
    contributions.push(contribution);
}

fn main() {
    let disclosure = oi_cli::status::live_disclosure().unwrap_or_else(|error| {
        oi_cli::status::SuiteCompositionDisclosure::unavailable(error)
    });
    let mut contributions = load_contribution_fixtures().unwrap_or_else(|error| {
        eprintln!("O:I desktop host-reading fixtures unavailable: {error}");
        Vec::new()
    });
    let factory = load_local_factory()
        .map_err(|error| eprintln!("O:I local Factory provider unavailable: {error}"))
        .ok()
        .flatten();
    if let Some(factory) = factory.as_ref() {
        match factory.observe() {
            Ok(observation) => {
                replace_factory_contribution_in(&mut contributions, observation.contribution)
            }
            Err(error) => eprintln!("O:I Factory observation degraded: {error}"),
        }
    }

    tauri::Builder::default()
        .manage(AppState {
            host: Mutex::new(DesktopHost::new(disclosure)),
            contributions: Mutex::new(contributions),
            factory: Mutex::new(factory),
        })
        .invoke_handler(tauri::generate_handler![
            shell_snapshot,
            contribution_catalog,
            factory_build_snapshot,
            dispatch_factory_action,
            select_semantic_ref,
            open_destination
        ])
        .run(tauri::generate_context!())
        .expect("failed to run O:I desktop");
}
