//! MIDI input for the Jankó keyboard (T-LIVE-MIDI, first leg). The native host opens the MIDI inputs the system offers (midir;
//! CoreMIDI on macOS), follows ports as they appear and disappear, and sends each note-on and note-off to the shell window as the
//! `oi://midi-note` event. The shell hands every note to the one Jankó input path; nothing here decides what sounds.
//!
//! Latency: the CoreMIDI callback only decodes three bytes and queues a small value. A forwarder thread drains what has queued and
//! emits it as one event, so notes that arrived together reach the shell in one task: one chord, one owner act.

use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// The notes: an array, one entry per decoded message, in arrival order.
pub const NOTE_EVENT: &str = "oi://midi-note";
/// The ports the host hears, with a named refusal when it could not open some or any of them.
pub const PORTS_EVENT: &str = "oi://midi-ports";
/// The one window that plays the Jankó keyboard. Detached surfaces receive no MIDI, so a note is never struck twice.
const SHELL_WINDOW: &str = "main";
const CLIENT_NAME: &str = "O:I cradle MIDI input";
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
struct Heard {
    port: Arc<str>,
    message: NoteMessage,
}

#[derive(Serialize, Clone)]
struct NoteEvent<'a> {
    port: &'a str,
    channel: u8,
    note: u8,
    velocity: u8,
    on: bool,
}

/// Start the MIDI listener: the forwarder that emits the notes, and the scanner that follows the system's ports.
pub fn start(app: &AppHandle) {
    app.manage(MidiHost::default());
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
            .map(|heard| NoteEvent {
                port: &heard.port,
                channel: heard.message.channel,
                note: heard.message.note,
                velocity: heard.message.velocity,
                on: heard.message.on,
            })
            .collect();
        let _ = app.emit_to(SHELL_WINDOW, NOTE_EVENT, notes);
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

    use super::{decode, Heard, PortsState, CLIENT_NAME};

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
                move |_stamp: u64, bytes: &[u8], port_name: &mut Arc<str>| {
                    if let Some(message) = decode(bytes) {
                        let _ = tx.send(Heard {
                            port: Arc::clone(port_name),
                            message,
                        });
                    }
                },
                owner,
            )
            .map_err(|error| error.to_string())
    }
}

#[cfg(not(target_os = "macos"))]
mod backend {
    use std::sync::mpsc::Sender;

    use super::{Heard, PortsState};

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
    fn controllers_clock_sysex_and_malformed_messages_are_not_notes() {
        assert_eq!(decode(&[0xB0, 64, 127]), None, "sustain pedal");
        assert_eq!(decode(&[0xF8]), None, "timing clock");
        assert_eq!(decode(&[0xF0, 0x7E, 0xF7]), None, "sysex");
        assert_eq!(decode(&[0x90, 60]), None, "truncated");
        assert_eq!(decode(&[0x90, 128, 100]), None, "note byte out of range");
        assert_eq!(decode(&[0x90, 60, 200]), None, "velocity byte out of range");
    }
}
