//! A bounded single-producer / single-consumer ring for `Copy` values —
//! the engine's only crossing between the control side (the host's
//! threads) and the audio callback.
//!
//! The realtime law (DLW TRACKER "The musical law": the realtime path takes
//! no allocation, no blocking lock and no UI work) is why this exists
//! rather than a `Mutex<Vec<_>>`: the slots are allocated once, at
//! [`ring`]; [`Producer::push`] and [`Consumer::pop`] are wait-free (two
//! atomic loads, one copy, one atomic store) and never allocate. A full
//! ring refuses the value back to the producer; nothing blocks.
//!
//! The split into a non-`Clone` [`Producer`] and a non-`Clone`
//! [`Consumer`] is what makes the single-producer / single-consumer
//! contract hold: each side can be owned by exactly one thread, and both
//! take `&mut self`. This is the classic Lamport queue: the producer owns
//! `head`, the consumer owns `tail`, and a slot is only ever written by
//! the producer while it is outside `[tail, head)` and only read by the
//! consumer while it is inside.

use std::cell::UnsafeCell;
use std::mem::MaybeUninit;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

struct Ring<T> {
    slots: Box<[UnsafeCell<MaybeUninit<T>>]>,
    /// Next slot the producer writes (monotone, wraps by modulo).
    head: AtomicUsize,
    /// Next slot the consumer reads (monotone, wraps by modulo).
    tail: AtomicUsize,
}

// SAFETY: a slot is written only by the single producer while it lies
// outside the consumer's readable window, and read only by the single
// consumer while it lies inside it; the Release store of `head` (after the
// write) and the Acquire load of it (before the read) order the two, and
// symmetrically for `tail`. `T: Copy` means no slot ever needs dropping.
unsafe impl<T: Copy + Send> Sync for Ring<T> {}

/// The writing end. Owned by one thread.
pub struct Producer<T> {
    ring: Arc<Ring<T>>,
}

/// The reading end. Owned by one thread.
pub struct Consumer<T> {
    ring: Arc<Ring<T>>,
}

/// A ring holding at most `capacity` values (at least one). The only
/// allocation the ring ever makes happens here.
pub fn ring<T: Copy + Send>(capacity: usize) -> (Producer<T>, Consumer<T>) {
    let capacity = capacity.max(1);
    let slots = (0..capacity)
        .map(|_| UnsafeCell::new(MaybeUninit::uninit()))
        .collect();
    let ring = Arc::new(Ring {
        slots,
        head: AtomicUsize::new(0),
        tail: AtomicUsize::new(0),
    });
    (
        Producer {
            ring: Arc::clone(&ring),
        },
        Consumer { ring },
    )
}

impl<T: Copy + Send> Producer<T> {
    /// Append `value`; a full ring hands it back. Wait-free, no allocation.
    pub fn push(&mut self, value: T) -> Result<(), T> {
        let r = &*self.ring;
        let head = r.head.load(Ordering::Relaxed);
        let tail = r.tail.load(Ordering::Acquire);
        if head.wrapping_sub(tail) >= r.slots.len() {
            return Err(value);
        }
        // SAFETY: `head` is outside [tail, head) — the consumer does not
        // read this slot until the Release store below publishes it.
        unsafe { (*r.slots[head % r.slots.len()].get()).write(value) };
        r.head.store(head.wrapping_add(1), Ordering::Release);
        Ok(())
    }

    /// How many more values fit right now.
    pub fn free(&self) -> usize {
        let r = &*self.ring;
        r.slots.len()
            - r.head
                .load(Ordering::Relaxed)
                .wrapping_sub(r.tail.load(Ordering::Acquire))
    }
}

impl<T: Copy + Send> Consumer<T> {
    /// Take the oldest value, if any. Wait-free, no allocation.
    pub fn pop(&mut self) -> Option<T> {
        let r = &*self.ring;
        let tail = r.tail.load(Ordering::Relaxed);
        let head = r.head.load(Ordering::Acquire);
        if tail == head {
            return None;
        }
        // SAFETY: `tail` is inside [tail, head): the producer wrote it and
        // published it with the Release store this Acquire load observed,
        // and will not overwrite it until the store below releases it.
        let value = unsafe { (*r.slots[tail % r.slots.len()].get()).assume_init() };
        r.tail.store(tail.wrapping_add(1), Ordering::Release);
        Some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn values_come_out_in_order_and_a_full_ring_refuses() {
        let (mut tx, mut rx) = ring::<u32>(3);
        assert_eq!(tx.free(), 3);
        assert!(tx.push(1).is_ok() && tx.push(2).is_ok() && tx.push(3).is_ok());
        assert_eq!(tx.push(4), Err(4), "a full ring hands the value back");
        assert_eq!(rx.pop(), Some(1));
        assert!(tx.push(4).is_ok(), "a popped slot is free again");
        assert_eq!(
            (rx.pop(), rx.pop(), rx.pop(), rx.pop()),
            (Some(2), Some(3), Some(4), None)
        );
    }

    #[test]
    fn indices_wrap_across_many_laps() {
        let (mut tx, mut rx) = ring::<u64>(4);
        for i in 0..10_000u64 {
            tx.push(i).unwrap();
            if i % 3 == 0 {
                tx.push(i + 1_000_000).unwrap();
                assert_eq!(rx.pop(), Some(i));
                assert_eq!(rx.pop(), Some(i + 1_000_000));
            } else {
                assert_eq!(rx.pop(), Some(i));
            }
        }
        assert_eq!(rx.pop(), None);
    }

    #[test]
    fn two_threads_see_every_value_once_in_order() {
        let (mut tx, mut rx) = ring::<u64>(64);
        let n = 200_000u64;
        let writer = std::thread::spawn(move || {
            let mut i = 0;
            while i < n {
                if tx.push(i).is_ok() {
                    i += 1;
                }
            }
        });
        let mut expect = 0;
        while expect < n {
            if let Some(v) = rx.pop() {
                assert_eq!(v, expect);
                expect += 1;
            }
        }
        writer.join().unwrap();
        assert_eq!(rx.pop(), None);
    }
}
