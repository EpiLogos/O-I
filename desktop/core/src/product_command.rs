use oi_cli::product_command::{product_command_catalogue, ProductCommandDescriptor};
use serde::Serialize;

pub const PRODUCT_COMMAND_READING_SCHEMA: &str = "oi.desktop-product-command-reading/v1";

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ProductCommandReading {
    pub schema: &'static str,
    pub verified_at: String,
    pub products: Vec<ProductCommandDescriptor>,
}

/// Read the same O:I-owned six-product command catalogue used by the `oi` binary.
/// The desktop can project these executable/probe facts into Command/System UI
/// without maintaining a second product command registry.
pub fn product_command_reading() -> Result<ProductCommandReading, String> {
    let catalogue = product_command_catalogue()?;
    Ok(ProductCommandReading {
        schema: PRODUCT_COMMAND_READING_SCHEMA,
        verified_at: catalogue.verified_at,
        products: catalogue.products,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_reads_the_same_six_canonical_namespaces_as_oi_cli() {
        let reading = product_command_reading().unwrap();
        assert_eq!(reading.products.len(), 6);
        assert_eq!(
            reading
                .products
                .iter()
                .map(|product| product.namespace.as_str())
                .collect::<Vec<_>>(),
            vec!["central", "actuation", "aikit", "factory", "workcell", "ql"]
        );
        assert_eq!(reading.products[0].aliases, vec!["ctrl"]);
        assert_eq!(reading.products[2].aliases, vec!["kit"]);
    }
}
