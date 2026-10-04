//! Private process resource accounting. A reservation outlives retired owners,
//! owns no Source or receiver authority, and cannot be imported or cloned.
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Debug, Default)]
struct State {
    next: u64,
    bytes: usize,
    live: BTreeMap<u64, usize>,
}
#[derive(Debug, Default)]
pub(super) struct Registry {
    state: Mutex<State>,
}
#[derive(Debug)]
pub(super) struct Reservation {
    registry: Arc<Registry>,
    id: u64,
    bytes: usize,
}
impl Registry {
    pub(super) fn shared() -> Arc<Self> {
        static SHARED: OnceLock<Arc<Registry>> = OnceLock::new();
        Arc::clone(SHARED.get_or_init(|| Arc::new(Registry::default())))
    }
    pub(super) fn charge(
        &self,
        budget: &mut crate::expression::procedural::budget::Budget,
        excluding: Option<&Reservation>,
    ) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|_| "Native capture accounting unavailable")?;
        let excluded = excluding
            .filter(|reservation| std::ptr::eq(self, reservation.registry.as_ref()))
            .and_then(|reservation| state.live.get(&reservation.id))
            .copied()
            .unwrap_or(0);
        budget.reserve(
            state
                .bytes
                .checked_sub(excluded)
                .ok_or("Native capture accounting inconsistent")?,
        )
    }
    pub(super) fn live(&self, id: Option<u64>) -> Result<bool, String> {
        let Some(id) = id else {
            return Ok(false);
        };
        let state = self
            .state
            .lock()
            .map_err(|_| "Native capture accounting unavailable")?;
        Ok(state.live.contains_key(&id))
    }
    pub(super) fn reserve(
        self: &Arc<Self>,
        bytes: usize,
        retained_bytes: usize,
    ) -> Result<Reservation, String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Native capture accounting unavailable")?;
        let total = state
            .bytes
            .checked_add(bytes)
            .ok_or("Native capture byte accounting overflow")?;
        if state.live.len() >= super::MAX_MEMOS
            || total
                .checked_add(retained_bytes)
                .is_none_or(|total| total > super::COMPILER_BYTES)
        {
            return Err("Native process capture budget exceeded before allocation; settle the original worker".into());
        }
        let id = state
            .next
            .checked_add(1)
            .ok_or("Native capture reservation sequence exhausted")?;
        state.next = id;
        state.bytes = total;
        state.live.insert(id, bytes);
        Ok(Reservation {
            registry: Arc::clone(self),
            id,
            bytes,
        })
    }
}
impl Reservation {
    pub(super) fn id(&self) -> u64 {
        self.id
    }
    /// Reserve necessary completion copies before allocating them, without a
    /// second job/count slot or any Source authority. Never shrink while live.
    pub(super) fn extend(
        &mut self,
        additional: usize,
        retained_bytes: usize,
    ) -> Result<(), String> {
        let mut state = self
            .registry
            .state
            .lock()
            .map_err(|_| "Native capture accounting unavailable")?;
        if state.live.get(&self.id) != Some(&self.bytes) {
            return Err("Original native capture reservation differs from its live charge".into());
        }
        let total = state
            .bytes
            .checked_add(additional)
            .ok_or("Native capture byte accounting overflow")?;
        let capacity = self
            .bytes
            .checked_add(additional)
            .ok_or("Native capture reservation byte accounting overflow")?;
        if total
            .checked_add(retained_bytes)
            .is_none_or(|total| total > super::COMPILER_BYTES)
        {
            return Err("Native completion capture budget exceeded before admission copy".into());
        }
        state.bytes = total;
        state.live.insert(self.id, capacity);
        self.bytes = capacity;
        Ok(())
    }
    pub(super) fn require(&self, registry: &Arc<Registry>, bytes: usize) -> Result<(), String> {
        if !Arc::ptr_eq(registry, &self.registry)
            || bytes > self.bytes
            || !registry.live(Some(self.id))?
        {
            return Err(
                "Original native capture has no matching live private resource reservation".into(),
            );
        }
        Ok(())
    }
}
impl Drop for Reservation {
    fn drop(&mut self) {
        // No authority is restored, including when the original owner is gone.
        // Recover the resource ledger from poison solely to release owned bytes.
        let mut state = self
            .registry
            .state
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if let Some(bytes) = state.live.remove(&self.id) {
            state.bytes = state
                .bytes
                .checked_sub(bytes)
                .expect("private capture accounting invariant");
        }
    }
}
