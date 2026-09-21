"""Resolve actual Cargo executable artifacts for the joined native Wiki walk.

Do not infer target directories from checkout paths: Cargo configuration and
workspace membership can change those independently. The emitted paths belong
to this exact build, not another cached or installed binary.
"""
import json
import os
from pathlib import Path
import subprocess

TARGETS = (
    ("OI_BIN", "cli/Cargo.toml", "oi"),
    ("OI_AIKIT_BIN", ".wiki-native-owner/Cargo.toml", "aikit"),
    ("OI_CENTRAL_CTRL_BIN", ".wiki-central-owner/ctrl/Cargo.toml", "ctrl"),
    ("WIKI_KERNEL_BIN", "desktop/cradle/kernel/Cargo.toml", "walk-bridge"),
)


def main():
    resolved = {}
    for name, manifest, binary in TARGETS:
        command = ["cargo", "build", "--locked", "--manifest-path", manifest,
                   "--bin", binary, "--message-format=json-render-diagnostics"]
        result = subprocess.run(command, check=True, stdout=subprocess.PIPE, text=True)
        artifacts = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
        paths = {str(Path(item["executable"]).resolve()) for item in artifacts
                 if item.get("reason") == "compiler-artifact"
                 and item.get("target", {}).get("name") == binary
                 and item.get("executable") and not item.get("profile", {}).get("test")}
        if len(paths) != 1:
            raise RuntimeError(f"Expected one built executable for {name}, received {paths}")
        path = paths.pop()
        if not Path(path).is_file() or not os.access(path, os.X_OK):
            raise RuntimeError(f"Cargo's {name} executable is not callable: {path}")
        resolved[name] = path
        print(f"{name}={path}", flush=True)
    destination = os.environ.get("GITHUB_ENV")
    if destination:
        with open(destination, "a", encoding="utf-8") as stream:
            stream.writelines(f"{name}={path}\n" for name, path in resolved.items())
    Path("/tmp/wiki-native-binaries.json").write_text(json.dumps(resolved, indent=2) + "\n")


if __name__ == "__main__":
    main()
