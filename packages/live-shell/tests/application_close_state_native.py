#!/usr/bin/env python3
"""Compile actual native close reply state; no substituted Tauri/window runtime."""
import pathlib, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parents[3]
source=(root/'desktop/cradle/src-tauri/src/native_shell.rs').read_text()
core=source.split('// BEGIN native close reply state (standalone source-bound regression).',1)[1].split('// END native close reply state.',1)[0]
tests=source.split('    #[cfg(test)]\n    mod close_reply_state_tests {',1)[1].split('    static NEXT:AtomicU64',1)[0]
unit='use std::{collections::{BTreeMap,BTreeSet},time::{Duration,Instant}};\n'+core+'\n#[cfg(test)]\nmod close_reply_state_tests {'+tests
with tempfile.TemporaryDirectory(prefix='oi-close-state-') as directory:
    path=pathlib.Path(directory)/'state.rs';path.write_text(unit)
    binary=pathlib.Path(directory)/'state-tests'
    subprocess.run(['rustc','--edition=2021','--test',str(path),'-o',str(binary)],check=True)
    subprocess.run([str(binary)],check=True)
print('Actual native close reply state: 4 tests; native event-loop/window acceptance remains pending')
