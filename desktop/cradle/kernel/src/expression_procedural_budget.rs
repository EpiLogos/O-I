//! Account borrowed native material before repeated Source contexts allocate.
//! The writer stores no encoded bytes. A refused intake has copied no Scene.
use super::*;
use serde::ser::{SerializeMap, SerializeStruct};
use std::io::{self, Write};

pub(crate) const SOURCE_BYTES: usize = 8 * 1024 * 1024;
pub(crate) struct Budget {
    remaining: usize,
}
impl Budget {
    pub(crate) fn new() -> Self {
        Self {
            remaining: SOURCE_BYTES,
        }
    }
    pub(crate) fn charged_bytes(&self) -> usize {
        SOURCE_BYTES - self.remaining
    }
    pub(crate) fn reserve(&mut self, bytes: usize) -> Result<(), String> {
        self.remaining = self
            .remaining
            .checked_sub(bytes)
            .ok_or("Native Source aggregate intake byte budget exceeded before allocation")?;
        Ok(())
    }
    pub(crate) fn value<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), String> {
        serde_json::to_writer(&mut *self, value).map_err(|_| {
            "Native Source aggregate intake byte budget exceeded before allocation".into()
        })
    }
    pub(super) fn material(
        &mut self,
        presentation: &crate::expression_scene::Presentation,
    ) -> Result<(), String> {
        self.value(&Material(presentation))
    }
    pub(super) fn driver_material(
        &mut self,
        presentation: &crate::expression_scene::Presentation,
    ) -> Result<(), String> {
        self.value(&DriverMaterial(presentation))
    }
    pub(super) fn entity_refs(
        &mut self,
        presentation: &crate::expression_scene::Presentation,
    ) -> Result<(), String> {
        self.value(&EntityRefs(&presentation.scene))
    }
}
impl Write for Budget {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.remaining = self.remaining.checked_sub(bytes.len()).ok_or_else(|| {
            io::Error::new(io::ErrorKind::OutOfMemory, "native Source intake budget")
        })?;
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
struct WithoutProcedural<'a>(&'a Value);
impl Serialize for WithoutProcedural<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let object = self
            .0
            .as_object()
            .ok_or_else(|| serde::ser::Error::custom("Actual native Scene object missing"))?;
        let mut map = serializer.serialize_map(Some(
            object.len() - usize::from(object.contains_key("procedural")),
        ))?;
        for (key, value) in object {
            if key != "procedural" {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}
struct Material<'a>(&'a crate::expression_scene::Presentation);
impl Serialize for Material<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer
            .serialize_struct("Presentation", if self.0.saved.is_some() { 3 } else { 2 })?;
        state.serialize_field("schema", &self.0.schema)?;
        state.serialize_field("scene", &WithoutProcedural(&self.0.scene))?;
        if let Some(saved) = &self.0.saved {
            state.serialize_field("saved", saved)?;
        }
        state.end()
    }
}
struct EntityRefs<'a>(&'a Value);
struct DriverProcedural<'a>(&'a Value);
impl Serialize for DriverProcedural<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let Some(object) = self.0.as_object() else {
            return self.0.serialize(serializer);
        };
        let mut map = serializer.serialize_map(Some(object.len()))?;
        for (key, value) in object {
            if key == "operations" {
                map.serialize_entry(key, &[] as &[Value])?;
            } else {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}
struct DriverScene<'a>(&'a Value);
impl Serialize for DriverScene<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let object = self
            .0
            .as_object()
            .ok_or_else(|| serde::ser::Error::custom("Actual native Scene object missing"))?;
        let mut map = serializer.serialize_map(Some(object.len()))?;
        for (key, value) in object {
            if key == "procedural" {
                map.serialize_entry(key, &DriverProcedural(value))?;
            } else {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}
struct DriverMaterial<'a>(&'a crate::expression_scene::Presentation);
impl Serialize for DriverMaterial<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer
            .serialize_struct("Presentation", if self.0.saved.is_some() { 3 } else { 2 })?;
        state.serialize_field("schema", &self.0.schema)?;
        state.serialize_field("scene", &DriverScene(&self.0.scene))?;
        if let Some(saved) = &self.0.saved {
            state.serialize_field("saved", saved)?;
        }
        state.end()
    }
}
pub(super) fn material_value(
    presentation: &crate::expression_scene::Presentation,
) -> Result<Value, String> {
    serde_json::to_value(Material(presentation)).map_err(|error| error.to_string())
}

pub(super) fn driver_material_value(
    presentation: &crate::expression_scene::Presentation,
) -> Result<Value, String> {
    serde_json::to_value(DriverMaterial(presentation)).map_err(|e| e.to_string())
}
impl Serialize for EntityRefs<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(None)?;
        for entity in self.0["entities"].as_array().into_iter().flatten() {
            let id = entity["id"].as_str().ok_or_else(|| {
                serde::ser::Error::custom("Actual native material identity missing")
            })?;
            map.serialize_entry(id, id)?;
        }
        map.end()
    }
}

pub(super) fn context_scenes(contribution: &Value) -> Result<BTreeSet<&str>, String> {
    let owned = retained_rows(contribution, "owned_addresses")?;
    let records = retained_rows(contribution, "authored_overrides")?;
    if owned.is_empty() || owned.len() > MAX_TARGETS || records.len() > 2048 {
        return Err(
            "Native event stored address/intervention bound exceeded before allocation".into(),
        );
    }
    if contribution["generated_basis"]["native_flow"].is_array() {
        Ok(BTreeSet::new())
    } else {
        owned
            .iter()
            .map(|a| {
                a["scene_ref"]
                    .as_str()
                    .ok_or_else(|| "Actual native intervention Scene missing".into())
            })
            .collect()
    }
}
pub(super) fn preflight_event_contexts(
    document: &Document,
    current: &[Value],
) -> Result<(), String> {
    if current.len() > 2048 {
        return Err("Native event intervention context bound exceeded before allocation".into());
    }
    // Complete cardinality is checked before streaming any material. A byte
    // refusal must not conceal the independent repeated-context count bound.
    let mut contexts = 0usize;
    let mut seen = BTreeSet::new();
    for row in current {
        let reference = retained_text(row, "contribution_ref")?;
        if !seen.insert(reference) {
            return Err("Duplicate current native output".into());
        }
        let contribution = source_current_contribution(document, reference)?;
        let scenes = context_scenes(contribution)?;
        contexts = contexts
            .checked_add(scenes.len().max(1))
            .ok_or("Native context cardinality overflow")?;
        if contexts > 2048 {
            return Err(
                "Native event intervention context bound exceeded before allocation".into(),
            );
        }
    }
    let mut budget = Budget::new();
    for row in current {
        let contribution =
            source_current_contribution(document, retained_text(row, "contribution_ref")?)?;
        let owned = retained_rows(contribution, "owned_addresses")?;
        let records = retained_rows(contribution, "authored_overrides")?;
        let scenes = context_scenes(contribution)?;
        budget.value(row)?;
        if scenes.is_empty() {
            budget.reserve(2048)?;
            budget.value(owned)?;
            budget.value(records)?;
            budget.value(&document.selection)?;
            budget.value(
                &document
                    .scenes
                    .iter()
                    .map(|s| &s.scene_ref)
                    .collect::<Vec<_>>(),
            )?;
        } else {
            for reference_scene in scenes {
                let presentation = document
                    .scenes
                    .iter()
                    .find(|s| s.scene_ref == reference_scene)
                    .and_then(|s| s.presentation.as_ref())
                    .ok_or("Actual native intervention Scene unavailable")?;
                budget.reserve(2048)?;
                budget.value(owned)?;
                for record in records
                    .iter()
                    .filter(|r| r["address"]["scene_ref"] == reference_scene)
                {
                    budget.value(record)?;
                }
                budget.material(presentation)?;
                budget.entity_refs(presentation)?;
            }
        }
    }
    Ok(())
}

// Compare the actual typed native envelope with its borrowed durable JSON.
// Serializer output is visited structurally, never buffered or converted to a
// second Value; objects remain order independent and numbers retain JSON kinds.
fn mismatch() -> serde_json::Error {
    serde::ser::Error::custom("Durable native envelope differs from its live owner")
}
pub(super) fn matches_borrowed<T: Serialize + ?Sized>(value: &T, raw: &Value) -> bool {
    value.serialize(MatchValue(raw)).is_ok()
}
struct MatchValue<'a>(&'a Value);
struct MatchSeq<'a> {
    values: &'a [Value],
    index: usize,
}
struct MatchMap<'a> {
    values: &'a serde_json::Map<String, Value>,
    entries: usize,
    pending: Option<&'a Value>,
}
impl<'a> MatchValue<'a> {
    fn sequence(self, len: Option<usize>) -> Result<MatchSeq<'a>, serde_json::Error> {
        let values = self.0.as_array().ok_or_else(mismatch)?;
        if len.is_some_and(|n| n != values.len()) {
            return Err(mismatch());
        }
        Ok(MatchSeq { values, index: 0 })
    }
    fn object(self, len: Option<usize>) -> Result<MatchMap<'a>, serde_json::Error> {
        let values = self.0.as_object().ok_or_else(mismatch)?;
        if len.is_some_and(|n| n != values.len()) {
            return Err(mismatch());
        }
        Ok(MatchMap {
            values,
            entries: 0,
            pending: None,
        })
    }
    fn variant(self, name: &str) -> Result<Self, serde_json::Error> {
        let object = self.0.as_object().ok_or_else(mismatch)?;
        if object.len() != 1 {
            return Err(mismatch());
        }
        Ok(Self(object.get(name).ok_or_else(mismatch)?))
    }
}
macro_rules! match_scalar {
    ($method:ident,$ty:ty,$convert:expr) => {
        fn $method(self, value: $ty) -> Result<(), Self::Error> {
            if self.0.as_number() == Some(&($convert)(value)) {
                Ok(())
            } else {
                Err(mismatch())
            }
        }
    };
}
impl<'a> serde::Serializer for MatchValue<'a> {
    type Ok = ();
    type Error = serde_json::Error;
    type SerializeSeq = MatchSeq<'a>;
    type SerializeTuple = MatchSeq<'a>;
    type SerializeTupleStruct = MatchSeq<'a>;
    type SerializeTupleVariant = MatchSeq<'a>;
    type SerializeMap = MatchMap<'a>;
    type SerializeStruct = MatchMap<'a>;
    type SerializeStructVariant = MatchMap<'a>;
    fn serialize_bool(self, value: bool) -> Result<(), Self::Error> {
        if self.0.as_bool() == Some(value) {
            Ok(())
        } else {
            Err(mismatch())
        }
    }
    match_scalar!(serialize_i8, i8, |v: i8| serde_json::Number::from(v));
    match_scalar!(serialize_i16, i16, |v: i16| serde_json::Number::from(v));
    match_scalar!(serialize_i32, i32, |v: i32| serde_json::Number::from(v));
    match_scalar!(serialize_i64, i64, |v: i64| serde_json::Number::from(v));
    match_scalar!(serialize_u8, u8, |v: u8| serde_json::Number::from(v));
    match_scalar!(serialize_u16, u16, |v: u16| serde_json::Number::from(v));
    match_scalar!(serialize_u32, u32, |v: u32| serde_json::Number::from(v));
    match_scalar!(serialize_u64, u64, |v: u64| serde_json::Number::from(v));
    fn serialize_i128(self, value: i128) -> Result<(), Self::Error> {
        i64::try_from(value)
            .map_err(|_| mismatch())
            .and_then(|value| self.serialize_i64(value))
    }
    fn serialize_u128(self, value: u128) -> Result<(), Self::Error> {
        u64::try_from(value)
            .map_err(|_| mismatch())
            .and_then(|value| self.serialize_u64(value))
    }
    fn serialize_f32(self, value: f32) -> Result<(), Self::Error> {
        self.serialize_f64(f64::from(value))
    }
    fn serialize_f64(self, value: f64) -> Result<(), Self::Error> {
        if serde_json::Number::from_f64(value).as_ref() == self.0.as_number() {
            Ok(())
        } else {
            Err(mismatch())
        }
    }
    fn serialize_char(self, value: char) -> Result<(), Self::Error> {
        let mut s = [0u8; 4];
        self.serialize_str(value.encode_utf8(&mut s))
    }
    fn serialize_str(self, value: &str) -> Result<(), Self::Error> {
        if self.0.as_str() == Some(value) {
            Ok(())
        } else {
            Err(mismatch())
        }
    }
    fn serialize_bytes(self, value: &[u8]) -> Result<(), Self::Error> {
        let mut sequence = self.sequence(Some(value.len()))?;
        for byte in value {
            serde::ser::SerializeSeq::serialize_element(&mut sequence, byte)?;
        }
        serde::ser::SerializeSeq::end(sequence)
    }
    fn serialize_none(self) -> Result<(), Self::Error> {
        self.serialize_unit()
    }
    fn serialize_some<T: Serialize + ?Sized>(self, value: &T) -> Result<(), Self::Error> {
        value.serialize(self)
    }
    fn serialize_unit(self) -> Result<(), Self::Error> {
        if self.0.is_null() {
            Ok(())
        } else {
            Err(mismatch())
        }
    }
    fn serialize_unit_struct(self, _name: &'static str) -> Result<(), Self::Error> {
        self.serialize_unit()
    }
    fn serialize_unit_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
    ) -> Result<(), Self::Error> {
        self.serialize_str(variant)
    }
    fn serialize_newtype_struct<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        value.serialize(self)
    }
    fn serialize_newtype_variant<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        value.serialize(self.variant(variant)?)
    }
    fn serialize_seq(self, len: Option<usize>) -> Result<Self::SerializeSeq, Self::Error> {
        self.sequence(len)
    }
    fn serialize_tuple(self, len: usize) -> Result<Self::SerializeTuple, Self::Error> {
        self.sequence(Some(len))
    }
    fn serialize_tuple_struct(
        self,
        _name: &'static str,
        len: usize,
    ) -> Result<Self::SerializeTupleStruct, Self::Error> {
        self.sequence(Some(len))
    }
    fn serialize_tuple_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<Self::SerializeTupleVariant, Self::Error> {
        self.variant(variant)?.sequence(Some(len))
    }
    fn serialize_map(self, len: Option<usize>) -> Result<Self::SerializeMap, Self::Error> {
        self.object(len)
    }
    fn serialize_struct(
        self,
        _name: &'static str,
        len: usize,
    ) -> Result<Self::SerializeStruct, Self::Error> {
        self.object(Some(len))
    }
    fn serialize_struct_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
        len: usize,
    ) -> Result<Self::SerializeStructVariant, Self::Error> {
        self.variant(variant)?.object(Some(len))
    }
}
macro_rules! match_sequence {
    ($trait:ident,$method:ident) => {
        impl serde::ser::$trait for MatchSeq<'_> {
            type Ok = ();
            type Error = serde_json::Error;
            fn $method<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
                let raw = self.values.get(self.index).ok_or_else(mismatch)?;
                value.serialize(MatchValue(raw))?;
                self.index += 1;
                Ok(())
            }
            fn end(self) -> Result<(), Self::Error> {
                if self.index == self.values.len() {
                    Ok(())
                } else {
                    Err(mismatch())
                }
            }
        }
    };
}
match_sequence!(SerializeSeq, serialize_element);
match_sequence!(SerializeTuple, serialize_element);
match_sequence!(SerializeTupleStruct, serialize_field);
match_sequence!(SerializeTupleVariant, serialize_field);
impl serde::ser::SerializeMap for MatchMap<'_> {
    type Ok = ();
    type Error = serde_json::Error;
    fn serialize_key<T: Serialize + ?Sized>(&mut self, key: &T) -> Result<(), Self::Error> {
        if self.pending.is_some() {
            return Err(mismatch());
        }
        self.pending = Some(key.serialize(MatchKey(self.values))?);
        Ok(())
    }
    fn serialize_value<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        value.serialize(MatchValue(self.pending.take().ok_or_else(mismatch)?))?;
        self.entries += 1;
        Ok(())
    }
    fn end(self) -> Result<(), Self::Error> {
        if self.pending.is_none() && self.entries == self.values.len() {
            Ok(())
        } else {
            Err(mismatch())
        }
    }
}
macro_rules! match_struct {
    ($trait:ident) => {
        impl serde::ser::$trait for MatchMap<'_> {
            type Ok = ();
            type Error = serde_json::Error;
            fn serialize_field<T: Serialize + ?Sized>(
                &mut self,
                key: &'static str,
                value: &T,
            ) -> Result<(), Self::Error> {
                value.serialize(MatchValue(self.values.get(key).ok_or_else(mismatch)?))?;
                self.entries += 1;
                Ok(())
            }
            fn end(self) -> Result<(), Self::Error> {
                if self.entries == self.values.len() {
                    Ok(())
                } else {
                    Err(mismatch())
                }
            }
        }
    };
}
match_struct!(SerializeStruct);
match_struct!(SerializeStructVariant);
struct MatchKey<'a>(&'a serde_json::Map<String, Value>);
macro_rules! refuse_key {
    ($method:ident,$ty:ty) => {
        fn $method(self, _value: $ty) -> Result<Self::Ok, Self::Error> {
            Err(mismatch())
        }
    };
}
impl<'a> serde::Serializer for MatchKey<'a> {
    type Ok = &'a Value;
    type Error = serde_json::Error;
    type SerializeSeq = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeTuple = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeTupleStruct = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeTupleVariant = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeMap = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeStruct = serde::ser::Impossible<Self::Ok, Self::Error>;
    type SerializeStructVariant = serde::ser::Impossible<Self::Ok, Self::Error>;
    fn serialize_str(self, value: &str) -> Result<Self::Ok, Self::Error> {
        self.0.get(value).ok_or_else(mismatch)
    }
    fn serialize_char(self, value: char) -> Result<Self::Ok, Self::Error> {
        let mut s = [0u8; 4];
        self.serialize_str(value.encode_utf8(&mut s))
    }
    refuse_key!(serialize_bool, bool);
    refuse_key!(serialize_i8, i8);
    refuse_key!(serialize_i16, i16);
    refuse_key!(serialize_i32, i32);
    refuse_key!(serialize_i64, i64);
    refuse_key!(serialize_i128, i128);
    refuse_key!(serialize_u8, u8);
    refuse_key!(serialize_u16, u16);
    refuse_key!(serialize_u32, u32);
    refuse_key!(serialize_u64, u64);
    refuse_key!(serialize_u128, u128);
    refuse_key!(serialize_f32, f32);
    refuse_key!(serialize_f64, f64);
    refuse_key!(serialize_bytes, &[u8]);
    fn serialize_none(self) -> Result<Self::Ok, Self::Error> {
        Err(mismatch())
    }
    fn serialize_some<T: Serialize + ?Sized>(self, value: &T) -> Result<Self::Ok, Self::Error> {
        value.serialize(self)
    }
    fn serialize_unit(self) -> Result<Self::Ok, Self::Error> {
        Err(mismatch())
    }
    fn serialize_unit_struct(self, _name: &'static str) -> Result<Self::Ok, Self::Error> {
        Err(mismatch())
    }
    fn serialize_unit_variant(
        self,
        _name: &'static str,
        _index: u32,
        variant: &'static str,
    ) -> Result<Self::Ok, Self::Error> {
        self.serialize_str(variant)
    }
    fn serialize_newtype_struct<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        value: &T,
    ) -> Result<Self::Ok, Self::Error> {
        value.serialize(self)
    }
    fn serialize_newtype_variant<T: Serialize + ?Sized>(
        self,
        _name: &'static str,
        _index: u32,
        _variant: &'static str,
        _value: &T,
    ) -> Result<Self::Ok, Self::Error> {
        Err(mismatch())
    }
    fn serialize_seq(self, _len: Option<usize>) -> Result<Self::SerializeSeq, Self::Error> {
        Err(mismatch())
    }
    fn serialize_tuple(self, _len: usize) -> Result<Self::SerializeTuple, Self::Error> {
        Err(mismatch())
    }
    fn serialize_tuple_struct(
        self,
        _name: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeTupleStruct, Self::Error> {
        Err(mismatch())
    }
    fn serialize_tuple_variant(
        self,
        _name: &'static str,
        _index: u32,
        _variant: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeTupleVariant, Self::Error> {
        Err(mismatch())
    }
    fn serialize_map(self, _len: Option<usize>) -> Result<Self::SerializeMap, Self::Error> {
        Err(mismatch())
    }
    fn serialize_struct(
        self,
        _name: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeStruct, Self::Error> {
        Err(mismatch())
    }
    fn serialize_struct_variant(
        self,
        _name: &'static str,
        _index: u32,
        _variant: &'static str,
        _len: usize,
    ) -> Result<Self::SerializeStructVariant, Self::Error> {
        Err(mismatch())
    }
}

pub(super) fn borrowed_journal(document: &Document) -> Result<BTreeMap<&str, &Value>, String> {
    let mut rows = BTreeMap::new();
    for scene in &document.scenes {
        for raw in scene
            .presentation
            .as_ref()
            .and_then(|p| p.scene["procedural"]["operations"].as_array())
            .into_iter()
            .flatten()
        {
            let id = raw["envelope"]["operation_ref"]
                .as_str()
                .ok_or("Missing operation identity")?;
            if rows.insert(id, raw).is_some() {
                return Err("An operation journal identity occurs in multiple Scenes".into());
            }
        }
    }
    Ok(rows)
}
/// Identical receiving predicate shared with output_readings, with the full
/// native envelope compared against borrowed JSON instead of cloning material.
pub(super) fn first_valid_creation<'a>(
    document: &Document,
    procedure_ref: &str,
    contribution: &Value,
    runtime: &'a Runtime,
    journal: &BTreeMap<&str, &Value>,
) -> Result<Option<&'a Operation>, String> {
    let occurrence = retained_text(contribution, "occurrence_ref")?;
    let owned = retained_rows(contribution, "owned_addresses")?;
    for (id, raw) in journal {
        if runtime.restored.contains(*id)
            || runtime.qualified_operations.get(*id).map(String::as_str) != Some(procedure_ref)
        {
            continue;
        }
        let Some(op) = runtime.operations.get(*id) else {
            continue;
        };
        if raw["fingerprint"].as_str() != Some(op.fingerprint.as_str())
            || !matches_borrowed(&op.envelope, &raw["envelope"])
        {
            continue;
        }
        let scene_constructor = contribution["generated_basis"]["schema"] == "oi.journey-scene/v1";
        let constructed = !scene_constructor
            || op
                .envelope
                .changes
                .iter()
                .any(|c| matches!(c,Change::SceneCreate{scene_ref,..}if scene_ref==occurrence))
                && op.envelope.changes.iter().any(
                    |c| matches!(c,Change::SceneMaterialSet{scene_ref,..}if scene_ref==occurrence),
                );
        let original=op.envelope.changes.iter().any(|change|matches!(change,Change::SceneMaterialSet{presentation,..}if presentation.scene["procedural"]["contributions"].as_array().is_some_and(|rows|rows.iter().any(|row|row["contribution_ref"]==contribution["contribution_ref"]&&row["procedure_ref"]==procedure_ref&&["output_slot","subject_refs","occurrence_ref","owned_addresses"].iter().all(|key|row[*key]==contribution[*key])))));
        if op.envelope.expression_ref != document.expression_ref
            || op.status != Status::Applied
            || !op.envelope.output_readings.is_empty()
            || !op.applied_revision.is_some_and(|r| r <= document.revision)
            || !constructed
            || !original
        {
            continue;
        }
        let mut covered = true;
        for raw_address in owned {
            let address = Address::deserialize(raw_address).map_err(|e| e.to_string())?;
            if !op.targets.iter().any(|target| covers(target, &address)) {
                covered = false;
                break;
            }
        }
        if covered {
            return Ok(Some(op));
        }
    }
    Ok(None)
}
struct GeneratedBasis<'a>(&'a Value);
impl Serialize for GeneratedBasis<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let Some(object) = self.0.as_object() else {
            return self.0.serialize(serializer);
        };
        let mut map = serializer.serialize_map(Some(object.len()))?;
        for (key, value) in object {
            if key == "scene" && value.is_object() {
                map.serialize_entry(key, &WithoutProcedural(value))?;
            } else {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}
/// Compare the exact native generated basis with the retained reading while
/// borrowing all glyph material. Only the recursive procedural journal is omitted.
pub(crate) fn generated_basis_matches(generated: &Value, current: &Value) -> bool {
    GeneratedBasis(generated)
        .serialize(MatchValue(current))
        .is_ok()
}
#[derive(Serialize)]
struct SourceBasisRow<'a> {
    source_ref: &'a str,
    revision: &'a str,
}
struct SourceBasis<'a>(&'a [Value]);
impl Serialize for SourceBasis<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for source in self.0 {
            if source["availability"] != "available" {
                return Err(serde::ser::Error::custom(
                    "Retained output source is not currently available",
                ));
            }
            let row = SourceBasisRow {
                source_ref: source["ref"].as_str().ok_or_else(|| {
                    serde::ser::Error::custom("Missing retained source reference")
                })?,
                revision: source["revision"]
                    .as_str()
                    .ok_or_else(|| serde::ser::Error::custom("Missing retained source revision"))?,
            };
            serde::ser::SerializeSeq::serialize_element(&mut sequence, &row)?;
        }
        serde::ser::SerializeSeq::end(sequence)
    }
}
/// Serialize the full original typed source list without dropping availability,
/// changing order, or consulting the latest procedural definition. This is a
/// projection only: first_valid_creation supplies the native qualification.
pub(super) struct OriginSourceBasis<'a>(pub(super) &'a [ReadingRef]);
impl Serialize for OriginSourceBasis<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        super::super::readings(self.0).map_err(serde::ser::Error::custom)?;
        if self.0.is_empty()
            || self
                .0
                .iter()
                .any(|source| source.availability != super::super::Availability::Available)
        {
            return Err(serde::ser::Error::custom(
                "Original native output sources must all be available",
            ));
        }
        self.0.serialize(serializer)
    }
}

/// Exposed within the receiver solely for accounting tests. A missing creation
/// remains an unqualified lower bound; this projection cannot grant a receipt.
pub(super) struct OutputProjection<'a> {
    pub(super) document: &'a Document,
    pub(super) procedure: &'a Value,
    pub(super) contribution: &'a Value,
    pub(super) current_scene: Option<&'a crate::expression_scene::Presentation>,
    pub(super) current_other: Option<&'a Value>,
    pub(super) creation: Option<&'a Operation>,
}
impl Serialize for OutputProjection<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        const REPLACED: &[&str] = &[
            "authored_overrides",
            "schema",
            "native_owner",
            "expression_ref",
            "document_revision",
            "source_basis",
            "origin_source_basis",
            "generated_basis",
            "current_basis",
            "applied_operation",
        ];
        let object = self
            .contribution
            .as_object()
            .ok_or_else(|| serde::ser::Error::custom("Invalid contribution"))?;
        let retained_count = object
            .keys()
            .filter(|key| !REPLACED.contains(&key.as_str()))
            .count();
        let mut map = serializer.serialize_map(Some(
            retained_count + 7 + 2 * usize::from(self.creation.is_some()),
        ))?;
        for (key, value) in object {
            if !REPLACED.contains(&key.as_str()) {
                map.serialize_entry(key, value)?;
            }
        }
        map.serialize_entry("schema", "oi.expression-procedural-output-reading/v1")?;
        map.serialize_entry("native_owner", "oi.expression")?;
        map.serialize_entry("expression_ref", &self.document.expression_ref)?;
        map.serialize_entry("document_revision", &self.document.revision)?;
        let sources = self.procedure["source_basis"]
            .as_array()
            .ok_or_else(|| serde::ser::Error::custom("Missing retained source basis"))?;
        map.serialize_entry("source_basis", &SourceBasis(sources))?;
        map.serialize_entry(
            "generated_basis",
            &GeneratedBasis(&self.contribution["generated_basis"]),
        )?;
        if let Some(scene) = self.current_scene {
            map.serialize_entry("current_basis", &Material(scene))?;
        } else {
            map.serialize_entry(
                "current_basis",
                self.current_other
                    .ok_or_else(|| serde::ser::Error::custom("Missing current native output"))?,
            )?;
        }
        if let Some(creation) = self.creation {
            map.serialize_entry(
                "origin_source_basis",
                &OriginSourceBasis(&creation.envelope.sources),
            )?;
            map.serialize_entry("applied_operation", creation)?;
        }
        map.end()
    }
}
pub(super) fn preflight_source_outputs(
    document: &Document,
    procedure_ref: &str,
    runtime: &Runtime,
) -> Result<(), String> {
    let mut budget = Budget::new();
    preflight_source_outputs_into(document, procedure_ref, runtime, &mut budget)
}
pub(super) fn preflight_source_outputs_into(
    document: &Document,
    procedure_ref: &str,
    runtime: &Runtime,
    budget: &mut Budget,
) -> Result<(), String> {
    // One work wrapper plus the output array delimiters; each row is measured
    // exactly, including its selected original native receipt only once.
    budget.reserve(4098)?;
    let journal = borrowed_journal(document)?;
    let mut seen = BTreeSet::new();
    for scene in &document.scenes {
        let Some(presentation) = &scene.presentation else {
            continue;
        };
        let retained = &presentation.scene["procedural"];
        if !retained["procedures"]
            .as_array()
            .is_some_and(|rows| rows.iter().any(|p| p["procedure_ref"] == procedure_ref))
        {
            continue;
        }
        for contribution in retained_rows(retained, "contributions")?
            .iter()
            .filter(|c| c["procedure_ref"] == procedure_ref && c["status"] == "active")
        {
            seen.insert(retained_text(contribution, "contribution_ref")?);
            if seen.len() > MAX_TARGETS {
                return Err(
                    "Retained output reading cardinality exceeded before allocation".into(),
                );
            }
        }
    }
    seen.clear();
    for scene in &document.scenes {
        let Some(presentation) = &scene.presentation else {
            continue;
        };
        let retained = &presentation.scene["procedural"];
        let Some(procedure) = retained["procedures"]
            .as_array()
            .and_then(|rows| rows.iter().find(|p| p["procedure_ref"] == procedure_ref))
        else {
            continue;
        };
        for contribution in retained_rows(retained, "contributions")?
            .iter()
            .filter(|c| c["procedure_ref"] == procedure_ref && c["status"] == "active")
        {
            let reference = retained_text(contribution, "contribution_ref")?;
            if !seen.insert(reference) {
                continue;
            }
            if seen.len() > MAX_TARGETS {
                return Err(
                    "Retained output reading cardinality exceeded before allocation".into(),
                );
            }
            budget.reserve(1)?;
            let creation =
                first_valid_creation(document, procedure_ref, contribution, runtime, &journal)?;
            let scene_constructor =
                contribution["generated_basis"]["schema"] == "oi.journey-scene/v1";
            let actual_scene = if scene_constructor {
                let occurrence = retained_text(contribution, "occurrence_ref")?;
                Some(
                    document
                        .scenes
                        .iter()
                        .find(|s| s.scene_ref == occurrence)
                        .and_then(|s| s.presentation.as_ref())
                        .ok_or("Actual generated Scene unavailable")?,
                )
            } else {
                None
            };
            let current_other = if scene_constructor {
                None
            } else {
                Some(source_current_output_basis(document, contribution)?)
            };
            budget.value(&OutputProjection {
                document,
                procedure,
                contribution,
                current_scene: actual_scene,
                current_other: current_other.as_ref(),
                creation,
            })?;
        }
    }
    Ok(())
}
