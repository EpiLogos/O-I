#[derive(Debug, Clone, Deserialize)]
struct NativeProductDispatchCatalog {
    schema: u32,
    surfaces: Vec<NativeProductDispatchSurface>,
}

#[derive(Debug, Clone, Deserialize)]
struct NativeProductDispatchSurface {
    id: String,
    native: NativeProductDispatchSpec,
}

#[derive(Debug, Clone, Deserialize)]
struct NativeProductDispatchSpec {
    kind: String,
    executable: Option<String>,
    canonical_namespace: String,
    #[serde(default)]
    compatibility_aliases: Vec<String>,
}

fn native_product_dispatch_route(args: &[OsString]) -> Option<Result<i32, String>> {
    let selector = args.first()?.to_str()?;
    let dispatch = match native_product_dispatch_catalog() {
        Ok(catalog) => catalog,
        Err(error) => return Some(Err(error)),
    };
    let product = dispatch.surfaces.iter().find(|surface| {
        surface.native.canonical_namespace == selector
            || surface
                .native
                .compatibility_aliases
                .iter()
                .any(|alias| alias == selector)
    })?;
    let catalog = match catalog() {
        Ok(catalog) => catalog,
        Err(error) => return Some(Err(error)),
    };
    let surface = match find_surface(&catalog, &product.id) {
        Ok(surface) => surface,
        Err(error) => return Some(Err(error)),
    };
    Some(dispatch_alias(surface, &args[1..]))
}

fn native_product_dispatch_catalog() -> Result<NativeProductDispatchCatalog, String> {
    let catalog: NativeProductDispatchCatalog = serde_json::from_str(CATALOG_JSON)
        .map_err(|error| format!("embedded native product descriptor is invalid: {error}"))?;
    validate_native_product_dispatch_catalog(&catalog)?;
    Ok(catalog)
}

fn validate_native_product_dispatch_catalog(
    catalog: &NativeProductDispatchCatalog,
) -> Result<(), String> {
    if catalog.schema != 1 {
        return Err(format!(
            "unsupported native product descriptor schema {}",
            catalog.schema
        ));
    }
    if catalog.surfaces.len() != 6 {
        return Err(format!(
            "native product command field must contain exactly six products; found {}",
            catalog.surfaces.len()
        ));
    }

    let mut ids = HashSet::new();
    let mut selectors = HashSet::new();
    for surface in &catalog.surfaces {
        if !ids.insert(surface.id.as_str()) {
            return Err(format!("duplicate native product id `{}`", surface.id));
        }
        if surface.native.kind != "cli" {
            return Err(format!(
                "native product `{}` is not published as a CLI surface",
                surface.id
            ));
        }
        if surface
            .native
            .executable
            .as_deref()
            .is_none_or(str::is_empty)
        {
            return Err(format!(
                "native product `{}` has no executable relation",
                surface.id
            ));
        }
        let namespace = surface.native.canonical_namespace.trim();
        if namespace.is_empty() {
            return Err(format!(
                "native product `{}` has no canonical O:I namespace",
                surface.id
            ));
        }
        if !selectors.insert(namespace) {
            return Err(format!("native product selector collision: `{namespace}`"));
        }
        for alias in &surface.native.compatibility_aliases {
            let alias = alias.trim();
            if alias.is_empty() {
                return Err(format!(
                    "native product `{}` publishes an empty compatibility alias",
                    surface.id
                ));
            }
            if !selectors.insert(alias) {
                return Err(format!("native product selector collision: `{alias}`"));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod native_product_dispatch_tests {
    use super::*;

    #[test]
    fn descriptor_publishes_exact_six_canonical_namespaces() {
        let catalog = native_product_dispatch_catalog().expect("descriptor should validate");
        assert_eq!(catalog.surfaces.len(), 6);
        assert_eq!(
            catalog
                .surfaces
                .iter()
                .map(|surface| surface.native.canonical_namespace.as_str())
                .collect::<Vec<_>>(),
            vec!["central", "actuation", "aikit", "factory", "workcell", "ql"]
        );
    }

    #[test]
    fn compatibility_aliases_are_only_the_intentional_shortcuts() {
        let catalog = native_product_dispatch_catalog().expect("descriptor should validate");
        let aliases = catalog
            .surfaces
            .iter()
            .flat_map(|surface| {
                surface
                    .native
                    .compatibility_aliases
                    .iter()
                    .map(move |alias| (surface.id.as_str(), alias.as_str()))
            })
            .collect::<Vec<_>>();
        assert_eq!(aliases, vec![("central", "ctrl"), ("ai-kit", "kit")]);
    }
}
