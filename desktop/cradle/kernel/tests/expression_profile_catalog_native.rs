//! Real Application catalog admission. These controlled authored grammars
//! exercise the native ES3 owner; no mock transport/source/current is used.
//! The ignored case additionally requires two retained source-qualified Epi
//! cohorts and never constructs their expected content from native readback.
use oi_cradle_kernel::{
    expression::{Application, Request},
    expression_profile::ExpressionProfile,
    flow::CentralClient, Kernel, KernelOp, KernelOpResult,
};
use serde_json::{json, Value};

const COUNT_BOUND: usize = 64 * 64;
const BYTE_BOUND: usize = 16 * 1024 * 1024;

fn apply(app: &mut Application, request: Value) -> (Value, bool) {
    let request: Request = serde_json::from_value(request).unwrap();
    let (value, changed) = app.apply(&CentralClient::discover(), request).unwrap();
    (value, changed.is_some())
}
fn refuse(app: &mut Application, request: Value, reason: &str) {
    let request: Request = serde_json::from_value(request).unwrap();
    let error = app.apply(&CentralClient::discover(), request).unwrap_err();
    assert!(error.contains(reason), "Expected {reason}, got {error}");
}
fn profile(reference: &str, parent: Option<&str>, revision: u64) -> Value {
    json!({"profile_ref":reference,"revision":revision,"title":"Controlled authored symbol grammar",
        "parent_profile_refs":parent.into_iter().collect::<Vec<_>>(),
        "accepted_binding_kinds":["engine_composition","glyph_form"],
        "accepted_native_owners":["expressions"],
        "material_defaults":{"scale":{"value":1.5,"automation":null}},
        "formation_vocabulary":["text"],
        "target_rules":{"glyph_form":{"formation":"text","text":"☉"}},
        "provenance":[{"ref":"material:controlled-profile-catalog","revision":"authored-native-test-v1","availability":"available"}]})
}
fn define(app: &mut Application, profile: Value) -> Value {
    let (response, changed) = apply(
        app,
        json!({"operation":"profile_define","profile":profile,"actor":"agent:controlled-native-catalog-test"}),
    );
    assert!(
        !changed,
        "Registry definition must not emit an Expression change"
    );
    assert_eq!(response["state"], "profile");
    response
}

fn kernel_expression(kernel: &mut Kernel, value: Value) -> Result<Value, String> {
    let outcome = kernel.apply(KernelOp::Expression { request: serde_json::from_value(value).unwrap() })?;
    assert!(outcome.receipts.is_empty(), "Profile registry calls must not mutate Documents");
    let KernelOpResult::Expression { data } = outcome.result else { panic!("Native Expression result required"); };
    Ok(data)
}
fn canonical_profile(value: Value) -> Value {
    serde_json::to_value(serde_json::from_value::<ExpressionProfile>(value).unwrap()).unwrap()
}

#[test]
fn native_profile_batch_preserves_order_inheritance_replay_and_refused_prefix() {
    let mut kernel = Kernel::new(CentralClient::discover());
    let root = profile("profile:batch-root", None, 1);
    let child = profile("profile:batch-child", Some("profile:batch-root"), 1);
    let definition = |profile: Value| json!({"profile":profile,"actor":"agent:native-batch-test"});
    let request = json!({"operation":"profile_define_many","definitions":[definition(root.clone()),definition(child.clone())]});
    let admitted = kernel_expression(&mut kernel, request.clone()).unwrap();
    assert_eq!(admitted["state"], "profiles");
    for (index, original) in [root.clone(), child.clone()].into_iter().enumerate() {
        let inspected = kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":original["profile_ref"]})).unwrap();
        assert_eq!(admitted["profiles"][index], inspected);
        assert_eq!(inspected["profile"], canonical_profile(original));
        assert_eq!(inspected["resolved_defaults"]["scale"]["value"], 1.5);
    }
    assert_eq!(kernel_expression(&mut kernel, request).unwrap(), admitted);
    let prefix = profile("profile:batch-prefix", None, 1);
    let mut conflict = child.clone(); conflict["title"] = json!("Different content at the same revision");
    let error = kernel_expression(&mut kernel, json!({"operation":"profile_define_many","definitions":[definition(prefix.clone()),definition(conflict)]})).unwrap_err();
    assert!(error.contains("after 1 admitted definitions") && error.contains("cannot name different content"));
    assert_eq!(kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":prefix["profile_ref"]})).unwrap()["profile"], canonical_profile(prefix));
    assert_eq!(kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":child["profile_ref"]})).unwrap()["profile"], canonical_profile(child));
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_define_many","definitions":[]})).unwrap_err().contains("1–64"));
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_define_many","definitions":vec![definition(root.clone());65]})).unwrap_err().contains("1–64"));
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_define_many","definitions":[{"profile":profile("profile:bad-batch-actor",None,1),"actor":""}]})).unwrap_err().contains("after 0 admitted definitions"));
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":"profile:bad-batch-actor"})).is_err());
}

#[test]
fn actual_retained_61_profile_batch_matches_every_single_native_definition_and_document() {
    let bytes = include_str!("fixtures/epi-world-131.expression.json");
    let actual = oi_cradle_kernel::expression_file::decode(bytes).unwrap();
    let source: Value = serde_json::from_str(include_str!("fixtures/epi-world-profile-definitions-61.json")).unwrap();
    assert_eq!(source["source_document_sha256"], "477ea134ff75cdad033a424263c23f9bff8897e175cf9d0bff3e45f933888507");
    assert_eq!(source["source_document_revision"], 136);
    let definitions = source["definitions"].as_array().unwrap();
    assert_eq!(definitions.len(), 61);
    let mut single = Kernel::new(CentralClient::discover());
    let mut batch = Kernel::new(CentralClient::discover());
    let mut expected = Vec::new();
    for request in definitions { expected.push(kernel_expression(&mut single, request.clone()).unwrap()); }
    let rows: Vec<Value> = definitions.iter().map(|r| json!({"profile":r["profile"],"actor":r["actor"]})).collect();
    let request = json!({"operation":"profile_define_many","definitions":rows});
    let result = kernel_expression(&mut batch, request.clone()).unwrap();
    assert_eq!(result["profiles"], json!(expected));
    let reference = actual.expression_ref.clone();
    batch.apply(KernelOp::Expression { request: Request::Open { document: Box::new(actual), actor: "agent:actual-native-batch-test".into() } }).unwrap();
    let inspect = json!({"operation":"inspect","expression_ref":reference});
    let before = kernel_expression(&mut batch, inspect.clone()).unwrap();
    assert_eq!(kernel_expression(&mut batch, request).unwrap(), result);
    assert_eq!(kernel_expression(&mut batch, inspect).unwrap(), before);
}

#[test]
fn native_profile_batch_refuses_input_and_inherited_reply_weight_before_effects() {
    let large = large_authored_profile(700);
    // The existing authored sequence passes the real profile validator.
    let weight = native_bytes(&large); assert!(weight > 400_000);
    let definition = |p: Value| json!({"profile":p,"actor":"agent:native-batch-budget-test"});
    let mut kernel = Kernel::new(CentralClient::discover());
    let oversized_input = json!({"operation":"profile_define_many","definitions":vec![definition(large.clone());32]});
    assert!(kernel_expression(&mut kernel, oversized_input).unwrap_err().contains("input byte budget"));
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":large["profile_ref"]})).is_err());
    kernel_expression(&mut kernel, json!({"operation":"profile_define","profile":large,"actor":"agent:native-batch-budget-test"})).unwrap();
    let rows: Vec<Value> = (0..32).map(|i|{
        let mut child = profile(&format!("profile:batch-weight-child-{i:02}"), Some("profile:catalog-bytes-0700"), 1);
        child["material_defaults"] = json!({}); definition(child)
    }).collect();
    assert!(serde_json::to_vec(&rows).unwrap().len() < 32_000, "Small input must exercise inherited reply weight");
    assert!(kernel_expression(&mut kernel, json!({"operation":"profile_define_many","definitions":rows})).unwrap_err().contains("reply byte budget"));
    for i in 0..32 {
        assert!(kernel_expression(&mut kernel, json!({"operation":"profile_inspect","profile_ref":format!("profile:batch-weight-child-{i:02}")})).is_err());
    }
}
fn inspect_profile(app: &mut Application, reference: &str) -> Value {
    let (response, changed) = apply(
        app,
        json!({"operation":"profile_inspect","profile_ref":reference}),
    );
    assert!(!changed);
    response
}
fn index(app: &mut Application) -> Value {
    let (response, changed) = apply(app, json!({"operation":"index"}));
    assert!(!changed);
    response
}
fn inspect_document(app: &mut Application, expression: &str) -> Value {
    let (response, changed) = apply(
        app,
        json!({"operation":"inspect","expression_ref":expression}),
    );
    assert!(!changed);
    response
}
fn create_adopted(app: &mut Application, expression: &str, reference: &str) {
    let (_, changed) = apply(
        app,
        json!({"operation":"create","expression_ref":expression,"title":"Controlled distinct world","actor":"agent:native-catalog-test"}),
    );
    assert!(changed);
    let (_, changed) = apply(
        app,
        json!({"operation":"edit","expression_ref":expression,"expected_revision":1,"actor":"agent:native-catalog-test","changes":[{"change":"profile_adopt","adoption":{"profile_ref":reference,"revision":1,"overridden_parameters":{}}}]}),
    );
    assert!(changed);
}

#[test]
fn distinct_authored_cohorts_over64_preserve_profiles_documents_and_edition() {
    let mut app = Application::default();
    let (capabilities, event) = apply(&mut app, json!({"operation":"capabilities"}));
    assert!(!event);
    assert_eq!(capabilities["profiles"]["budget"], COUNT_BOUND);
    assert_eq!(capabilities["profiles"]["byte_budget"], BYTE_BOUND);
    let mut retained = Vec::new();
    for version in ["v2", "v3"] {
        let root = format!("profile:catalog-{version}-root");
        let mut base = profile(&root, None, 1);
        base["title"] = json!(format!("Explicit authored {version} grammar"));
        define(&mut app, base.clone());
        retained.push(base);
        for member in 0..60 {
            let reference = format!("profile:catalog-{version}-purpose-{member}");
            let child = profile(&reference, Some(&root), 1);
            let owner = define(&mut app, child.clone());
            assert_eq!(owner["resolved_defaults"]["scale"]["value"], 1.5);
            retained.push(child);
        }
        create_adopted(
            &mut app,
            &format!("expression:catalog-person-{version}"),
            &root,
        );
    }
    let before = index(&mut app);
    assert_eq!(before["profiles"].as_array().unwrap().len(), 122);
    assert_eq!(before["expressions"].as_array().unwrap().len(), 2);
    for original in &retained {
        assert_eq!(
            inspect_profile(&mut app, original["profile_ref"].as_str().unwrap())["profile"],
            serde_json::to_value(
                serde_json::from_value::<ExpressionProfile>(original.clone()).unwrap()
            )
            .unwrap()
        );
    }
    let edition = json!({"edition_ref":"edition:catalog-old-world","revision":1,"title":"Old authored world edition","expression_ref":"expression:catalog-person-v2","expression_revision":2,"profile_ref":"profile:catalog-v2-root","profile_revision":1,"front_representation":{"ref":"material:controlled-catalog-front","revision":"v2","availability":"available"},"digest":"controlled-native-edition-v2"});
    let (created, changed) = apply(
        &mut app,
        json!({"operation":"edition_create","edition":edition,"actor":"agent:controlled-native-catalog-test"}),
    );
    assert!(!changed);
    assert_eq!(created["expression_opened"], false);
    let mut changed_content = retained[0].clone();
    changed_content["title"] = json!("Same revision must not silently replace old grammar");
    let indexed = index(&mut app);
    refuse(
        &mut app,
        json!({"operation":"profile_define","profile":changed_content,"actor":"agent:native-catalog-test"}),
        "different content",
    );
    assert_eq!(index(&mut app), indexed);
    let (opened, event) = apply(
        &mut app,
        json!({"operation":"edition_inspect","edition_ref":"edition:catalog-old-world"}),
    );
    assert!(!event);
    assert_eq!(opened["edition"], created["edition"]);
}

#[test]
fn explicit_catalog_count_refusal_is_atomic_and_exact_replay_is_free() {
    let mut app = Application::default();
    let first = profile("profile:catalog-count-0000", None, 1);
    define(&mut app, first.clone());
    create_adopted(
        &mut app,
        "expression:catalog-count",
        "profile:catalog-count-0000",
    );
    for ordinal in 1..COUNT_BOUND {
        define(
            &mut app,
            profile(&format!("profile:catalog-count-{ordinal:04}"), None, 1),
        );
    }
    let before = index(&mut app);
    let document_before = inspect_document(&mut app, "expression:catalog-count");
    assert_eq!(before["profiles"].as_array().unwrap().len(), COUNT_BOUND);
    let first_before = inspect_profile(&mut app, "profile:catalog-count-0000");
    let last_before = inspect_profile(&mut app, "profile:catalog-count-4095");
    refuse(
        &mut app,
        json!({"operation":"profile_define","profile":profile("profile:catalog-count-overflow",None,1),"actor":"agent:native-catalog-test"}),
        "catalog count budget",
    );
    assert_eq!(index(&mut app), before);
    assert_eq!(
        inspect_document(&mut app, "expression:catalog-count"),
        document_before
    );
    assert_eq!(
        inspect_profile(&mut app, "profile:catalog-count-0000"),
        first_before
    );
    assert_eq!(
        inspect_profile(&mut app, "profile:catalog-count-4095"),
        last_before
    );
    refuse(
        &mut app,
        json!({"operation":"profile_inspect","profile_ref":"profile:catalog-count-overflow"}),
        "not defined",
    );
    define(&mut app, first);
    assert_eq!(
        index(&mut app),
        before,
        "Exact replay must not consume another catalog slot"
    );
}

fn large_authored_profile(ordinal: usize) -> Value {
    let mut result = profile(&format!("profile:catalog-bytes-{ordinal:04}"), None, 1);
    let text = "A bounded authored sequence retains its complete source text. ".repeat(65);
    assert!(text.len() < 4096);
    let steps: Vec<_> = (0..128).map(|index| json!({"id":format!("authored-step-{index}"),"shape":"text","text":text,"hold":3,"transition":1})).collect();
    result["material_defaults"] = json!({"material":{"value":{"name":"Complete controlled text sequence","kind":"formation","shape":"text","text":"Source sequence","sequence":{"enabled":true,"clock":"seconds","steps":steps}},"automation":null}});
    result
}
fn native_bytes(profile: &Value) -> usize {
    let profile: ExpressionProfile = serde_json::from_value(profile.clone()).unwrap();
    profile.validate().unwrap();
    serde_json::to_vec(&profile).unwrap().len()
}

#[test]
fn aggregate_byte_refusal_and_replacement_accounting_preserve_every_owner() {
    let mut app = Application::default();
    let mut expected_bytes = 0;
    let mut originals: Vec<Value> = Vec::new();
    for ordinal in 0..100 {
        let candidate = large_authored_profile(ordinal);
        let bytes = native_bytes(&candidate);
        if expected_bytes + bytes > BYTE_BOUND {
            let before = index(&mut app);
            let document_before = inspect_document(&mut app, "expression:catalog-bytes");
            refuse(
                &mut app,
                json!({"operation":"profile_define","profile":candidate,"actor":"agent:native-catalog-test"}),
                "catalog byte budget",
            );
            assert_eq!(index(&mut app), before);
            assert_eq!(
                inspect_document(&mut app, "expression:catalog-bytes"),
                document_before
            );
            for original in &originals {
                let typed: ExpressionProfile = serde_json::from_value(original.clone()).unwrap();
                assert_eq!(
                    inspect_profile(&mut app, &typed.profile_ref)["profile"],
                    serde_json::to_value(typed).unwrap()
                );
            }
            assert!(
                originals.len() < 64,
                "Bytes must discriminate independently of the old count limit"
            );
            break;
        }
        define(&mut app, candidate.clone());
        if ordinal == 0 {
            create_adopted(
                &mut app,
                "expression:catalog-bytes",
                "profile:catalog-bytes-0000",
            );
        }
        expected_bytes += bytes;
        originals.push(candidate);
    }
    assert!(!originals.is_empty() && expected_bytes > BYTE_BOUND - 600_000);
    let before = index(&mut app);
    define(&mut app, originals[0].clone());
    assert_eq!(
        index(&mut app),
        before,
        "Same bytes must not double count a replay near the byte bound"
    );
    let mut smaller = profile("profile:catalog-bytes-0000", None, 2);
    smaller["title"] = json!("Explicit smaller revision");
    define(&mut app, smaller.clone());
    expected_bytes = expected_bytes - native_bytes(&originals[0]) + native_bytes(&smaller);
    let new = large_authored_profile(99);
    assert!(expected_bytes + native_bytes(&new) < BYTE_BOUND);
    define(&mut app, new);
    let after = index(&mut app);
    refuse(
        &mut app,
        json!({"operation":"profile_define","profile":originals[0],"actor":"agent:native-catalog-test"}),
        "monotonic",
    );
    assert_eq!(index(&mut app), after);
}

#[test]
fn larger_catalog_retains_lineage_and_four_adoption_limits() {
    let mut app = Application::default();
    define(&mut app, profile("profile:catalog-ancestor", None, 1));
    define(&mut app, profile("profile:catalog-extra-root", None, 1));
    let mut parent = "profile:catalog-ancestor".to_owned();
    for depth in 0..8 {
        let child = format!("profile:catalog-depth-{depth}");
        define(&mut app, profile(&child, Some(&parent), 1));
        parent = child;
    }
    for ordinal in 0..70 {
        define(
            &mut app,
            profile(&format!("profile:catalog-extra-{ordinal}"), None, 1),
        );
    }
    let before = index(&mut app);
    let descendant = inspect_profile(&mut app, &parent);
    refuse(
        &mut app,
        json!({"operation":"profile_define","profile":profile("profile:catalog-ancestor",Some("profile:catalog-extra-root"),2),"actor":"agent:native-catalog-test"}),
        "too deep",
    );
    assert_eq!(index(&mut app), before);
    assert_eq!(inspect_profile(&mut app, &parent), descendant);
    create_adopted(
        &mut app,
        "expression:catalog-adoption",
        "profile:catalog-ancestor",
    );
    apply(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:catalog-adoption","expected_revision":2,"actor":"agent:native-catalog-test","changes":(0..3).map(|i|json!({"change":"profile_adopt","adoption":{"profile_ref":format!("profile:catalog-extra-{i}"),"revision":1,"overridden_parameters":{}}})).collect::<Vec<_>>()}),
    );
    let old = apply(
        &mut app,
        json!({"operation":"inspect","expression_ref":"expression:catalog-adoption"}),
    )
    .0;
    refuse(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:catalog-adoption","expected_revision":3,"actor":"agent:native-catalog-test","changes":[{"change":"profile_adopt","adoption":{"profile_ref":"profile:catalog-extra-3","revision":1,"overridden_parameters":{}}}]}),
        "adoption budget",
    );
    assert_eq!(
        apply(
            &mut app,
            json!({"operation":"inspect","expression_ref":"expression:catalog-adoption"})
        )
        .0,
        old
    );
    let (_, changed) = apply(
        &mut app,
        json!({"operation":"edit","expression_ref":"expression:catalog-adoption","expected_revision":3,"actor":"agent:native-catalog-test","changes":[{"change":"profile_release","profile_ref":"profile:catalog-ancestor"}]}),
    );
    assert!(changed);
    assert_eq!(
        inspect_profile(&mut app, &parent),
        descendant,
        "Release affects adoption, never the catalog or descendants"
    );
}

#[test]
#[ignore = "requires exact retained actual-world/controlled-current-producer cohorts"]
fn retained_actual_epi_v2_and_controlled_current_v3_coexist() {
    let path = std::env::var("OI_PROFILE_CATALOG_COHORTS")
        .expect("Supply retained source-qualified profile cohorts");
    let cohorts: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let rows = cohorts["cohorts"].as_array().unwrap();
    assert_eq!(rows.len(), 2);
    let mut app = Application::default();
    for row in rows {
        let definitions = row["definitions"].as_array().unwrap();
        assert_eq!(definitions.len(), 61);
        for request in definitions {
            assert_eq!(request["operation"], "profile_define");
            define(&mut app, request["profile"].clone());
        }
    }
    let state = index(&mut app);
    let distinct = state["profiles"].as_array().unwrap().len();
    assert!(distinct > 64 && distinct <= 122);
    for (ordinal, row) in rows.iter().enumerate() {
        for request in row["definitions"].as_array().unwrap() {
            let original: ExpressionProfile =
                serde_json::from_value(request["profile"].clone()).unwrap();
            let actual = inspect_profile(&mut app, &original.profile_ref);
            assert_eq!(actual["profile"], serde_json::to_value(&original).unwrap());
            if let Some(material) = original.material_defaults.get("material") {
                assert_eq!(
                    actual["resolved_defaults"]["material"],
                    serde_json::to_value(material).unwrap()
                );
            }
        }
        let root = row["definitions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|r| {
                r["profile"]["parent_profile_refs"]
                    .as_array()
                    .unwrap()
                    .is_empty()
                    && r["profile"]["profile_ref"]
                        .as_str()
                        .unwrap()
                        .starts_with("profile:epi-world-")
            })
            .unwrap();
        create_adopted(
            &mut app,
            &format!("expression:controlled-catalog-person-{ordinal}"),
            root["profile"]["profile_ref"].as_str().unwrap(),
        );
    }
    assert_eq!(index(&mut app)["expressions"].as_array().unwrap().len(), 2);
    println!("actual_v2_plus_controlled_current_v3_distinct_profiles={distinct} all_profile_values_preserved=true two_native_documents=true");
}
