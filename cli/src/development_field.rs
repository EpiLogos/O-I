use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

pub const DEVELOPMENT_PROTOCOL: &str = "1.0";
pub const CHANNEL_CATALOG_SCHEMA: &str = "oi.suite-channels/v1";
pub const SUITE_CANDIDATE_SCHEMA: &str = "oi.suite-candidate/v1";
pub const ACTIVE_SUITE_RECEIPT_SCHEMA: &str = "oi.active-suite-receipt/v1";
pub const PRODUCT_IDS: [&str; 6] = [
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
];

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ProtocolRange {
    pub protocol_min: String,
    pub protocol_max: String,
}

impl ProtocolRange {
    pub fn validate(&self) -> Result<(), String> {
        let min = parse_version(&self.protocol_min)?;
        let max = parse_version(&self.protocol_max)?;
        if min > max {
            return Err(format!(
                "protocol range is inverted: {} > {}",
                self.protocol_min, self.protocol_max
            ));
        }
        Ok(())
    }

    pub fn supports(&self, protocol: &str) -> Result<bool, String> {
        self.validate()?;
        let protocol = parse_version(protocol)?;
        let min = parse_version(&self.protocol_min)?;
        let max = parse_version(&self.protocol_max)?;
        Ok(protocol >= min && protocol <= max)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteChannelCatalog {
    pub schema: String,
    pub protocol_min: String,
    pub protocol_max: String,
    pub default_channel: String,
    pub channels: BTreeMap<String, SuiteChannel>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteChannel {
    pub candidate_ref: Option<String>,
    pub source: String,
    pub standing: String,
    #[serde(default)]
    pub installable: bool,
}

impl SuiteChannelCatalog {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != CHANNEL_CATALOG_SCHEMA {
            return Err(format!(
                "unsupported suite-channel schema `{}`; expected `{CHANNEL_CATALOG_SCHEMA}`",
                self.schema
            ));
        }
        ProtocolRange {
            protocol_min: self.protocol_min.clone(),
            protocol_max: self.protocol_max.clone(),
        }
        .validate()?;
        for required in ["stable", "mainline", "source"] {
            if !self.channels.contains_key(required) {
                return Err(format!("suite channel catalogue is missing `{required}`"));
            }
        }
        if !self.channels.contains_key(&self.default_channel) {
            return Err(format!(
                "default suite channel `{}` is not declared",
                self.default_channel
            ));
        }
        for (name, channel) in &self.channels {
            nonempty("channel name", name)?;
            nonempty("channel source", &channel.source)?;
            nonempty("channel standing", &channel.standing)?;
            if channel.installable && channel.candidate_ref.as_deref().is_none_or(str::is_empty) {
                return Err(format!(
                    "installable suite channel `{name}` must name a candidate_ref"
                ));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteCandidate {
    pub schema: String,
    pub protocol_min: String,
    pub protocol_max: String,
    pub candidate_ref: String,
    pub channel: String,
    pub source: String,
    pub products: BTreeMap<String, ProductIdentity>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ProductIdentity {
    pub revision: String,
    pub artifact: String,
    pub sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attestation: Option<String>,
}

impl SuiteCandidate {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != SUITE_CANDIDATE_SCHEMA {
            return Err(format!(
                "unsupported suite-candidate schema `{}`; expected `{SUITE_CANDIDATE_SCHEMA}`",
                self.schema
            ));
        }
        nonempty("candidate_ref", &self.candidate_ref)?;
        nonempty("candidate channel", &self.channel)?;
        nonempty("candidate source", &self.source)?;
        let range = ProtocolRange {
            protocol_min: self.protocol_min.clone(),
            protocol_max: self.protocol_max.clone(),
        };
        range.validate()?;
        if !range.supports(DEVELOPMENT_PROTOCOL)? {
            return Err(format!(
                "suite candidate `{}` does not admit O:I protocol {DEVELOPMENT_PROTOCOL} ({}..={})",
                self.candidate_ref, self.protocol_min, self.protocol_max
            ));
        }
        validate_six_products(&self.products)?;
        for (id, product) in &self.products {
            validate_revision(id, &product.revision)?;
            nonempty("artifact", &product.artifact)?;
            validate_sha256(id, &product.sha256)?;
            if let Some(executable) = &product.executable {
                nonempty("executable", executable)?;
            }
            if let Some(attestation) = &product.attestation {
                nonempty("attestation", attestation)?;
            }
        }
        Ok(())
    }

    pub fn digest(&self) -> Result<String, String> {
        self.validate()?;
        let bytes = serde_json::to_vec(self).map_err(|error| error.to_string())?;
        Ok(hex_sha256(&bytes))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ActiveSuiteReceipt {
    pub schema: String,
    pub protocol: String,
    pub receipt_ref: String,
    pub candidate_ref: String,
    pub candidate_digest: String,
    pub channel: String,
    pub source: String,
    pub activated_at_ms: u128,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_receipt_ref: Option<String>,
    pub products: BTreeMap<String, ActiveProduct>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ActiveProduct {
    pub revision: String,
    pub artifact: String,
    pub sha256: String,
    pub root: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attestation: Option<String>,
    #[serde(default)]
    pub attestation_verified: bool,
}

impl ActiveSuiteReceipt {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != ACTIVE_SUITE_RECEIPT_SCHEMA {
            return Err(format!(
                "unsupported active-suite receipt schema `{}`; expected `{ACTIVE_SUITE_RECEIPT_SCHEMA}`",
                self.schema
            ));
        }
        if self.protocol != DEVELOPMENT_PROTOCOL {
            return Err(format!(
                "active receipt protocol `{}` is not supported by O:I protocol {DEVELOPMENT_PROTOCOL}",
                self.protocol
            ));
        }
        nonempty("receipt_ref", &self.receipt_ref)?;
        nonempty("candidate_ref", &self.candidate_ref)?;
        validate_digest("candidate_digest", &self.candidate_digest)?;
        nonempty("channel", &self.channel)?;
        nonempty("source", &self.source)?;
        validate_six_products(&self.products)?;
        for (id, product) in &self.products {
            validate_revision(id, &product.revision)?;
            nonempty("artifact", &product.artifact)?;
            validate_sha256(id, &product.sha256)?;
            nonempty("root", &product.root)?;
            if let Some(executable) = &product.executable {
                nonempty("executable", executable)?;
            }
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransitionAction {
    Reuse,
    Acquire,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SuiteTransitionPlan {
    pub from_receipt: Option<String>,
    pub to_candidate: String,
    pub actions: BTreeMap<String, TransitionAction>,
}

pub fn plan_transition(
    active: Option<&ActiveSuiteReceipt>,
    candidate: &SuiteCandidate,
) -> Result<SuiteTransitionPlan, String> {
    candidate.validate()?;
    if let Some(active) = active {
        active.validate()?;
    }
    let mut actions = BTreeMap::new();
    for (id, wanted) in &candidate.products {
        let action = active
            .and_then(|receipt| receipt.products.get(id))
            .filter(|installed| {
                installed.revision == wanted.revision
                    && installed.artifact == wanted.artifact
                    && installed.sha256 == wanted.sha256
            })
            .map(|_| TransitionAction::Reuse)
            .unwrap_or(TransitionAction::Acquire);
        actions.insert(id.clone(), action);
    }
    Ok(SuiteTransitionPlan {
        from_receipt: active.map(|receipt| receipt.receipt_ref.clone()),
        to_candidate: candidate.candidate_ref.clone(),
        actions,
    })
}

pub fn validate_protocol_envelope(protocol_min: &str, protocol_max: &str) -> Result<(), String> {
    let range = ProtocolRange {
        protocol_min: protocol_min.to_owned(),
        protocol_max: protocol_max.to_owned(),
    };
    range.validate()?;
    if !range.supports(DEVELOPMENT_PROTOCOL)? {
        return Err(format!(
            "protocol range {protocol_min}..={protocol_max} excludes O:I protocol {DEVELOPMENT_PROTOCOL}"
        ));
    }
    Ok(())
}

fn validate_six_products<T>(products: &BTreeMap<String, T>) -> Result<(), String> {
    let expected = PRODUCT_IDS.into_iter().collect::<BTreeSet<_>>();
    let observed = products.keys().map(String::as_str).collect::<BTreeSet<_>>();
    if observed != expected {
        let missing = expected.difference(&observed).copied().collect::<Vec<_>>();
        let extra = observed.difference(&expected).copied().collect::<Vec<_>>();
        return Err(format!(
            "suite composition must contain exactly the six native owners; missing={missing:?}, extra={extra:?}"
        ));
    }
    Ok(())
}

fn validate_revision(id: &str, revision: &str) -> Result<(), String> {
    if revision.len() != 40 || !revision.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(format!("{id} has non-immutable revision `{revision}`"));
    }
    Ok(())
}

fn validate_sha256(id: &str, digest: &str) -> Result<(), String> {
    validate_digest(&format!("{id} sha256"), digest)
}

fn validate_digest(label: &str, digest: &str) -> Result<(), String> {
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(format!(
            "{label} must be a 64-character hexadecimal SHA-256"
        ));
    }
    Ok(())
}

fn nonempty(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("{label} must not be empty"))
    } else {
        Ok(())
    }
}

fn parse_version(value: &str) -> Result<Vec<u64>, String> {
    if value.trim().is_empty() {
        return Err("protocol version must not be empty".into());
    }
    value
        .split('.')
        .map(|part| {
            if part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_digit()) {
                return Err(format!(
                    "protocol version `{value}` must be dot-separated numeric components"
                ));
            }
            part.parse::<u64>()
                .map_err(|_| format!("protocol version component overflows in `{value}`"))
        })
        .collect()
}

fn hex_sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn product(revision_char: char) -> ProductIdentity {
        ProductIdentity {
            revision: std::iter::repeat(revision_char).take(40).collect(),
            artifact: "fixture.tar.gz".into(),
            sha256: "a".repeat(64),
            executable: Some("fixture".into()),
            attestation: Some("attestation:fixture".into()),
        }
    }

    fn candidate() -> SuiteCandidate {
        SuiteCandidate {
            schema: SUITE_CANDIDATE_SCHEMA.into(),
            protocol_min: "1.0".into(),
            protocol_max: "1.0".into(),
            candidate_ref: "suite:fixture-b".into(),
            channel: "mainline".into(),
            source: "fixture".into(),
            products: PRODUCT_IDS
                .into_iter()
                .map(|id| (id.to_owned(), product('b')))
                .collect(),
        }
    }

    #[test]
    fn protocol_range_is_closed_and_numeric() {
        let range = ProtocolRange {
            protocol_min: "1.0".into(),
            protocol_max: "1.2".into(),
        };
        assert!(range.supports("1.0").unwrap());
        assert!(range.supports("1.1").unwrap());
        assert!(range.supports("1.2").unwrap());
        assert!(!range.supports("2.0").unwrap());
    }

    #[test]
    fn candidate_requires_exact_native_sixfold() {
        let mut value = candidate();
        value.products.remove("workcell");
        assert!(value
            .validate()
            .unwrap_err()
            .contains("exactly the six native owners"));
    }

    #[test]
    fn candidate_digest_is_deterministic() {
        let first = candidate();
        let second = candidate();
        assert_eq!(first.digest().unwrap(), second.digest().unwrap());
    }

    #[test]
    fn transition_reuses_only_identical_artifact_identity() {
        let wanted = candidate();
        let digest = wanted.digest().unwrap();
        let mut installed = BTreeMap::new();
        for (id, product) in &wanted.products {
            installed.insert(
                id.clone(),
                ActiveProduct {
                    revision: product.revision.clone(),
                    artifact: product.artifact.clone(),
                    sha256: product.sha256.clone(),
                    root: format!("/suite/{id}"),
                    executable: product.executable.clone(),
                    attestation: product.attestation.clone(),
                    attestation_verified: true,
                },
            );
        }
        installed.get_mut("ai-kit").unwrap().sha256 = "c".repeat(64);
        let active = ActiveSuiteReceipt {
            schema: ACTIVE_SUITE_RECEIPT_SCHEMA.into(),
            protocol: DEVELOPMENT_PROTOCOL.into(),
            receipt_ref: "receipt:a".into(),
            candidate_ref: "suite:a".into(),
            candidate_digest: digest,
            channel: "mainline".into(),
            source: "fixture".into(),
            activated_at_ms: 1,
            previous_receipt_ref: None,
            products: installed,
        };
        let plan = plan_transition(Some(&active), &wanted).unwrap();
        assert_eq!(plan.actions["ai-kit"], TransitionAction::Acquire);
        assert_eq!(plan.actions["central"], TransitionAction::Reuse);
    }
}
