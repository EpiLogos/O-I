use oi_cli::{owner_disclosure, product_command};

#[test]
#[ignore = "requires explicit built OI_BIN and actual installed native owners"]
fn six_real_owner_disclosures_keep_their_native_contracts() {
    let suite =
        std::path::PathBuf::from(std::env::var_os("OI_BIN").expect("explicit actual S binary"));
    let cwd = std::env::current_dir().unwrap();
    let reading = owner_disclosure::read(&suite, &cwd).unwrap();
    assert!(
        reading.discovery_error.is_none(),
        "{:?}",
        reading.discovery_error
    );
    assert_eq!(reading.owners.len(), 6);
    let catalogue = product_command::product_command_catalogue().unwrap();
    for owner in &reading.owners {
        assert!(
            owner.capabilities.error.is_none(),
            "{}: {:?}",
            owner.product_id,
            owner.capabilities
        );
        assert_eq!(owner.capabilities.exit_code, Some(0));
        assert!(owner.capabilities.reading.as_ref().unwrap().is_object());
        assert_eq!(owner.discovery.as_ref().unwrap()["id"], owner.product_id);
        let contract = catalogue
            .products
            .iter()
            .find(|p| p.id == owner.product_id)
            .unwrap();
        assert_eq!(
            owner.command_contract,
            serde_json::to_value(contract).unwrap()
        );
        assert_eq!(owner.capabilities.command[0], contract.namespace);
        assert_eq!(owner.capabilities.command[1..], contract.capability_command);
        if owner.product_id == "ai-kit" {
            let context = owner.effective_context.as_ref().unwrap();
            assert!(context.error.is_none(), "{:?}", context.error);
            let native = context.reading.as_ref().unwrap();
            assert_eq!(native["ok"], true);
            assert!(native["context"]["context_id"].is_string());
            assert!(native["data"]["active"].is_array());
            assert!(native["data"]["unavailable"].is_array());
        } else {
            assert!(owner.effective_context.is_none());
        }
    }
    let encoded = serde_json::to_value(&reading).unwrap();
    let decoded: owner_disclosure::Reading = serde_json::from_value(encoded).unwrap();
    assert_eq!(reading, decoded);
}
