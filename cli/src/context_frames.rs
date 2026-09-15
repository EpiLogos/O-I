//! The canonical Context Frame composition lock (#268): one containing
//! material frame (CF5) and the six install modes it organises.
//!
//! CF5 — `4.0/1–4.4/5` — is THE material nesting frame in which every
//! installation is situated. The machine or material environment is already
//! the condition of every composition, whether two products, the Desktop, a
//! remote client or the whole suite is present. CF5 is NOT the tier obtained
//! when all six product packages happen to be installed, and the material
//! relation is never omitted merely because Workcell management packages are
//! absent.
//!
//! The **Context Frames organise the install modes; the modes do not define
//! the frames.** Each install mode is situated at a frame notation — `0/1`,
//! `0/1/2`, `4.5/0`, … — which is its canonical identity. The modes are
//! characteristic ways of adopting the system, not ascending editions.
//! All-products deployment remains a valid composition inside CF5; it is not
//! itself one of the modes and no eighth frame exists. Canonical lock:
//! `docs/CONTEXT-FRAME-COMPOSITION-LOCK.md`.

use serde::{Deserialize, Serialize};

/// The containing material frame: always applicable, independent of which
/// products are installed.
pub const CONTAINING_FRAME: &str = "cf5";

/// The Workcell-internal notation situating the six products inside CF5.
/// Not an instruction to install "product 5".
pub const CONTAINING_FRAME_NOTATION: &str = "4.0/1–4.4/5";

/// One install mode, situated at its frame notation. `products` lists the
/// canonical positions of the mode's characteristic composition, or `None`
/// when the mode is not derivable from six-product presence alone (the
/// Desktop mode is recognised through the Desktop/backing seam).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstallMode {
    /// The frame notation this mode is situated at — the canonical mode id.
    pub frame: &'static str,
    pub name: &'static str,
    pub products: Option<&'static [u8]>,
}

/// The six install modes (#268), organised by the Context Frames.
pub const INSTALL_MODES: [InstallMode; 6] = [
    InstallMode {
        frame: "00/00",
        name: "Desktop / integrated encounter",
        products: None,
    },
    InstallMode {
        frame: "0/1",
        name: "Central + Actuation",
        products: Some(&[0, 1]),
    },
    InstallMode {
        frame: "0/1/2",
        name: "Central + Actuation + AIKit",
        products: Some(&[0, 1, 2]),
    },
    InstallMode {
        frame: "0/1/2/3",
        name: "Central + Actuation + AIKit + Software Factory",
        products: Some(&[0, 1, 2, 3]),
    },
    InstallMode {
        frame: "4.5/0",
        name: "Central + minimal Workcell client/connectivity",
        products: Some(&[0, 4]),
    },
    InstallMode {
        frame: "5/0",
        name: "Central + Quaternal Logic",
        products: Some(&[0, 5]),
    },
];

/// Look up an install mode by its frame notation.
pub fn install_mode_by_frame(frame: &str) -> Option<&'static InstallMode> {
    INSTALL_MODES.iter().find(|mode| mode.frame == frame)
}

/// Name the install mode whose characteristic composition exactly matches
/// the present positions. Arbitrary selections — including all-products and
/// supersets or mixtures of the characteristic compositions — return
/// `None`: they are disclosed as what they are, never forced into a false
/// canonical mode.
pub fn install_mode_for(present_positions: &[u8]) -> Option<&'static InstallMode> {
    INSTALL_MODES.iter().find(|mode| {
        mode.products
            .is_some_and(|products| products == present_positions)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn characteristic_compositions_recognise_exactly() {
        let cases = [
            (&[0u8, 1][..], "0/1"),
            (&[0, 1, 2][..], "0/1/2"),
            (&[0, 1, 2, 3][..], "0/1/2/3"),
            (&[0, 4][..], "4.5/0"),
            (&[0, 5][..], "5/0"),
        ];
        for (positions, expected) in cases {
            assert_eq!(
                install_mode_for(positions).map(|mode| mode.frame),
                Some(expected),
                "{positions:?}"
            );
        }
    }

    #[test]
    fn non_compositions_are_not_forced_into_a_mode() {
        // All-products is a deployment inside CF5, not one of the six modes.
        assert_eq!(install_mode_for(&[0, 1, 2, 3, 4, 5]), None);
        // Central alone, client plus local QL, Desktop-less mixtures:
        // explicit selections stay exactly what they are.
        assert_eq!(install_mode_for(&[]), None);
        assert_eq!(install_mode_for(&[0]), None);
        assert_eq!(install_mode_for(&[0, 4, 5]), None);
        assert_eq!(install_mode_for(&[1, 2]), None);
    }

    #[test]
    fn client_and_learning_modes_carry_no_hidden_stack_requirements() {
        // The client mode's closure is Central + Workcell only: no
        // Actuation, AIKit, Factory or QL. The learning mode's closure is
        // Central + QL only: no agent-development stack.
        let client = install_mode_for(&[0, 4]).unwrap();
        assert_eq!(client.products, Some(&[0u8, 4][..]));
        let learning = install_mode_for(&[0, 5]).unwrap();
        assert_eq!(learning.products, Some(&[0u8, 5][..]));
    }

    #[test]
    fn every_mode_sits_at_a_unique_frame_notation() {
        let mut frames = INSTALL_MODES.map(|mode| mode.frame).to_vec();
        frames.sort_unstable();
        frames.dedup();
        assert_eq!(frames.len(), INSTALL_MODES.len());
        for mode in INSTALL_MODES {
            assert!(mode.frame.contains('/'), "{}", mode.frame);
            assert!(!mode.name.is_empty());
        }
    }
}
