//! Feature `k8` only: compile the C ABI shim over QL's K8 typed API
//! (`src/k8/field_shim.cpp`) against an installed QL prefix and link it.
//! `QL_MEF_PREFIX` names the prefix: `include/ql/continuous_field.hpp`,
//! `include/ql/torus_keys.hpp` (QL's played-address law, O-I #849) and
//! `include/ql/coupled_clock.h` (with the headers they include), and
//! `lib/libql-mef-c.a`. The default build (and the realtime build) never
//! runs a compiler here.

use std::path::PathBuf;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    if std::env::var_os("CARGO_FEATURE_K8").is_none() {
        return;
    }
    println!("cargo:rerun-if-changed=src/k8/field_shim.cpp");
    println!("cargo:rerun-if-env-changed=QL_MEF_PREFIX");
    println!("cargo:rerun-if-env-changed=CXX");
    let prefix = PathBuf::from(std::env::var_os("QL_MEF_PREFIX").unwrap_or_else(|| {
        panic!(
            "feature `k8` needs QL_MEF_PREFIX: an installed QL prefix with include/ql/continuous_field.hpp \
             and lib/libql-mef-c.a"
        )
    }));
    let header = prefix.join("include/ql/continuous_field.hpp");
    let keys = prefix.join("include/ql/torus_keys.hpp");
    let lib = prefix.join("lib/libql-mef-c.a");
    for need in [&header, &keys, &lib] {
        assert!(
            need.exists(),
            "QL_MEF_PREFIX {} lacks {}",
            prefix.display(),
            need.display()
        );
        println!("cargo:rerun-if-changed={}", need.display());
    }
    let out = PathBuf::from(std::env::var_os("OUT_DIR").expect("OUT_DIR"));
    let object = out.join("field_shim.o");
    let cxx = std::env::var("CXX").unwrap_or_else(|_| "c++".into());
    let status = Command::new(&cxx)
        .args([
            "-std=c++17",
            "-O2",
            "-fPIC",
            "-Wall",
            "-Wextra",
            "-Werror",
            "-c",
        ])
        .arg(format!("-I{}", prefix.join("include").display()))
        .arg("src/k8/field_shim.cpp")
        .arg("-o")
        .arg(&object)
        .status()
        .unwrap_or_else(|e| panic!("{cxx}: {e}"));
    assert!(status.success(), "{cxx} could not compile the K8 shim");
    let archive = out.join("libk8_field_shim.a");
    let _ = std::fs::remove_file(&archive);
    let status = Command::new("ar")
        .arg("rcs")
        .arg(&archive)
        .arg(&object)
        .status()
        .expect("ar");
    assert!(status.success(), "ar could not archive the K8 shim");
    println!("cargo:rustc-link-search=native={}", out.display());
    println!("cargo:rustc-link-lib=static=k8_field_shim");
    println!(
        "cargo:rustc-link-search=native={}",
        prefix.join("lib").display()
    );
    println!("cargo:rustc-link-lib=static=ql-mef-c");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-link-lib=c++");
    } else {
        println!("cargo:rustc-link-lib=stdc++");
        println!("cargo:rustc-link-lib=m");
    }
}
