//! Local inference IO from AIKit's admitted staged reading. This owns neither
//! the person/context admission nor playback, cancellation or an agent session.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::IpAddr,
    process::{Child, Command, Stdio},
    sync::mpsc,
    time::{Duration, Instant},
};

const MAX_WAV: usize = 32 * 1024 * 1024;
const MAX_TRANSCRIPT: usize = 256 * 1024;
const MAX_TEXT: usize = 16 * 1024;
const TIMEOUT: Duration = Duration::from_secs(90);

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn text(value: &Value, field: &str) -> Result<String, String> {
    value
        .as_str()
        .filter(|v| !v.trim().is_empty() && v.len() <= 4096 && !v.chars().any(char::is_control))
        .map(str::to_owned)
        .ok_or_else(|| format!("Native speech {field} is absent or invalid"))
}
fn endpoint(config: &Value, field: &str) -> Result<String, String> {
    let host: IpAddr = text(&config["host"], "host")?
        .parse()
        .map_err(|_| "Native speech requires a literal loopback host")?;
    let port = config["port"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= 65535)
        .ok_or("Native speech port is invalid")?;
    let path = text(&config[field], field)?;
    if !host.is_loopback() || !path.starts_with('/') {
        return Err("Native speech requires a configured loopback HTTP path".into());
    }
    let host = match host {
        IpAddr::V4(v) => v.to_string(),
        IpAddr::V6(v) => format!("[{v}]"),
    };
    let raw = format!("http://{host}:{port}{path}");
    let url = url::Url::parse(&raw).map_err(|_| "Native speech endpoint is invalid")?;
    if url.as_str() != raw
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(
            "Native speech endpoint must have an exact path without credentials, query or fragment"
                .into(),
        );
    }
    Ok(raw)
}

#[derive(Clone)]
struct Stage {
    endpoint: String,
    provider: String,
    model: String,
    model_ref: String,
    engine: String,
    engine_revision: String,
    source: String,
    voice: Option<String>,
}
impl Stage {
    fn from_reading(reading: &Value, name: &str) -> Result<Self, String> {
        let config = &reading["configuration"][name];
        let api_endpoint = endpoint(config, "path")?;
        let component = format!("component/local-speech-{name}");
        let stages = reading["runtime"]["stages"]
            .as_array()
            .ok_or("Native speech stages are absent")?;
        let matches: Vec<_> = stages
            .iter()
            .filter(|v| v["component"] == component)
            .collect();
        if matches.len() != 1 {
            return Err("Native speech stage is missing or ambiguous".into());
        }
        let relation = &matches[0]["relation"];
        for (actual, declared) in [
            (
                &relation["materialisation"]["endpoint"],
                json!(api_endpoint),
            ),
            (
                &relation["engine"]["provider"],
                config["provider_ref"].clone(),
            ),
            (&relation["engine"]["engine"], config["engine_ref"].clone()),
            (
                &relation["engine"]["revision"],
                config["engine_revision"].clone(),
            ),
            (&relation["model"]["model"], config["model_ref"].clone()),
            (&relation["model"]["variant"], config["model_id"].clone()),
        ] {
            if actual != &declared {
                return Err("Native speech stage differs from its configured material".into());
            }
        }
        let modality = &relation["model_surface"]["modality"];
        if relation["model_surface"]["protocol"] != "http-request-response"
            || modality["transport"] != "http"
            || modality["availability"]["state"] != "available"
            || relation["model_surface"]["access"]["inference"]["state"] != "available"
            || modality["credential"]["condition"] != "not-required"
            || !modality["interaction"]
                .as_array()
                .is_some_and(|values| values.iter().any(|value| value == "request-response"))
        {
            return Err(
                "Native local speech stage has no available credential-free request/response route"
                    .into(),
            );
        }
        if reading["probes"][name]["endpoint"] != endpoint(config, "health_path")? {
            return Err("Native speech health probe belongs to another endpoint".into());
        }
        text(&reading["probes"][name]["response_digest"], "probe digest")?;
        let engine = text(&config["engine_ref"], "engine")?;
        if (name == "stt" && engine != "engine/whisper-cpp")
            || (name == "tts" && engine != "engine/kokoro-onnx")
        {
            return Err("Native speech engine has no implemented local wire adapter".into());
        }
        let voice = if name == "tts" {
            Some(text(&config["voice"], "configured voice")?)
        } else {
            None
        };
        Ok(Self {
            endpoint: api_endpoint,
            provider: text(&config["provider_ref"], "provider")?,
            model: text(&config["model_id"], "model identifier")?,
            model_ref: text(&config["model_ref"], "model reference")?,
            engine,
            engine_revision: text(&config["engine_revision"], "engine revision")?,
            source: text(&config["source_ref"], "configuration source")?,
            voice,
        })
    }
}

pub struct LocalSpeechTransport {
    revision: String,
    reading_digest: String,
    stt: Stage,
    tts: Stage,
}
impl LocalSpeechTransport {
    pub fn from_reading(reading: &Value) -> Result<Self, String> {
        if reading["schema"] != "aikit.local-speech-reading/v1"
            || reading["configuration"]["schema"] != "aikit.local-speech-config/v1"
            || reading["runtime"]["version"] != "aikit.model-stage-runtime/v1"
            || reading["runtime"]["composed_modality"]["complete"] != true
            || reading["runtime"]["composed_modality"]["speech_capable"] != true
        {
            return Err("Expected an available native staged speech reading".into());
        }
        let revision = text(&reading["configuration_revision"], "configuration revision")?;
        if reading["composition"]["target_revision"] != revision {
            return Err("Native speech configuration revision differs from its composition".into());
        }
        Ok(Self {
            revision,
            reading_digest: digest(&serde_json::to_vec(reading).map_err(|e| e.to_string())?),
            stt: Stage::from_reading(reading, "stt")?,
            tts: Stage::from_reading(reading, "tts")?,
        })
    }
    fn receipt(
        &self,
        stage: &Stage,
        input: &[u8],
        output: &[u8],
        request: &[u8],
        http: &HttpReply,
    ) -> Value {
        json!({"schema":"oi.nara-local-speech-receipt/v1","configuration_revision":self.revision,
            "native_reading_sha256":self.reading_digest,"configuration_source_ref":stage.source,
            "provider_ref":stage.provider,"engine_ref":stage.engine,"engine_revision":stage.engine_revision,
            "declared_model_ref":stage.model_ref,"declared_model_id":stage.model,"declared_voice":stage.voice,
            "endpoint":stage.endpoint,"input_sha256":digest(input),"output_sha256":digest(output),
            "request_sha256":digest(request),"response_sha256":digest(&http.body),"http_status":http.status,
            "response_content_type":http.content_type,"elapsed_milliseconds":http.elapsed.as_millis(),
            "inference_observed":true,"playback_observed":false,"provider_cancellation_performed":false,
            "standing":"Actual HTTP inference response; model/voice identity remains the native configured declaration"})
    }
    pub fn transcribe(
        &self,
        wav: &[u8],
        request_ref: &str,
        cancelled: impl Fn() -> bool,
    ) -> Result<Value, String> {
        text(&json!(request_ref), "request reference")?;
        let format = wav_format(wav)?;
        if format["sample_rate"] != 16000
            || format["channels"] != 1
            || format["bits_per_sample"] != 16
        {
            return Err("Whisper transcription requires 16 kHz mono PCM16 WAV; resample the actual capture first".into());
        }
        let boundary = format!("oi-nara-{}", digest(wav));
        let mut body = format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"capture.wav\"\r\nContent-Type: audio/wav\r\n\r\n").into_bytes();
        body.extend_from_slice(wav);
        body.extend_from_slice(format!("\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n--{boundary}--\r\n").as_bytes());
        let http = post(
            &self.stt.endpoint,
            &format!("multipart/form-data; boundary={boundary}"),
            &body,
            MAX_TRANSCRIPT,
            cancelled,
        )?;
        if http.content_type.split(';').next().map(str::trim) != Some("application/json") {
            return Err("Native transcription returned an unexpected content type".into());
        }
        let reply: Value = serde_json::from_slice(&http.body)
            .map_err(|_| "Native transcription response is not JSON")?;
        let transcript = reply["text"]
            .as_str()
            .filter(|v| v.len() <= MAX_TRANSCRIPT)
            .ok_or("Native transcription response has no bounded text")?;
        Ok(
            json!({"schema":"oi.nara-transcription/v1","request_ref":request_ref,"text":transcript,
            "empty":transcript.trim().is_empty(),"input_format":format,
            "receipt":self.receipt(&self.stt,wav,transcript.as_bytes(),&body,&http)}),
        )
    }
    pub fn synthesize(
        &self,
        spoken_text: &str,
        request_ref: &str,
        cancelled: impl Fn() -> bool,
    ) -> Result<Value, String> {
        text(&json!(request_ref), "request reference")?;
        if spoken_text.trim().is_empty()
            || spoken_text.len() > MAX_TEXT
            || spoken_text
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
        {
            return Err("Native synthesis requires nonempty text of at most 16 KiB without control characters".into());
        }
        let body = serde_json::to_vec(&json!({"model":self.tts.model,"input":spoken_text,
            "voice":self.tts.voice,"response_format":"wav"}))
        .map_err(|e| e.to_string())?;
        let http = post(
            &self.tts.endpoint,
            "application/json",
            &body,
            MAX_WAV,
            cancelled,
        )?;
        if !matches!(
            http.content_type.split(';').next().map(str::trim),
            Some("audio/wav" | "audio/x-wav" | "audio/wave")
        ) {
            return Err("Native synthesis returned an unexpected content type".into());
        }
        let format = wav_format(&http.body)?;
        Ok(
            json!({"schema":"oi.nara-synthesis/v1","request_ref":request_ref,
            "audio_base64":STANDARD.encode(&http.body),"content_type":"audio/wav","format":format,
            "receipt":self.receipt(&self.tts,spoken_text.as_bytes(),&http.body,&body,&http)}),
        )
    }
}

/// Inspect RIFF chunks rather than assuming a 44-byte header: actual provider
/// WAVs may carry LIST/JUNK metadata. Bounds and PCM arithmetic are checked.
fn wav_format(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() < 44
        || bytes.len() > MAX_WAV
        || &bytes[..4] != b"RIFF"
        || &bytes[8..12] != b"WAVE"
        || u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize != bytes.len() - 8
    {
        return Err("Native speech requires a bounded, complete RIFF/WAVE file".into());
    }
    let mut offset = 12usize;
    let mut format = None;
    let mut data_size = None;
    while offset < bytes.len() {
        if bytes.len() - offset < 8 {
            return Err("WAV chunk header is truncated".into());
        }
        let size = u32::from_le_bytes(bytes[offset + 4..offset + 8].try_into().unwrap()) as usize;
        let end = (offset + 8)
            .checked_add(size)
            .filter(|v| *v <= bytes.len())
            .ok_or("WAV chunk exceeds its file")?;
        let chunk = &bytes[offset + 8..end];
        match &bytes[offset..offset + 4] {
            b"fmt " => {
                if format.is_some() || size < 16 {
                    return Err("WAV format is absent or ambiguous".into());
                }
                let u16at = |n| u16::from_le_bytes(chunk[n..n + 2].try_into().unwrap());
                let u32at = |n| u32::from_le_bytes(chunk[n..n + 4].try_into().unwrap());
                let (encoding, channels, rate, byte_rate, align, bits) =
                    (u16at(0), u16at(2), u32at(4), u32at(8), u16at(12), u16at(14));
                if encoding != 1
                    || !(1..=2).contains(&channels)
                    || !(8000..=96000).contains(&rate)
                    || bits != 16
                    || align != channels * 2
                    || byte_rate != rate * u32::from(align)
                {
                    return Err("Native speech WAV must be PCM16 mono/stereo with consistent sample arithmetic".into());
                }
                format = Some((channels, rate, align, bits));
            }
            b"data" if data_size.replace(size).is_some() => {
                return Err("WAV data is ambiguous".into());
            }
            _ => {}
        }
        offset = end
            .checked_add(size % 2)
            .filter(|v| *v <= bytes.len())
            .ok_or("WAV padding is truncated")?;
    }
    let (channels, rate, align, bits) = format.ok_or("WAV has no format")?;
    let size = data_size
        .filter(|v| *v > 0 && v % usize::from(align) == 0)
        .ok_or("WAV has no complete sample frames")?;
    let frames = size / usize::from(align);
    if frames > rate as usize * 300 {
        return Err("Native speech audio exceeds five minutes".into());
    }
    Ok(
        json!({"encoding":"pcm","sample_rate":rate,"channels":channels,"bits_per_sample":bits,
        "sample_frames":frames,"duration_seconds":frames as f64 / f64::from(rate)}),
    )
}

struct HttpReply {
    status: u16,
    content_type: String,
    body: Vec<u8>,
    elapsed: Duration,
}
struct Process(Child);
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn reader(
    pipe: impl Read + Send + 'static,
    limit: usize,
) -> mpsc::Receiver<Result<Vec<u8>, String>> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = pipe
            .take(limit as u64 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Local speech response could not be read".into())
            .and_then(|_| {
                if bytes.len() > limit {
                    Err("Local speech response exceeds its bound".into())
                } else {
                    Ok(bytes)
                }
            });
        let _ = tx.send(result);
    });
    rx
}
fn post(
    endpoint: &str,
    content_type: &str,
    body: &[u8],
    limit: usize,
    cancelled: impl Fn() -> bool,
) -> Result<HttpReply, String> {
    if cancelled() {
        return Err("Native speech request was stopped before dispatch".into());
    }
    let start = Instant::now();
    let mut process = Process(
        Command::new("curl")
            .args([
                "--disable",
                "--silent",
                "--show-error",
                "--noproxy",
                "*",
                "--proto",
                "=http",
                "--max-redirs",
                "0",
                "--connect-timeout",
                "2",
                "--max-time",
                &TIMEOUT.as_secs().to_string(),
                "--header",
                &format!("Content-Type: {content_type}"),
                "--data-binary",
                "@-",
                "--write-out",
                "\nOI_NARA_HTTP:%{http_code}\n%{content_type}\n",
                endpoint,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|_| "Native local speech HTTP transport is unavailable")?,
    );
    let mut stdin = process
        .0
        .stdin
        .take()
        .ok_or("Native speech stdin is unavailable")?;
    let stdout = reader(
        process
            .0
            .stdout
            .take()
            .ok_or("Native speech stdout is unavailable")?,
        limit + 1024,
    );
    let stderr = reader(
        process
            .0
            .stderr
            .take()
            .ok_or("Native speech stderr is unavailable")?,
        8192,
    );
    let (tx, rx) = mpsc::channel();
    let input = body.to_vec();
    std::thread::spawn(move || {
        let _ = tx.send(
            stdin
                .write_all(&input)
                .map_err(|_| "Native speech request could not be written".to_string()),
        );
    });
    let status = loop {
        if cancelled() {
            // Drop terminates and reaps our HTTP client. The provider has no
            // cancellation protocol: do not claim its computation has stopped.
            return Err(
                "Native speech HTTP transport stopped; no inference result admitted".into(),
            );
        }
        match process
            .0
            .try_wait()
            .map_err(|_| "Native speech transport status is unavailable")?
        {
            Some(status) => break status,
            None if start.elapsed() < TIMEOUT + Duration::from_secs(2) => {
                std::thread::sleep(Duration::from_millis(10))
            }
            None => return Err("Native speech HTTP request exceeded its deadline".into()),
        }
    };
    if cancelled() {
        return Err("Native speech response was stopped; no inference result admitted".into());
    }
    rx.recv_timeout(Duration::from_secs(2))
        .map_err(|_| "Native speech request writer did not finish")??;
    let bytes = stdout
        .recv_timeout(Duration::from_secs(2))
        .map_err(|_| "Native speech response reader did not finish")??;
    let _errors = stderr
        .recv_timeout(Duration::from_secs(2))
        .map_err(|_| "Native speech error reader did not finish")??;
    if !status.success() {
        return Err(format!(
            "Native speech HTTP transport failed (exit {:?}); no inference result admitted",
            status.code()
        ));
    }
    let marker = b"\nOI_NARA_HTTP:";
    let split = bytes
        .windows(marker.len())
        .rposition(|v| v == marker)
        .ok_or("Native speech HTTP status was not returned")?;
    let metadata = std::str::from_utf8(&bytes[split + marker.len()..])
        .map_err(|_| "Native speech HTTP metadata is invalid")?;
    let mut lines = metadata.lines();
    let status: u16 = lines
        .next()
        .ok_or("Native speech HTTP status is absent")?
        .parse()
        .map_err(|_| "Native speech HTTP status is invalid")?;
    let content_type = lines
        .next()
        .ok_or("Native speech content type is absent")?
        .to_ascii_lowercase();
    if lines.next().is_some() || split > limit {
        return Err("Native speech HTTP response exceeds its bound".into());
    }
    if !(200..300).contains(&status) {
        return Err(format!(
            "Native speech inference refused with HTTP {status}"
        ));
    }
    Ok(HttpReply {
        status,
        content_type,
        body: bytes[..split].to_vec(),
        elapsed: start.elapsed(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        net::TcpListener,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
    };

    #[test]
    fn stop_terminates_real_pending_http_io() {
        // Exercise the real curl process and TCP connection. This peer never
        // returns an inference result; it is a deliberately stalled transport,
        // not a substitute speech provider or a claimed voice acceptance.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}/pending", listener.local_addr().unwrap());
        let cancelled = Arc::new(AtomicBool::new(false));
        let observed = cancelled.clone();
        let peer = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(10)))
                .unwrap();
            let mut data = [0; 4096];
            assert!(stream.read(&mut data).unwrap() > 0);
            observed.store(true, Ordering::SeqCst);
            loop {
                match stream.read(&mut data) {
                    Ok(0) => break,
                    Ok(_) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::ConnectionReset => break,
                    Err(error) => panic!("Stopped HTTP client left its connection open: {error}"),
                }
            }
        });
        let started = Instant::now();
        let result = post(&endpoint, "application/json", b"{}", 1024, || {
            cancelled.load(Ordering::SeqCst)
        });
        assert!(matches!(result, Err(ref error) if error.contains("transport stopped")));
        assert!(started.elapsed() < Duration::from_secs(10));
        peer.join().unwrap();
    }
}
