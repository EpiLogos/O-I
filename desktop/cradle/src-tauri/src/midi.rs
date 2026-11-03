//! MIDI input for the Jankó keyboard and the MIDI map (T-LIVE-MIDI). The native host opens the MIDI inputs the system offers (midir;
//! CoreMIDI on macOS), follows ports as they appear and disappear, and sends each note-on and note-off to the shell window as the
//! `oi://midi-note` event, and each control change as `oi://midi-cc`. The shell hands every note to the one Jankó input path and every
//! control to the MIDI map; nothing here decides what sounds or what a control moves.
//!
//! Latency: the CoreMIDI callback only decodes three bytes, reads the wall clock and queues a small value. A forwarder thread drains what
//! has queued and emits it as one event, so notes that arrived together reach the shell in one task: one chord, one owner act. Each note
//! carries `received_ms`, the wall clock when the host heard it, so the shell can measure host-to-page time (O-I #853).
//!
//! MIDI out (O-I #853): the `midi_out` command lists the system's MIDI outputs, connects the one the person chooses, and sends the notes
//! the part's playing path plays to it. The shell decides what is sent; this side only encodes and delivers, and refuses in words.

use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// The notes: an array, one entry per decoded message, in arrival order.
pub const NOTE_EVENT: &str = "oi://midi-note";
/// The control changes (T-LIVE-MIDI leg 2): an array, one entry per decoded controller message, in arrival order. A sibling of the notes,
/// so a note batch keeps its shape; a drain that carries only controls emits only this event.
pub const CONTROL_EVENT: &str = "oi://midi-cc";
/// The ports the host hears, with a named refusal when it could not open some or any of them.
pub const PORTS_EVENT: &str = "oi://midi-ports";
/// The one window that plays the Jankó keyboard. Detached surfaces receive no MIDI, so a note is never struck twice.
const SHELL_WINDOW: &str = "main";
const CLIENT_NAME: &str = "O:I cradle MIDI input";
const OUT_CLIENT_NAME: &str = "O:I cradle MIDI output";
/// How often the host re-reads the system's ports. The state is re-sent on every read, so a window that starts late catches up.
const SCAN_INTERVAL: Duration = Duration::from_secs(2);

/// One channel note message as it decoded. `channel` is the wire value (0 to 15).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NoteMessage {
    pub channel: u8,
    pub note: u8,
    pub velocity: u8,
    pub on: bool,
}

/// One channel controller message (control change, 0xBn). `controller` is the wire controller number (0 to 119); `value` is 0 to 127.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ControlMessage {
    pub channel: u8,
    pub controller: u8,
    pub value: u8,
}

/// One decoded channel message the host forwards: a note, or a control change.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MidiMessage {
    Note(NoteMessage),
    Control(ControlMessage),
}

/// Decode one complete MIDI message as the host forwards it: a note when it is one, else a control change when it is one, else nothing.
pub fn decode_message(bytes: &[u8]) -> Option<MidiMessage> {
    decode(bytes)
        .map(MidiMessage::Note)
        .or_else(|| decode_control(bytes).map(MidiMessage::Control))
}

/// Decode one channel control change (0xBn controller value). Controllers 120 to 127 are channel mode messages (all notes off, reset
/// controllers and the like), not controls a parameter can be mapped to, so they decode to `None` with the rest of the non-controls.
pub fn decode_control(bytes: &[u8]) -> Option<ControlMessage> {
    if bytes.len() != 3 {
        return None;
    }
    let (status, controller, value) = (bytes[0], bytes[1], bytes[2]);
    if status & 0xF0 != 0xB0 || controller > 119 || value > 127 {
        return None;
    }
    Some(ControlMessage {
        channel: status & 0x0F,
        controller,
        value,
    })
}

/// Decode one complete MIDI message. Only channel note-off (0x8n) and note-on (0x9n) are notes, and a note-on at velocity 0 is a
/// note-off. Controllers, clock, sysex and malformed messages are not notes and decode to `None`.
pub fn decode(bytes: &[u8]) -> Option<NoteMessage> {
    if bytes.len() != 3 {
        return None;
    }
    let (status, note, velocity) = (bytes[0], bytes[1], bytes[2]);
    let on = match status & 0xF0 {
        0x90 => velocity > 0,
        0x80 => false,
        _ => return None,
    };
    if note > 127 || velocity > 127 {
        return None;
    }
    Some(NoteMessage {
        channel: status & 0x0F,
        note,
        velocity,
        on,
    })
}

/// The ports the host hears, and the named refusal for any it could not open.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct PortsState {
    pub ports: Vec<String>,
    pub refusal: Option<String>,
}

/// The last ports state the scanner read; the shell hears it as the `oi://midi-ports` event.
#[derive(Default)]
pub struct MidiHost {
    state: Mutex<PortsState>,
}

/// A decoded message on its way from the CoreMIDI thread to the forwarder.
enum Heard {
    Note {
        port: Arc<str>,
        message: NoteMessage,
        received_ms: f64,
    },
    Control {
        port: Arc<str>,
        message: ControlMessage,
    },
}

#[derive(Serialize, Clone)]
struct NoteEvent<'a> {
    port: &'a str,
    channel: u8,
    note: u8,
    velocity: u8,
    on: bool,
    /// The wall clock when the host heard the note, in ms since the epoch: the start of the key-to-sound measurement.
    received_ms: f64,
}

#[derive(Serialize, Clone)]
struct ControlEvent<'a> {
    port: &'a str,
    channel: u8,
    controller: u8,
    value: u8,
}

/// The wall clock in ms since the epoch, as the shell's `Date.now()` reads it.
fn wall_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

// ── MIDI out ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/// One message a part plays out: a note struck, a note let go, or every note on a channel let go (Panic). `channel` is the wire value.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OutMessage {
    On { channel: u8, note: u8, velocity: u8 },
    Off { channel: u8, note: u8, velocity: u8 },
    AllOff { channel: u8 },
}

/// The message as its three MIDI bytes, or the refusal in words when it is not one MIDI carries.
pub fn encode(message: &OutMessage) -> Result<[u8; 3], String> {
    let (status, channel, data, value) = match *message {
        OutMessage::On {
            channel,
            note,
            velocity,
        } => {
            if velocity == 0 {
                return Err(
                    "A note sent out is struck at a velocity from 1 to 127; at 0 it would be a release".to_owned(),
                );
            }
            (0x90, channel, note, velocity)
        }
        OutMessage::Off {
            channel,
            note,
            velocity,
        } => (0x80, channel, note, velocity),
        // Controller 123: all notes off.
        OutMessage::AllOff { channel } => (0xB0, channel, 123, 0),
    };
    if channel > 15 {
        return Err(format!(
            "MIDI has channels 1 to 16, so channel {} cannot be sent",
            u16::from(channel) + 1
        ));
    }
    if data > 127 {
        return Err(format!(
            "MIDI notes run from 0 to 127, so {data} cannot be sent"
        ));
    }
    if value > 127 {
        return Err(format!(
            "A MIDI velocity runs from 0 to 127, so {value} cannot be sent"
        ));
    }
    Ok([status | channel, data, value])
}

/// What the shell asks of the MIDI output.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OutRequest {
    /// The outputs the system offers, and the one connected.
    Read,
    /// Connect the named output, or let the connected one go (`null`).
    Choose { port: Option<String> },
    /// Send these messages, in order, to the connected output.
    Send { messages: Vec<OutMessage> },
}

/// The host's answer: the outputs the system offered at the last read, and the one connected.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct OutState {
    pub ports: Vec<String>,
    pub port: Option<String>,
}

/// The seam to the system's MIDI outputs: midir on macOS, a fake in the tests. No test opens a device.
pub trait OutBackend {
    /// The outputs the system offers now, by name.
    fn ports(&mut self) -> Result<Vec<String>, String>;
    /// Connect the output of this name, letting any other go.
    fn connect(&mut self, name: &str) -> Result<(), String>;
    /// Let the connected output go.
    fn disconnect(&mut self);
    /// Send one message's bytes to the connected output.
    fn send(&mut self, bytes: &[u8]) -> Result<(), String>;
}

/// The MIDI output: the outputs last read, and the one the person chose.
pub struct MidiOut<B> {
    backend: B,
    ports: Vec<String>,
    port: Option<String>,
}

impl<B: OutBackend> MidiOut<B> {
    pub fn new(backend: B) -> Self {
        Self {
            backend,
            ports: Vec::new(),
            port: None,
        }
    }

    pub fn handle(&mut self, request: OutRequest) -> Result<OutState, String> {
        match request {
            OutRequest::Read => self.read(),
            OutRequest::Choose { port } => self.choose(port),
            OutRequest::Send { messages } => self.send(&messages),
        }
    }

    fn state(&self) -> OutState {
        OutState {
            ports: self.ports.clone(),
            port: self.port.clone(),
        }
    }

    fn let_go(&mut self) {
        self.backend.disconnect();
        self.port = None;
    }

    /// Read the system's outputs. A connected output the system no longer offers is let go.
    fn read(&mut self) -> Result<OutState, String> {
        self.ports = self.backend.ports()?;
        if self
            .port
            .as_ref()
            .is_some_and(|port| !self.ports.contains(port))
        {
            self.let_go();
        }
        Ok(self.state())
    }

    fn choose(&mut self, port: Option<String>) -> Result<OutState, String> {
        self.read()?;
        let Some(name) = port else {
            self.let_go();
            return Ok(self.state());
        };
        if !self.ports.contains(&name) {
            return Err(format!(
                "{name} is not a MIDI output this system offers now"
            ));
        }
        if self.port.as_deref() != Some(name.as_str()) {
            self.let_go();
            self.backend.connect(&name).map_err(|error| {
                format!("{name} could not be opened as the MIDI output: {error}")
            })?;
            self.port = Some(name);
        }
        Ok(self.state())
    }

    /// Send a batch in order. A batch with any message MIDI cannot carry is refused whole, before a byte leaves; an output that
    /// refuses a message is let go and named.
    fn send(&mut self, messages: &[OutMessage]) -> Result<OutState, String> {
        let Some(port) = self.port.clone() else {
            return Err("No MIDI output is chosen, so nothing was sent".to_owned());
        };
        let encoded = messages.iter().map(encode).collect::<Result<Vec<_>, _>>()?;
        for bytes in &encoded {
            if let Err(error) = self.backend.send(bytes) {
                self.let_go();
                return Err(format!(
                    "The MIDI output {port} went away ({error}), so it is no longer connected"
                ));
            }
        }
        Ok(self.state())
    }
}

/// The host's MIDI output, held for the `midi_out` command.
pub struct MidiOutHost(Mutex<MidiOut<backend::Outputs>>);

/// The shell's MIDI output (O-I #853): read the outputs, choose one, or send what a part plays. Synchronous, so the sends of one window
/// leave in the order it made them.
#[tauri::command]
pub fn midi_out(app: AppHandle, request: OutRequest) -> Result<OutState, String> {
    let host = app
        .try_state::<MidiOutHost>()
        .ok_or_else(|| "MIDI output has not started in this host".to_owned())?;
    let mut out = host
        .0
        .lock()
        .map_err(|_| "MIDI output stopped after an earlier failure".to_owned())?;
    out.handle(request)
}

/// Start the MIDI listener: the forwarder that emits the notes, and the scanner that follows the system's ports. The MIDI output is
/// held from here too; it opens nothing until the shell asks.
pub fn start(app: &AppHandle) {
    app.manage(MidiHost::default());
    app.manage(MidiOutHost(Mutex::new(MidiOut::new(
        backend::Outputs::default(),
    ))));
    let (tx, rx) = mpsc::channel::<Heard>();
    let forwarder = app.clone();
    if let Err(error) = std::thread::Builder::new()
        .name("oi-midi-forward".into())
        .spawn(move || forward(forwarder, rx))
    {
        eprintln!("MIDI note forwarder unavailable: {error}");
        return;
    }
    let scanner = app.clone();
    if let Err(error) = std::thread::Builder::new()
        .name("oi-midi-scan".into())
        .spawn(move || scan_forever(scanner, tx))
    {
        eprintln!("MIDI port scanner unavailable: {error}");
    }
}

fn forward(app: AppHandle, rx: Receiver<Heard>) {
    while let Ok(first) = rx.recv() {
        let mut batch = vec![first];
        while let Ok(next) = rx.try_recv() {
            batch.push(next);
        }
        let notes: Vec<NoteEvent<'_>> = batch
            .iter()
            .filter_map(|heard| match heard {
                Heard::Note {
                    port,
                    message,
                    received_ms,
                } => Some(NoteEvent {
                    port,
                    channel: message.channel,
                    note: message.note,
                    velocity: message.velocity,
                    on: message.on,
                    received_ms: *received_ms,
                }),
                Heard::Control { .. } => None,
            })
            .collect();
        if !notes.is_empty() {
            let _ = app.emit_to(SHELL_WINDOW, NOTE_EVENT, notes);
        }
        let controls: Vec<ControlEvent<'_>> = batch
            .iter()
            .filter_map(|heard| match heard {
                Heard::Control { port, message } => Some(ControlEvent {
                    port,
                    channel: message.channel,
                    controller: message.controller,
                    value: message.value,
                }),
                Heard::Note { .. } => None,
            })
            .collect();
        if !controls.is_empty() {
            let _ = app.emit_to(SHELL_WINDOW, CONTROL_EVENT, controls);
        }
    }
}

fn scan_forever(app: AppHandle, tx: Sender<Heard>) {
    let mut inputs = backend::Inputs::default();
    loop {
        let state = inputs.scan(&tx);
        if let Ok(mut held) = app.state::<MidiHost>().state.lock() {
            *held = state.clone();
        }
        let _ = app.emit_to(SHELL_WINDOW, PORTS_EVENT, &state);
        std::thread::sleep(SCAN_INTERVAL);
    }
}

#[cfg(target_os = "macos")]
mod backend {
    use std::collections::BTreeMap;
    use std::sync::mpsc::Sender;
    use std::sync::Arc;

    use midir::{MidiInput, MidiInputConnection};

    use midir::{MidiOutput, MidiOutputConnection};

    use super::{
        decode_message, wall_ms, Heard, MidiMessage, OutBackend, PortsState, CLIENT_NAME,
        OUT_CLIENT_NAME,
    };

    /// The open inputs, keyed by midir's stable port id. Each keeps the name it was opened under.
    #[derive(Default)]
    pub struct Inputs {
        open: BTreeMap<String, (String, MidiInputConnection<Arc<str>>)>,
    }

    impl Inputs {
        /// Follow the system once: close the ports that are gone, open the ports that appeared, and report what is open.
        pub fn scan(&mut self, tx: &Sender<Heard>) -> PortsState {
            let probe = match MidiInput::new(CLIENT_NAME) {
                Ok(probe) => probe,
                Err(error) => {
                    return PortsState {
                        ports: self.heard(),
                        refusal: Some(format!("MIDI input could not start: {error}")),
                    };
                }
            };
            let listed: Vec<(String, String)> = probe
                .ports()
                .iter()
                .filter_map(|port| probe.port_name(port).ok().map(|name| (port.id(), name)))
                .collect();
            self.open
                .retain(|id, _| listed.iter().any(|(listed_id, _)| listed_id == id));
            let mut refusals = Vec::new();
            for (id, name) in &listed {
                if self.open.contains_key(id) {
                    continue;
                }
                match connect(id, name, tx.clone()) {
                    Ok(connection) => {
                        self.open.insert(id.clone(), (name.clone(), connection));
                    }
                    Err(error) => refusals.push(format!("{name} could not be opened: {error}")),
                }
            }
            PortsState {
                ports: self.heard(),
                refusal: (!refusals.is_empty()).then(|| refusals.join("; ")),
            }
        }

        fn heard(&self) -> Vec<String> {
            let mut names: Vec<String> = self.open.values().map(|(name, _)| name.clone()).collect();
            names.sort();
            names
        }
    }

    /// Open one port. The callback only decodes and queues: no allocation beyond the port handle's reference count.
    fn connect(
        id: &str,
        name: &str,
        tx: Sender<Heard>,
    ) -> Result<MidiInputConnection<Arc<str>>, String> {
        let input = MidiInput::new(CLIENT_NAME).map_err(|error| error.to_string())?;
        let port = input
            .find_port_by_id(id)
            .ok_or_else(|| "the port is no longer offered".to_owned())?;
        let owner: Arc<str> = Arc::from(name);
        input
            .connect(
                &port,
                CLIENT_NAME,
                move |_stamp: u64, bytes: &[u8], port_name: &mut Arc<str>| match decode_message(
                    bytes,
                ) {
                    Some(MidiMessage::Note(message)) => {
                        let _ = tx.send(Heard::Note {
                            port: Arc::clone(port_name),
                            message,
                            received_ms: wall_ms(),
                        });
                    }
                    Some(MidiMessage::Control(message)) => {
                        let _ = tx.send(Heard::Control {
                            port: Arc::clone(port_name),
                            message,
                        });
                    }
                    None => {}
                },
                owner,
            )
            .map_err(|error| error.to_string())
    }

    /// The system's MIDI outputs through midir, and the one connection the person chose.
    #[derive(Default)]
    pub struct Outputs {
        connection: Option<MidiOutputConnection>,
    }

    impl OutBackend for Outputs {
        fn ports(&mut self) -> Result<Vec<String>, String> {
            let probe = MidiOutput::new(OUT_CLIENT_NAME)
                .map_err(|error| format!("MIDI output could not start: {error}"))?;
            Ok(probe
                .ports()
                .iter()
                .filter_map(|port| probe.port_name(port).ok())
                .collect())
        }

        fn connect(&mut self, name: &str) -> Result<(), String> {
            self.disconnect();
            let output = MidiOutput::new(OUT_CLIENT_NAME).map_err(|error| error.to_string())?;
            let port = output
                .ports()
                .into_iter()
                .find(|port| output.port_name(port).is_ok_and(|named| named == name))
                .ok_or_else(|| "it is no longer offered".to_owned())?;
            let connection = output
                .connect(&port, OUT_CLIENT_NAME)
                .map_err(|error| error.to_string())?;
            self.connection = Some(connection);
            Ok(())
        }

        fn disconnect(&mut self) {
            if let Some(connection) = self.connection.take() {
                connection.close();
            }
        }

        fn send(&mut self, bytes: &[u8]) -> Result<(), String> {
            self.connection
                .as_mut()
                .ok_or_else(|| "it is not connected".to_owned())?
                .send(bytes)
                .map_err(|error| error.to_string())
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod backend {
    use std::sync::mpsc::Sender;

    use super::{Heard, OutBackend, PortsState};

    /// The native MIDI backend is the macOS host's. Elsewhere the named refusal is the whole answer.
    #[derive(Default)]
    pub struct Inputs;

    impl Inputs {
        pub fn scan(&mut self, _tx: &Sender<Heard>) -> PortsState {
            PortsState {
                ports: Vec::new(),
                refusal: Some("MIDI input is served by the macOS native host only".to_owned()),
            }
        }
    }

    /// MIDI output is the macOS host's too; elsewhere every request is refused in words.
    #[derive(Default)]
    pub struct Outputs;

    const ELSEWHERE: &str = "MIDI output is served by the macOS native host only";

    impl OutBackend for Outputs {
        fn ports(&mut self) -> Result<Vec<String>, String> {
            Err(ELSEWHERE.to_owned())
        }
        fn connect(&mut self, _name: &str) -> Result<(), String> {
            Err(ELSEWHERE.to_owned())
        }
        fn disconnect(&mut self) {}
        fn send(&mut self, _bytes: &[u8]) -> Result<(), String> {
            Err(ELSEWHERE.to_owned())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_on_and_note_off_decode_with_channel_note_and_velocity() {
        assert_eq!(
            decode(&[0x90, 60, 100]),
            Some(NoteMessage {
                channel: 0,
                note: 60,
                velocity: 100,
                on: true
            })
        );
        assert_eq!(
            decode(&[0x9F, 127, 1]),
            Some(NoteMessage {
                channel: 15,
                note: 127,
                velocity: 1,
                on: true
            })
        );
        assert_eq!(
            decode(&[0x80, 60, 40]),
            Some(NoteMessage {
                channel: 0,
                note: 60,
                velocity: 40,
                on: false
            })
        );
        assert_eq!(
            decode(&[0x83, 0, 0]),
            Some(NoteMessage {
                channel: 3,
                note: 0,
                velocity: 0,
                on: false
            })
        );
    }

    #[test]
    fn note_on_at_velocity_zero_is_a_release() {
        assert_eq!(
            decode(&[0x91, 64, 0]),
            Some(NoteMessage {
                channel: 1,
                note: 64,
                velocity: 0,
                on: false
            })
        );
    }

    #[test]
    fn control_change_decodes_with_channel_controller_and_value() {
        assert_eq!(
            decode_control(&[0xB0, 74, 127]),
            Some(ControlMessage {
                channel: 0,
                controller: 74,
                value: 127
            })
        );
        assert_eq!(
            decode_control(&[0xBF, 1, 0]),
            Some(ControlMessage {
                channel: 15,
                controller: 1,
                value: 0
            })
        );
        assert_eq!(
            decode_message(&[0xB3, 7, 64]),
            Some(MidiMessage::Control(ControlMessage {
                channel: 3,
                controller: 7,
                value: 64
            }))
        );
    }

    #[test]
    fn decode_message_routes_notes_and_controls_apart() {
        assert_eq!(
            decode_message(&[0x90, 60, 100]),
            Some(MidiMessage::Note(NoteMessage {
                channel: 0,
                note: 60,
                velocity: 100,
                on: true
            }))
        );
        assert_eq!(decode_message(&[0xF8]), None, "timing clock is neither");
        // A control is never a note: the notes path still ignores 0xBn, so a sustain pedal cannot sound a key.
        assert_eq!(decode(&[0xB0, 64, 127]), None);
    }

    #[test]
    fn channel_mode_messages_and_malformed_controls_are_not_controls() {
        assert_eq!(
            decode_control(&[0xB0, 120, 0]),
            None,
            "all sound off is channel mode"
        );
        assert_eq!(
            decode_control(&[0xB0, 127, 0]),
            None,
            "poly mode is channel mode"
        );
        assert_eq!(
            decode_control(&[0xB0, 7, 128]),
            None,
            "value byte out of range"
        );
        assert_eq!(decode_control(&[0xB0, 7]), None, "truncated");
        assert_eq!(
            decode_control(&[0x90, 7, 100]),
            None,
            "a note is not a control"
        );
    }

    // ── MIDI out (O-I #853): what a part plays leaves for the output the person chooses ──────────────────────────────────────

    /// The system's outputs as a test names them, and every byte each connection was sent. No device is opened.
    #[derive(Default)]
    struct FakeOutputs {
        offered: Vec<String>,
        connected: Option<String>,
        sent: Vec<(String, Vec<u8>)>,
        refuse_send: bool,
    }

    impl OutBackend for FakeOutputs {
        fn ports(&mut self) -> Result<Vec<String>, String> {
            Ok(self.offered.clone())
        }
        fn connect(&mut self, name: &str) -> Result<(), String> {
            self.connected = Some(name.to_owned());
            Ok(())
        }
        fn disconnect(&mut self) {
            self.connected = None;
        }
        fn send(&mut self, bytes: &[u8]) -> Result<(), String> {
            if self.refuse_send {
                return Err("the device went away".into());
            }
            let port = self.connected.clone().expect("sent only while connected");
            self.sent.push((port, bytes.to_vec()));
            Ok(())
        }
    }

    fn outputs(names: &[&str]) -> MidiOut<FakeOutputs> {
        MidiOut::new(FakeOutputs {
            offered: names.iter().map(|name| (*name).to_owned()).collect(),
            ..FakeOutputs::default()
        })
    }

    fn request(json: serde_json::Value) -> OutRequest {
        serde_json::from_value(json).expect("a request the shell sends")
    }

    #[test]
    fn a_note_on_a_note_off_and_all_notes_off_encode_as_midi_bytes() {
        let on = OutMessage::On {
            channel: 2,
            note: 60,
            velocity: 100,
        };
        assert_eq!(encode(&on), Ok([0x92, 60, 100]));
        let off = OutMessage::Off {
            channel: 15,
            note: 127,
            velocity: 0,
        };
        assert_eq!(encode(&off), Ok([0x8F, 127, 0]));
        assert_eq!(
            encode(&OutMessage::AllOff { channel: 0 }),
            Ok([0xB0, 123, 0])
        );
    }

    #[test]
    fn a_message_off_the_wire_is_refused_in_words() {
        for bad in [
            OutMessage::On {
                channel: 16,
                note: 60,
                velocity: 100,
            },
            OutMessage::On {
                channel: 0,
                note: 128,
                velocity: 100,
            },
            OutMessage::On {
                channel: 0,
                note: 60,
                velocity: 0,
            },
            OutMessage::Off {
                channel: 0,
                note: 60,
                velocity: 128,
            },
            OutMessage::AllOff { channel: 16 },
        ] {
            let refusal = encode(&bad).expect_err("refused");
            assert!(!refusal.contains('_'), "prose, no field names: {refusal}");
        }
    }

    #[test]
    fn the_outputs_are_read_and_the_one_chosen_is_connected() {
        let mut out = outputs(&["IAC Bus 1", "Synth"]);
        let read = out
            .handle(request(serde_json::json!({"kind": "read"})))
            .unwrap();
        assert_eq!(
            read,
            OutState {
                ports: vec!["IAC Bus 1".into(), "Synth".into()],
                port: None
            }
        );
        let chosen = out
            .handle(request(
                serde_json::json!({"kind": "choose", "port": "Synth"}),
            ))
            .unwrap();
        assert_eq!(chosen.port.as_deref(), Some("Synth"));
        assert_eq!(out.backend.connected.as_deref(), Some("Synth"));
        let none = out
            .handle(request(serde_json::json!({"kind": "choose", "port": null})))
            .unwrap();
        assert_eq!(none.port, None);
        assert_eq!(
            out.backend.connected, None,
            "choosing none lets the output go"
        );
    }

    #[test]
    fn an_output_the_system_does_not_offer_is_refused_by_name_and_nothing_is_connected() {
        let mut out = outputs(&["Synth"]);
        let refusal = out
            .handle(request(
                serde_json::json!({"kind": "choose", "port": "Gone"}),
            ))
            .expect_err("refused");
        assert!(refusal.contains("Gone"), "{refusal}");
        assert_eq!(out.backend.connected, None);
    }

    #[test]
    fn the_notes_a_part_plays_are_sent_in_order_to_the_chosen_output() {
        let mut out = outputs(&["Synth"]);
        out.handle(request(
            serde_json::json!({"kind": "choose", "port": "Synth"}),
        ))
        .unwrap();
        out.handle(request(serde_json::json!({"kind": "send", "messages": [
            {"kind": "on", "channel": 0, "note": 60, "velocity": 100},
            {"kind": "on", "channel": 0, "note": 64, "velocity": 90},
            {"kind": "off", "channel": 0, "note": 60, "velocity": 0},
            {"kind": "all-off", "channel": 0},
        ]})))
        .unwrap();
        let bytes: Vec<Vec<u8>> = out
            .backend
            .sent
            .iter()
            .map(|(_, bytes)| bytes.clone())
            .collect();
        assert_eq!(
            bytes,
            vec![
                vec![0x90, 60, 100],
                vec![0x90, 64, 90],
                vec![0x80, 60, 0],
                vec![0xB0, 123, 0]
            ]
        );
        assert!(out.backend.sent.iter().all(|(port, _)| port == "Synth"));
    }

    #[test]
    fn nothing_is_sent_without_an_output_or_from_a_batch_with_a_message_off_the_wire() {
        let mut out = outputs(&["Synth"]);
        let refusal = out
            .handle(request(serde_json::json!({"kind": "send", "messages": [{"kind": "on", "channel": 0, "note": 60, "velocity": 100}]})))
            .expect_err("no output chosen");
        assert!(refusal.contains("No MIDI output is chosen"), "{refusal}");
        out.handle(request(
            serde_json::json!({"kind": "choose", "port": "Synth"}),
        ))
        .unwrap();
        out.handle(request(serde_json::json!({"kind": "send", "messages": [
            {"kind": "on", "channel": 0, "note": 60, "velocity": 100},
            {"kind": "on", "channel": 0, "note": 200, "velocity": 100},
        ]})))
        .expect_err("one message off the wire refuses the batch");
        assert!(
            out.backend.sent.is_empty(),
            "the batch is refused whole, before any byte leaves"
        );
    }

    #[test]
    fn an_output_that_goes_away_is_let_go_and_named() {
        let mut out = outputs(&["Synth"]);
        out.handle(request(
            serde_json::json!({"kind": "choose", "port": "Synth"}),
        ))
        .unwrap();
        out.backend.offered.clear();
        let read = out
            .handle(request(serde_json::json!({"kind": "read"})))
            .unwrap();
        assert_eq!(read.port, None, "a vanished output is no longer chosen");
        assert_eq!(out.backend.connected, None);
        out.backend.offered.push("Synth".into());
        out.handle(request(
            serde_json::json!({"kind": "choose", "port": "Synth"}),
        ))
        .unwrap();
        out.backend.refuse_send = true;
        let refusal = out
            .handle(request(serde_json::json!({"kind": "send", "messages": [{"kind": "all-off", "channel": 0}]})))
            .expect_err("refused");
        assert!(
            refusal.contains("Synth") && refusal.contains("went away"),
            "{refusal}"
        );
        assert_eq!(out.port, None, "an output that refused is let go");
    }

    #[test]
    fn a_note_carries_when_the_host_received_it() {
        let event = NoteEvent {
            port: "Keys",
            channel: 0,
            note: 60,
            velocity: 100,
            on: true,
            received_ms: 1_700_000_000_123.5,
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["received_ms"], serde_json::json!(1_700_000_000_123.5));
        assert!(
            wall_ms() > 1_600_000_000_000.0,
            "the wall clock, in ms since the epoch"
        );
    }

    #[test]
    fn controllers_clock_sysex_and_malformed_messages_are_not_notes() {
        assert_eq!(decode(&[0xB0, 64, 127]), None, "sustain pedal");
        assert_eq!(decode(&[0xF8]), None, "timing clock");
        assert_eq!(decode(&[0xF0, 0x7E, 0xF7]), None, "sysex");
        assert_eq!(decode(&[0x90, 60]), None, "truncated");
        assert_eq!(decode(&[0x90, 128, 100]), None, "note byte out of range");
        assert_eq!(decode(&[0x90, 60, 200]), None, "velocity byte out of range");
    }
}
