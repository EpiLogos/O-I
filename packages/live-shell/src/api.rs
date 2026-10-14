//! The seam's JSON contract. The handler bodies live in `live_set::api`, shared
//! with the kernel's Live ops (desktop/cradle/kernel/src/live_set_owner.rs) and
//! the native host; this module keeps the server's and the native host's
//! `api::` paths. Each response is plain serde_json, the stable M2/M3 contract.
pub use live_set::api::*;
