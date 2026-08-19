//! Generic AgentSession conversation Surface for the O:I workbench.
//!
//! This is deliberately a Surface over AIKit's connection contract, not an O:I
//! conversation ontology. The caller supplies canonical `agent-session/*`
//! identity; the provider keeps its own native session id; O:I stores no second
//! transcript and returns the ordered native/AIKit signals as provenance-bearing
//! material for rendering.

use std::path::Path;

use aikit_adapters::{
    AcpV1ConnectionAdapter, AgentConnectionAdapter, CancelRequest, ConnectionDescriptor,
    ConnectionProcess, ConnectionSignal, ConnectionSignalKind, NativeSessionBinding,
    PromptRequest, SessionOpenMode, SessionOpenRequest,
};
use aikit_core::ResourceRef;
use serde::{Deserialize, Serialize};
use serde_json::json;

const MAX_MESSAGES_PER_TURN: usize = 512;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AgentSurfaceOpenRequest {
    pub connection_ref: String,
    pub agent_session_ref: String,
    pub argv: Vec<String>,
    pub cwd: String,
    #[serde(default)]
    pub provenance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AgentSurfaceReading {
    pub descriptor: ConnectionDescriptor,
    pub binding: NativeSessionBinding,
    #[serde(default)]
    pub signals: Vec<ConnectionSignal>,
}

#[derive(Debug)]
pub struct AikitAgentSurface {
    adapter: AcpV1ConnectionAdapter,
    process: ConnectionProcess,
    binding: NativeSessionBinding,
}

impl AikitAgentSurface {
    pub fn open(request: AgentSurfaceOpenRequest) -> Result<(Self, AgentSurfaceReading), String> {
        if request.argv.is_empty() {
            return Err("Agent Surface provider command is empty".into());
        }
        let canonical = ResourceRef::parse(&request.agent_session_ref)
            .map_err(|error| error.to_string())?;
        if !canonical.as_str().starts_with("agent-session/") {
            return Err("canonical AgentSession ref must begin with `agent-session/`".into());
        }
        let connection_ref = ResourceRef::parse(&request.connection_ref)
            .map_err(|error| error.to_string())?;
        let mut provenance = request.provenance;
        provenance.push("O:I generic conversation Surface via AIKit ACP adapter".into());
        let mut adapter = AcpV1ConnectionAdapter::new(connection_ref, provenance);
        let mut process = ConnectionProcess::spawn(&request.argv, Some(Path::new(&request.cwd)))
            .map_err(|error| error.to_string())?;

        process
            .send_json(&adapter.initialize().map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        let mut signals = adapter
            .ingest(process.read_json().map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        if !adapter
            .negotiated_capabilities()
            .supports(SessionOpenMode::Create)
        {
            let _ = process.terminate();
            return Err("ACP provider does not advertise session creation".into());
        }

        process
            .send_json(
                &adapter
                    .open_session(SessionOpenRequest {
                        mode: SessionOpenMode::Create,
                        native_session_id: None,
                        cwd: request.cwd,
                        additional_directories: Vec::new(),
                        mcp_servers: Vec::new(),
                        agent_session: Some(canonical.clone()),
                    })
                    .map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
        let opened = adapter
            .ingest(process.read_json().map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        let binding = opened
            .iter()
            .find_map(|signal| match &signal.kind {
                ConnectionSignalKind::SessionOpened { binding } => Some(binding.clone()),
                _ => None,
            })
            .ok_or_else(|| "ACP provider did not return a SessionOpened binding".to_owned())?;
        if binding.agent_session.as_ref() != Some(&canonical) {
            let _ = process.terminate();
            return Err("ACP provider binding did not preserve the canonical AgentSession ref".into());
        }
        signals.extend(opened);
        let descriptor = adapter.descriptor();
        let reading = AgentSurfaceReading {
            descriptor: descriptor.clone(),
            binding: binding.clone(),
            signals,
        };
        Ok((
            Self {
                adapter,
                process,
                binding,
            },
            reading,
        ))
    }

    pub fn descriptor(&self) -> ConnectionDescriptor {
        self.adapter.descriptor()
    }

    pub fn binding(&self) -> &NativeSessionBinding {
        &self.binding
    }

    /// Execute one turn through the native provider and return only the ordered
    /// signals observed for that turn. No desktop transcript is persisted.
    pub fn send(&mut self, text: &str) -> Result<Vec<ConnectionSignal>, String> {
        self.process
            .send_json(
                &self
                    .adapter
                    .prompt(PromptRequest {
                        native_session_id: self.binding.native_session_id.clone(),
                        prompt: json!([{ "type": "text", "text": text }]),
                    })
                    .map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;

        let mut observed = Vec::new();
        for _ in 0..MAX_MESSAGES_PER_TURN {
            let message = self.process.read_json().map_err(|error| error.to_string())?;
            let signals = self
                .adapter
                .ingest(message)
                .map_err(|error| error.to_string())?;
            let terminal = signals.iter().any(|signal| {
                matches!(
                    signal.kind,
                    ConnectionSignalKind::Completed { .. } | ConnectionSignalKind::Cancelled
                )
            });
            observed.extend(signals);
            if terminal {
                return Ok(observed);
            }
        }
        Err(format!(
            "Agent Surface turn exceeded {MAX_MESSAGES_PER_TURN} provider messages without completion"
        ))
    }

    pub fn cancel(&mut self) -> Result<(), String> {
        let command = self
            .adapter
            .cancel(CancelRequest {
                native_session_id: self.binding.native_session_id.clone(),
            })
            .map_err(|error| error.to_string())?;
        self.process
            .send_json(&command)
            .map_err(|error| error.to_string())
    }

    pub fn close(&mut self) -> Result<(), String> {
        self.process.terminate().map_err(|error| error.to_string())
    }
}

impl Drop for AikitAgentSurface {
    fn drop(&mut self) {
        let _ = self.process.terminate();
    }
}
