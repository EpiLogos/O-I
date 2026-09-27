//! The desktop brokers actual AIKit identity, Actuation lifecycle and local
//! speech IO. Native owners remain authoritative; the renderer receives only
//! bounded leases, native receipts and generated audio.
use crate::{
    agency, flow::CentralClient, nara_dialogue, nara_voice_actor::Actor,
    nara_voice_transport::LocalSpeechTransport,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Open {
        binding: nara_dialogue::Request,
        context: Value,
    },
    Read {
        voice_ref: String,
    },
    Listen {
        voice_ref: String,
    },
    Transcribe {
        voice_ref: String,
        capture_ref: String,
        wav_base64: String,
    },
    Speak {
        voice_ref: String,
        answer_block_id: u64,
    },
    Complete {
        voice_ref: String,
        response_ref: String,
    },
    Close {
        voice_ref: String,
    },
}
impl Request {
    fn voice_ref(&self) -> Option<&str> {
        match self {
            Self::Open { .. } => None,
            Self::Read { voice_ref }
            | Self::Listen { voice_ref }
            | Self::Transcribe { voice_ref, .. }
            | Self::Speak { voice_ref, .. }
            | Self::Complete { voice_ref, .. }
            | Self::Close { voice_ref } => Some(voice_ref),
        }
    }
}
struct Session {
    actor: Actor,
    transport: LocalSpeechTransport,
    capture: Option<String>,
    response: Option<String>,
}
struct Entry {
    project: String,
    binding: nara_dialogue::Request,
    context: Value,
    native_basis: Value,
    generation: Arc<AtomicU64>,
    expected_generation: u64,
    session: Mutex<Session>,
}
#[derive(Clone, Default)]
pub struct Store(
    Arc<Mutex<BTreeMap<String, Arc<Entry>>>>,
    Arc<Mutex<BTreeMap<String, Arc<AtomicU64>>>>,
);
impl std::fmt::Debug for Store {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeVoiceStore").finish_non_exhaustive()
    }
}
pub struct Prepared {
    store: Store,
    client: CentralClient,
    agency: agency::Client,
    cwd: PathBuf,
    project: String,
    request: Request,
    document: Value,
    entry: Option<Arc<Entry>>,
    generation: Arc<AtomicU64>,
    expected_generation: u64,
}
fn native_basis(reading: &Value) -> Value {
    json!({"agent_ref":reading["agent_ref"],"agency_ref":reading["agency_ref"],
        "agent_session_ref":reading["agent_session_ref"],"world_ref":reading["world_ref"],
        "world_binding_ref":reading["world_binding_ref"],"native_session_id":reading["native_session_id"],
        "acting_body":reading["acting_body"],"configuration_revision":reading["configuration_revision"],
        "runtime":reading["runtime"],"composition":reading["composition"]})
}
impl Session {
    fn reset_actor(&mut self, constitution: &Value, context: &Value) -> Result<Value, String> {
        let closed = self.actor.call(json!({"operation":"close"}))?;
        let mut actor = Actor::spawn()?;
        let admitted = actor.call(json!({"operation":"constitute","constitution":constitution,
            "dialogue_context":context,"allowed_action_refs":[],"denied_action_refs":[]}))?;
        self.actor = actor;
        self.capture = None;
        self.response = None;
        Ok(
            json!({"closed":closed,"admitted":admitted,"canonical_session_preserved":true,
            "reason":"A consumed recording or undelivered synthesis ended this speech binding; the same native conversation remains."}),
        )
    }
}
fn token() -> Result<String, String> {
    let mut b = [0u8; 24];
    getrandom::fill(&mut b).map_err(|e| e.to_string())?;
    Ok(b.iter().map(|v| format!("{v:02x}")).collect())
}
fn resolved_at() -> Result<String, String> {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let native: libc::time_t = seconds
        .try_into()
        .map_err(|_| "Native clock exceeds timestamp range")?;
    let mut parts: libc::tm = unsafe { std::mem::zeroed() };
    if unsafe { libc::gmtime_r(&native, &mut parts) }.is_null() {
        return Err("Native UTC clock is unavailable".into());
    }
    Ok(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        parts.tm_year + 1900,
        parts.tm_mon + 1,
        parts.tm_mday,
        parts.tm_hour,
        parts.tm_min,
        parts.tm_sec
    ))
}
impl Store {
    pub fn invalidate_expression(&self, expression_ref: &str) {
        if let Ok(generations) = self.1.lock() {
            if let Some(generation) = generations.get(expression_ref) {
                generation.fetch_add(1, Ordering::SeqCst);
            }
        }
    }
    pub fn binding(&self, request: &Request) -> Result<Option<nara_dialogue::Request>, String> {
        if let Request::Open { binding, .. } = request {
            return Ok(Some(binding.clone()));
        }
        if matches!(request, Request::Close { .. }) {
            return Ok(None);
        }
        Ok(Some(
            self.entry(request.voice_ref().ok_or("Voice lease absent")?)?
                .binding
                .clone(),
        ))
    }
    fn entry(&self, reference: &str) -> Result<Arc<Entry>, String> {
        self.0
            .lock()
            .map_err(|_| "Voice registry unavailable")?
            .get(reference)
            .cloned()
            .ok_or_else(|| "Native voice lease is closed or unavailable".into())
    }
    pub fn prepare(
        &self,
        client: CentralClient,
        agency: agency::Client,
        cwd: PathBuf,
        project: String,
        request: Request,
        document: Value,
    ) -> Result<Prepared, String> {
        let entry = request.voice_ref().map(|r| self.entry(r)).transpose()?;
        if entry.as_ref().is_some_and(|e| e.project != project) {
            return Err("Native voice belongs to another Project".into());
        }
        let (generation, expected_generation) = if let Some(entry) = &entry {
            (entry.generation.clone(), entry.expected_generation)
        } else {
            let reference = document["expression_ref"]
                .as_str()
                .ok_or("Native voice Expression is absent")?;
            let generation = self
                .1
                .lock()
                .map_err(|_| "Voice generations unavailable")?
                .entry(reference.to_owned())
                .or_insert_with(|| Arc::new(AtomicU64::new(0)))
                .clone();
            let expected = generation.load(Ordering::SeqCst);
            (generation, expected)
        };
        Ok(Prepared {
            store: self.clone(),
            client,
            agency,
            cwd,
            project,
            request,
            document,
            entry,
            generation,
            expected_generation,
        })
    }
}
fn validate_context(
    document: &Value,
    binding: &nara_dialogue::Request,
    context: &Value,
    project: &str,
) -> Result<(), String> {
    let canonical = nara_dialogue::Binding::new(project, binding)?;
    if binding.role != nara_dialogue::Role::Nara
        || context["schema"] != "ql.nara-dialogue-context/v1"
        || context["nara_ref"] != binding.nara_ref
        || context["subject_ref"] != binding.person_ref
        || context["profile_ref"] != binding.source_ref
        || context["profile_revision"] != binding.expected_revision
        || context["agent_session_ref"] != canonical.agent_session
        || document["expression_ref"] != binding.expression_ref
        || context["expression_ref"] != binding.expression_ref
        || context["expression_revision"].as_str()
            != document["revision"]
                .as_u64()
                .map(|r| r.to_string())
                .as_deref()
        || context["scene_ref"] != document["selection"]["scene_ref"]
    {
        return Err(
            "Native voice context differs from the current saved person, session or Expression"
                .into(),
        );
    }
    // This document-backed route has no native live-event reading yet. It
    // refuses renderer-authored event/focus facts instead of attributing them
    // to the current Expression or silently admitting an invented occasion.
    for field in [
        "occasion",
        "bimba",
        "shared_field",
        "c_prime",
        "expressive_act",
        "hovered_ref",
    ] {
        if !context[field].is_null() {
            return Err(format!("Native voice has no admitted source for {field}"));
        }
    }
    if context["pinned_refs"] != json!([])
        || context["active_m_focus"] != "m4"
        || context["coordinate_ref"] != "M4.1"
        || context["m4_branch"] != "embodied"
    {
        return Err("Native voice context is outside the admitted personal M4 route".into());
    }
    let disclosed = context["disclosed"]
        .as_array()
        .ok_or("Native voice disclosure list absent")?;
    if disclosed.len() != 1
        || disclosed[0]["ref_id"] != binding.source_ref
        || disclosed[0]["revision"] != binding.expected_revision
        || disclosed[0]["standing"] != "reported"
        || disclosed[0]["disclosure"] != "personal-consent"
    {
        return Err(
            "Native voice disclosure does not name only the selected saved identity".into(),
        );
    }
    let mut actual = std::collections::BTreeSet::new();
    if let Some(entities) = document["entities"].as_object() {
        for entity in entities.values() {
            if let Some(actions) = entity["subject"]["actions"].as_array() {
                for action in actions {
                    if let Some(reference) = action["action_ref"].as_str() {
                        actual.insert(reference.to_owned());
                    }
                }
            }
        }
    }
    let supplied: std::collections::BTreeSet<String> = context["available_action_refs"]
        .as_array()
        .ok_or("Native voice action list absent")?
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .ok_or_else(|| "Native voice action reference is invalid".to_owned())
        })
        .collect::<Result<_, _>>()?;
    if supplied != actual {
        return Err("Native voice actions differ from the current Expression".into());
    }
    let relation = document["selection"]["relation_ref"]
        .as_str()
        .and_then(|r| document["relations"].get(r));
    let entity = document["selection"]["entity_ref"]
        .as_str()
        .and_then(|r| document["entities"].get(r));
    let pointed = relation
        .map(|r| r["relation"]["ref"].clone())
        .or_else(|| entity.map(|e| e["subject"]["subject_ref"].clone()))
        .unwrap_or(Value::Null);
    if context["pointed_ref"] != pointed {
        return Err(
            "Native voice does not address the currently selected centre or relation".into(),
        );
    }
    Ok(())
}
impl Prepared {
    fn require_current(&self, binding: &nara_dialogue::Request) -> Result<(), String> {
        if self.generation.load(Ordering::SeqCst) != self.expected_generation {
            return Err(
                "Expression changed or voice was closed. Open voice from its current selection."
                    .into(),
            );
        }
        let (source, profile) = crate::nara_identity::read(&self.client, &binding.source_ref)?;
        if source.revision.revision != binding.expected_revision
            || profile["person_ref"] != binding.person_ref
            || profile["nara_ref"] != binding.nara_ref
        {
            return Err("Saved identity changed. Close voice, review the correction and select the current person.".into());
        }
        Ok(())
    }
    pub fn execute(self) -> Result<crate::KernelOpOutcome, String> {
        let result = self.run()?;
        Ok(crate::KernelOpOutcome {
            receipts: vec![],
            result: crate::KernelOpResult::NaraVoice { data: result },
        })
    }
    fn run(self) -> Result<Value, String> {
        if let Request::Close { voice_ref } = &self.request {
            let entry = self
                .store
                .0
                .lock()
                .map_err(|_| "Voice registry unavailable")?
                .remove(voice_ref)
                .ok_or("Voice lease already closed")?;
            entry.generation.fetch_add(1, Ordering::SeqCst);
            let mut session = entry
                .session
                .lock()
                .map_err(|_| "Voice session unavailable")?;
            let receipt = session.actor.call(json!({"operation":"close"}))?;
            return Ok(
                json!({"schema":"oi.nara-voice/v1","voice_ref":voice_ref,"closed":true,"receipt":receipt}),
            );
        }
        let (binding, context) = match &self.request {
            Request::Open { binding, context } => (binding, context),
            _ => (
                &self.entry.as_ref().ok_or("Voice lease absent")?.binding,
                &self.entry.as_ref().unwrap().context,
            ),
        };
        // Reject concurrent calls instead of queueing an old prepared document
        // behind a long speech request. Re-read source under this session gate.
        let mut gate =
            self.entry
                .as_ref()
                .map(|entry| {
                    entry.session.try_lock().map_err(|_| {
                        "Native voice is busy; wait for its current operation".to_owned()
                    })
                })
                .transpose()?;
        validate_context(&self.document, binding, context, &self.project)?;
        self.require_current(binding)?;
        if let Request::Open { .. } = &self.request {
            if self
                .store
                .0
                .lock()
                .map_err(|_| "Voice registry unavailable")?
                .len()
                >= 4
            {
                return Err("Close an existing native voice session first".into());
            }
            let mut lookup = binding.clone();
            lookup.operation = nara_dialogue::Operation::Lookup;
            let native = nara_dialogue::resolve(
                &self.client,
                &self.agency,
                &self.cwd,
                &self.project,
                lookup,
            )?;
            if native["provisioning"]["resume_required"] != false
                || native["provisioning"]["agent_session"] != context["agent_session_ref"]
            {
                return Err(
                    "Connect this person's native Nara conversation before opening voice".into(),
                );
            }
            let session = context["agent_session_ref"]
                .as_str()
                .ok_or("Native session absent")?;
            let reading = self.agency.local_speech_read(&self.cwd, session)?;
            let constitution =
                crate::nara_voice_constitution::from_reading(&reading, context, &resolved_at()?)?;
            let transport = LocalSpeechTransport::from_reading(&reading)?;
            self.require_current(binding)?;
            let mut actor = Actor::spawn()?;
            let receipt=actor.call(json!({"operation":"constitute","constitution":constitution,"dialogue_context":context,"allowed_action_refs":[],"denied_action_refs":[]}))?;
            let reference = format!("nara-voice:{}", token()?);
            let entry = Arc::new(Entry {
                project: self.project.clone(),
                binding: binding.clone(),
                context: context.clone(),
                native_basis: native_basis(&reading),
                generation: self.generation.clone(),
                expected_generation: self.expected_generation,
                session: Mutex::new(Session {
                    actor,
                    transport,
                    capture: None,
                    response: None,
                }),
            });
            self.require_current(binding)?;
            let mut held = self
                .store
                .0
                .lock()
                .map_err(|_| "Voice registry unavailable")?;
            if held.len() >= 4 {
                return Err("Close an existing native voice session first".into());
            }
            if self.generation.load(Ordering::SeqCst) != self.expected_generation {
                return Err("Expression changed while voice was opening".into());
            }
            held.insert(reference.clone(), entry);
            return Ok(
                json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"receipt":receipt,"constitution":constitution,"conditions":reading["conditions"],"mode":"turn-based-native-cascade"}),
            );
        }
        let reference = self.request.voice_ref().ok_or("Voice lease absent")?;
        let entry = self.entry.as_ref().ok_or("Voice lease absent")?;
        let session = gate.as_mut().ok_or("Voice session unavailable")?;
        let native = context["agent_session_ref"]
            .as_str()
            .ok_or("Native session absent")?;
        let current = self.agency.local_speech_read(&self.cwd, native)?;
        if native_basis(&current) != entry.native_basis {
            return Err(
                "The native speech body or configuration changed. Close and reopen voice.".into(),
            );
        }
        let constitution =
            crate::nara_voice_constitution::from_reading(&current, context, &resolved_at()?)?;
        self.require_current(binding)?;
        match &self.request {
            Request::Read { .. } => Ok(
                json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"receipt":session.actor.call(json!({"operation":"read"}))?}),
            ),
            Request::Listen { .. } => {
                if session.capture.is_some() || session.response.is_some() {
                    return Err("Finish the current voice activity first".into());
                }
                let receipt = session.actor.call(json!({"operation":"listen"}))?;
                let capture = format!("nara-capture:{}", token()?);
                session.capture = Some(capture.clone());
                Ok(
                    json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"capture_ref":capture,"receipt":receipt}),
                )
            }
            Request::Transcribe {
                capture_ref,
                wav_base64,
                ..
            } => {
                if session.capture.as_deref() != Some(capture_ref) {
                    return Err("Recording lease is stale or already consumed".into());
                }
                if wav_base64.len() > 12_800_064 {
                    return Err("Voice recording exceeds five minutes".into());
                }
                let wav = STANDARD
                    .decode(wav_base64)
                    .map_err(|_| "Voice recording is not valid encoded WAV")?;
                session.capture = None;
                let result = session.transport.transcribe(&wav, capture_ref);
                self.require_current(binding)?;
                let lifecycle = session.reset_actor(&constitution, context)?;
                let result = result?;
                Ok(
                    json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"transcription":result,"receipt":lifecycle}),
                )
            }
            Request::Speak {
                answer_block_id, ..
            } => {
                if session.capture.is_some() || session.response.is_some() {
                    return Err("Finish the current voice activity first".into());
                }
                let native = context["agent_session_ref"]
                    .as_str()
                    .ok_or("Native session absent")?;
                let answer = crate::nara_voice_answer::read(
                    &self.agency,
                    &self.cwd,
                    &self.project,
                    native,
                    *answer_block_id,
                    context,
                )?;
                let response = format!("nara-voice-answer:{}:{answer_block_id}", token()?);
                self.require_current(binding)?;
                let receipt = session
                    .actor
                    .call(json!({"operation":"response","response_ref":response}))?;
                session.response = Some(response.clone());
                let audio = session.transport.synthesize(
                    answer["text"].as_str().ok_or("Native answer text absent")?,
                    &response,
                );
                self.require_current(binding)?;
                let audio = match audio {
                    Ok(audio) => audio,
                    Err(error) => {
                        session.reset_actor(&constitution, context)?;
                        return Err(error);
                    }
                };
                Ok(
                    json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"response_ref":response,"answer":answer,"audio":audio,"receipt":receipt}),
                )
            }
            Request::Complete { response_ref, .. } => {
                if session.response.as_deref() != Some(response_ref) {
                    return Err(
                        "Playback completion does not name the current native response".into(),
                    );
                }
                let receipt = session
                    .actor
                    .call(json!({"operation":"complete","response_ref":response_ref}))?;
                session.response = None;
                Ok(
                    json!({"schema":"oi.nara-voice/v1","voice_ref":reference,"receipt":receipt,"observation":"renderer-playback-ended"}),
                )
            }
            _ => Err("Invalid native voice operation".into()),
        }
    }
}
