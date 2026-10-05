use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
    revision: Option<String>,
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
    #[serde(default)]
    companions: Vec<CompanionSource>,
}

#[derive(Debug, Clone, Deserialize)]
struct CompanionSource {
    executable: String,
    executable_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SourceInstallDescriptor {
    pub build: Vec<String>,
    pub executable_path: String,
    /// Executables the same build produces for the product's own use (native
    /// owners it spawns). They are staged beside the primary executable in one
    /// content-addressed directory and are never activated on PATH.
    pub companions: Vec<CompanionDescriptor>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CompanionDescriptor {
    pub executable: String,
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
        self.id == value
            || self.namespace == value
            || self.aliases.iter().any(|alias| alias == value)
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
    let resolved = crate::catalog_source::resolve()?;
    product_command_catalogue_from_json(&resolved.json, resolved.origin)
}

/// The catalogue constructor over one explicit catalogue document. The
/// runtime entry above is this plus the live resolution order (`$OI_CATALOG`,
/// the adopted `<state>/catalogue.json`, the embedded snapshot). Hermetic
/// tests pin the document — a machine-adopted catalogue must never move a
/// unit-test floor.
pub fn product_command_catalogue_from_json(
    json: &str,
    origin: &str,
) -> Result<ProductCommandCatalogue, String> {
    let source: SurfaceCatalogSource = serde_json::from_str(json)
        .map_err(|error| format!("O:I surface catalogue ({origin}) is invalid: {error}"))?;
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
        let namespace = required(surface.native.namespace, &surface.id, "native.namespace")?;
        let executable = required(surface.native.executable, &surface.id, "native.executable")?;
        let version_command = required_vec(
            surface.native.version_command,
            &surface.id,
            "native.version_command",
        )?;
        let capability_command = required_vec(
            surface.native.capability_command,
            &surface.id,
            "native.capability_command",
        )?;
        let verification_command = required_vec(
            surface.native.verification_command,
            &surface.id,
            "native.verification_command",
        )?;
        let command_revision = required(
            surface.native.command_revision,
            &surface.id,
            "native.command_revision",
        )?;
        let command_standing = required(
            surface.native.command_standing,
            &surface.id,
            "native.command_standing",
        )?;
        let install_kind = required(surface.install.kind, &surface.id, "install.kind")?;
        let install_revision = required(surface.install.revision, &surface.id, "install.revision")?;
        if command_revision != install_revision {
            return Err(format!(
                "{} native.command_revision {} differs from install.revision {}",
                surface.id, command_revision, install_revision
            ));
        }
        if command_standing != "accepted-main" {
            return Err(format!(
                "{} native command standing is {}, expected accepted-main",
                surface.id, command_standing
            ));
        }

        let source_install = surface
            .native
            .source_install
            .ok_or_else(|| format!("{} is missing native.source_install", surface.id))?;
        let executable_path = required(
            source_install.executable_path,
            &surface.id,
            "native.source_install.executable_path",
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

        let mut companions = Vec::with_capacity(source_install.companions.len());
        for companion in source_install.companions {
            let name = companion.executable.trim();
            if name.is_empty()
                || name.contains(['/', '\\'])
                || matches!(name, "." | "..")
                || name == executable
                || companions
                    .iter()
                    .any(|seen: &CompanionDescriptor| seen.executable == name)
            {
                return Err(format!(
                    "{} native.source_install.companions has an invalid or repeated executable '{}'",
                    surface.id, companion.executable
                ));
            }
            if !companion.executable_path.starts_with("target/")
                || std::path::Path::new(&companion.executable_path).components()
                    .any(|part| !matches!(part, std::path::Component::Normal(_)))
            {
                return Err(format!(
                    "{} companion {} must be a build output under target/",
                    surface.id, name
                ));
            }
            companions.push(CompanionDescriptor {
                executable: name.to_owned(),
                executable_path: companion.executable_path,
            });
        }

        let mut aliases = surface.native.aliases;
        if let Some(legacy) = surface.native.alias {
            if legacy != namespace && !aliases.iter().any(|alias| alias == &legacy) {
                aliases.push(legacy);
            }
        }
        aliases.sort();
        aliases.dedup();

        // Every name `resolve` consults is a command route: the surface id
        // (the canonical name the update plan, receipt and `oi update --check`
        // print), the native namespace and the compatibility aliases. Deduped
        // per product so an id that coincides with its own namespace is not a
        // self-collision.
        let mut routes_for_product = vec![surface.id.as_str(), namespace.as_str()];
        routes_for_product.extend(aliases.iter().map(String::as_str));
        routes_for_product.sort_unstable();
        routes_for_product.dedup();
        for route in routes_for_product {
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
                companions,
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
        .ok_or_else(|| format!("{product} is missing {field}"))
}

fn required_vec(
    value: Option<Vec<String>>,
    product: &str,
    field: &str,
) -> Result<Vec<String>, String> {
    value
        .filter(|items| !items.is_empty() && items.iter().all(|item| !item.trim().is_empty()))
        .ok_or_else(|| format!("{product} is missing {field}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalogue_is_complete_sixfold_and_accepted() {
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
            !product.install_kind.is_empty()
                && !product.source_install.executable_path.is_empty()
                && product.command_standing == "accepted-main"
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

    /// The surface id is the canonical name every other surface prints and
    /// keys by (`oi update --check`, the managed-update receipt, the suite
    /// manifest), so it must resolve like a namespace or alias — pinned
    /// hermetically against the embedded snapshot.
    #[test]
    fn surface_ids_resolve_to_their_own_product() {
        let catalogue = product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(),
            "test-embedded",
        )
        .unwrap();
        for id in [
            "central",
            "actuation",
            "ai-kit",
            "software-factory",
            "workcell",
            "quaternal-logic",
        ] {
            assert_eq!(
                catalogue.resolve(id).map(|product| product.id.as_str()),
                Some(id),
                "surface id '{id}' must resolve to its own product"
            );
        }
        assert!(catalogue.resolve("nonsense").is_none());
    }

    fn with_ql_companions(
        companions: serde_json::Value,
    ) -> Result<ProductCommandCatalogue, String> {
        let mut value: serde_json::Value =
            serde_json::from_str(crate::catalog_source::embedded_catalogue_json()).unwrap();
        let ql = value["surfaces"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|surface| surface["id"] == "quaternal-logic")
            .unwrap();
        ql["native"]["source_install"]["companions"] = companions;
        product_command_catalogue_from_json(&value.to_string(), "test-companions")
    }

    #[test]
    fn quaternal_logic_declares_its_native_expression_companions() {
        let catalogue = product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(),
            "test-embedded",
        )
        .unwrap();
        let install = &catalogue.resolve("ql").unwrap().source_install;
        assert_eq!(install.build, vec!["sh", "scripts/oi-source-install.sh"]);
        assert_eq!(install.executable_path, "target/release/ql");
        let companions = install
            .companions
            .iter()
            .map(|companion| {
                (
                    companion.executable.as_str(),
                    companion.executable_path.as_str(),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(
            companions,
            vec![
                ("ql-field-host", "target/release/ql-field-host"),
                ("ql-focused-host", "target/release/ql-focused-host"),
                ("ql-field-worker", "target/release/ql-field-worker"),
                ("ql-sky", "target/release/ql-sky"),
            ]
        );
        assert!(catalogue
            .products
            .iter()
            .filter(|product| !matches!(product.id.as_str(), "quaternal-logic" | "workcell" | "ai-kit"))
            .all(|product| product.source_install.companions.is_empty()));
    }

    #[test]
    fn aikit_declares_its_native_package_companions() {
        let catalogue = product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(),
            "test-embedded",
        )
        .unwrap();
        let install = &catalogue.resolve("aikit").unwrap().source_install;
        assert_eq!(
            install.build,
            vec![
                "cargo",
                "build",
                "--locked",
                "--release",
                "-p",
                "aikit-cli",
                "--bins"
            ]
        );
        assert_eq!(install.executable_path, "target/release/aikit");
        let companions = install
            .companions
            .iter()
            .map(|companion| {
                (
                    companion.executable.as_str(),
                    companion.executable_path.as_str(),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(
            companions,
            vec![
                ("aikit-session-space", "target/release/aikit-session-space"),
                (
                    "aikit-explain-history",
                    "target/release/aikit-explain-history"
                ),
                (
                    "aikit-knowledge-living",
                    "target/release/aikit-knowledge-living"
                ),
            ]
        );
    }

    #[test]
    fn workcell_declares_one_coherent_native_owner_installation() {
        let catalogue = product_command_catalogue_from_json(
            crate::catalog_source::embedded_catalogue_json(),
            "test-embedded",
        )
        .unwrap();
        let install = &catalogue.resolve("workcell").unwrap().source_install;
        assert_eq!(install.executable_path, "target/release/workcell");
        assert_eq!(
            install
                .companions
                .iter()
                .map(|companion| (
                    companion.executable.as_str(),
                    companion.executable_path.as_str(),
                ))
                .collect::<Vec<_>>(),
            vec![
                (
                    "workcell-write-boundary",
                    "target/release/workcell-write-boundary"
                ),
                (
                    "workcell-control-service",
                    "target/release/workcell-control-service"
                ),
                (
                    "workcell-control-client",
                    "target/release/workcell-control-client"
                ),
            ],
        );
    }

    #[test]
    fn companion_declarations_are_validated() {
        for (companions, fragment) in [
            (
                serde_json::json!([{"executable": "", "executable_path": "target/release/x"}]),
                "invalid or repeated",
            ),
            (
                serde_json::json!([{"executable": "bin/x", "executable_path": "target/release/x"}]),
                "invalid or repeated",
            ),
            (
                serde_json::json!([{"executable": "ql", "executable_path": "target/release/ql"}]),
                "invalid or repeated",
            ),
            (
                serde_json::json!([
                    {"executable": "x", "executable_path": "target/release/x"},
                    {"executable": "x", "executable_path": "target/release/y"}
                ]),
                "invalid or repeated",
            ),
            (
                serde_json::json!([{"executable": "x", "executable_path": "/usr/bin/x"}]),
                "under target/",
            ),
            (
                serde_json::json!([{"executable": "x", "executable_path": "release/x"}]),
                "under target/",
            ),
        ] {
            let error = with_ql_companions(companions.clone()).unwrap_err();
            assert!(error.contains(fragment), "{companions}: {error}");
        }
        assert!(with_ql_companions(serde_json::json!([])).is_ok());
    }
    #[test]
    fn companion_descriptor_refuses_foreign_build_paths_and_non_member_names() {
        for (name, path) in [
            ("ql-field-host", "target/../../foreign"),
            ("ql-field-host", "/target/release/ql-field-host"),
            ("..", "target/release/ql-field-host"),
            (".", "target/release/ql-field-host"),
            ("ql/field-host", "target/release/ql-field-host"),
        ] {
            let error = with_ql_companions(serde_json::json!([{
                "executable": name, "executable_path": path
            }])).unwrap_err();
            assert!(!error.is_empty(), "{name}: {path}");
        }
    }
}
