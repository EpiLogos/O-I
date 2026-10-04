//! Prospective private definition storage, charged without material copies.
use serde::ser::SerializeMap;
use serde::{Serialize, Serializer};
use serde_json::Value;
use std::collections::BTreeMap;

struct Prospective<'a> {
    existing: &'a BTreeMap<String, Value>,
    reference: &'a str,
    candidate: &'a Value,
    count: usize,
}
impl Serialize for Prospective<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut rows = serializer.serialize_map(Some(self.count))?;
        for (reference, definition) in self.existing {
            if reference != self.reference {
                rows.serialize_entry(reference, definition)?;
            }
        }
        rows.serialize_entry(self.reference, self.candidate)?;
        rows.end()
    }
}
pub(super) fn prospective(
    existing: &BTreeMap<String, Value>,
    reference: &str,
    candidate: &Value,
) -> Result<(), String> {
    let count = existing.len().checked_add(usize::from(!existing.contains_key(reference)))
        .ok_or("Existing owner procedural qualification count overflow")?;
    if count > 64 {
        return Err("Existing owner procedural qualification budget exceeded".into());
    }
    crate::expression_procedural_source_budget::measure(&Prospective {
        existing, reference, candidate, count,
    }, 8 * 1024 * 1024).map(|_| ())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn complete_prospective_map_preserves_replacement_and_admits_no_material_copy() {
        let existing = BTreeMap::from([
            ("procedure:a".into(),json!({"full":"original a"})),
            ("procedure:b".into(),json!({"full":"original b"}))]);
        let candidate = json!({"full":"new a", "tail":[1,2,3]});
        let before = json!((&existing,&candidate));
        prospective(&existing,"procedure:a",&candidate).unwrap();
        let actual=serde_json::to_value(Prospective{existing:&existing,reference:"procedure:a",candidate:&candidate,count:2}).unwrap();
        assert_eq!(actual,json!({"procedure:a":candidate,"procedure:b":existing["procedure:b"]}));
        assert_eq!(json!((&existing,&candidate)),before);
    }
    #[test]
    fn count_and_complete_late_body_are_refused_before_copy_or_storage() {
        let existing=(0..64).map(|n|(format!("procedure:{n}"),json!({"full":n}))).collect::<BTreeMap<_,_>>();
        let before=json!(existing);
        assert!(prospective(&existing,"procedure:new",&json!({})).is_err());
        prospective(&existing,"procedure:63",&json!({"replacement":true})).unwrap();
        let over=json!({"late_body":"x".repeat(8*1024*1024)});
        assert!(prospective(&existing,"procedure:63",&over).is_err());
        assert_eq!(json!(existing),before);
    }
    #[test]
    fn complete_first_install_expansion_charges_repeated_definition_before_copy() {
        let definition = json!({"actual_configuration_body": "x".repeat(3 * 1024 * 1024)});
        let original = definition.clone();
        crate::expression::procedural::bootstrap::preflight_source_message(&definition).unwrap();
        assert!(crate::expression::procedural::bootstrap::preflight_source_message(&(
            &definition, &definition, &definition,
        )).is_err());
        assert_eq!(definition, original);
    }

}
