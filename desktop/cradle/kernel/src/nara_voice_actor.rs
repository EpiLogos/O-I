//! One native Actuation speech lifecycle actor. The pipe carries native
//! receipts; its process lifetime neither replaces nor destroys AgentSession.
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    time::{Duration, Instant},
};
const MAX_REQUEST: usize = 256 * 1024;
const MAX_RESPONSE: usize = 1024 * 1024;

pub(crate) struct Actor {
    child: Child,
    stdin: Option<ChildStdin>,
    replies: Receiver<Result<Value, String>>,
}
impl Actor {
    pub(crate) fn spawn() -> Result<Self, String> {
        let (path, args) = match std::env::var_os("OI_ACTUATION_NARA_BIN") {
            Some(path) => (PathBuf::from(path), vec!["nara", "serve"]),
            None => (
                std::env::var_os("OI_BIN")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| PathBuf::from("oi")),
                vec!["actuation", "nara", "serve"],
            ),
        };
        let mut child = Command::new(path)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Native Actuation speech actor is unavailable: {e}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or("Native speech input pipe unavailable")?;
        let stdout = child
            .stdout
            .take()
            .ok_or("Native speech output pipe unavailable")?;
        let (send, replies) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut line = Vec::new();
                let frame = (|| -> Result<Option<Value>, String> {
                    loop {
                        let buffer = reader.fill_buf().map_err(|e| e.to_string())?;
                        if buffer.is_empty() {
                            return if line.is_empty() {
                                Ok(None)
                            } else {
                                Err("Native speech actor closed inside a frame".into())
                            };
                        }
                        let newline = buffer.iter().position(|b| *b == b'\n');
                        let take = newline.map(|p| p + 1).unwrap_or(buffer.len());
                        if line.len() + take > MAX_RESPONSE {
                            return Err("Native speech actor response exceeds its bound".into());
                        }
                        line.extend_from_slice(&buffer[..take]);
                        reader.consume(take);
                        if newline.is_some() {
                            return serde_json::from_slice(&line).map(Some).map_err(|e| {
                                format!("Native speech actor response is invalid: {e}")
                            });
                        }
                    }
                })();
                match frame {
                    Ok(Some(value)) => {
                        if send.send(Ok(value)).is_err() {
                            break;
                        }
                    }
                    Ok(None) => break,
                    Err(error) => {
                        let _ = send.send(Err(error));
                        break;
                    }
                }
            }
        });
        Ok(Self {
            child,
            stdin: Some(stdin),
            replies,
        })
    }
    pub(crate) fn call(&mut self, mut request: Value) -> Result<Value, String> {
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
        let reference = format!(
            "oi:nara-voice:{}",
            bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()
        );
        request["schema"] = json!("actuation.nara-session-request/v1");
        request["request_ref"] = json!(reference);
        let mut wire = serde_json::to_vec(&request).map_err(|e| e.to_string())?;
        if wire.len() + 1 > MAX_REQUEST {
            return Err("Native speech request exceeds its bound".into());
        }
        wire.push(b'\n');
        // A live child can stop reading. Bound the writer as well as the
        // reply; terminating the child releases any blocked pipe writer.
        let mut stdin = self.stdin.take().ok_or("Native speech actor is closed")?;
        let (written, completion) = mpsc::sync_channel(1);
        std::thread::spawn(move || {
            let result = stdin.write_all(&wire).and_then(|_| stdin.flush());
            let _ = written.send((stdin, result));
        });
        match completion.recv_timeout(Duration::from_secs(10)) {
            Ok((stdin, Ok(()))) => self.stdin = Some(stdin),
            Ok((_, Err(error))) => {
                self.stop();
                return Err(format!("Native speech transport failed: {error}"));
            }
            Err(error) => {
                self.stop();
                return Err(format!(
                    "Native speech actor did not consume the bounded request: {error}"
                ));
            }
        }
        let response = match self.replies.recv_timeout(Duration::from_secs(10)) {
            Ok(value) => value?,
            Err(error) => {
                self.stop();
                return Err(format!(
                    "Native speech actor did not return a bounded receipt: {error}"
                ));
            }
        };
        if response["schema"] != "actuation.nara-session-response/v1"
            || response["request_ref"] != reference
        {
            self.stop();
            return Err("Native speech actor returned an unrelated receipt".into());
        }
        if response["ok"] != true {
            return Err(format!("Native speech refused: {}", response["error"]));
        }
        Ok(response)
    }
    fn stop(&mut self) {
        drop(self.stdin.take());
        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            match self.child.try_wait() {
                Ok(Some(_)) => return,
                Err(_) => break,
                Ok(None) => {}
            }
            if Instant::now() >= deadline {
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
impl Drop for Actor {
    fn drop(&mut self) {
        self.stop();
    }
}
