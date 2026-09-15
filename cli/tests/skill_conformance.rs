//! Suite-level Skill/SDK conformance (docs/SKILL-CONFORMANCE.md).
//!
//! The conjugate law: a Skill may only name commands the product's discovery
//! surface actually serves, and only paths the product repository actually
//! has. This harness runs each product's machine-readable discovery surface
//! (or its help graph when no richer surface exists at the served revision),
//! extracts the real inventory, and checks the product's Skill material
//! against it. O:I's own Skills are checked hermetically against the `oi`
//! binary under test; the six product checkouts are checked when the
//! workspace is present. Skips are printed, never silently green; manual
//! residuals are itemised in the run output.

#[cfg(unix)]
mod unix {
    use std::collections::BTreeSet;
    use std::path::{Path, PathBuf};
    use std::process::{Command, Output};

    /// A product's served-binary identity and where its Skill material lives.
    struct ProductSpec {
        id: &'static str,
        binary: &'static str,
        /// Skill directories relative to the checkout root.
        skill_dirs: &'static [&'static str],
        /// Standalone guidance files checked as Skill material.
        extra_files: &'static [&'static str],
        /// Optional machine-readable inventory commands, richest first.
        inventories: &'static [InventoryCommand],
    }

    struct InventoryCommand {
        args: &'static [&'static str],
        kind: InventoryKind,
    }

    enum InventoryKind {
        /// JSON array of dotted command strings ("commands" at the root).
        RootStringArray(&'static str),
        /// JSON array of objects under "actions" carrying "action_ref".
        ActionRefs(&'static str),
        /// JSON object under "data" with an "actions" array of "id" strings.
        DataActionIds,
        /// JSON service operation names under ["service"]["operations"].
        ServiceOperations,
        /// Product namespaces, aliases and executables from `oi products`.
        ProductField,
        /// `help`/`--help` text graph, always available.
        HelpGraph,
    }

    const PRODUCTS: &[ProductSpec] = &[
        ProductSpec {
            id: "central",
            binary: "ctrl",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["actions", "--json"],
                    kind: InventoryKind::DataActionIds,
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        ProductSpec {
            id: "actuation",
            binary: "actuation",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["system", "--json"],
                    kind: InventoryKind::ActionRefs("actuation."),
                },
                InventoryCommand {
                    args: &["help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        ProductSpec {
            id: "ai-kit",
            binary: "aikit",
            skill_dirs: &[],
            extra_files: &["AGENTS.md"],
            inventories: &[
                InventoryCommand {
                    args: &["system", "--json"],
                    kind: InventoryKind::ActionRefs("aikit."),
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        ProductSpec {
            id: "software-factory",
            binary: "factory",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["capabilities", "--json"],
                    kind: InventoryKind::RootStringArray("commands"),
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        ProductSpec {
            id: "workcell",
            binary: "workcell",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["system", "--json"],
                    kind: InventoryKind::ActionRefs("workcell."),
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        ProductSpec {
            id: "quaternal-logic",
            binary: "ql",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["capabilities", "--json"],
                    kind: InventoryKind::ServiceOperations,
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
        // O:I itself: the binary under test is CARGO_BIN_EXE_oi, skills live in this repo.
        ProductSpec {
            id: "oi",
            binary: "oi",
            skill_dirs: &["skills"],
            extra_files: &[],
            inventories: &[
                InventoryCommand {
                    args: &["products", "--json"],
                    kind: InventoryKind::ProductField,
                },
                InventoryCommand {
                    args: &["--help"],
                    kind: InventoryKind::HelpGraph,
                },
            ],
        },
    ];

    /// The command inventory a product's discovery surface yielded.
    #[derive(Default)]
    struct Inventory {
        first_tokens: BTreeSet<String>,
        dotted: BTreeSet<String>,
        served_via: Vec<String>,
    }

    impl Inventory {
        fn admits(&self, tokens: &[String]) -> bool {
            if tokens.is_empty() {
                return true;
            }
            if self.first_tokens.contains(&tokens[0]) {
                return true;
            }
            let mut dotted = tokens[0].clone();
            for token in &tokens[1..] {
                dotted.push('.');
                dotted.push_str(token);
                if self.dotted.contains(&dotted) {
                    return true;
                }
            }
            false
        }

        fn note(
            &mut self,
            surface: String,
            tokens: impl IntoIterator<Item = String>,
            dotted: &[String],
            detail: String,
        ) {
            for token in tokens {
                self.first_tokens.insert(token);
            }
            for value in dotted {
                self.dotted.insert(value.clone());
            }
            self.served_via.push(format!("{surface} ({detail})"));
        }
    }

    fn run_capture(executable: &Path, args: &[&str]) -> Option<Output> {
        Command::new(executable).args(args).output().ok()
    }

    fn stdout_string(output: &Output) -> String {
        String::from_utf8_lossy(&output.stdout).into_owned()
    }

    /// Extract scannable units for command references: fenced code block lines
    /// and closed backticked code spans. The context is the whole paragraph
    /// (or fence) a unit sits in — markdown soft-wraps sentences, and R4
    /// reads the sentence around a path. Prose mention is not an invocation.
    fn scannable_units(skill_text: &str) -> Vec<(String, String, bool)> {
        let mut units = Vec::new();
        let mut para_lines: Vec<String> = Vec::new();
        let mut para_units: Vec<String> = Vec::new();
        let mut fence_lines: Vec<String> = Vec::new();
        let mut in_fence = false;

        let flush_paragraph = |units: &mut Vec<(String, String, bool)>,
                               para_lines: &mut Vec<String>,
                               para_units: &mut Vec<String>| {
            if !para_units.is_empty() {
                let context = para_lines.join("\n");
                for unit in para_units.drain(..) {
                    units.push((unit, context.clone(), false));
                }
            }
            para_lines.clear();
        };

        for line in skill_text.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("```") {
                flush_paragraph(&mut units, &mut para_lines, &mut para_units);
                if in_fence {
                    let context = fence_lines.join("\n");
                    for fence_line in &fence_lines {
                        units.push((fence_line.clone(), context.clone(), true));
                    }
                    fence_lines.clear();
                    in_fence = false;
                } else {
                    in_fence = true;
                }
                continue;
            }
            if in_fence {
                fence_lines.push(trimmed.to_string());
                continue;
            }
            if trimmed.is_empty() {
                flush_paragraph(&mut units, &mut para_lines, &mut para_units);
                continue;
            }
            para_lines.push(trimmed.to_string());
            for span in trimmed.split('`').skip(1).step_by(2) {
                para_units.push(span.trim().to_string());
            }
        }
        flush_paragraph(&mut units, &mut para_lines, &mut para_units);
        units
    }

    /// Reduce a unit to the argv token runs that follow the binary name,
    /// skipping leading flags and placeholder tokens.
    fn command_token_runs(unit: &str, binary: &str) -> Vec<Vec<String>> {
        let mut runs = Vec::new();
        let words: Vec<String> = unit
            .split_whitespace()
            .map(|word| {
                word.trim_matches(|c: char| "`,;()\"'".contains(c))
                    .to_string()
            })
            .filter(|word| !word.is_empty())
            .collect();
        for index in 0..words.len() {
            let after_label = index > 0 && words[index - 1].ends_with(':');
            if words[index] != binary || after_label {
                continue;
            }
            let mut tokens = Vec::new();
            let mut cursor = index + 1;
            while cursor < words.len() && tokens.len() < 3 {
                let word = &words[cursor];
                if word.starts_with('-') || word.starts_with('<') || word.starts_with('[') {
                    cursor += 1;
                    continue;
                }
                let candidate = word
                    .split('|')
                    .next()
                    .unwrap_or("")
                    .trim_matches(|c: char| ".,]()>".contains(c));
                if candidate.is_empty() {
                    // A bare "|" alternation inside a usage line continues the run.
                    if word == "|" {
                        cursor += 1;
                        continue;
                    }
                    break;
                }
                let is_token = candidate
                    .chars()
                    .next()
                    .map(|c| c.is_ascii_lowercase())
                    .unwrap_or(false)
                    && candidate.chars().all(|c| {
                        c.is_ascii_lowercase()
                            || c.is_ascii_digit()
                            || c == '-'
                            || c == '_'
                            || c == '.'
                    });
                if !is_token {
                    break;
                }
                tokens.push(candidate.to_string());
                cursor += 1;
            }
            if !tokens.is_empty() {
                runs.push(tokens);
            }
        }
        runs
    }

    /// First-word tokens of commands in a help graph: both `<binary> token`
    /// usage lines and indented `Commands:` section entries.
    fn parse_help_tokens(help: &str, binary: &str) -> BTreeSet<String> {
        let mut tokens = BTreeSet::new();
        let mut in_commands_section = false;
        for line in help.lines() {
            let trimmed = line.trim_end();
            if trimmed.trim() == "Commands:" {
                in_commands_section = true;
                continue;
            }
            if in_commands_section {
                if !trimmed.starts_with("  ") {
                    in_commands_section = false;
                } else if let Some(word) = trimmed.split_whitespace().next() {
                    let name = word.split('[').next().unwrap_or(word);
                    let is_name = name
                        .chars()
                        .next()
                        .map(|c| c.is_ascii_lowercase())
                        .unwrap_or(false)
                        && name
                            .chars()
                            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
                    if is_name {
                        tokens.insert(name.to_string());
                    }
                    continue;
                }
            }
            // Usage lines begin with the binary itself; prose lines are ignored.
            // An alternation line ("ctrl root | init | doctor") declares every
            // listed command, so all its run tokens are inserted.
            let usage = trimmed.trim_start();
            if usage.starts_with(binary)
                && usage[binary.len()..]
                    .chars()
                    .next()
                    .map(|c| c.is_whitespace())
                    .unwrap_or(false)
            {
                let alternation = usage.contains(" | ");
                for run in command_token_runs(usage, binary) {
                    if alternation {
                        for token in &run {
                            tokens.insert(token.clone());
                        }
                    } else if let Some(first) = run.first() {
                        tokens.insert(first.clone());
                    }
                }
            }
        }
        tokens
    }

    fn dotted_first_segments(values: &[String]) -> Vec<String> {
        values
            .iter()
            .filter_map(|value| value.split('.').next().map(|segment| segment.to_string()))
            .collect()
    }

    /// All `"key": "value"` string values anywhere in a JSON payload,
    /// tolerating the few shapes this harness reads.
    fn json_string_field_values(payload: &str, key: &str) -> Vec<String> {
        let mut values = Vec::new();
        let mut search_from = 0;
        while let Some(position) = payload[search_from..].find(&format!("\"{key}\"")) {
            let absolute = search_from + position;
            let tail = &payload[absolute + key.len() + 2..];
            let Some(colon) = tail.find(':') else { break };
            let after = tail[colon + 1..].trim_start();
            if let Some(rest) = after.strip_prefix('"') {
                if let Some(end) = rest.find('"') {
                    values.push(rest[..end].to_string());
                }
            }
            search_from = absolute + key.len() + 2;
        }
        values
    }

    /// All `"key": ["a", "b", ...]` string-array values in a JSON payload.
    fn json_string_array_values(payload: &str, key: &str) -> Vec<String> {
        let mut values = Vec::new();
        let mut search_from = 0;
        while let Some(position) = payload[search_from..].find(&format!("\"{key}\"")) {
            let absolute = search_from + position;
            let tail = &payload[absolute + key.len() + 2..];
            let Some(colon) = tail.find(':') else { break };
            let after = &tail[colon + 1..];
            let Some(open) = after.find('[') else { break };
            let Some(close) = after[open..].find(']') else {
                break;
            };
            let body = &after[open + 1..open + close];
            let mut parts = body.split('"');
            while let Some(part) = parts.next() {
                if part.ends_with('\\') || part.is_empty() {
                    continue;
                }
                if let Some(value) = parts.next() {
                    values.push(value.to_string());
                }
            }
            search_from = absolute + key.len() + 2;
        }
        values
    }

    /// The "actions" array of objects that follows a JSON key, read as the
    /// values of one string field of each object. The array bound is found
    /// with bracket-depth scanning so nested arrays inside one action do not
    /// truncate the window.
    fn json_action_field_values(
        payload: &str,
        array_key: &str,
        field: &str,
    ) -> Option<Vec<String>> {
        let array_start = payload.find(&format!("\"{array_key}\""))?;
        let window = &payload[array_start..];
        let open = window.find('[')?;
        let mut depth = 0usize;
        let mut in_string = false;
        let mut escaped = false;
        let mut window_end = window.len();
        for (offset, character) in window[open..].char_indices() {
            if in_string {
                if escaped {
                    escaped = false;
                } else if character == '\\' {
                    escaped = true;
                } else if character == '"' {
                    in_string = false;
                }
                continue;
            }
            match character {
                '"' => in_string = true,
                '[' => depth += 1,
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        window_end = open + offset + 1;
                        break;
                    }
                }
                _ => {}
            }
        }
        Some(json_string_field_values(&window[..window_end], field))
    }

    fn collect_inventory(spec: &ProductSpec, executable: &Path) -> Result<Inventory, String> {
        let mut inventory = Inventory::default();
        let mut any_surface = false;
        for command in spec.inventories {
            let Some(output) = run_capture(executable, command.args) else {
                continue;
            };
            if !output.status.success() {
                continue;
            }
            let stdout = stdout_string(&output);
            let served = format!("{} {}", spec.binary, command.args.join(" "));
            match &command.kind {
                InventoryKind::HelpGraph => {
                    let tokens = parse_help_tokens(&stdout, spec.binary);
                    let count = tokens.len();
                    inventory.note(served, tokens, &[], format!("help graph, {count} tokens"));
                    any_surface = true;
                }
                InventoryKind::RootStringArray(key) => {
                    let values = json_string_array_values(&stdout, key);
                    if !values.is_empty() {
                        let detail = format!("{} entries", values.len());
                        let segments = dotted_first_segments(&values);
                        inventory.note(served, segments, &values, detail);
                        any_surface = true;
                    }
                }
                InventoryKind::ActionRefs(prefix) => {
                    let refs = json_action_field_values(&stdout, "actions", "action_ref");
                    if let Some(refs) = refs {
                        if !refs.is_empty() {
                            let stripped: Vec<String> = refs
                                .iter()
                                .map(|value| {
                                    value.strip_prefix(prefix).unwrap_or(value).to_string()
                                })
                                .collect();
                            let detail = format!("{} actions", stripped.len());
                            let segments = dotted_first_segments(&stripped);
                            inventory.note(served, segments, &stripped, detail);
                            any_surface = true;
                        }
                    }
                }
                InventoryKind::DataActionIds => {
                    let ids = json_action_field_values(&stdout, "actions", "id");
                    if let Some(ids) = ids {
                        if !ids.is_empty() {
                            let detail = format!("{} actions", ids.len());
                            let segments = dotted_first_segments(&ids);
                            inventory.note(served, segments, &ids, detail);
                            any_surface = true;
                        }
                    }
                }
                InventoryKind::ServiceOperations => {
                    let operations = json_action_field_values(&stdout, "operations", "operation");
                    if let Some(operations) = operations {
                        if !operations.is_empty() {
                            let detail = format!("{} operations", operations.len());
                            let segments = dotted_first_segments(&operations);
                            inventory.note(served, segments, &operations, detail);
                            any_surface = true;
                        }
                    }
                }
                InventoryKind::ProductField => {
                    let mut names = json_string_field_values(&stdout, "namespace");
                    names.extend(json_string_field_values(&stdout, "executable"));
                    names.extend(json_string_array_values(&stdout, "aliases"));
                    if !names.is_empty() {
                        let detail = format!("{} names", names.len());
                        inventory.note(served, names, &[], detail);
                        any_surface = true;
                    }
                }
            }
        }
        if !any_surface {
            return Err(format!(
                "no discovery surface of `{}` could be executed or parsed",
                spec.binary
            ));
        }
        Ok(inventory)
    }

    fn env_path(name: &str) -> Option<PathBuf> {
        std::env::var_os(name)
            .map(PathBuf::from)
            .filter(|value| !value.as_os_str().is_empty())
    }

    fn checkout_dir(product_id: &str) -> &'static str {
        match product_id {
            "central" => "Central",
            "actuation" => "Actuation",
            "ai-kit" => "ai-kit",
            "software-factory" => "Factory",
            "workcell" => "Workcell",
            "quaternal-logic" => "Quaternal-Logic",
            _ => "O-I",
        }
    }

    fn locate_binary(spec: &ProductSpec, workspace: Option<&Path>) -> Option<PathBuf> {
        let override_name = format!(
            "OI_CONFORMANCE_BIN_{}",
            spec.id.to_ascii_uppercase().replace('-', "_")
        );
        if let Some(explicit) = env_path(&override_name) {
            if explicit.is_file() {
                return Some(explicit);
            }
        }
        if spec.id == "oi" {
            return Some(PathBuf::from(env!("CARGO_BIN_EXE_oi")));
        }
        if let Some(path_variable) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_variable) {
                let candidate = dir.join(spec.binary);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
        let built = workspace?
            .join(checkout_dir(spec.id))
            .join("target")
            .join("release")
            .join(spec.binary);
        built.is_file().then_some(built)
    }

    fn workspace_root() -> Option<PathBuf> {
        if let Some(root) = env_path("OI_CONFORMANCE_WORK_ROOT") {
            if root.is_dir() {
                return Some(root);
            }
        }
        let default = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        if default.is_dir() && default.join("Central").is_dir() && default.join("Factory").is_dir()
        {
            return Some(default);
        }
        None
    }

    fn skill_files(checkout: &Path, spec: &ProductSpec) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for dir in spec.skill_dirs {
            let Ok(entries) = std::fs::read_dir(checkout.join(dir)) else {
                continue;
            };
            for entry in entries.flatten() {
                let candidate = entry.path().join("SKILL.md");
                if candidate.is_file() {
                    files.push(candidate);
                }
            }
        }
        for extra in spec.extra_files {
            let candidate = checkout.join(extra);
            if candidate.is_file() {
                files.push(candidate);
            }
        }
        files.sort();
        files
    }

    fn frontmatter_field(frontmatter: &str, field: &str) -> Option<String> {
        let needle = format!("{field}:");
        frontmatter.lines().find_map(|line| {
            line.strip_prefix(&needle).map(|value| {
                value
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string()
            })
        })
    }

    /// A backticked span that claims to be a repository-relative path.
    /// GitHub owner/repo refs, ground paths (non-lowercase heads), protocol
    /// and contract names ("workcell.control/v1"), typed cross-product refs
    /// ("skill/factory-native/..."), media types and placeholders are not
    /// repository paths.
    fn as_repo_path(unit: &str) -> Option<String> {
        if unit.contains(char::is_whitespace)
            || unit.contains("..")
            || unit.starts_with('/')
            || unit.contains('<')
            || unit.contains('>')
            || unit.contains(':')
            || !unit.contains('/')
        {
            return None;
        }
        let parts: Vec<&str> = unit.split('/').collect();
        if parts.len() < 2 || parts.iter().any(|part| part.is_empty()) {
            return None;
        }
        let lowercase_head = parts[0]
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_');
        if !lowercase_head {
            return None;
        }
        let typed_ref_heads = [
            "skill",
            "skills",
            "profile",
            "profiles",
            "method",
            "routine",
            "context",
            "knowledge",
            "capability",
        ];
        let media_heads = [
            "application",
            "text",
            "image",
            "audio",
            "video",
            "model",
            "font",
        ];
        if typed_ref_heads.contains(&parts[0]) || media_heads.contains(&parts[0]) {
            return None;
        }
        let dotted_segment = parts[..parts.len() - 1]
            .iter()
            .any(|part| part.contains('.'));
        let version_tail = parts
            .last()
            .map(|part| {
                let mut chars = part.chars();
                chars.next() == Some('v') && chars.all(|c| c.is_ascii_digit()) && part.len() > 1
            })
            .unwrap_or(false);
        if dotted_segment || version_tail {
            return None;
        }
        Some(unit.to_string())
    }

    /// The sentence around a path says the thing is intentionally absent.
    fn context_names_intentional_absence(context: &str) -> bool {
        let lowered = context.to_lowercase();
        [
            "gone",
            "removed",
            "retired",
            "deleted",
            "historical",
            "formerly",
            "previously",
        ]
        .iter()
        .any(|word| lowered.contains(word))
    }

    /// The sentence around a path marks the material as pending/branch work.
    /// ("candidate" is deliberately absent: it is a Factory product noun.)
    fn context_names_pending_material(context: &str) -> bool {
        let lowered = context.to_lowercase();
        ["pending", "unratified", "ratification"]
            .iter()
            .any(|word| lowered.contains(word))
    }

    struct SkillAudit {
        failures: Vec<String>,
        residuals: Vec<String>,
    }

    fn audit_skill(
        skill_path: &Path,
        checkout: &Path,
        spec: &ProductSpec,
        inventories: &[(String, Inventory)],
        workspace: Option<&Path>,
    ) -> SkillAudit {
        let mut audit = SkillAudit {
            failures: Vec::new(),
            residuals: Vec::new(),
        };
        let label = format!(
            "{}:{}",
            checkout_dir(spec.id),
            skill_path
                .strip_prefix(checkout)
                .unwrap_or(skill_path)
                .display()
        );
        let Ok(text) = std::fs::read_to_string(skill_path) else {
            audit.failures.push(format!("{label}: unreadable"));
            return audit;
        };
        let is_skill_file = skill_path
            .file_name()
            .is_some_and(|name| name == "SKILL.md");

        // R1 + R2 apply to Skill files; standalone guidance files get R3-R5 only.
        if is_skill_file {
            let Some(rest) = text.strip_prefix("---\n") else {
                audit
                    .failures
                    .push(format!("{label}: missing '---' frontmatter (R1)"));
                return audit;
            };
            let (frontmatter, body) = match rest.find("\n---") {
                Some(index) => (&rest[..index], &rest[index + 4..]),
                None => {
                    audit
                        .failures
                        .push(format!("{label}: unterminated frontmatter (R1)"));
                    ("", rest)
                }
            };
            if !frontmatter.is_empty() {
                match frontmatter_field(frontmatter, "name") {
                    Some(name) if !name.is_empty() => {}
                    _ => audit
                        .failures
                        .push(format!("{label}: frontmatter has no name (R1)")),
                }
                match frontmatter_field(frontmatter, "description") {
                    Some(description) if description.chars().count() >= 40 => {}
                    _ => audit.failures.push(format!(
                        "{label}: frontmatter description missing or under 40 characters (R1)"
                    )),
                }
            }
            // The trigger may live in the frontmatter description or the body.
            let description_cue = frontmatter_field(frontmatter, "description")
                .map(|value| value.to_lowercase())
                .unwrap_or_default();
            let opening = body
                .lines()
                .take(12)
                .collect::<Vec<_>>()
                .join("\n")
                .to_lowercase();
            let trigger_cues = [
                "use this skill when",
                "use this skill to",
                "use this skill only",
                "use when",
                "use at",
                "use for",
                "required for",
            ];
            let trigger_cue = trigger_cues
                .iter()
                .any(|cue| opening.contains(cue) || description_cue.contains(cue));
            if !trigger_cue {
                audit.failures.push(format!(
                    "{label}: no routing/trigger statement in description or opening lines (R2)"
                ));
            }
        }

        // R3: every named command for every binary exists in its inventory.
        let units = scannable_units(&text);
        let mut invocation_count = 0;
        for (unit, _context, _in_fence) in &units {
            for (product_id, inventory) in inventories {
                let binary = PRODUCTS
                    .iter()
                    .find(|candidate| candidate.id == product_id)
                    .map(|candidate| candidate.binary)
                    .unwrap_or_default();
                for tokens in command_token_runs(unit, binary) {
                    invocation_count += 1;
                    if !inventory.admits(&tokens) {
                        audit.failures.push(format!(
                            "{label}: names `{} {}` which the {product_id} discovery surface does not declare (R3)",
                            binary,
                            tokens.join(" ")
                        ));
                    }
                }
            }
        }
        if invocation_count == 0 {
            audit.residuals.push(format!(
                "{label}: no direct command invocations found; procedure-to-CLI fit needs owner review (R3 residual)"
            ));
        }

        // R4: backticked repository-relative paths exist. Absent paths are
        // classified honestly: diagram/shape paths in fences, intentional-
        // absence and pending-material contexts, and cross-product
        // occurrences are residuals; a path claimed live and existing
        // nowhere is a failure.
        for (unit, context, in_fence) in &units {
            if let Some(path) = as_repo_path(unit) {
                if checkout.join(&path).exists() {
                    continue;
                }
                if *in_fence {
                    audit.residuals.push(format!(
                        "{label}: diagram names path `{path}` which does not exist; owner review (R4 residual)"
                    ));
                } else if context_names_intentional_absence(context) {
                    audit.residuals.push(format!(
                        "{label}: names `{path}` as intentionally absent; owner review (R4 residual)"
                    ));
                } else if context_names_pending_material(context) {
                    audit.residuals.push(format!(
                        "{label}: names `{path}` as pending/branch material; owner review (R4 residual)"
                    ));
                } else if workspace.is_some_and(|root| root.join(&path).exists()) {
                    audit.residuals.push(format!(
                        "{label}: names `{path}` which exists in another checkout, not this one (R4 residual)"
                    ));
                } else {
                    audit.failures.push(format!(
                        "{label}: names path `{path}` which does not exist in the checkout (R4)"
                    ));
                }
            }
        }

        // R5: verification is named (Skill files only).
        if is_skill_file {
            let lowered = text.to_lowercase();
            let names_verification = lowered.contains("verify")
                || lowered.contains("verification")
                || lowered.contains("doctor");
            if !names_verification {
                audit
                    .failures
                    .push(format!("{label}: names no verification path (R5)"));
            }

            // R6: recovery named when the skill can mutate; absence is a residual.
            let mutation_vocabulary = [
                "mutate",
                "mutation",
                " apply",
                "install",
                "invoke",
                "actualise",
                "record",
                "write",
            ];
            let recovery_vocabulary = [
                "recover", "recovery", "rollback", "undo", "revert", "restore", "backup", "refuse",
                "refusal", "discard",
            ];
            let can_mutate = mutation_vocabulary
                .iter()
                .any(|word| lowered.contains(word));
            let names_recovery = recovery_vocabulary
                .iter()
                .any(|word| lowered.contains(word));
            if can_mutate && !names_recovery {
                audit.residuals.push(format!(
                    "{label}: mutating skill names no recovery path; owner review required (R6 residual)"
                ));
            }
        }

        audit
    }

    fn oi_checkout() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    #[test]
    fn oi_skill_names_only_served_commands() {
        let spec = PRODUCTS
            .iter()
            .find(|candidate| candidate.id == "oi")
            .unwrap();
        let checkout = oi_checkout();
        let executable = PathBuf::from(env!("CARGO_BIN_EXE_oi"));

        let version = run_capture(&executable, &["--version"]).expect("run oi --version");
        assert!(version.status.success(), "oi --version failed");
        println!(
            "oi under test: {} [{}]",
            stdout_string(&version).trim(),
            executable.display()
        );

        let inventory = collect_inventory(spec, &executable).expect("oi discovery inventory");
        for surface in &inventory.served_via {
            println!("oi inventory: {surface}");
        }
        assert!(
            inventory.first_tokens.contains("central") && inventory.first_tokens.contains("ql"),
            "oi discovery inventory must disclose the six product namespaces; got {:?}",
            inventory.served_via
        );

        // O:I Skills route to the products too; check those references only
        // against product binaries that are actually locatable here.
        let mut inventories = vec![("oi".to_string(), inventory)];
        let workspace = workspace_root();
        for candidate in PRODUCTS.iter().filter(|candidate| candidate.id != "oi") {
            if let Some(binary) = locate_binary(candidate, workspace.as_deref()) {
                if let Ok(product_inventory) = collect_inventory(candidate, &binary) {
                    inventories.push((candidate.id.to_string(), product_inventory));
                }
            }
        }

        let mut failures = Vec::new();
        for skill in skill_files(&checkout, spec) {
            failures.extend(
                audit_skill(&skill, &checkout, spec, &inventories, workspace.as_deref()).failures,
            );
        }
        assert!(
            failures.is_empty(),
            "O:I Skills name commands or paths the served surfaces do not declare:\n{}",
            failures.join("\n")
        );
    }

    #[test]
    fn product_skills_conform_to_discovery_inventories() {
        let Some(workspace) = workspace_root() else {
            println!(
                "SKIP product skill conformance: no sibling workspace (set OI_CONFORMANCE_WORK_ROOT); \
                 sibling material is a cross-product concern"
            );
            return;
        };

        // Pass one: serve every product's discovery inventory first, so any
        // product's Skill can be checked against any other product's surface.
        let mut inventories: Vec<(String, Inventory)> = Vec::new();
        let mut blocks: Vec<String> = Vec::new();
        let mut residuals: Vec<String> = Vec::new();
        let mut failures: Vec<String> = Vec::new();

        for spec in PRODUCTS {
            let product_id = spec.id.to_string();
            let checkout = if spec.id == "oi" {
                oi_checkout()
            } else {
                workspace.join(checkout_dir(spec.id))
            };
            if !checkout.is_dir() {
                blocks.push(format!(
                    "{product_id}: checkout {} absent; checks skipped (explicit)",
                    checkout.display()
                ));
                continue;
            }
            let Some(executable) = locate_binary(spec, Some(&workspace)) else {
                residuals.push(format!(
                    "{product_id}: binary not found (PATH, target/release or OI_CONFORMANCE_BIN_*); \
                     command-existence checks not executed against a served surface (R8 residual)"
                ));
                continue;
            };
            let version = run_capture(&executable, &["--version"]);
            let Some(version) = version.filter(|output| output.status.success()) else {
                failures.push(format!("{product_id}: binary present but --version failed"));
                continue;
            };
            match collect_inventory(spec, &executable) {
                Ok(inventory) => {
                    for surface in &inventory.served_via {
                        blocks.push(format!("{product_id}: inventory via {surface}"));
                    }
                    inventories.push((product_id.clone(), inventory));
                }
                Err(message) => {
                    failures.push(format!("{product_id}: {message}"));
                    continue;
                }
            }
            blocks.push(format!(
                "{product_id}: binary {} [{}]",
                executable.display(),
                stdout_string(&version).trim()
            ));
        }

        // Pass two: audit every product's Skill material.
        for spec in PRODUCTS {
            let checkout = if spec.id == "oi" {
                oi_checkout()
            } else {
                workspace.join(checkout_dir(spec.id))
            };
            if !checkout.is_dir() {
                continue;
            }
            for skill in skill_files(&checkout, spec) {
                let audit = audit_skill(&skill, &checkout, spec, &inventories, Some(&workspace));
                failures.extend(audit.failures);
                residuals.extend(audit.residuals);
            }
        }

        println!("== Skill/SDK conformance run ==");
        for line in &blocks {
            println!("surface: {line}");
        }
        for line in &residuals {
            println!("MANUAL RESIDUAL: {line}");
        }
        for line in &blocks {
            if line.contains("absent") {
                println!("BLOCKED: {line}");
            }
        }
        assert!(
            failures.is_empty(),
            "product Skill material drifts from served reality:\n{}",
            failures.join("\n")
        );
    }

    #[test]
    fn command_extraction_is_precise() {
        // Flags and placeholders are not commands.
        let runs = command_token_runs(
            "ctrl --json --root <root> action run <action-id> '<JSON>'",
            "ctrl",
        );
        assert_eq!(runs, vec![vec!["action".to_string(), "run".to_string()]]);

        let runs = command_token_runs("oi migrate <path>", "oi");
        assert_eq!(runs, vec![vec!["migrate".to_string()]]);

        let runs = command_token_runs("actuation agency actualise [file|-] [--json]", "actuation");
        assert_eq!(
            runs,
            vec![vec!["agency".to_string(), "actualise".to_string()]]
        );

        // Labelled occurrences ("owner: ctrl ...") are not invocations; a
        // later unlabelled occurrence still is.
        assert!(command_token_runs("owner: ctrl action", "ctrl").is_empty());
        let runs = command_token_runs("see the aikit: use aikit tree", "aikit");
        assert_eq!(runs, vec![vec!["tree".to_string()]]);

        // Usage alias lines yield no false token runs.
        assert!(command_token_runs(
            "oi central ...      -> ctrl ...        (alias: oi ctrl)",
            "ctrl"
        )
        .is_empty());

        // Help-graph parsing reads usage lines and Commands: sections, and
        // keeps "|" alternations ("ctrl root | init | doctor") together.
        let tokens = parse_help_tokens(
            "Usage:\n  ctrl --version\n  ctrl action run <ACTION>\n  ctrl root | init | doctor\n\nCommands:\n  source     Manage pinned sources\n  ui         Open the palette\n",
            "ctrl",
        );
        assert!(tokens.contains("action") && tokens.contains("source") && tokens.contains("ui"));
        assert!(tokens.contains("root") && tokens.contains("init") && tokens.contains("doctor"));
        assert!(!tokens.contains("--version"));

        // Prose that merely mentions the binary is not a usage line.
        let tokens = parse_help_tokens("The aikit binary: CLI contract, JSON envelope.\n", "aikit");
        assert!(tokens.is_empty());

        // Dotted inventories admit family references, not invented leaves.
        let mut inventory = Inventory::default();
        inventory
            .dotted
            .insert("development.commission".to_string());
        assert!(inventory.admits(&["development".into(), "commission".into()]));
        assert!(!inventory.admits(&["development".into(), "unknown".into()]));

        // Non-path spans: protocol names, GitHub refs, ground paths, typed
        // refs, media types, placeholders, trailing-slash dir stems.
        assert_eq!(as_repo_path("workcell.control/v1"), None);
        assert_eq!(as_repo_path("actuation.agency/v1"), None);
        assert_eq!(as_repo_path("EpiLogos/QL-MEF"), None);
        assert_eq!(as_repo_path("Control/machines"), None);
        assert_eq!(
            as_repo_path("Work/<Name>/ProjectCentral/project.json"),
            None
        );
        assert_eq!(
            as_repo_path("skill/factory-native/factory-bounded-work"),
            None
        );
        assert_eq!(as_repo_path("application/json"), None);
        assert_eq!(as_repo_path("okf-wiki/spaces/:project-wiki"), None);
        assert_eq!(as_repo_path("user/"), None);
        assert_eq!(
            as_repo_path("docs/CONTROL-CONTENT-PROTOCOL.md").as_deref(),
            Some("docs/CONTROL-CONTENT-PROTOCOL.md")
        );
        assert_eq!(
            as_repo_path("crates/actuation-core/src/agency.rs").as_deref(),
            Some("crates/actuation-core/src/agency.rs")
        );
        assert_eq!(as_repo_path("desktop/ui").as_deref(), Some("desktop/ui"));
    }
}
