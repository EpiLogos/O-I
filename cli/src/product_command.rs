use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const SURFACES_JSON: &str = include_str!("../../surfaces.json");
const EXPECTED_PRODUCT_COUNT: usize = 6;

#[derive(Debug, Clone, Deserialize)]
struct SurfaceCatalogSource {
    schema: u32,
    verified_at: String,
    surfaces: Vec<SurfaceSource>,
}

#[derive(Debug, Clone, Deserialize)]
struct SurfaceSource {
    id: String,
    public_name: String,
    native: NativeCommandSource,
    install: InstallSource,
}

#[derive(Debug, Clone, Deserialize)]
struct InstallSource {
    kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct NativeCommandSource {
    executable: Option<String>,
    #[serde(default)]
    alias: Option<String>,
    namespace: Option<String>,
    #[serde(default)]
    aliases: Vec<String>,
    version_command: Option<Vec<String>>,
    capability_command: Option<Vec<String>>,
    verification_command: Option<Vec<String>>,
    command_revision: Option<String>,
    command_standing: Option<String>,
    source_install: Option<SourceInstallSource>,
}

#[derive(Debug, Clone, Deserialize)]
struct SourceInstallSource {
    #[serde(default)]
    build: Vec<String>,
    executable_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SourceInstallDescriptor {
    pub build: Vec<String>,
    pub executable_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProductCommandDescriptor {
    pub id: String,
    pub public_name: String,
    pub namespace: String,
    pub executable: String,
    pub aliases: Vec<String>,
    pub version_command: Vec<String>,
    pub capability_command: Vec<String>,
    pub verification_command: Vec<String>,
    pub command_revision: String,
    pub command_standing: String,
    pub install_kind: String,
    pub source_install: SourceInstallDescriptor,
}

impl ProductCommandDescriptor {
    pub fn matches(&self, value: &str) -> bool {
        self.namespace == value || self.aliases.iter().any(|alias| alias == value)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ProductCommandCatalogue {
    pub schema: &'static str,
    pub verified_at: String,
    pub products: Vec<ProductCommandDescriptor>,
}

impl ProductCommandCatalogue {
    pub fn resolve(&self, value: &str) -> Option<&ProductCommandDescriptor> {
        self.products.iter().find(|product| product.matches(value))
    }
}

pub fn product_command_catalogue() -> Result<ProductCommandCatalogue, String> {
    let source: SurfaceCatalogSource = serde_json::from_str(SURFACES_JSON)
        .map_err(|error| format!("embedded O:I surface catalogue is invalid: {error}"))?;
    if source.schema != 1 {
        return Err(format!(
            "unsupported O:I surface catalogue schema {}",
            source.schema
        ));
    }
    if source.surfaces.len() != EXPECTED_PRODUCT_COUNT {
        return Err(format!(
            "O:I command catalogue requires exactly {EXPECTED_PRODUCT_COUNT} product surfaces; observed {}",
            source.surfaces.len()
        ));
    }

    let mut routes = HashSet::new();
    let mut products = Vec::with_capacity(source.surfaces.len());
    for surface in source.surfaces {
        let namespace = required(surface.native.namespace, &surface.id, "namespace")?;
        let executable = required(surface.native.executable, &surface.id, "executable")?;
        let version_command = required_vec(
            surface.native.version_command,
            &surface.id,
            "version_command",
        )?;
        let capability_command = required_vec(
            surface.native.capability_command,
            &surface.id,
            "capability_command",
        )?;
        let verification_command = required_vec(
            surface.native.verification_command,
            &surface.id,
            "verification_command",
        )?;
        let command_revision = required(
            surface.native.command_revision,
            &surface.id,
            "command_revision",
        )?;
        let command_standing = required(
            surface.native.command_standing,
            &surface.id,
            "command_standing",
        )?;
        let install_kind = required(surface.install.kind, &surface.id, "install.kind")?;
        let source_install = surface
            .native
            .source_install
            .ok_or_else(|| format!("{} is missing native.source_install", surface.id))?;
        let executable_path = required(
            source_install.executable_path,
            &surface.id,
            "source_install.executable_path",
        )?;
        if source_install
            .build
            .iter()
            .any(|argument| argument.trim().is_empty())
        {
            return Err(format!(
                "{} native.source_install.build contains an empty argument",
                surface.id
            ));
        }

        let mut aliases = surface.native.aliases;
        if let Some(legacy) = surface.native.alias {
            if legacy != namespace && !aliases.iter().any(|alias| alias == &legacy) {
                aliases.push(legacy);
            }
        }
        aliases.sort();
        aliases.dedup();

        for route in std::iter::once(namespace.as_str()).chain(aliases.iter().map(String::as_str)) {
            if route.is_empty() {
                return Err(format!(
                    "{} declares an empty O:I command route",
                    surface.id
                ));
            }
            if !routes.insert(route.to_owned()) {
                return Err(format!("O:I product command route collision: {route}"));
            }
        }

        products.push(ProductCommandDescriptor {
            id: surface.id,
            public_name: surface.public_name,
            namespace,
            executable,
            aliases,
            version_command,
            capability_command,
            verification_command,
            command_revision,
            command_standing,
            install_kind,
            source_install: SourceInstallDescriptor {
                build: source_install.build,
                executable_path,
            },
        });
    }

    Ok(ProductCommandCatalogue {
        schema: "oi.product-command-catalogue/v1",
        verified_at: source.verified_at,
        products,
    })
}

fn required(value: Option<String>, product: &str, field: &str) -> Result<String, String> {
    value
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("{product} is missing native.{field}"))
}

fn required_vec(
    value: Option<Vec<String>>,
    product: &str,
    field: &str,
) -> Result<Vec<String>, String> {
    value
        .filter(|items| !items.is_empty() && items.iter().all(|item| !item.trim().is_empty()))
        .ok_or_else(|| format!("{product} is missing native.{field}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalogue_is_complete_and_sixfold() {
        let catalogue = product_command_catalogue().unwrap();
        assert_eq!(catalogue.products.len(), 6);
        let namespaces = catalogue
            .products
            .iter()
            .map(|product| product.namespace.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            namespaces,
            vec!["central", "actuation", "aikit", "factory", "workcell", "ql"]
        );
        assert!(catalogue.products.iter().all(|product| {
            !product.install_kind.is_empty() && !product.source_install.executable_path.is_empty()
        }));
    }

    #[test]
    fn canonical_namespaces_and_compatibility_aliases_resolve_same_product() {
        let catalogue = product_command_catalogue().unwrap();
        assert_eq!(catalogue.resolve("central").unwrap().id, "central");
        assert_eq!(catalogue.resolve("ctrl").unwrap().id, "central");
        assert_eq!(catalogue.resolve("aikit").unwrap().id, "ai-kit");
        assert_eq!(catalogue.resolve("kit").unwrap().id, "ai-kit");
        assert_eq!(catalogue.resolve("factory").unwrap().id, "software-factory");
        assert_eq!(catalogue.resolve("ql").unwrap().id, "quaternal-logic");
    }
}
