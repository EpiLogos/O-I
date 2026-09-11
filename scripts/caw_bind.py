#!/usr/bin/env python3
"""Inspect explicit native binaries + clean source cuts. This is NOT installation
or proof that a declared binary was built from its associated source. Native
build command logs are separately required. No PATH fallback or private reads.
"""
import argparse
from pathlib import Path
import subprocess
import caw_campaign as c

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--entry',action='append',nargs=3,metavar=('OWNER','EXECUTABLE','SOURCE'),required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
bindings={}
try:
    for owner,binary,source in a.entry:
        if owner in bindings: raise c.Failure('duplicate owner binding')
        path,root=Path(binary),Path(source).resolve()
        if not path.is_absolute() or path.is_symlink() or not path.is_file():
            raise c.Failure('pass the exact regular native executable, not a wrapper or PATH name')
        revision=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True,timeout=30).strip()
        source_cut=c.fingerprint_source(root,revision)
        bindings[owner]={'path':str(path),'sha256':c.sha(path.read_bytes()),'source':str(root),
                         **source_cut,'association_standing':'declared-source-association-build-logs-required'}
    c.store(a.output,bindings)
except (c.Failure,OSError,ValueError,subprocess.SubprocessError) as e:
    p.exit(1,f'caw-bind: {e}\n')
