//! The canonical Context Frame composition lock (#268): one containing
//! material frame (CF5) and six installation forms.
//!
//! CF5 — `4.0/1–4.4/5` — is THE material nesting frame in which the other
//! six are situated. The machine or material environment is already the
//! condition of every installation, whether two products, the Desktop, a
//! remote client or the whole suite is present. CF5 is NOT the tier obtained
//! when all six product packages happen to be installed, and the material
//! relation is never omitted merely because Workcell management packages are
//! absent.
//!
//! The six installation forms are characteristic ways of adopting the
//! system, not ascending editions. All-products deployment remains a valid
//! composition inside CF5; it is not itself one of the six forms and no
//! eighth frame exists. Canonical lock:
//! `docs/CONTEXT-FRAME-COMPOSITION-LOCK.md`.

use serde::{Deserialize, Serialize};

/// The containing material frame: always applicable, independent of which
/// products are installed.
pub const CONTAINING_FRAME: &str = "cf5";

/// The Workcell-internal notation situating the six products inside CF5.
/// Not an instruction to install "product 5".
pub const CONTAINING_FRAME_NOTATION: &str = "4.0/1–4.4/5";

/// One characteristic installation form. `products` lists the canonical
/// positions of the form's characteristic composition, or `None` when the
/// form is not derivable from six-product presence alone (CF1 is
/// Desktop-mediated and recognised through the Desktop/backing seam).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstallationForm {
    pub id: &'static str,
    pub notation: &'static str,
    pub name: &'static str,
    pub products: Option<&'static [u8]>,
}

/// The six characteristic installation forms (#268). CF1 is included for
/// catalogue completeness; presence-derived recognition never names it.
pub const INSTALLATION_FORMS: [InstallationForm; 6] = [
    InstallationForm {
        id: "cf1",
        notation: "00/00",
        name: "Desktop / integrated encounter",
        products: None,
    },
    InstallationForm {
        id: "cf2",
        notation: "0/1",
        name: "Central + Actuation",
        products: Some(&[0, 1]),
    },
    InstallationForm {
        id: "cf3",
        notation: "0/1/2",
        name: "Central + Actuation + AIKit",
        products: Some(&[0, 1, 2]),
    },
    InstallationForm {
        id: "cf4",
        notation: "0/1/2/3",
        name: "Central + Actuation + AIKit + Software Factory",
        products: Some(&[0, 1, 2, 3]),
    },
    InstallationForm {
        id: "cf6",
        notation: "4.5/0",
        name: "Central + minimal Workcell client/connectivity",
        products: Some(&[0, 4]),
    },
    InstallationForm {
        id: "cf7",
        notation: "5/0",
        name: "Central + Quaternal Logic",
        products: Some(&[0, 5]),
    },
];

/// Name the installation form whose characteristic composition exactly
/// matches the present positions. Arbitrary selections — including
/// all-products and supersets or mixtures of the characteristic
/// compositions — return `None`: they are disclosed as what they are,
/// never forced into a false canonical frame.
pub fn installation_form_for(present_positions: &[u8]) -> Option<&'static InstallationForm> {
    INSTALLATION_FORMS.iter().find(|form| {
        form.products
            .is_some_and(|products| products == present_positions)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn characteristic_compositions_recognise_exactly() {
        let cases = [
            (&[0u8, 1][..], "cf2"),
            (&[0, 1, 2][..], "cf3"),
            (&[0, 1, 2, 3][..], "cf4"),
            (&[0, 4][..], "cf6"),
            (&[0, 5][..], "cf7"),
        ];
        for (positions, expected) in cases {
            assert_eq!(
                installation_form_for(positions).map(|form| form.id),
                Some(expected),
                "{positions:?}"
            );
        }
    }

    #[test]
    fn non_compositions_are_not_forced_into_a_form() {
        // All-products is a deployment inside CF5, not one of the six forms.
        assert_eq!(installation_form_for(&[0, 1, 2, 3, 4, 5]), None);
        // Central alone, CF6 plus local QL, Desktop-less mixtures: explicit
        // selections stay exactly what they are.
        assert_eq!(installation_form_for(&[]), None);
        assert_eq!(installation_form_for(&[0]), None);
        assert_eq!(installation_form_for(&[0, 4, 5]), None);
        assert_eq!(installation_form_for(&[1, 2]), None);
    }

    #[test]
    fn cf6_and_cf7_carry_no_hidden_stack_requirements() {
        // The CF6 client form's closure is Central + Workcell only: no
        // Actuation, AIKit, Factory or QL. The CF7 learning form's closure
        // is Central + QL only: no agent-development stack.
        let cf6 = installation_form_for(&[0, 4]).unwrap();
        assert_eq!(cf6.products, Some(&[0u8, 4][..]));
        let cf7 = installation_form_for(&[0, 5]).unwrap();
        assert_eq!(cf7.products, Some(&[0u8, 5][..]));
    }

    #[test]
    fn every_form_id_is_unique_and_canonical() {
        let mut ids = INSTALLATION_FORMS.map(|form| form.id).to_vec();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), INSTALLATION_FORMS.len());
        for form in INSTALLATION_FORMS {
            assert!(form.id.starts_with("cf"), "{}", form.id);
            assert!(!form.name.is_empty());
            assert!(!form.notation.is_empty());
        }
    }
}
