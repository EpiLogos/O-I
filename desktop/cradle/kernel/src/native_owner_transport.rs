//! Qualified native ownership across the existing authenticated Gateway.
//! Offers contain addresses only. Native state, CAS and receipts remain here.
use crate::{Kernel, KernelOp, KernelOpOutcome, KernelOpResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Describe {
        world_ref: String,
    },
    Apply {
        world_ref: String,
        expected_owner_generation: String,
        request: Box<KernelOp>,
    },
}

pub fn admitted(request: &KernelOp) -> bool {
    matches!(
        request,
        KernelOp::Receiving { .. }
            | KernelOp::Encounter { .. }
            | KernelOp::EncounterTaskRead { .. }
            | KernelOp::Expression { .. }
    )
}
fn qualified(world: &str) -> bool {
    world.starts_with("world:") && world.len() > 6 && world.len() <= 512 && world.trim() == world
}

pub struct NativeOwner {
    world_ref: String,
    generation: String,
    grants: PathBuf,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NativeGrants {
    schema: String,
    world_ref: String,
    operations: Vec<KernelOp>,
}
impl NativeOwner {
    /// Finite exact operation offers. No wildcard grants, collection-wide
    /// scopes or renderer-supplied roots. The owner can revise/withdraw the
    /// private offer; each request reads it again before interpreting effects.
    pub fn new(world_ref: String, grants: PathBuf) -> Result<Self, String> {
        if !qualified(&world_ref) {
            return Err("Native owner requires an exact qualified World".into());
        }
        let mut bytes = [0u8; 24];
        getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
        let generation = format!(
            "oi:native-owner-generation:{}",
            bytes.iter().map(|v| format!("{v:02x}")).collect::<String>()
        );
        Ok(Self {
            world_ref,
            generation,
            grants,
        })
    }
    fn grants(&self) -> Result<NativeGrants, String> {
        let refusal = |message: String| {
            format!("native_owner.grant_refused: {message}; effects were not performed")
        };
        let metadata = std::fs::symlink_metadata(&self.grants)
            .map_err(|_| refusal("Native operation offer is unavailable".into()))?;
        if !metadata.is_file() || metadata.len() > 1024 * 1024 {
            return Err(refusal(
                "Exact native operation offer must be a bounded regular file".into(),
            ));
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, PermissionsExt};
            if metadata.permissions().mode() & 0o077 != 0
                || metadata.uid() != unsafe { libc::geteuid() }
            {
                return Err(refusal(
                    "Exact native operation offer must belong to this owner and be owner-only"
                        .into(),
                ));
            }
        }
        let grants: NativeGrants = serde_json::from_slice(
            &std::fs::read(&self.grants)
                .map_err(|_| refusal("Native operation offer is unreadable".into()))?,
        )
        // Serde errors can quote a private grant input. No offer body or
        // owner-local path may escape through the count-only Describe route.
        .map_err(|_| refusal("Native operation offer is invalid".into()))?;
        if grants.schema != "oi.native-owner-grants/v1"
            || grants.world_ref != self.world_ref
            || grants.operations.len() > 256
            || grants.operations.iter().any(|op| !admitted(op))
        {
            return Err(refusal(
                "Invalid or differently owned native operation offer".into(),
            ));
        }
        Ok(grants)
    }
    fn procedural_admitted_request<'a>(
        &self,
        input: &'a Request,
    ) -> Result<Option<&'a KernelOp>, String> {
        let world = match input {
            Request::Describe { world_ref } | Request::Apply { world_ref, .. } => world_ref,
        };
        if world != &self.world_ref {
            return Err(
                "native_owner.wrong_world: this owner does not own the requested World".into(),
            );
        }
        let Request::Apply {
            expected_owner_generation,
            request,
            ..
        } = input
        else {
            return Ok(None);
        };
        if expected_owner_generation != &self.generation {
            return Err("native_owner.stale_generation: describe this fresh owner before operating; effects were not performed".into());
        }
        if !admitted(request) {
            return Err("native_owner.operation_refused: this offer admits native document, Expression and session operations only".into());
        }
        if !self
            .grants()?
            .operations
            .iter()
            .any(|op| op == request.as_ref())
        {
            return Err("native_owner.grant_refused: this exact subject, verb and input were not offered by the native World owner; effects were not performed".into());
        }
        Ok(Some(request))
    }
    pub fn prepare_native_procedural_manual(
        &self,
        kernel: &Kernel,
        input: &Request,
    ) -> Result<Option<crate::native_expression::procedural::manual::Prepared>, String> {
        match self.procedural_admitted_request(input)? {
            Some(request) => kernel.prepare_native_procedural_manual(request),
            None => Ok(None),
        }
    }
    pub fn finish_native_procedural_manual(
        &self,
        kernel: &mut Kernel,
        input: Request,
        completed: crate::native_expression::procedural::manual::Completed,
    ) -> Result<Value, String> {
        let original = self
            .procedural_admitted_request(&input)?
            .ok_or("Native attribution completion cannot answer Describe")?;
        let KernelOp::Expression { request } = original else {
            return Err("Native attribution completion belongs to an Expression operation".into());
        };
        if request != completed.original() {
            return Err(
                "Native attribution completion differs from the exact offered operation".into(),
            );
        }
        let outcome = kernel.finish_native_procedural_manual(completed)?;
        Ok(json!({"world_ref":self.world_ref,"owner_generation":self.generation,"outcome":outcome}))
    }
    pub fn apply(&self, kernel: &mut Kernel, request: Request) -> Result<Value, String> {
        let world = match &request {
            Request::Describe { world_ref } | Request::Apply { world_ref, .. } => world_ref,
        };
        if world != &self.world_ref {
            return Err(
                "native_owner.wrong_world: this owner does not own the requested World".into(),
            );
        }
        match request {
            Request::Describe { .. } => Ok(
                json!({"world_ref":self.world_ref,"owner_generation":self.generation,"grant_mode":"exact-native-operations","offered_operation_count":self.grants()?.operations.len()}),
            ),
            Request::Apply {
                expected_owner_generation,
                request,
                ..
            } => {
                if expected_owner_generation != self.generation {
                    return Err("native_owner.stale_generation: describe this fresh owner before operating; effects were not performed".into());
                }
                if !admitted(&request) {
                    return Err("native_owner.operation_refused: this offer admits native document, Expression and session operations only".into());
                }
                if !self.grants()?.operations.iter().any(|op| op == &*request) {
                    return Err("native_owner.grant_refused: this exact subject, verb and input were not offered by the native World owner; effects were not performed".into());
                }
                let outcome = kernel.apply(*request)?;
                Ok(
                    json!({"world_ref":self.world_ref,"owner_generation":self.generation,"outcome":outcome}),
                )
            }
        }
    }
}

/// The local operator explicitly offers the already bound native World. A
/// renderer supplies neither a filesystem root nor an executable nor a token.
pub fn configured_offer() -> Result<Option<(PathBuf, NativeOwner)>, String> {
    let Some(socket) = std::env::var_os("OI_NATIVE_OWNER_SOCKET") else {
        return Ok(None);
    };
    let socket = PathBuf::from(socket);
    if !socket.is_absolute() {
        return Err("Native owner socket must be absolute".into());
    }
    let world = std::env::var("OI_SHARED_FIELD_LOCAL_WORLD_REF")
        .map_err(|_| "Native owner offer has no bound World")?;
    let grants = std::env::var_os("OI_NATIVE_OWNER_GRANTS")
        .map(PathBuf::from)
        .ok_or("Native owner offer requires exact private operation grants")?;
    if !grants.is_absolute() {
        return Err("Native owner grants must have an absolute owner-local path".into());
    }
    Ok(Some((socket, NativeOwner::new(world, grants)?)))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RemoteRoutes {
    schema: String,
    routes: Vec<RemoteRoute>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RemoteRoute {
    world_ref: String,
    workcell_ref: String,
}

/// Use Gateway's declared remote Workcell, then fence the exact native owner
/// incarnation. There is deliberately no retry after an uncertain effect.
pub fn remote(world_ref: &str, request: &KernelOp) -> Result<KernelOpOutcome, String> {
    if !qualified(world_ref) || !admitted(request) {
        return Err(
            "Hosted native route requires a qualified World and an admitted operation".into(),
        );
    }
    let path = std::env::var_os("OI_SHARED_FIELD_REMOTE_WORLD_ROUTES")
        .ok_or_else(|| format!("No native Gateway owner route is offered for {world_ref}"))?;
    let metadata = std::fs::symlink_metadata(&path)
        .map_err(|e| format!("Native route register unavailable: {e}"))?;
    if !metadata.is_file() || metadata.len() > 1024 * 1024 {
        return Err("Native route register must be a bounded regular file".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};
        if metadata.permissions().mode() & 0o077 != 0
            || metadata.uid() != unsafe { libc::geteuid() }
        {
            return Err("Native route register must be owner-only".into());
        }
    }
    let register: RemoteRoutes =
        serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    if register.schema != "oi.hosted-native-routes/v1" || register.routes.len() > 64 {
        return Err("Unsupported native route register".into());
    }
    let mut seen = std::collections::BTreeSet::new();
    for route in &register.routes {
        if !qualified(&route.world_ref)
            || !seen.insert(&route.world_ref)
            || !route.workcell_ref.starts_with("workcell:")
            || route.workcell_ref.len() <= 9
            || route.workcell_ref.trim() != route.workcell_ref
        {
            return Err(
                "Native routes require distinct qualified Worlds and declared Workcells".into(),
            );
        }
    }
    let route = register
        .routes
        .iter()
        .find(|route| route.world_ref == world_ref)
        .ok_or_else(|| format!("No native Gateway owner route is offered for {world_ref}"))?;
    let described = gateway(&route.workcell_ref, world_ref, None, None)?;
    if described["world_ref"].as_str() != Some(world_ref) {
        return Err("Gateway described a different native World".into());
    }
    let generation = described["owner_generation"]
        .as_str()
        .filter(|v| !v.is_empty())
        .ok_or("Gateway described no native owner generation")?;
    let operated = gateway(
        &route.workcell_ref,
        world_ref,
        Some(generation),
        Some(request),
    )?;
    if operated["world_ref"].as_str() != Some(world_ref)
        || operated["owner_generation"].as_str() != Some(generation)
    {
        return Err("Native response belongs to another World or generation; reconcile effects with its owner".into());
    }
    let outcome = serde_json::from_value(operated["outcome"].clone()).map_err(|e| {
        format!("Native owner returned an invalid outcome; reconcile effects before retrying: {e}")
    })?;
    Ok(KernelOpOutcome {
        receipts: Vec::new(),
        result: KernelOpResult::HostedNative {
            source_world_ref: world_ref.to_owned(),
            owner_generation: generation.to_owned(),
            outcome: Box::new(outcome),
        },
    })
}

fn gateway(
    workcell: &str,
    world: &str,
    generation: Option<&str>,
    request: Option<&KernelOp>,
) -> Result<Value, String> {
    use std::{
        io::{Read, Write},
        process::{Command, Stdio},
        time::{Duration, Instant},
    };
    let executable = std::env::var_os("OI_AIKIT_BIN").unwrap_or_else(|| "aikit".into());
    let mut command = Command::new(executable);
    command.args([
        "gateway",
        "--at",
        workcell,
        "native-owner",
        "--world-ref",
        world,
        "--json",
    ]);
    if let Some(generation) = generation {
        command.args(["--expected-owner-generation", generation]);
    }
    if request.is_some() {
        command.args(["--request-file", "-"]);
    }
    let input = request
        .map(serde_json::to_vec)
        .transpose()
        .map_err(|_| "Native Gateway request could not be encoded")?;
    if input
        .as_ref()
        .is_some_and(|bytes| bytes.len() > 1024 * 1024)
    {
        return Err(
            "Native Gateway request exceeds the delivery bound; effects were not performed".into(),
        );
    }
    let start = Instant::now();
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Native Gateway carrier unavailable: {e}"))?;
    let mut stdin = child.stdin.take().expect("piped stdin");
    // A slow carrier may not read a pipe-sized request immediately. Start
    // delivery off-thread so the same deadline also bounds that wait.
    let delivery = std::thread::spawn(move || {
        if let Some(bytes) = input {
            stdin.write_all(&bytes)?;
            stdin.flush()?;
        }
        Ok::<_, std::io::Error>(())
    });
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let out = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take(1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let err = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.take(65537).read_to_end(&mut bytes).map(|_| bytes)
    });
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if start.elapsed() < Duration::from_secs(20) => {
                std::thread::sleep(Duration::from_millis(25))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Native Gateway response unavailable or timed out; reconcile possible effects before replaying".into());
            }
        }
    };
    delivery
        .join()
        .map_err(|_| "Native Gateway delivery failed; reconcile possible effects before replaying")?
        .map_err(|_| {
            "Native Gateway delivery uncertain; reconcile possible effects before replaying"
        })?;
    let bytes = out
        .join()
        .map_err(|_| {
            "Native Gateway response reader failed; reconcile possible effects before replaying"
        })?
        .map_err(|_| {
            "Native Gateway response was lost; reconcile possible effects before replaying"
        })?;
    let _ = err.join(); // Private carrier details and credentials never become renderer errors.
    if bytes.len() > 1024 * 1024 {
        return Err(
            "Native Gateway response exceeded the bound; reconcile effects before replaying".into(),
        );
    }
    let reply: Value = serde_json::from_slice(&bytes).map_err(|e| {
        format!("Native Gateway response invalid; reconcile possible effects before replaying: {e}")
    })?;
    if !status.success() || reply["ok"] != true {
        return Err(format!(
            "{}: {}",
            reply["error"]["code"]
                .as_str()
                .unwrap_or("gateway.native_owner.unavailable"),
            reply["error"]["message"]
                .as_str()
                .unwrap_or("No trustworthy native outcome; reconcile effects before replaying")
        ));
    }
    if reply["data"]["type"] != "native-owner" {
        return Err("Gateway returned no native owner response contract; reconcile possible effects before replaying".into());
    }
    Ok(reply["data"]["reading"].clone())
}
