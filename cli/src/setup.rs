//! Reviewed composition adoption, independent of product-owned settings.
//! Production adapters supply native observations, installers and readback.
//! This module cannot author Control, capture credentials or grant authority.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub const SCHEMA: &str = "oi.setup/v1";
pub const PLAN_SCHEMA: &str = "oi.adoption-plan/v1";
pub const JOURNAL_SCHEMA: &str = "oi.adoption-journal/v1";
pub const REVIEW_LIFETIME_MS: u64 = 15 * 60 * 1000;
pub const ENGAGEMENT_CONTRACT: &str = "oi.engagement/2026-09-18";

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DesktopChoice {
    #[default]
    Keep,
    Add,
    Remove,
}

/// Human surfaces use names and pickers. Only canonical identities cross the
/// wire; no arbitrary command, secret or authority grant is a selection field.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Selection {
    pub composition: String,
    #[serde(default)]
    pub ground: Option<String>,
    #[serde(default)]
    pub desktop: DesktopChoice,
    #[serde(default)]
    pub bundle: Option<String>,
    #[serde(default)]
    pub bundle_sha256: Option<String>,
    #[serde(default)]
    pub products: Vec<String>,
    #[serde(default)]
    pub remove_products: Vec<String>,
}
impl Default for Selection {
    fn default() -> Self {
        Self {
            composition: "0/1/2".into(),
            ground: None,
            desktop: DesktopChoice::Keep,
            bundle: None,
            bundle_sha256: None,
            products: Vec::new(),
            remove_products: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Choice {
    pub id: String,
    pub title: String,
    pub description: String,
    pub products: Vec<String>,
    pub hosted: bool,
}
pub fn choices() -> Vec<Choice> {
    use crate::current_world::PRODUCT_POSITIONS;
    crate::context_frames::INSTALL_MODES.iter().map(|mode| {
        let products = if mode.frame == "00/00" { vec![0, 1, 2] }
            else { mode.products.unwrap_or_default().to_vec() };
        Choice {
            id: mode.frame.into(), title: mode.name.into(),
            description: match mode.frame {
                "00/00" => "Integrated application; normal new backing is Central, Actuation and AIKit.",
                "0/1" => "Durable ground and agency; retain your existing harness and tools.",
                "0/1/2" => "Ground, agency, context, models, capabilities and sessions.",
                "0/1/2/3" => "Add durable development through Software Factory; Direct sessions stay Direct.",
                "4.5/0" => "Central and Workcell client/connectivity; work may run elsewhere.",
                "5/0" => "Read and explore the published Library in a browser. No local products or credentials.",
                _ => unreachable!("the native catalogue has six engagement forms"),
            }.into(),
            products: products.iter().filter_map(|p| PRODUCT_POSITIONS.iter().find(|(n,_,_)| p == n))
                .map(|(_,id,_)| (*id).into()).collect(),
            hosted: mode.frame == "5/0",
        }
    }).chain(std::iter::once(Choice { id: "custom".into(), title: "Choose individual products".into(),
        description: "Independent native products. Existing unselected products are retained unless removal is explicitly selected.".into(),
        products: Vec::new(), hosted: false })).collect()
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Product {
    pub id: String,
    pub title: String,
    pub purpose: String,
    pub registered: bool,
    pub present: bool,
    pub managed: bool,
    pub existing_executable: Option<String>,
    pub existing_digest: Option<String>,
    pub offer: Option<Value>,
    pub unavailable_reason: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Discovery {
    pub schema: String,
    pub basis: String,
    pub data_root: String,
    pub composition_path: String,
    pub target: String,
    pub bound_ground: Option<String>,
    pub suggested_ground: String,
    pub selected_ground: Option<String>,
    pub ground: Value,
    pub products: Vec<Product>,
    pub desktop: Value,
    pub choices: Vec<Choice>,
    pub warnings: Vec<String>,
    pub recognition: Value,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Operation {
    RegisterExisting {
        product: String,
        executable: String,
        sha256: String,
    },
    InstallProduct {
        product: String,
    },
    RemoveProduct {
        product: String,
    },
    EstablishGround {
        path: String,
    },
    BindGround {
        path: String,
    },
    InstallDesktop,
    RemoveDesktop,
    RecordComposition,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Step {
    pub operation: Operation,
    pub title: String,
    pub effects: Vec<String>,
    pub native_plan: Option<Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Plan {
    pub schema: String,
    pub engagement_contract: String,
    pub selection: Selection,
    pub discovery: Discovery,
    pub steps: Vec<Step>,
    pub blocked: Vec<String>,
    pub notices: Vec<String>,
    pub created_at_unix_ms: u64,
    pub expires_at_unix_ms: u64,
    pub review_token: String,
}
pub fn digest<T: Serialize>(value: &T) -> Result<String, String> {
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}
impl Plan {
    pub fn seal(&mut self) -> Result<(), String> {
        // Diagnostic timestamps are not authority. Exact effects are bound to
        // the adapter's independently re-read composition/source/owner basis.
        self.review_token = digest(&json!({
            "schema":self.schema,"contract":self.engagement_contract,
            "selection":self.selection,"basis":self.discovery.basis,
            "steps":self.steps,"blocked":self.blocked,"notices":self.notices,
            "created":self.created_at_unix_ms,"expires":self.expires_at_unix_ms
        }))?;
        Ok(())
    }
    pub fn check_review(&self, approval: &str, now: u64) -> Result<(), String> {
        if self.schema != PLAN_SCHEMA || self.engagement_contract != ENGAGEMENT_CONTRACT {
            return Err(
                "This plan uses an unsupported adoption contract. Make a fresh plan.".into(),
            );
        }
        if approval.is_empty() || approval != self.review_token {
            return Err("Explicit approval must name this exact reviewed plan.".into());
        }
        let mut original = self.clone();
        original.seal()?;
        if original.review_token != self.review_token {
            return Err("The reviewed plan was changed.".into());
        }
        if self.created_at_unix_ms > now
            || now >= self.expires_at_unix_ms
            || self.expires_at_unix_ms != self.created_at_unix_ms.saturating_add(REVIEW_LIFETIME_MS)
        {
            return Err(
                "The plan expired or has an invalid review window. Refresh and review again."
                    .into(),
            );
        }
        if !self.blocked.is_empty() {
            return Err("Resolve the plan's blocked items before applying.".into());
        }
        Ok(())
    }
}

/// Desktop supplies its own bundle/footprint plan and receipt-owned teardown.
pub fn plan(
    selection: Selection,
    discovery: Discovery,
    desktop_plan: Result<Option<Value>, String>,
    now: u64,
) -> Result<Plan, String> {
    let choice = discovery
        .choices
        .iter()
        .find(|c| c.id == selection.composition)
        .ok_or("Choose one of the discovered compositions.")?;
    let mut selected = if choice.id == "custom" {
        selection.products.clone()
    } else {
        choice.products.clone()
    };
    selected.sort();
    selected.dedup();
    let mut result = Plan { schema: PLAN_SCHEMA.into(), engagement_contract: ENGAGEMENT_CONTRACT.into(),
        selection: selection.clone(), discovery: discovery.clone(), steps: Vec::new(), blocked: Vec::new(),
        notices: vec![
            "Installation is not a grant of Agent authority. No credential, Control policy, harness hook or session is changed by this plan.".into(),
            "Existing unselected products, Central source, Projects and Agents are retained. Software presence does not prove a loaded capability.".into(),
            "Contributed capability settings are configured and verified separately through their native owners after installation.".into(),
        ], created_at_unix_ms: now, expires_at_unix_ms: now.saturating_add(REVIEW_LIFETIME_MS), review_token: String::new() };
    if choice.hosted {
        if selection.desktop != DesktopChoice::Keep
            || selection.bundle.is_some()
            || !selection.products.is_empty()
            || !selection.remove_products.is_empty()
        {
            result.blocked.push("Hosted reading has no local install or teardown. Choose a local composition for local changes.".into());
        }
        result.notices.push("Continue through the site's existing Library. Hosting is the publisher's responsibility, not the reader's setup.".into());
        result.seal()?;
        return Ok(result);
    }
    if choice.id != "custom" && !selection.products.is_empty() {
        result.blocked.push(
            "Individual product overrides require the explicit individual-products composition."
                .into(),
        );
    }
    if selected.is_empty()
        && selection.desktop != DesktopChoice::Remove
        && selection.remove_products.is_empty()
    {
        result
            .blocked
            .push("Choose at least one product or an explicit removal.".into());
    }
    let all: BTreeSet<&str> = discovery.products.iter().map(|p| p.id.as_str()).collect();
    for id in selected.iter().chain(selection.remove_products.iter()) {
        if !all.contains(id.as_str()) {
            result.blocked.push(format!(
                "Product {id:?} is not in the current native catalogue."
            ));
        }
    }
    if selection.desktop == DesktopChoice::Remove && choice.id == "00/00" {
        result
            .blocked
            .push("Choose the backing composition to keep when removing Desktop.".into());
    }
    for product in &discovery.products {
        if !selected.contains(&product.id) {
            continue;
        }
        if selection.remove_products.contains(&product.id) {
            result.blocked.push(format!(
                "{} cannot be selected and removed in the same plan.",
                product.title
            ));
            continue;
        }
        if product.present && product.registered {
            continue;
        }
        if let (Some(executable), Some(sha256)) =
            (&product.existing_executable, &product.existing_digest)
        {
            result.steps.push(Step {
                operation: Operation::RegisterExisting {
                    product: product.id.clone(),
                    executable: executable.clone(),
                    sha256: sha256.clone(),
                },
                title: format!("Retain existing {}", product.title),
                effects: vec![format!(
                    "Register {executable}; do not replace it or change its native configuration."
                )],
                native_plan: None,
            });
        } else if let Some(offer) = &product.offer {
            result.steps.push(Step { operation: Operation::InstallProduct { product: product.id.clone() }, title: format!("Install {}", product.title),
                effects: vec!["Use the reviewed native source/build/activation contract. Keep foreign installations and source untouched.".into()], native_plan: Some(offer.clone()) });
        } else {
            result.blocked.push(format!(
                "{}: {}",
                product.title,
                product
                    .unavailable_reason
                    .as_deref()
                    .unwrap_or("No usable native installation offer was disclosed.")
            ));
        }
    }
    let adds_desktop = selection.desktop == DesktopChoice::Add || choice.id == "00/00";
    let needs_ground = selected.iter().any(|id| id == "central") || adds_desktop;
    if selection.remove_products.iter().any(|id| id == "central")
        && (adds_desktop
            || (discovery.desktop["state"] == "installed"
                && selection.desktop != DesktopChoice::Remove))
    {
        result.blocked.push("Central backs Desktop. Retain Central or explicitly remove Desktop in this same reviewed plan.".into());
    }
    if adds_desktop
        && !selected.iter().any(|id| id == "central")
        && !discovery
            .products
            .iter()
            .any(|p| p.id == "central" && p.present)
    {
        result.blocked.push(
            "Desktop needs Central ground. Select Central or retain an existing installation."
                .into(),
        );
    }
    if needs_ground {
        let path = discovery.selected_ground.as_deref().unwrap_or_default();
        if path.is_empty() {
            result
                .blocked
                .push("Choose where Central will live, or select the existing ground.".into());
        } else {
            match discovery.ground["outcome"].as_str() {
            Some("recognized") if discovery.ground["access"]["readable"] == true && discovery.ground["access"]["searchable"] == true => {
                if discovery.bound_ground.as_deref() != Some(path) {
                    result.steps.push(Step { operation: Operation::BindGround { path: path.into() }, title: "Use the recognised Central ground".into(),
                        effects: vec![format!("Change the O:I default binding to {path} for the next launch; leave its source and current sessions untouched.")],
                        native_plan: Some(json!({"canonical_path":discovery.ground["canonical_path"],"identity":discovery.ground["identity"],"access":discovery.ground["access"],"outcome":discovery.ground["outcome"]})) });
                }
            }
            Some("new") => result.steps.push(Step { operation: Operation::EstablishGround { path: path.into() }, title: "Establish Central".into(),
                effects: vec![format!("Ask Central to initialise {path} and verify it with its native doctor. No work-placement grants or human-adopted policy will be fabricated.")], native_plan: None }),
            _ => result.blocked.push("Central did not recognise the selected directory as accessible ground. Select a recognised root or a new empty directory; existing content is not overwritten.".into()),
        }
        }
    }
    if adds_desktop && discovery.desktop["state"] != "installed" {
        match desktop_plan {
            Ok(Some(native_plan)) => result.steps.push(Step { operation: Operation::InstallDesktop, title: "Add Desktop to this World".into(),
                effects: vec!["Install the verified app bundle and exactly the native footprint shown below. Ground and backing products are not recreated.".into()], native_plan: Some(native_plan) }),
            Ok(None) => result.blocked.push("Choose a checksum-qualified Desktop bundle using the native file picker.".into()),
            Err(message) => result.blocked.push(message),
        }
    } else if selection.desktop == DesktopChoice::Remove {
        match desktop_plan {
            Ok(Some(native_plan)) => result.steps.push(Step { operation: Operation::RemoveDesktop, title: "Remove Desktop; keep the World".into(),
                effects: vec!["Remove only receipt-owned Desktop resources. Retain Central, native tools, Projects, Agents and source. The running app must be closed after this operation.".into()], native_plan: Some(native_plan) }),
            Ok(None) => result.notices.push("Desktop has no owned installation to remove; nothing will be deleted.".into()),
            Err(message) => result.blocked.push(message),
        }
    }
    for product in discovery
        .products
        .iter()
        .rev()
        .filter(|p| selection.remove_products.contains(&p.id))
    {
        if !product.managed {
            result.blocked.push(format!("{} is not a receipt-owned install; setup will not remove a pre-existing native installation.", product.title));
            continue;
        }
        result.steps.push(Step { operation: Operation::RemoveProduct { product: product.id.clone() }, title: format!("Remove managed {}", product.title),
            effects: vec!["Remove only the native receipt-owned footprint. Keep all human source and foreign installations.".into()], native_plan: None });
    }
    result.steps.push(Step { operation: Operation::RecordComposition, title: "Record the chosen composition".into(),
        effects: vec!["Record intent separately from the actual installed state. Existing sessions keep their current runtime basis.".into()], native_plan: None });
    result.seal()?;
    Ok(result)
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepState {
    Pending,
    Running,
    Applied,
    Verified,
    Refused,
    Unknown,
}
/// Independent observations never replace an operation's original receipt.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct StepReadback {
    pub observed_at_unix_ms: u64,
    pub reading: Option<Value>,
    pub error: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct StepRecord {
    pub state: StepState,
    pub receipt: Option<Value>,
    #[serde(default)]
    pub invocation_error: Option<String>,
    #[serde(default)]
    pub readbacks: Vec<StepReadback>,
    pub message: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Journal {
    pub schema: String,
    pub plan: Plan,
    pub records: Vec<StepRecord>,
    pub updated_at_unix_ms: u64,
    pub verification: Option<Value>,
}
impl Journal {
    pub fn new(plan: Plan, now: u64) -> Self {
        let records = plan
            .steps
            .iter()
            .map(|_| StepRecord {
                state: StepState::Pending,
                receipt: None,
                invocation_error: None,
                readbacks: Vec::new(),
                message: None,
            })
            .collect();
        Self {
            schema: JOURNAL_SCHEMA.into(),
            plan,
            records,
            updated_at_unix_ms: now,
            verification: None,
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != JOURNAL_SCHEMA || self.records.len() != self.plan.steps.len() {
            return Err("The native adoption journal is incomplete or unsupported.".into());
        }
        let mut checked = self.plan.clone();
        checked.seal()?;
        if checked.review_token != self.plan.review_token {
            return Err("The native adoption journal's review basis changed.".into());
        }
        Ok(())
    }
    pub fn uncertain(&self) -> bool {
        self.records
            .iter()
            .any(|r| matches!(r.state, StepState::Running | StepState::Unknown))
    }
    pub fn complete(&self) -> bool {
        self.records.iter().all(|r| r.state == StepState::Verified)
    }
    pub fn disposition(&self) -> &'static str {
        if self.uncertain() {
            "outcome_unknown"
        } else if self.complete() {
            "verified"
        } else if self
            .records
            .iter()
            .any(|r| matches!(r.state, StepState::Applied | StepState::Verified))
        {
            "partially_applied"
        } else {
            "not_applied"
        }
    }
}

/// No retry transition exists. An interrupted process or lost write reply is
/// resolved only by independent owner readback, never by invoking it again.
pub trait Runtime {
    fn refresh_plan(&mut self, reviewed: &Plan) -> Result<Plan, String>;
    fn preflight(&mut self, _step: &Step, _plan: &Plan) -> Result<(), String> {
        Ok(())
    }
    fn invoke(&mut self, step: &Step, plan: &Plan) -> Result<Value, String>;
    fn verify(
        &mut self,
        step: &Step,
        plan: &Plan,
        receipt: Option<&Value>,
    ) -> Result<Value, String>;
}
pub trait JournalStore {
    fn save(&mut self, journal: &Journal) -> Result<(), String>;
}

pub fn apply<R: Runtime, S: JournalStore>(
    runtime: &mut R,
    store: &mut S,
    plan: Plan,
    approval: &str,
    now: u64,
) -> Result<Journal, String> {
    plan.check_review(approval, now)?;
    let fresh = runtime.refresh_plan(&plan)?;
    if fresh.review_token != plan.review_token {
        return Err("The World, native effects or source changed after review. No operation started; refresh and review a new plan.".into());
    }
    // Never invoke metadata supplied by a client instead of fresh native data.
    let mut journal = Journal::new(fresh, now);
    store.save(&journal)?;
    for index in 0..journal.records.len() {
        if let Err(message) = runtime.preflight(&journal.plan.steps[index], &journal.plan) {
            journal.records[index].state = StepState::Refused;
            journal.records[index].message = Some(message);
            store.save(&journal)?;
            break;
        }
        journal.records[index].state = StepState::Running;
        // A failed durability operation cannot release an unanchored write.
        store.save(&journal)?;
        let step = &journal.plan.steps[index];
        match runtime.invoke(step, &journal.plan) {
            Ok(receipt) => {
                journal.records[index].state = StepState::Applied;
                journal.records[index].receipt = Some(receipt);
                store.save(&journal)?;
                match runtime.verify(step, &journal.plan, journal.records[index].receipt.as_ref()) {
                    Ok(reading) => {
                        journal.records[index].state = StepState::Verified;
                        journal.records[index].readbacks.push(StepReadback {
                            observed_at_unix_ms: now,
                            reading: Some(reading),
                            error: None,
                        });
                    }
                    Err(error) => {
                        journal.records[index].readbacks.push(StepReadback {
                            observed_at_unix_ms: now,
                            reading: None,
                            error: Some(error.clone()),
                        });
                        journal.records[index].message = Some(format!("The operation returned, but independent native readback did not verify: {error}. Recheck; do not replay the write."));
                    }
                }
                store.save(&journal)?;
                if journal.records[index].state != StepState::Verified {
                    break;
                }
            }
            Err(error) => {
                journal.records[index].state = StepState::Unknown;
                journal.records[index].invocation_error = Some(error.clone());
                journal.records[index].message = Some(format!("Native operation: {error}. Earlier effects are retained. Inspect and recheck the owner's state; this write will not be retried."));
                store.save(&journal)?;
                break;
            }
        }
    }
    Ok(journal)
}
pub fn recheck<R: Runtime, S: JournalStore>(
    runtime: &mut R,
    store: &mut S,
    mut journal: Journal,
    now: u64,
) -> Result<Journal, String> {
    journal.validate()?;
    for index in 0..journal.records.len() {
        if journal.records[index].state == StepState::Pending
            || journal.records[index].state == StepState::Refused
        {
            continue;
        }
        match runtime.verify(
            &journal.plan.steps[index],
            &journal.plan,
            journal.records[index].receipt.as_ref(),
        ) {
            Ok(reading) => {
                journal.records[index].state = StepState::Verified;
                journal.records[index].message = None;
                journal.records[index].readbacks.push(StepReadback {
                    observed_at_unix_ms: now,
                    reading: Some(reading),
                    error: None,
                });
            }
            Err(error) => {
                journal.records[index].readbacks.push(StepReadback {
                    observed_at_unix_ms: now,
                    reading: None,
                    error: Some(error),
                });
                journal.records[index].state = match journal.records[index].state {
                    StepState::Running | StepState::Unknown => StepState::Unknown,
                    _ => StepState::Applied,
                };
                journal.records[index].message = Some("Native readback still does not establish the expected effect. No write was retried.".into());
            }
        }
    }
    journal.updated_at_unix_ms = now;
    store.save(&journal)?;
    Ok(journal)
}
