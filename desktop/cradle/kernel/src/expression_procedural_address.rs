//! Borrow the existing native addressed root before aggregate Source admission.
//! Scope and layer canonicalization remain in the parent owner. The owned
//! getter serializes this same root after admission; this child stores no copy.
use super::*;
use serde::ser::{
    SerializeMap, SerializeSeq, SerializeStruct, SerializeStructVariant, SerializeTuple,
    SerializeTupleStruct, SerializeTupleVariant,
};
use std::io::{self, Write};

pub(super) enum NativeRoot<'a> {
    Value(&'a Value),
    SharedValue(&'a Value),
    Document(&'a Document),
    Scene(&'a super::super::Scene),
    Entity(&'a super::super::Entity),
    Parameters(&'a BTreeMap<String, super::super::Parameter>),
}
impl Serialize for NativeRoot<'_> {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Value(v) | Self::SharedValue(v) => v.serialize(serializer),
            Self::Document(v) => v.serialize(serializer),
            Self::Scene(v) => v.serialize(serializer),
            Self::Entity(v) => v.serialize(serializer),
            Self::Parameters(v) => v.serialize(serializer),
        }
    }
}
pub(super) struct BorrowedAddress<'a> {
    root: NativeRoot<'a>,
    property: Option<&'a str>,
}
impl<'a> BorrowedAddress<'a> {
    pub(super) fn validate(&self) -> Result<(), String> {
        match &self.root {
            NativeRoot::SharedValue(_) => Ok(()),
            NativeRoot::Value(value) => {
                if value.is_null() {
                    return Err("This component is unavailable".into());
                }
                if let Some(property) = self.property {
                    path(value, property)?;
                }
                Ok(())
            }
            _ => {
                let tokens = self
                    .property
                    .map(|p| p.split('.').collect::<Vec<_>>())
                    .unwrap_or_default();
                if self
                    .root
                    .serialize(PathProbe(&tokens))
                    .map_err(|e| e.to_string())?
                {
                    Ok(())
                } else {
                    Err(format!(
                        "Property {} is unavailable",
                        self.property.unwrap_or_default()
                    ))
                }
            }
        }
    }
    pub(super) fn to_owned(&self) -> Result<Value, String> {
        self.validate()?;
        if let NativeRoot::Value(value) | NativeRoot::SharedValue(value) = &self.root {
            return Ok(match self.property {
                Some(property) => path(value, property)?,
                None => value,
            }
            .clone());
        }
        let value = serde_json::to_value(&self.root).map_err(|e| e.to_string())?;
        match self.property {
            Some(property) => Ok(path(&value, property)?.clone()),
            None => Ok(value),
        }
    }
    #[cfg(test)]
    fn borrowed_value(&self) -> Option<&'a Value> {
        match &self.root {
            NativeRoot::Value(value) | NativeRoot::SharedValue(value) => match self.property {
                Some(p) => path(value, p).ok(),
                None => Some(value),
            },
            _ => None,
        }
    }
}

pub(super) fn root<'a>(
    document: &'a Document,
    address: &'a Address,
) -> Result<BorrowedAddress<'a>, String> {
    retained_address(&serde_json::to_value(address).map_err(|e| e.to_string())?)?;
    if address.expression_ref != document.expression_ref {
        return Err("Wrong Expression subject".into());
    }
    if address.component == Component::Expression {
        if let Some(property) = &address.property {
            for bucket in ["values", "pointer"] {
                if let Some(key) = property.strip_prefix(&format!("shared.{bucket}.")) {
                    retained_address(&serde_json::to_value(address).map_err(|e| e.to_string())?)?;
                    let p = document
                        .presentation
                        .as_ref()
                        .ok_or("Expression has no authored composition")?;
                    let value = p
                        .shared
                        .as_ref()
                        .ok_or("Expression has no shared properties")?[bucket]
                        .get(key)
                        .ok_or("Shared registry property has no authored override")?;
                    return Ok(BorrowedAddress {
                        root: NativeRoot::SharedValue(value),
                        property: None,
                    });
                }
            }
        }
    }
    let root = if address.component == Component::Expression {
        if address.scene_ref.is_some()
            || address.entity_ref.is_some()
            || address.constituent_ref.is_some()
        {
            return Err("Expression scope has constituent refs".into());
        }
        NativeRoot::Document(document)
    } else {
        let scene = document
            .scenes
            .iter()
            .find(|s| Some(&s.scene_ref) == address.scene_ref.as_ref())
            .ok_or("Unknown Scene address")?;
        if matches!(address.component, Component::Scene | Component::Field)
            && (address.entity_ref.is_some() || address.constituent_ref.is_some())
        {
            return Err("Scene/field address has unrelated constituent refs".into());
        }
        if !matches!(
            address.component,
            Component::Layer | Component::SequenceLink | Component::Driver
        ) && address.constituent_ref.is_some()
        {
            return Err("Component does not have a constituent ref".into());
        }
        match address.component {
            Component::Scene => NativeRoot::Scene(scene),
            Component::Field => NativeRoot::Value(
                &scene
                    .presentation
                    .as_ref()
                    .ok_or("Scene has no authored material")?
                    .scene["field"],
            ),
            Component::Property if address.entity_ref.is_none() => NativeRoot::Value(
                &scene
                    .presentation
                    .as_ref()
                    .ok_or("Scene has no authored material")?
                    .scene,
            ),
            Component::Driver => {
                let controls = scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene["procedural"]["controls"].as_array())
                    .ok_or("Scene has no retained drivers")?;
                let reference = address
                    .constituent_ref
                    .as_deref()
                    .ok_or("Driver needs its stable control target ref")?;
                NativeRoot::Value(
                    controls
                        .iter()
                        .find(|c| {
                            c["target"].as_str() == Some(reference)
                                && c["address"]["entity_ref"].as_str()
                                    == address.entity_ref.as_deref()
                        })
                        .ok_or("Unknown named driver")?,
                )
            }
            _ => {
                let reference = address
                    .entity_ref
                    .as_ref()
                    .ok_or("Constituent needs a stable entity ref")?;
                if !scene.entity_refs.contains(reference) {
                    return Err("Occurrence is not in this Scene".into());
                }
                let native = document
                    .entities
                    .get(reference)
                    .ok_or("Unknown entity occurrence")?;
                let material = scene
                    .presentation
                    .as_ref()
                    .and_then(|p| p.scene["entities"].as_array())
                    .and_then(|entities| {
                        entities
                            .iter()
                            .find(|e| e["id"].as_str() == Some(reference))
                    });
                match address.component {
                    Component::Entity => match material {
                        Some(material) => NativeRoot::Value(material),
                        None => NativeRoot::Entity(native),
                    },
                    Component::Force => {
                        let root = material.ok_or("Occurrence has no material")?;
                        NativeRoot::Value(
                            root.get("force")
                                .or_else(|| root.get("forces"))
                                .or_else(|| root["native"].get("forces"))
                                .ok_or("Force is unavailable")?,
                        )
                    }
                    Component::Sequence => {
                        let root = material.ok_or("Occurrence has no material")?;
                        NativeRoot::Value(
                            root.get("sequence")
                                .or_else(|| root["native"].get("sequence"))
                                .ok_or("Sequence is unavailable")?,
                        )
                    }
                    Component::Layer => {
                        let root = material.ok_or("Occurrence has no material")?;
                        let matches = layer_locations(root, address);
                        if address.parent_ref.is_none()
                            && matches
                                .iter()
                                .map(|(parent, _)| parent)
                                .collect::<BTreeSet<_>>()
                                .len()
                                > 1
                        {
                            return Err("Legacy Layer address has multiple containing coordinates; select its base or exact state".into());
                        }
                        let (_, found) = matches
                            .first()
                            .ok_or("Unknown stable layer or containing state")?;
                        if matches.iter().any(|(_, row)| *row != *found) {
                            return Err("Ambiguous native/authoring layer projection".into());
                        }
                        NativeRoot::Value(found)
                    }
                    Component::SequenceLink => {
                        let root = material.ok_or("Occurrence has no material")?;
                        let matches: Vec<_> = [
                            &root["sequence"]["steps"],
                            &root["sequence"]["links"],
                            &root["native"]["sequence"]["links"],
                        ]
                        .into_iter()
                        .filter_map(Value::as_array)
                        .flatten()
                        .filter(|row| row["id"].as_str() == address.constituent_ref.as_deref())
                        .collect();
                        let found = matches.first().ok_or("Unknown stable sequence-link ref")?;
                        if matches.iter().any(|row| *row != *found) {
                            return Err("Ambiguous native/authoring sequence projection".into());
                        }
                        NativeRoot::Value(found)
                    }
                    Component::Property => NativeRoot::Parameters(&native.parameters),
                    _ => return Err("Unsupported component address".into()),
                }
            }
        }
    };
    Ok(BorrowedAddress {
        root,
        property: address.property.as_deref(),
    })
}

// Inspect the real serde field layout without building a Value or serializing
// unrelated values. This preserves skip_serializing_if and typed-only paths.
// Address grammar excludes array indices, so sequences never have child paths.
struct PathProbe<'a>(&'a [&'a str]);
struct ProbeMap<'a> {
    path: &'a [&'a str],
    found: bool,
    selected: bool,
    active: bool,
}
impl<'a> ProbeMap<'a> {
    fn new(path: &'a [&'a str], active: bool) -> Self {
        Self {
            path,
            found: active && path.is_empty(),
            selected: false,
            active,
        }
    }
    fn field<T: Serialize + ?Sized>(
        &mut self,
        key: &str,
        value: &T,
    ) -> Result<(), serde_json::Error> {
        if self.active && self.path.first().copied() == Some(key) {
            self.found = value.serialize(PathProbe(&self.path[1..]))?;
        }
        Ok(())
    }
}
struct ProbeSequence(bool);
impl<'a> serde::Serializer for PathProbe<'a> {
    type Ok = bool;
    type Error = serde_json::Error;
    type SerializeSeq = ProbeSequence;
    type SerializeTuple = ProbeSequence;
    type SerializeTupleStruct = ProbeSequence;
    type SerializeTupleVariant = ProbeSequence;
    type SerializeMap = ProbeMap<'a>;
    type SerializeStruct = ProbeMap<'a>;
    type SerializeStructVariant = ProbeMap<'a>;
    fn serialize_bool(self, _: bool) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_i8(self, _: i8) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_i16(self, _: i16) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_i32(self, _: i32) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_i64(self, _: i64) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_u8(self, _: u8) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_u16(self, _: u16) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_u32(self, _: u32) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_u64(self, _: u64) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_f32(self, _: f32) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_f64(self, _: f64) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_char(self, _: char) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_str(self, _: &str) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_bytes(self, _: &[u8]) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_none(self) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_some<T: Serialize + ?Sized>(self, value: &T) -> Result<bool, Self::Error> {
        if self.0.is_empty() {
            Ok(true)
        } else {
            value.serialize(self)
        }
    }
    fn serialize_unit(self) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_unit_struct(self, _: &'static str) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_unit_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
    ) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn serialize_newtype_struct<T: Serialize + ?Sized>(
        self,
        _: &'static str,
        value: &T,
    ) -> Result<bool, Self::Error> {
        if self.0.is_empty() {
            Ok(true)
        } else {
            value.serialize(self)
        }
    }
    fn serialize_newtype_variant<T: Serialize + ?Sized>(
        self,
        _: &'static str,
        _: u32,
        variant: &'static str,
        value: &T,
    ) -> Result<bool, Self::Error> {
        if self.0.is_empty() {
            return Ok(true);
        }
        if self.0[0] == variant {
            value.serialize(PathProbe(&self.0[1..]))
        } else {
            Ok(false)
        }
    }
    fn serialize_seq(self, _: Option<usize>) -> Result<ProbeSequence, Self::Error> {
        Ok(ProbeSequence(self.0.is_empty()))
    }
    fn serialize_tuple(self, _: usize) -> Result<ProbeSequence, Self::Error> {
        Ok(ProbeSequence(self.0.is_empty()))
    }
    fn serialize_tuple_struct(
        self,
        _: &'static str,
        _: usize,
    ) -> Result<ProbeSequence, Self::Error> {
        Ok(ProbeSequence(self.0.is_empty()))
    }
    fn serialize_tuple_variant(
        self,
        _: &'static str,
        _: u32,
        variant: &'static str,
        _: usize,
    ) -> Result<ProbeSequence, Self::Error> {
        Ok(ProbeSequence(
            self.0.is_empty() || self.0.len() == 1 && self.0[0] == variant,
        ))
    }
    fn serialize_map(self, _: Option<usize>) -> Result<ProbeMap<'a>, Self::Error> {
        Ok(ProbeMap::new(self.0, true))
    }
    fn serialize_struct(self, _: &'static str, _: usize) -> Result<ProbeMap<'a>, Self::Error> {
        Ok(ProbeMap::new(self.0, true))
    }
    fn serialize_struct_variant(
        self,
        _: &'static str,
        _: u32,
        variant: &'static str,
        _: usize,
    ) -> Result<ProbeMap<'a>, Self::Error> {
        if self.0.is_empty() {
            return Ok(ProbeMap::new(self.0, true));
        }
        Ok(ProbeMap::new(&self.0[1..], self.0[0] == variant))
    }
    fn collect_str<T: std::fmt::Display + ?Sized>(self, _: &T) -> Result<bool, Self::Error> {
        Ok(self.0.is_empty())
    }
    fn is_human_readable(&self) -> bool {
        true
    }
}
// Compare only a map key's encoded bytes. No serialized key or material buffer
// is allocated; the selected, bounded address token supplies the sole buffer.
struct KeyMatch<'a> {
    expected: &'a [u8],
    written: usize,
    equal: bool,
}
impl Write for KeyMatch<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let end = self.written.saturating_add(bytes.len());
        self.equal &= self.expected.get(self.written..end) == Some(bytes);
        self.written = end;
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
impl SerializeMap for ProbeMap<'_> {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_key<T: Serialize + ?Sized>(&mut self, key: &T) -> Result<(), Self::Error> {
        self.selected = false;
        if self.active {
            if let Some(token) = self.path.first() {
                let expected = serde_json::to_vec(token)?;
                let mut writer = KeyMatch {
                    expected: &expected,
                    written: 0,
                    equal: true,
                };
                serde_json::to_writer(&mut writer, key)?;
                self.selected = writer.equal && writer.written == expected.len();
            }
        }
        Ok(())
    }
    fn serialize_value<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), Self::Error> {
        if self.selected {
            self.found = value.serialize(PathProbe(&self.path[1..]))?;
        }
        self.selected = false;
        Ok(())
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.found)
    }
}
impl SerializeStruct for ProbeMap<'_> {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_field<T: Serialize + ?Sized>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        self.field(key, value)
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.found)
    }
}
impl SerializeStructVariant for ProbeMap<'_> {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_field<T: Serialize + ?Sized>(
        &mut self,
        key: &'static str,
        value: &T,
    ) -> Result<(), Self::Error> {
        self.field(key, value)
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.found)
    }
}
impl SerializeSeq for ProbeSequence {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_element<T: Serialize + ?Sized>(&mut self, _: &T) -> Result<(), Self::Error> {
        Ok(())
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.0)
    }
}
impl SerializeTuple for ProbeSequence {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_element<T: Serialize + ?Sized>(&mut self, _: &T) -> Result<(), Self::Error> {
        Ok(())
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.0)
    }
}
impl SerializeTupleStruct for ProbeSequence {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_field<T: Serialize + ?Sized>(&mut self, _: &T) -> Result<(), Self::Error> {
        Ok(())
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.0)
    }
}
impl SerializeTupleVariant for ProbeSequence {
    type Ok = bool;
    type Error = serde_json::Error;
    fn serialize_field<T: Serialize + ?Sized>(&mut self, _: &T) -> Result<(), Self::Error> {
        Ok(())
    }
    fn end(self) -> Result<bool, Self::Error> {
        Ok(self.0)
    }
}

#[cfg(test)]
#[path = "expression_procedural_address_tests.rs"]
mod tests;
