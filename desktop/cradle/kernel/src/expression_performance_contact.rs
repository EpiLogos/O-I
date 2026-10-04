//! Authored numerical contact definitions in the existing native Scene score.
//! No native timing, force, route, body, constructor lifetime or admission can
//! be supplied here. The privately borrowed Scene selects this original input;
//! the sole P/Engine contact owner derives and admits its operative programme.
use super::{Performance, Scalar, MAX_ROUTES};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const AUTHORED_SCHEMA: &str = "ql.authored-body-local-plane-contact/v1";
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AuthoredContactDefinition {
    pub schema: String,
    pub contact_ref: String,
    pub particle_ref: String,
    pub collider_ref: String,
    pub policy_ref: String,
    pub policy_revision: String,
    pub standing: String,
    pub particle_position_metres: [Scalar; 3],
    pub particle_velocity_metres_per_second: [Scalar; 3],
    pub plane_position_metres: [Scalar; 3],
    pub outward_normal: [Scalar; 3],
    pub gravity_metres_per_second_squared: [Scalar; 3],
    pub mass_kg: Scalar,
    pub restitution: Scalar,
    pub transfer_fraction: Scalar,
    pub minimum_impact_speed_metres_per_second: Scalar,
    pub duration_samples: u32,
}
fn reference(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() >= 192 || value.chars().any(char::is_control) {
        return Err("contact requires an original bounded printable reference".into());
    }
    Ok(())
}
fn bounded(value: Scalar, low: f64, high: f64) -> Result<(), String> {
    super::range(value, low, high)
}
impl AuthoredContactDefinition {
    /// Structural authored law only. Spatial/exciter conduction and collision
    /// dates/forces are derived from the actual current native prepared body.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != AUTHORED_SCHEMA
            || !(1..=512).contains(&self.duration_samples)
            || !["architecture-model", "reference", "tunable-model"]
                .contains(&self.standing.as_str())
        {
            return Err("authored contact contract, standing or duration invalid".into());
        }
        for value in [
            &self.contact_ref,
            &self.particle_ref,
            &self.collider_ref,
            &self.policy_ref,
            &self.policy_revision,
            &self.standing,
        ] {
            reference(value)?;
        }
        for vector in [&self.particle_position_metres, &self.plane_position_metres] {
            for value in vector {
                bounded(*value, -1e6, 1e6)?;
            }
        }
        for vector in [
            &self.particle_velocity_metres_per_second,
            &self.gravity_metres_per_second_squared,
        ] {
            for value in vector {
                bounded(*value, -1e4, 1e4)?;
            }
        }
        let mut norm = 0.0;
        for value in &self.outward_normal {
            bounded(*value, -1.0, 1.0)?;
            norm += value.value() * value.value();
        }
        if (norm - 1.0).abs() > 1e-10 {
            return Err("authored contact normal is not unit length".into());
        }
        bounded(self.mass_kg, 1e-12, 1e3)?;
        bounded(self.restitution, 0.0, 1.0)?;
        bounded(self.transfer_fraction, 0.0, 1.0)?;
        bounded(self.minimum_impact_speed_metres_per_second, 0.0, 1e4)?;
        Ok(())
    }
}
pub(super) fn validate_definitions(
    definitions: &[AuthoredContactDefinition],
) -> Result<(), String> {
    if definitions.len() > MAX_ROUTES {
        return Err("authored contact definition budget exceeded".into());
    }
    let mut references = BTreeSet::new();
    for definition in definitions {
        definition.validate()?;
        if !references.insert(&definition.contact_ref) {
            return Err("duplicate authored contact definition reference".into());
        }
    }
    Ok(())
}
impl Performance {
    /// The native closed reader borrows this exact original definition before
    /// Contact trigger. This lookup performs no queue mutation and grants no
    /// Scene lifetime/source/clock capability to a caller holding a Performance.
    pub fn contact_definition(
        &self,
        contact_ref: &str,
    ) -> Result<&AuthoredContactDefinition, String> {
        self.validate()?;
        self.contact_definitions
            .iter()
            .find(|definition| definition.contact_ref == contact_ref)
            .ok_or_else(|| "authored current Scene contact definition absent".into())
    }
}
