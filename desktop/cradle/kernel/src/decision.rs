//! Bounded, host-authorised model decisions. Request JSON is never a grant.
//! The native host alone may issue an episode after its own confirmation;
//! each provider attempt reserves spend and checks that live episode first.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const MAX_STATE_BYTES: usize = 64 * 1024;
const MAX_WIRE_BYTES: usize = 1024 * 1024;
const MAX_RECORDS: usize = 128;
pub const RECEIPT_SCHEMA: &str = "oi.decision-receipt/v1";

fn now() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|n| n.as_secs())
        .map_err(|_| "The system clock is before the Unix epoch".into())
}
fn opaque(kind: &str) -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| format!("Cannot create a decision reference: {e}"))?;
    Ok(format!(
        "{kind}:{}",
        bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
    ))
}
fn digest(value: &impl Serialize) -> Result<String, String> {
    Ok(format!(
        "sha256:{:x}",
        Sha256::digest(serde_json::to_vec(value).map_err(|e| e.to_string())?)
    ))
}
fn text(value: &str, name: &str, max: usize) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > max || value.chars().any(char::is_control) {
        Err(format!(
            "{name} is empty, too long or contains control characters"
        ))
    } else {
        Ok(())
    }
}
fn entry(value: &Value) -> bool {
    matches!(
        value,
        Value::String(_) | Value::Object(_) | Value::Array(_) | Value::Null
    )
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
pub enum Question {
    Noul {
        #[serde(default)]
        instructions: Value,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        criteria: Option<BTreeMap<String, Value>>,
    },
    Choice {
        #[serde(default)]
        instructions: Value,
        criteria: BTreeMap<String, Value>,
    },
    Score {
        #[serde(default)]
        instructions: Value,
        criteria: Vec<Value>,
    },
}
impl Question {
    fn validate(&self) -> Result<(), String> {
        let instructions = match self {
            Self::Noul {
                instructions,
                criteria,
            } => {
                if criteria.as_ref().is_some_and(|c| {
                    c.iter()
                        .any(|(k, v)| !matches!(k.as_str(), "true" | "false") || !entry(v))
                }) {
                    return Err("Invalid Noul criteria".into());
                }
                instructions
            }
            Self::Choice {
                instructions,
                criteria,
            } => {
                if !(1..=255).contains(&criteria.len())
                    || criteria
                        .iter()
                        .any(|(k, v)| text(k, "Choice name", 256).is_err() || !entry(v))
                {
                    return Err("Invalid Choice criteria".into());
                }
                instructions
            }
            Self::Score {
                instructions,
                criteria,
            } => {
                if !(2..=10).contains(&criteria.len()) || !criteria.iter().all(entry) {
                    return Err("Invalid Score rubric".into());
                }
                instructions
            }
        };
        if !entry(instructions) {
            return Err("Question instructions must be structured text".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Tariff {
    pub model_version: String,
    pub source: String,
    pub max_input_tokens_per_attempt: u64,
    pub max_output_tokens_per_attempt: u64,
    pub input_microusd_per_million_tokens: u64,
    pub output_microusd_per_million_tokens: u64,
}
impl Tariff {
    fn cost(&self, input: u64, output: u64) -> Result<u64, String> {
        let total = (input as u128)
            .checked_mul(self.input_microusd_per_million_tokens as u128)
            .and_then(|i| {
                (output as u128)
                    .checked_mul(self.output_microusd_per_million_tokens as u128)
                    .and_then(|o| i.checked_add(o))
            })
            .ok_or("Decision tariff overflow")?;
        total
            .div_ceil(1_000_000)
            .try_into()
            .map_err(|_| "Decision tariff overflow".into())
    }
    fn reservation(&self) -> Result<u64, String> {
        self.cost(
            self.max_input_tokens_per_attempt,
            self.max_output_tokens_per_attempt,
        )
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Limits {
    pub timeout_ms: u64,
    pub max_attempts: u32,
    pub max_total_reserved_microusd: u64,
    pub tariff: Tariff,
}
impl Limits {
    fn validate(&self) -> Result<(), String> {
        text(
            &self.tariff.model_version,
            "Concrete Jev model version",
            256,
        )?;
        text(&self.tariff.source, "Tariff source", 4096)?;
        if !self.tariff.model_version.starts_with("jev-")
            || matches!(
                self.tariff.model_version.as_str(),
                "jev-latest" | "jev-preview"
            )
        {
            return Err(
                "A concrete Jev model version is required; a moving alias is not a tariff basis"
                    .into(),
            );
        }
        if !(1..=180_000).contains(&self.timeout_ms)
            || !(1..=8).contains(&self.max_attempts)
            || self.max_total_reserved_microusd == 0
            || self.tariff.max_input_tokens_per_attempt == 0
            || self.tariff.max_output_tokens_per_attempt == 0
            || self.tariff.input_microusd_per_million_tokens == 0
            || self.reservation()? > self.max_total_reserved_microusd
        {
            return Err("Decision time, attempts, token bounds and reserved spend must be finite and positive".into());
        }
        Ok(())
    }
    fn reservation(&self) -> Result<u64, String> {
        self.tariff.reservation()
    }
}

/// State is resolved by the kernel from these bindings, never supplied as JSON.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Proposal {
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub observer_id: Option<String>,
    pub sites: Vec<String>,
    /// Agent-plane questions use the same typed batch; their state remains the
    /// declared UI observation. Native confirmation binds these exact questions.
    #[serde(default)]
    pub agent_questions: BTreeMap<String, Question>,
    pub credential_ref: String,
    pub limits: Limits,
    pub episode_budget_microusd: u64,
    pub episode_seconds: u64,
}
impl Proposal {
    fn validate(&self) -> Result<(), String> {
        self.limits.validate()?;
        text(&self.credential_ref, "Native credential reference", 4096)?;
        if !["keychain://", "op://", "pass://", "varlock://"]
            .iter()
            .any(|s| self.credential_ref.starts_with(s))
        {
            return Err("Use a native stored-secret reference; environment imports, files and secret material are not accepted".into());
        }
        if self.episode_budget_microusd < self.limits.max_total_reserved_microusd
            || self.episode_budget_microusd > 1_000_000_000
            || !(1..=3600).contains(&self.episode_seconds)
            || self.episode_seconds.saturating_mul(1000) <= self.limits.timeout_ms
        {
            return Err("The episode needs an explicit spend cap and an expiry within one hour, longer than one call".into());
        }
        if self.sites.is_empty()
            || self.sites.len() > 16
            || self.sites.iter().collect::<BTreeSet<_>>().len() != self.sites.len()
        {
            return Err("Choose distinct declared decision sites".into());
        }
        if !self.agent_questions.is_empty() && !self.sites.iter().any(|s| s == "agent.ui") {
            return Err("Custom questions belong only to the declared agent UI site".into());
        }
        if serde_json::to_vec(&self.agent_questions)
            .map_err(|e| e.to_string())?
            .len()
            > 16 * 1024
        {
            return Err("Agent questions exceed the 16 KiB native review bound".into());
        }
        for (id, question) in &self.agent_questions {
            text(id, "Question name", 256)?;
            question.validate()?;
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Site {
    pub name: String,
    pub label: String,
    pub plane: String,
    pub input: String,
    pub questions: BTreeMap<String, Question>,
    pub max_reserved_microusd: u64,
    pub gate_behavior: String,
}
pub fn sites() -> Result<Vec<Site>, String> {
    serde_json::from_str(include_str!("decision_sites.json"))
        .map_err(|e| format!("Decision site catalogue: {e}"))
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Basis {
    pub scope_ref: String,
    pub source_refs: Vec<String>,
    pub inputs: BTreeMap<String, Value>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Preflight {
    pub schema: String,
    pub preflight_ref: String,
    pub basis_digest: String,
    pub proposal: Proposal,
    pub basis: Basis,
    pub questions: BTreeMap<String, Question>,
    pub expires_at_unix_seconds: u64,
}
#[derive(Clone, Debug, Serialize)]
pub struct AuthorisationPreview {
    pub preflight_ref: String,
    pub message: String,
    pub expires_at_unix_seconds: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct EpisodeSummary {
    pub episode_ref: String,
    pub authority_ref: String,
    pub scope_ref: String,
    pub source_refs: Vec<String>,
    pub sites: Vec<String>,
    pub credential_ref: String,
    pub limits: Limits,
    pub budget_microusd: u64,
    pub spent_microusd: u64,
    pub reserved_microusd: u64,
    pub expires_at_unix_seconds: u64,
    pub revoked: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Receipt {
    pub schema: String,
    pub decision_ref: String,
    pub authority_ref: String,
    pub episode_ref: String,
    pub scope_ref: String,
    pub sites: Vec<String>,
    pub basis_digest: String,
    pub questions: BTreeMap<String, Question>,
    pub outcome: String,
    pub model_version: Option<String>,
    pub answers: Option<Value>,
    pub usage: Option<Value>,
    pub cost_microusd: u64,
    pub unknown_reserved_microusd: u64,
    pub provider_receipts: Vec<Value>,
    pub reason: Option<String>,
    pub cached_from: Option<String>,
}
#[derive(Clone, Debug)]
struct Grant {
    summary: EpisodeSummary,
    proposal: Proposal,
    questions: BTreeMap<String, Question>,
}
#[derive(Debug, Default)]
struct State {
    preflights: BTreeMap<String, Preflight>,
    grants: BTreeMap<String, Grant>,
    receipts: BTreeMap<String, Receipt>,
    cache: BTreeMap<String, Receipt>,
    inflight: BTreeSet<String>,
    authorised_preflights: BTreeSet<String>,
}
#[derive(Clone, Debug, Default)]
pub struct Store {
    inner: Arc<Mutex<State>>,
}

impl Store {
    pub fn preflight(&self, proposal: Proposal, basis: Basis) -> Result<Preflight, String> {
        proposal.validate()?;
        if serde_json::to_vec(&basis).map_err(|e| e.to_string())?.len() > MAX_STATE_BYTES {
            return Err("Decision basis exceeds its disclosed 64 KiB bound".into());
        }
        let catalogue = sites()?;
        let mut questions = BTreeMap::new();
        for name in &proposal.sites {
            let site = catalogue
                .iter()
                .find(|site| &site.name == name)
                .ok_or("Unknown decision site")?;
            if proposal.limits.max_total_reserved_microusd > site.max_reserved_microusd {
                return Err(format!("{} exceeds its declared site budget", site.label));
            }
            let source = if name == "agent.ui" {
                &proposal.agent_questions
            } else {
                &site.questions
            };
            for (id, question) in source {
                question.validate()?;
                questions.insert(format!("{name}/{id}"), question.clone());
            }
        }
        if !(1..=256).contains(&questions.len()) {
            return Err("Provide 1–256 named questions across the selected sites".into());
        }
        let basis_digest =
            digest(&json!({"basis":basis,"questions":questions,"tariff":proposal.limits.tariff}))?;
        let preflight = Preflight {
            schema: "oi.decision-preflight/v1".into(),
            preflight_ref: opaque("decision-preflight")?,
            basis_digest,
            proposal,
            basis,
            questions,
            expires_at_unix_seconds: now()?.saturating_add(300),
        };
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        state
            .preflights
            .retain(|_, p| p.expires_at_unix_seconds > now().unwrap_or(u64::MAX));
        if state.preflights.len() >= MAX_RECORDS {
            return Err(
                "Too many live decision preflights; wait for old previews to expire".into(),
            );
        }
        state
            .preflights
            .insert(preflight.preflight_ref.clone(), preflight.clone());
        Ok(preflight)
    }
    pub fn get_preflight(&self, id: &str) -> Result<Preflight, String> {
        let state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        let p = state
            .preflights
            .get(id)
            .ok_or("Unknown or forged decision preflight")?;
        if p.expires_at_unix_seconds <= now()? {
            return Err("Decision preflight expired; read the current basis again".into());
        }
        Ok(p.clone())
    }
    fn current(&self, id: &str, basis: &Basis) -> Result<Preflight, String> {
        let p = self.get_preflight(id)?;
        if &p.basis != basis {
            return Err(
                "The decision basis changed; read a new preflight before proceeding".into(),
            );
        }
        Ok(p)
    }
    pub fn preview(&self, id: &str, basis: &Basis) -> Result<AuthorisationPreview, String> {
        let p = self.current(id, basis)?;
        let names = sites()?
            .into_iter()
            .filter(|s| p.proposal.sites.contains(&s.name))
            .map(|s| s.label)
            .collect::<Vec<_>>()
            .join(", ");
        let message=format!("Allow one bounded decision episode?\n\nScope: {}\nQuestions: {} ({})\nDisclosed inputs: {}\nProvider: TypeSafe\nModel: {}\nCredential reference: {}\nTariff source: {}\nInput / output tariff: {} / {} micro-US dollars per million tokens\nMaximum total spend: {} micro-US dollars (${:.6})\nExpires {} seconds after confirmation\n\nOnly the disclosed native counts/statuses and advisory arrangement summary are sent. No document bodies, drafts, commands or URLs. Answers are advisory; no review, inclusion, recovery or other action will be applied. This permission ends at expiry, revocation or app restart.",p.basis.scope_ref,p.questions.len(),names,p.basis.inputs.keys().cloned().collect::<Vec<_>>().join(", "),p.proposal.limits.tariff.model_version,p.proposal.credential_ref,p.proposal.limits.tariff.source,p.proposal.limits.tariff.input_microusd_per_million_tokens,p.proposal.limits.tariff.output_microusd_per_million_tokens,p.proposal.episode_budget_microusd,p.proposal.episode_budget_microusd as f64/1_000_000.0,p.proposal.episode_seconds);
        let message = if p.proposal.agent_questions.is_empty() {
            message
        } else {
            format!(
                "{message}\n\nExact agent questions approved for this episode:\n{}",
                serde_json::to_string_pretty(&p.proposal.agent_questions)
                    .map_err(|e| e.to_string())?
            )
        };
        Ok(AuthorisationPreview {
            preflight_ref: id.into(),
            message,
            expires_at_unix_seconds: p.expires_at_unix_seconds,
        })
    }
    /// Host-only issuance. This method is deliberately absent from KernelOp.
    pub fn authorise(&self, id: &str, basis: &Basis) -> Result<EpisodeSummary, String> {
        let p = self.current(id, basis)?;
        let summary = EpisodeSummary {
            episode_ref: opaque("decision-episode")?,
            authority_ref: opaque("decision-authority")?,
            scope_ref: p.basis.scope_ref,
            source_refs: p.basis.source_refs,
            sites: p.proposal.sites.clone(),
            credential_ref: p.proposal.credential_ref.clone(),
            limits: p.proposal.limits.clone(),
            budget_microusd: p.proposal.episode_budget_microusd,
            spent_microusd: 0,
            reserved_microusd: 0,
            expires_at_unix_seconds: now()?.saturating_add(p.proposal.episode_seconds),
            revoked: false,
        };
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        // Expired records retain unknown reservations and remain inspectable.
        if state.grants.len() >= MAX_RECORDS {
            return Err("Too many live decision episodes".into());
        }
        // The confirmed preview cannot be used to mint another episode.
        if !state.authorised_preflights.insert(id.into()) {
            return Err("This preview has already issued an episode; prepare a new preview before another confirmation".into());
        }
        state.grants.insert(
            summary.authority_ref.clone(),
            Grant {
                summary: summary.clone(),
                proposal: p.proposal,
                questions: p.questions,
            },
        );
        Ok(summary)
    }
    pub fn revoke(&self, authority: &str) -> Result<(EpisodeSummary, bool), String> {
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        let grant = state
            .grants
            .get_mut(authority)
            .ok_or("Unknown decision episode")?;
        let changed = !grant.summary.revoked;
        grant.summary.revoked = true;
        Ok((grant.summary.clone(), changed))
    }
    pub fn reading(&self) -> Result<Value, String> {
        let state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        Ok(
            json!({"schema":"oi.decision-reading/v1","sites":sites()?,"episodes":state.grants.values().map(|g|&g.summary).collect::<Vec<_>>(),"receipts":state.receipts.values().collect::<Vec<_>>(),"standing":"host-issued per-episode authority; no standing permission","agent_actions":[{"action":"action:decision.preflight","target":"renderer observation identifier from presentation_read","input":"DecisionProposal for agent.ui; native state only; no provider call"},{"action":"action:decision.decide","target":"decision preflight reference","input":"authority_ref from an already confirmed live native episode"}]}),
        )
    }
    pub fn prepare(
        &self,
        id: &str,
        authority: &str,
        basis: &Basis,
        cwd: PathBuf,
    ) -> Result<PreparedDecision, String> {
        let p = self.current(id, basis)?;
        let mut state = self
            .inner
            .lock()
            .map_err(|_| "Decision state lock failed")?;
        let grant = state
            .grants
            .get(authority)
            .ok_or("No host-issued decision authority exists for this reference")?;
        check_grant(grant, &p, 0)?;
        let cache_key = digest(&json!({"authority":authority,"basis":p.basis_digest}))?;
        let cached = state.cache.get(&cache_key).cloned();
        if !state.inflight.insert(cache_key.clone()) {
            return Err("This exact decision basis is already being considered".into());
        }
        Ok(PreparedDecision {
            store: self.clone(),
            preflight: p,
            authority: authority.into(),
            cwd,
            cache_key,
            cached,
        })
    }
}
fn check_grant(grant: &Grant, p: &Preflight, reserve: u64) -> Result<(), String> {
    let g = &grant.summary;
    if g.revoked {
        return Err("Decision episode was revoked".into());
    }
    if g.expires_at_unix_seconds <= now()? {
        return Err("Decision episode expired".into());
    }
    if g.scope_ref != p.basis.scope_ref
        || grant.proposal.project != p.proposal.project
        || grant.proposal.observer_id != p.proposal.observer_id
        || g.credential_ref != p.proposal.credential_ref
        || g.limits != p.proposal.limits
        || p.proposal.sites.iter().any(|s| !g.sites.contains(s))
        || p.questions
            .iter()
            .any(|(name, q)| grant.questions.get(name) != Some(q))
    {
        return Err(
            "Decision exceeds its approved scope, sites, questions, credential or tariff".into(),
        );
    }
    let committed = g
        .spent_microusd
        .checked_add(g.reserved_microusd)
        .and_then(|n| n.checked_add(reserve))
        .ok_or("Decision budget overflow")?;
    if committed > g.budget_microusd {
        return Err("Decision episode budget is exhausted".into());
    }
    Ok(())
}

/// Executes outside the global kernel mutex. Authority and reservations stay
/// synchronized independently; the host commits the returned receipt afterwards.
pub struct PreparedDecision {
    store: Store,
    preflight: Preflight,
    authority: String,
    cwd: PathBuf,
    cache_key: String,
    cached: Option<Receipt>,
}
impl PreparedDecision {
    pub fn execute(self) -> Result<Receipt, String> {
        let result = self.run();
        if let Ok(mut state) = self.store.inner.lock() {
            state.inflight.remove(&self.cache_key);
            if let Ok(receipt) = &result {
                if state.receipts.len() >= MAX_RECORDS {
                    if let Some(key) = state.receipts.keys().next().cloned() {
                        state.receipts.remove(&key);
                    }
                }
                state
                    .receipts
                    .insert(receipt.decision_ref.clone(), receipt.clone());
                if receipt.outcome == "completed" {
                    if state.cache.len() >= MAX_RECORDS {
                        state.cache.clear();
                    }
                    state.cache.insert(self.cache_key.clone(), receipt.clone());
                }
            }
        }
        result
    }
    fn run(&self) -> Result<Receipt, String> {
        let p = &self.preflight;
        let grant = {
            let state = self
                .store
                .inner
                .lock()
                .map_err(|_| "Decision state lock failed")?;
            let grant = state
                .grants
                .get(&self.authority)
                .ok_or("Decision episode no longer exists")?;
            check_grant(grant, p, 0)?;
            grant.summary.clone()
        };
        let mut receipt = Receipt {
            schema: RECEIPT_SCHEMA.into(),
            decision_ref: opaque("decision")?,
            authority_ref: self.authority.clone(),
            episode_ref: grant.episode_ref,
            scope_ref: p.basis.scope_ref.clone(),
            sites: p.proposal.sites.clone(),
            basis_digest: p.basis_digest.clone(),
            questions: p.questions.clone(),
            outcome: "failed".into(),
            model_version: None,
            answers: None,
            usage: None,
            cost_microusd: 0,
            unknown_reserved_microusd: 0,
            provider_receipts: vec![],
            reason: None,
            cached_from: None,
        };
        if let Some(cached) = &self.cached {
            receipt.outcome = "cached".into();
            receipt.model_version = cached.model_version.clone();
            receipt.answers = cached.answers.clone();
            receipt.usage = None;
            receipt.cached_from = Some(cached.decision_ref.clone());
            return Ok(receipt);
        }
        let started = Instant::now();
        let reserve = p.proposal.limits.reservation()?;
        let mut total_reserved = 0u64;
        let mut total_input = 0u64;
        let mut total_output = 0u64;
        for ordinal in 1..=p.proposal.limits.max_attempts {
            let remaining = p
                .proposal
                .limits
                .timeout_ms
                .saturating_sub(started.elapsed().as_millis() as u64);
            if remaining == 0 {
                receipt.reason = Some("Decision deadline reached".into());
                break;
            }
            if total_reserved
                .checked_add(reserve)
                .is_none_or(|n| n > p.proposal.limits.max_total_reserved_microusd)
            {
                receipt.reason = Some("Decision invocation reservation exhausted".into());
                break;
            }
            let mut limits = p.proposal.limits.clone();
            limits.max_attempts = 1;
            limits.timeout_ms = remaining;
            limits.max_total_reserved_microusd = reserve;
            let request = json!({"model":limits.tariff.model_version,"state":{"scope_ref":p.basis.scope_ref,"inputs":p.basis.inputs},"questions":p.questions});
            let files = InvocationFiles::new(&request, &limits)?;
            {
                let mut state = self
                    .store
                    .inner
                    .lock()
                    .map_err(|_| "Decision state lock failed")?;
                let grant = state
                    .grants
                    .get_mut(&self.authority)
                    .ok_or("Decision episode no longer exists")?;
                if let Err(reason) = check_grant(grant, p, reserve) {
                    receipt.reason = Some(reason);
                    break;
                }
                if now()?.saturating_add(remaining.div_ceil(1000))
                    >= grant.summary.expires_at_unix_seconds
                {
                    receipt.reason =
                        Some("The attempt cannot finish within the approved episode expiry".into());
                    break;
                }
                grant.summary.reserved_microusd += reserve;
            }
            total_reserved += reserve;
            let invocation = files.invoke(&self.cwd, &p.proposal.credential_ref, remaining);
            let mut known_cost = None;
            let mut retry = false;
            match invocation {
                Ok(value) => {
                    if value["schema"] != "aikit.jev-invocation/v1"
                        || value["requested_model"] != p.proposal.limits.tariff.model_version
                    {
                        receipt.reason =
                            Some("AIKit returned an unrecognised decision invocation".into());
                    } else {
                        if let Some(attempt) = value["attempts"].as_array().and_then(|a| a.first())
                        {
                            if let (Some(input), Some(output), Some(model)) = (
                                attempt["usage"]["input_tokens"].as_u64(),
                                attempt["usage"]["output_tokens"].as_u64(),
                                attempt["model_version"].as_str(),
                            ) {
                                if model == limits.tariff.model_version
                                    && input <= limits.tariff.max_input_tokens_per_attempt
                                    && output <= limits.tariff.max_output_tokens_per_attempt
                                {
                                    known_cost = Some(limits.tariff.cost(input, output)?);
                                    total_input += input;
                                    total_output += output;
                                }
                            }
                            retry = matches!(attempt["http_status"].as_u64(), Some(429 | 529))
                                && ordinal < p.proposal.limits.max_attempts;
                        }
                        if value["outcome"] == "completed"
                            && known_cost.is_some()
                            && value["answer"]["model"] == limits.tariff.model_version
                            && complete_answers(&value["answer"]["answers"], &p.questions)
                        {
                            receipt.outcome = "completed".into();
                            receipt.model_version =
                                value["answer"]["model"].as_str().map(str::to_owned);
                            receipt.answers = Some(value["answer"]["answers"].clone());
                        } else {
                            receipt.reason=Some(value["failure"]["message"].as_str().unwrap_or("The decision provider did not return a complete bounded answer").to_owned());
                        }
                        receipt.provider_receipts.push(value);
                    }
                }
                Err(reason) => receipt.reason = Some(reason),
            }
            {
                let mut state = self
                    .store
                    .inner
                    .lock()
                    .map_err(|_| "Decision state lock failed")?;
                let grant = state
                    .grants
                    .get_mut(&self.authority)
                    .ok_or("Decision episode no longer exists")?;
                if let Some(cost) = known_cost {
                    grant.summary.reserved_microusd -= reserve;
                    grant.summary.spent_microusd += cost;
                    receipt.cost_microusd += cost;
                } else {
                    receipt.unknown_reserved_microusd += reserve;
                }
                if let Err(reason) = check_grant(grant, p, 0) {
                    receipt.outcome = "refused".into();
                    receipt.answers = None;
                    receipt.reason = Some(reason);
                    break;
                }
            }
            if receipt.outcome == "completed" || !retry {
                break;
            }
            // The owner exposes no Retry-After in its invocation receipt. Only
            // explicit overload answers retry, with a bounded delay, and the
            // next loop rechecks expiry, deadline and budget before egress.
            std::thread::sleep(Duration::from_millis(
                200.min(
                    p.proposal
                        .limits
                        .timeout_ms
                        .saturating_sub(started.elapsed().as_millis() as u64),
                ),
            ));
        }
        if total_input > 0 || total_output > 0 {
            receipt.usage = Some(json!({"input_tokens":total_input,"output_tokens":total_output}));
        }
        Ok(receipt)
    }
}
fn complete_answers(value: &Value, questions: &BTreeMap<String, Question>) -> bool {
    let Some(answers) = value.as_object() else {
        return false;
    };
    if answers.len() != questions.len() {
        return false;
    }
    questions
        .iter()
        .all(|(name, q)| match (q, answers.get(name)) {
            (Question::Noul { .. }, Some(a)) => {
                a["type"] == "noul"
                    && a["noul"]
                        .as_f64()
                        .is_some_and(|n| n.is_finite() && (0.0..=1.0).contains(&n))
            }
            (Question::Choice { criteria, .. }, Some(a)) => {
                a["type"] == "choice"
                    && a["choice"]
                        .as_str()
                        .is_some_and(|v| criteria.contains_key(v))
            }
            (Question::Score { .. }, Some(a)) => {
                a["type"] == "score" && a["score"].as_f64().is_some_and(f64::is_finite)
            }
            _ => false,
        })
}

/// Owner CLI inputs and output are private, bounded, short-lived files. Secret
/// material never enters this process: AIKit resolves the approved reference.
struct InvocationFiles {
    dir: PathBuf,
}
impl InvocationFiles {
    fn new(request: &Value, limits: &Limits) -> Result<Self, String> {
        use std::io::Write;
        use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
        let dir = std::env::temp_dir().join(opaque("oi-decision")?.replace(':', "-"));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&dir)
            .map_err(|e| e.to_string())?;
        let files = Self { dir };
        for (name, value) in [
            ("request.json", request.clone()),
            (
                "limits.json",
                serde_json::to_value(limits).map_err(|e| e.to_string())?,
            ),
        ] {
            let bytes = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
            if bytes.len() > MAX_WIRE_BYTES {
                return Err("Decision input exceeds its 1 MiB bound".into());
            }
            std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(files.dir.join(name))
                .and_then(|mut f| f.write_all(&bytes))
                .map_err(|e| e.to_string())?;
        }
        Ok(files)
    }
    fn invoke(&self, cwd: &Path, credential: &str, timeout: u64) -> Result<Value, String> {
        use std::os::unix::{fs::OpenOptionsExt, process::CommandExt};
        use std::process::{Command, Stdio};
        let output = |name| {
            std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(self.dir.join(name))
                .map_err(|e| e.to_string())
        };
        let executable = std::env::var_os("OI_BIN").unwrap_or_else(|| "oi".into());
        let mut child = Command::new(executable)
            .args(["aikit", "--json", "-C"])
            .arg(cwd)
            .args(["jev", "invoke", "--request-file"])
            .arg(self.dir.join("request.json"))
            .arg("--limits-file")
            .arg(self.dir.join("limits.json"))
            .args(["--credential-ref", credential])
            .stdin(Stdio::null())
            .stdout(output("stdout")?)
            .stderr(output("stderr")?)
            .process_group(0)
            .spawn()
            .map_err(|e| format!("Cannot start the native decision owner: {e}"))?;
        let started = Instant::now();
        let status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Err(e) => break Err(e.to_string()),
                Ok(None) => {}
            }
            if started.elapsed() >= Duration::from_millis(timeout) {
                break Err("Native decision timed out; its reservation remains held because provider effects are unknown".into());
            }
            if ["stdout", "stderr"].iter().any(|name| {
                std::fs::metadata(self.dir.join(name))
                    .is_ok_and(|m| m.len() > MAX_WIRE_BYTES as u64)
            }) {
                break Err(
                    "Native decision output exceeded its bound; provider effects are unknown"
                        .into(),
                );
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        if status.is_err() {
            let _ = Command::new("/bin/kill")
                .args(["-KILL", "--", &format!("-{}", child.id())])
                .status();
            let _ = child.kill();
            let _ = child.wait();
        }
        let status = status?;
        let bytes = std::fs::read(self.dir.join("stdout")).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_WIRE_BYTES {
            return Err("Native decision output exceeded its bound".into());
        }
        let envelope: Value = serde_json::from_slice(&bytes)
            .map_err(|e| format!("Native decision returned unreadable JSON: {e}"))?;
        if !status.success() || envelope["ok"] != true {
            return Err(envelope["error"]["message"]
                .as_str()
                .unwrap_or("Native decision owner refused the request")
                .into());
        }
        envelope
            .get("data")
            .cloned()
            .ok_or("Native decision response has no owner receipt".into())
    }
}
impl Drop for InvocationFiles {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Strictly reduces an untrusted renderer observation again at the egress
/// boundary. No caller string, identifier, ref, URL, command or body survives.
fn presentation_input(observation: &Value) -> Value {
    let arrangement = &observation["arrangement"];
    let mode = match arrangement["mode"].as_str() {
        Some("base") => "base",
        Some("encounter") => "encounter",
        Some("build") => "build",
        _ => "other-or-absent",
    };
    let surfaces = arrangement["surfaces"].as_array();
    fn nodes(value: &Value, depth: usize) -> (usize, usize) {
        if depth > 12 {
            return (0, 0);
        };
        match value["type"].as_str() {
            Some("group") => (1, value["tabs"].as_array().map_or(0, |a| a.len().min(64))),
            Some("split") => value["children"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .take(16)
                        .map(|n| nodes(n, depth + 1))
                        .fold((0, 0), |(a, b), (c, d)| (a + c, b + d))
                })
                .unwrap_or_default(),
            _ => (0, 0),
        }
    }
    let (groups, tabs) = nodes(&arrangement["root"], 0);
    json!({"standing":"untrusted advisory renderer observation; not authenticated UI truth","present":!observation.is_null(),"mode":mode,"workspace_count":arrangement["workspace_ids"].as_array().map_or(0,|a|a.len().min(64)),"surface_count":surfaces.map_or(0,|a|a.len().min(64)),"group_count":groups,"tab_count":tabs,"truncated":arrangement["truncated"]==true,"visual_expression_enabled":observation["visuals"]["enabled"]==true})
}

impl crate::Kernel {
    fn decision_basis(&mut self, proposal: &Proposal) -> Result<(Basis, PathBuf), String> {
        proposal.validate()?;
        let cwd = self.agent_location(proposal.project.as_deref())?;
        let scope_ref = if let Some(project) = proposal.project.as_deref() {
            self.agent_project_ref(project, &cwd)?
        } else {
            "control:root".into()
        };
        let mut inputs = BTreeMap::new();
        let mut source_refs = vec![scope_ref.clone()];
        let catalogue = sites()?;
        for name in &proposal.sites {
            let site = catalogue
                .iter()
                .find(|s| &s.name == name)
                .ok_or("Unknown decision site")?;
            if inputs.contains_key(&site.input) {
                continue;
            }
            match site.input.as_str() {
                "receiving" => {
                    let reading = self
                        .client
                        .receiving(
                            proposal.project.as_deref(),
                            &crate::flow::ReceivingRequest::List {
                                after: None,
                                limit: Some(50),
                            },
                        )
                        .map_err(|e| e.to_string())?;
                    if reading["schema"] != "central.receiving-page/v1" {
                        return Err("Unrecognised native receiving page".into());
                    }
                    let rows = reading["returns"]
                        .as_array()
                        .ok_or("Native receiving page has no return rows")?;
                    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
                    for row in rows.iter().take(50) {
                        let status = match row["status"].as_str() {
                            Some("pending") => "pending",
                            Some("needs-review") => "needs-review",
                            Some("accepted") => "accepted",
                            Some("including") => "including",
                            Some("uncertain") => "uncertain",
                            Some("included") => "included",
                            Some("conflict") => "conflict",
                            Some("rejected") => "rejected",
                            Some("recovered") => "recovered",
                            _ => "other",
                        };
                        *counts.entry(status.into()).or_default() += 1;
                    }
                    // Native refs/revisions remain local basis provenance; they
                    // are hashed, never sent as provider state.
                    source_refs.push(format!("native-receiving:{}", digest(&reading)?));
                    inputs.insert(site.input.clone(),json!({"standing":"native receiving page, first 50 records only","count":rows.len().min(50),"status_counts":counts,"more":reading["more"]==true}));
                }
                "presentation" => {
                    let observer = proposal
                        .observer_id
                        .as_deref()
                        .ok_or("Select the current renderer observation for this decision site")?;
                    text(observer, "Renderer observation identifier", 256)?;
                    let document = self.presentation.reading()?;
                    let observation = document["observations"].get(observer).ok_or(
                        "This renderer observation is no longer present; read the UI again",
                    )?;
                    let curated = presentation_input(observation);
                    source_refs.push(format!("advisory-renderer:{}", digest(&curated)?));
                    inputs.insert(site.input.clone(), curated);
                }
                _ => {
                    return Err("The decision site has no implemented native input resolver".into())
                }
            }
        }
        Ok((
            Basis {
                scope_ref,
                source_refs,
                inputs,
            },
            cwd,
        ))
    }
    pub fn decision_authorisation_preview(
        &mut self,
        preflight_ref: &str,
    ) -> Result<AuthorisationPreview, String> {
        let preflight = self.decisions.get_preflight(preflight_ref)?;
        let (basis, _) = self.decision_basis(&preflight.proposal)?;
        self.decisions.preview(preflight_ref, &basis)
    }
    /// Only the trusted native host calls this after its own confirmation.
    pub fn authorise_decision(
        &mut self,
        preflight_ref: &str,
    ) -> Result<crate::KernelOpOutcome, String> {
        let preflight = self.decisions.get_preflight(preflight_ref)?;
        let (basis, _) = self.decision_basis(&preflight.proposal)?;
        let episode = self.decisions.authorise(preflight_ref, &basis)?;
        let receipt = self
            .log
            .record(crate::events::KernelEvent::DecisionEpisodeChanged {
                episode: serde_json::to_value(&episode).map_err(|e| e.to_string())?,
            });
        Ok(crate::KernelOpOutcome {
            receipts: vec![receipt],
            result: crate::KernelOpResult::DecisionEpisodeAuthorised { episode },
        })
    }
    /// Hosts call this under their mutex, execute the returned job after
    /// releasing it, then commit the receipt with finish_decision.
    pub fn prepare_decision(
        &mut self,
        op: &crate::KernelOp,
    ) -> Result<Option<PreparedDecision>, String> {
        let Some((preflight_ref, authority_ref)) = decision_call(op)? else {
            return Ok(None);
        };
        let preflight = self.decisions.get_preflight(&preflight_ref)?;
        // Refuse unknown/revoked/expired grants before any native source reads.
        {
            let state = self
                .decisions
                .inner
                .lock()
                .map_err(|_| "Decision state lock failed")?;
            let grant = state
                .grants
                .get(&authority_ref)
                .ok_or("No host-issued decision authority exists for this reference")?;
            check_grant(grant, &preflight, 0)?;
        }
        let (basis, cwd) = self.decision_basis(&preflight.proposal)?;
        self.decisions
            .prepare(&preflight_ref, &authority_ref, &basis, cwd)
            .map(Some)
    }
    pub fn finish_decision(
        &mut self,
        receipt: Receipt,
        as_action: bool,
    ) -> Result<crate::KernelOpOutcome, String> {
        let event = self
            .log
            .record(crate::events::KernelEvent::DecisionRecorded {
                receipt: serde_json::to_value(&receipt).map_err(|e| e.to_string())?,
            });
        let result = if as_action {
            crate::KernelOpResult::ActionDispatched {
                dispatch: crate::action::ActionDispatch::Invoked {
                    owner_operation: "oi kernel decide".into(),
                    data: serde_json::to_value(receipt).map_err(|e| e.to_string())?,
                },
            }
        } else {
            crate::KernelOpResult::DecisionMade { receipt }
        };
        Ok(crate::KernelOpOutcome {
            receipts: vec![event],
            result,
        })
    }
    pub(crate) fn decision_preflight(&mut self, proposal: Proposal) -> Result<Preflight, String> {
        let (basis, _) = self.decision_basis(&proposal)?;
        self.decisions.preflight(proposal, basis)
    }
}
fn decision_call(op: &crate::KernelOp) -> Result<Option<(String, String)>, String> {
    match op {
        crate::KernelOp::Decide {
            preflight_ref,
            authority_ref,
        } => Ok(Some((preflight_ref.clone(), authority_ref.clone()))),
        crate::KernelOp::InvokeAction { invocation, .. }
            if invocation.action == "action:decision.decide" =>
        {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Input {
                authority_ref: String,
            }
            let input: Input =
                serde_json::from_value(invocation.input.clone().unwrap_or(Value::Null))
                    .map_err(|e| e.to_string())?;
            Ok(Some((invocation.target_ref.clone(), input.authority_ref)))
        }
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn proposal() -> Proposal {
        Proposal {
            project: None,
            observer_id: None,
            sites: vec!["receiving.review-priority".into()],
            agent_questions: BTreeMap::new(),
            credential_ref: "keychain://test/decision".into(),
            limits: Limits {
                timeout_ms: 100,
                max_attempts: 1,
                max_total_reserved_microusd: 100,
                tariff: Tariff {
                    model_version: "jev-1.13.0".into(),
                    source: "Explicit tariff for boundary test; no provider call".into(),
                    max_input_tokens_per_attempt: 1000,
                    max_output_tokens_per_attempt: 100,
                    input_microusd_per_million_tokens: 42000,
                    output_microusd_per_million_tokens: 0,
                },
            },
            episode_budget_microusd: 100,
            episode_seconds: 60,
        }
    }
    fn basis() -> Basis {
        Basis {
            scope_ref: "control:root".into(),
            source_refs: vec!["control:root".into()],
            inputs: BTreeMap::from([("receiving".into(), json!({"count":0,"more":false}))]),
        }
    }
    #[test]
    fn no_json_or_reference_can_issue_authority() {
        assert!(serde_json::from_value::<crate::KernelOp>(
            json!({"op":"decision_episode_authorise","preflight_ref":"forged","confirmed":true})
        )
        .is_err());
        let store = Store::default();
        let p = store.preflight(proposal(), basis()).unwrap();
        assert!(store
            .prepare(
                &p.preflight_ref,
                "caller-supplied",
                &basis(),
                PathBuf::from("/")
            )
            .err()
            .unwrap()
            .contains("No host-issued"));
        assert!(store
            .authorise("forged", &basis())
            .unwrap_err()
            .contains("forged"));
        assert!(store.reading().unwrap()["episodes"]
            .as_array()
            .unwrap()
            .is_empty());
    }
    #[test]
    fn changed_basis_refused_and_confirmed_preview_cannot_reissue_after_revocation() {
        let store = Store::default();
        let p = store.preflight(proposal(), basis()).unwrap();
        let mut changed = basis();
        changed
            .inputs
            .insert("receiving".into(), json!({"count":1}));
        assert!(store
            .authorise(&p.preflight_ref, &changed)
            .unwrap_err()
            .contains("changed"));
        let episode = store.authorise(&p.preflight_ref, &basis()).unwrap();
        let prepared = store
            .prepare(
                &p.preflight_ref,
                &episode.authority_ref,
                &basis(),
                PathBuf::from("/"),
            )
            .unwrap();
        assert!(store.revoke(&episode.authority_ref).unwrap().1);
        assert!(!store.revoke(&episode.authority_ref).unwrap().1);
        assert!(prepared.execute().unwrap_err().contains("revoked"));
        assert!(store
            .authorise(&p.preflight_ref, &basis())
            .unwrap_err()
            .contains("already issued"));
        assert!(store.reading().unwrap()["receipts"]
            .as_array()
            .unwrap()
            .is_empty());
    }
    #[test]
    fn scope_tariff_budget_and_expiry_checked_before_execution() {
        let store = Store::default();
        let p = store.preflight(proposal(), basis()).unwrap();
        let episode = store.authorise(&p.preflight_ref, &basis()).unwrap();
        let mut state = store.inner.lock().unwrap();
        let grant = state.grants.get_mut(&episode.authority_ref).unwrap();
        assert_eq!(p.proposal.limits.reservation().unwrap(), 42);
        assert!(check_grant(grant, &p, 101).unwrap_err().contains("budget"));
        grant.summary.reserved_microusd = 70;
        assert!(check_grant(grant, &p, 42).unwrap_err().contains("budget"));
        let mut wrong = p.clone();
        wrong.basis.scope_ref = "project:outside".into();
        assert!(check_grant(grant, &wrong, 0).unwrap_err().contains("scope"));
        wrong = p.clone();
        wrong
            .proposal
            .limits
            .tariff
            .input_microusd_per_million_tokens = 1;
        assert!(check_grant(grant, &wrong, 0)
            .unwrap_err()
            .contains("tariff"));
        grant.summary.expires_at_unix_seconds = 0;
        assert!(check_grant(grant, &p, 0).unwrap_err().contains("expired"));
    }
    #[test]
    fn arbitrary_observation_strings_never_become_provider_input() {
        let secret = "PRIVATE BODY URL COMMAND OR ID";
        let observation = json!({"visuals":{"enabled":true,"glyph":secret},"arrangement":{"mode":secret,"active":secret,"workspace_ids":[secret],"surfaces":[{"id":secret,"ref":secret,"kind":secret}],"root":{"type":"group","tabs":[secret],"body":secret},"draft":secret}});
        let curated = presentation_input(&observation);
        let encoded = serde_json::to_string(&curated).unwrap();
        assert!(!encoded.contains(secret));
        assert_eq!(curated["workspace_count"], 1);
        assert_eq!(curated["surface_count"], 1);
        assert_eq!(curated["tab_count"], 1);
        assert_eq!(curated["mode"], "other-or-absent");
    }
    #[test]
    fn concrete_tariff_and_typed_batch_are_required() {
        let mut p = proposal();
        p.limits.tariff.model_version = "jev-latest".into();
        assert!(p.validate().is_err());
        p = proposal();
        p.credential_ref = "env://TYPESAFE_API_KEY".into();
        assert!(p.validate().is_err());
        p = proposal();
        p.limits.tariff.max_input_tokens_per_attempt = u64::MAX;
        p.limits.tariff.input_microusd_per_million_tokens = u64::MAX;
        assert!(p.validate().is_err());
        let invalid: Question = serde_json::from_value(
            json!({"type":"score","instructions":"score","criteria":["one"]}),
        )
        .unwrap();
        assert!(invalid.validate().is_err());
        for site in sites().unwrap() {
            assert!(!site.gate_behavior.is_empty());
            for question in site.questions.values() {
                question.validate().unwrap();
            }
        }
    }
}
