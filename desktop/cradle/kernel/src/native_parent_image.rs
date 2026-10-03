//! Actual native process/socket facts qualified by existing installer cuts.
//! Requests cannot choose a PID, expected image hash or qualification path.
//! The native CLI derives its actual parent and stdin Unix peer here.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};

pub const CUT_SCHEMA: &str = "oi.native-parent-image-cut/v1";
pub const QUALIFICATION_SCHEMA: &str = "oi.native-parent-channel-qualification/v1";
const MAX_RECEIPT: u64 = 1024 * 1024;
const MAX_IMAGE: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeParentComponent {
    pub role: String,
    pub executable: PathBuf,
    pub sha256: String,
    pub bytes: String,
    pub source_revision: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct NativeParentCut {
    pub schema: String,
    pub standing: String,
    pub source_revision: String,
    pub source_tree: String,
    pub source_receipt_sha256: String,
    pub packaging_sha256: Option<String>,
    pub components: Vec<NativeParentComponent>,
}
fn hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn digest_shape(value: &str) -> bool {
    value.strip_prefix("sha256:").is_some_and(|v| hex(v, 64))
}
fn decimal(value: &str) -> Result<u64, String> {
    let number: u64 = value
        .parse()
        .map_err(|_| "native image byte count invalid")?;
    if number.to_string() != value {
        return Err("native image byte count noncanonical".into());
    }
    Ok(number)
}
fn file_digest(file: &mut File) -> Result<String, String> {
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_IMAGE {
        return Err("native executable image exceeds finite image bound".into());
    }
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut block = [0u8; 65536];
    loop {
        let n = file.read(&mut block).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&block[..n]);
    }
    let after = file.metadata().map_err(|e| e.to_string())?;
    if metadata.dev() != after.dev()
        || metadata.ino() != after.ino()
        || metadata.len() != after.len()
        || metadata.mtime() != after.mtime()
        || metadata.mtime_nsec() != after.mtime_nsec()
        || metadata.ctime() != after.ctime()
        || metadata.ctime_nsec() != after.ctime_nsec()
    {
        return Err("native executable image changed during measurement".into());
    }
    Ok(format!("sha256:{:x}", hash.finalize()))
}
impl NativeParentCut {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != CUT_SCHEMA
            || !["installed", "source_built_component"].contains(&self.standing.as_str())
            || !hex(&self.source_revision, 40)
            || !hex(&self.source_tree, 40)
            || !digest_shape(&self.source_receipt_sha256)
            || !(3..=512).contains(&self.components.len())
            || (self.standing == "installed"
                && self
                    .packaging_sha256
                    .as_deref()
                    .is_none_or(|v| !digest_shape(v)))
            || (self.standing == "source_built_component" && self.packaging_sha256.is_some())
        {
            return Err("native parent cut is incomplete or unsupported".into());
        }
        let mut entries = std::collections::BTreeSet::new();
        for component in &self.components {
            if !["supervisor", "qualifier", "ql_host"].contains(&component.role.as_str())
                || !component.executable.is_absolute()
                || !digest_shape(&component.sha256)
                || !hex(&component.source_revision, 40)
                || !(1..=MAX_IMAGE).contains(&decimal(&component.bytes)?)
                || !entries.insert((component.role.clone(), component.executable.clone()))
            {
                return Err("native parent cut component is invalid or duplicated".into());
            }
        }
        for role in ["supervisor", "qualifier", "ql_host"] {
            if !self.components.iter().any(|c| c.role == role) {
                return Err(format!("native parent cut has no actual {role} image"));
            }
        }
        Ok(())
    }
}
fn owned_bytes(path: &Path, uid: u32) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !metadata.is_file()
        || metadata.uid() != uid
        || metadata.mode() & 0o022 != 0
        || metadata.len() == 0
        || metadata.len() > MAX_RECEIPT
    {
        return Err("native image receipt is missing, foreign or mutable by another user".into());
    }
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let opened = file.metadata().map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(MAX_RECEIPT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let after = file.metadata().map_err(|e| e.to_string())?;
    let current = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    let same = |a: &fs::Metadata, b: &fs::Metadata| {
        a.dev() == b.dev()
            && a.ino() == b.ino()
            && a.len() == b.len()
            && a.uid() == b.uid()
            && a.mode() == b.mode()
            && a.mtime() == b.mtime()
            && a.mtime_nsec() == b.mtime_nsec()
            && a.ctime() == b.ctime()
            && a.ctime_nsec() == b.ctime_nsec()
    };
    if !same(&metadata, &opened)
        || !same(&opened, &after)
        || !same(&after, &current)
        || bytes.len() as u64 != metadata.len()
    {
        return Err("native image receipt changed during read".into());
    }
    Ok(bytes)
}
fn owned_json(path: &Path, uid: u32) -> Result<Value, String> {
    serde_json::from_slice(&owned_bytes(path, uid)?).map_err(|e| e.to_string())
}
/// OS account data, never HOME/OI_DATA_HOME or an operation's expected file.
pub fn native_receipt_root() -> Result<(PathBuf, u32), String> {
    let uid = unsafe { libc::getuid() };
    let mut buffer = vec![0u8; 65536];
    let mut entry = std::mem::MaybeUninit::<libc::passwd>::zeroed();
    let mut result = std::ptr::null_mut();
    // SAFETY: reentrant OS account lookup into owned exact bounded buffers;
    // pointer is read only while this buffer remains alive.
    let status = unsafe {
        libc::getpwuid_r(
            uid,
            entry.as_mut_ptr(),
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            &mut result,
        )
    };
    if status != 0 || result.is_null() {
        return Err("native OS account home unavailable".into());
    }
    let entry = unsafe { entry.assume_init() };
    if entry.pw_uid != uid || entry.pw_dir.is_null() {
        return Err("native OS account changed".into());
    }
    let home = unsafe { std::ffi::CStr::from_ptr(entry.pw_dir) };
    use std::os::unix::ffi::OsStrExt;
    let home = PathBuf::from(std::ffi::OsStr::from_bytes(home.to_bytes()));
    if !home.is_absolute() {
        return Err("native OS account home is not absolute".into());
    }
    #[cfg(target_os = "linux")]
    let root = home.join(".local/share/oi");
    #[cfg(target_os = "macos")]
    let root = home.join("Library/Application Support/OI");
    Ok((root, uid))
}
/// Fixed existing installer/developer receipt locations. This is called only
/// with the native CLI's independently discovered application-data root.
pub fn locate_native_cut(data_root: &Path, uid: u32) -> Result<NativeParentCut, String> {
    let developer = data_root.join("receipts/dev/installed/oi-native-act-parent.json");
    let cut = if developer.exists() {
        let cut: NativeParentCut =
            serde_json::from_value(owned_json(&developer, uid)?).map_err(|e| e.to_string())?;
        if cut.standing != "source_built_component" {
            return Err("native developer cut has wrong standing".into());
        }
        let receipt_path = developer.with_file_name("oi-native-act-parent-source.json");
        let original = owned_bytes(&receipt_path, uid)?;
        let source: Value = serde_json::from_slice(&original).map_err(|e| e.to_string())?;
        if format!("sha256:{:x}", Sha256::digest(&original)) != cut.source_receipt_sha256
            || source["schema"] != "oi.native-parent-source-build/v1"
            || source["status"] != "component_images_ready"
            || source["sources"]["oi"]["revision"] != cut.source_revision
            || source["sources"]["oi"]["tree"] != cut.source_tree
        {
            return Err("native developer cut detached from original source-build receipt".into());
        }
        let actual = source["images"]
            .as_array()
            .ok_or("native original image inventory absent")?;
        if actual.len() != cut.components.len() {
            return Err("native original image cohort lost".into());
        }
        for (a, c) in actual.iter().zip(&cut.components) {
            if a["role"] != c.role
                || a["executable"] != json!(c.executable)
                || a["sha256"] != c.sha256
                || a["bytes"] != c.bytes
                || a["source_revision"] != c.source_revision
            {
                return Err(
                    "native source cut differs from actual compiler image inventory".into(),
                );
            }
        }
        cut
    } else {
        let receipt = owned_json(&data_root.join("receipts/installed-desktop.json"), uid)?;
        if receipt["schema"] != "oi.installed-desktop/v1" {
            return Err("native desktop receipt contract unavailable".into());
        }
        let cut: NativeParentCut = serde_json::from_value(receipt["native_parent_cut"].clone())
            .map_err(|_| "native desktop receipt has no qualified parent images")?;
        if cut.standing != "installed"
            || cut.source_revision != receipt["bundle"]["source_revision"]
            || cut
                .packaging_sha256
                .as_deref()
                .and_then(|v| v.strip_prefix("sha256:"))
                != receipt["bundle"]["sha256"].as_str()
        {
            return Err("native parent images detached from original installed bundle".into());
        }
        cut
    };
    cut.validate()?;
    Ok(cut)
}

#[derive(Debug, Eq, PartialEq, Serialize)]
struct ProcessIdentity {
    pid: u32,
    ppid: u32,
    uid: u32,
    start: String,
}
#[derive(Debug, Serialize)]
struct LoadedImage {
    process: ProcessIdentity,
    executable: PathBuf,
    device: String,
    inode: String,
    bytes: String,
    sha256: String,
}
#[cfg(target_os = "linux")]
fn process_identity(pid: u32) -> Result<ProcessIdentity, String> {
    let root = PathBuf::from(format!("/proc/{pid}"));
    let bytes = fs::read_to_string(root.join("stat")).map_err(|e| e.to_string())?;
    let tail = bytes
        .rsplit_once(')')
        .ok_or("native process stat malformed")?
        .1;
    let values: Vec<_> = tail.split_whitespace().collect();
    if values.len() < 20 {
        return Err("native process stat truncated".into());
    }
    Ok(ProcessIdentity {
        pid,
        ppid: values[1].parse().map_err(|_| "native parent PID absent")?,
        uid: fs::metadata(root).map_err(|e| e.to_string())?.uid(),
        start: values[19].to_owned(),
    })
}
#[cfg(target_os = "macos")]
fn process_identity(pid: u32) -> Result<ProcessIdentity, String> {
    let mut info = std::mem::MaybeUninit::<libc::proc_bsdinfo>::zeroed();
    // SAFETY: the exact libc output type and byte length are supplied; the
    // output is used only when the OS returned its entire initialized size.
    let size = std::mem::size_of::<libc::proc_bsdinfo>();
    let n = unsafe {
        libc::proc_pidinfo(
            pid as i32,
            libc::PROC_PIDTBSDINFO,
            0,
            info.as_mut_ptr().cast(),
            size as i32,
        )
    };
    if n != size as i32 {
        return Err("native BSD process identity unavailable".into());
    }
    let info = unsafe { info.assume_init() };
    if info.pbi_pid != pid {
        return Err("native process PID changed".into());
    }
    Ok(ProcessIdentity {
        pid,
        ppid: info.pbi_ppid,
        uid: info.pbi_uid,
        start: format!("{}:{}", info.pbi_start_tvsec, info.pbi_start_tvusec),
    })
}

#[cfg(target_os = "macos")]
#[repr(C)]
struct RegionInfo {
    protection: u32,
    max_protection: u32,
    inheritance: u32,
    flags: u32,
    offset: u64,
    behavior: u32,
    user_wired_count: u32,
    user_tag: u32,
    pages_resident: u32,
    pages_shared_now_private: u32,
    pages_swapped_out: u32,
    pages_dirtied: u32,
    ref_count: u32,
    shadow_depth: u32,
    share_mode: u32,
    private_pages_resident: u32,
    shared_pages_resident: u32,
    obj_id: u32,
    depth: u32,
    address: u64,
    size: u64,
}
#[cfg(target_os = "macos")]
#[repr(C)]
struct RegionWithPath {
    region: RegionInfo,
    vnode: libc::vnode_info_path,
}
#[cfg(target_os = "macos")]
fn mapped_executable(pid: u32, metadata: &fs::Metadata) -> Result<(), String> {
    let mut address = 0_u64;
    // Actual executable mapping vnode, not a pathname claimed by argv/ps.
    for _ in 0..4096 {
        let mut region = std::mem::MaybeUninit::<RegionWithPath>::zeroed();
        let size = std::mem::size_of::<RegionWithPath>();
        // Darwin sys/proc_info.h PROC_PIDREGIONPATHINFO=8. Exact repr(C)
        // mirrors the published native structures; OS result length checked.
        let n = unsafe {
            libc::proc_pidinfo(
                pid as i32,
                8,
                address,
                region.as_mut_ptr().cast(),
                size as i32,
            )
        };
        if n != size as i32 {
            return Err("native executable mapping unavailable".into());
        }
        let region = unsafe { region.assume_init() };
        let stat = &region.vnode.vip_vi.vi_stat;
        if region.region.protection & libc::PROT_EXEC as u32 != 0
            && u64::from(stat.vst_dev) == metadata.dev()
            && stat.vst_ino == metadata.ino()
            && stat.vst_size as u64 == metadata.len()
        {
            return Ok(());
        }
        let next = region
            .region
            .address
            .checked_add(region.region.size)
            .ok_or("native VM address exhausted")?;
        if next <= address {
            return Err("native VM region order invalid".into());
        }
        address = next;
    }
    Err("native executable mapping exceeds bounded native region inspection".into())
}
fn loaded_image(pid: u32) -> Result<LoadedImage, String> {
    let before = process_identity(pid)?;
    #[cfg(target_os = "linux")]
    let (path, mut file) = {
        let handle = PathBuf::from(format!("/proc/{pid}/exe"));
        (
            fs::read_link(&handle).map_err(|e| e.to_string())?,
            File::open(handle).map_err(|e| e.to_string())?,
        )
    };
    #[cfg(target_os = "macos")]
    let (path, mut file) = {
        let mut bytes = [0u8; 4096];
        // SAFETY: initialized buffer with exact native bound; returned length
        // and NUL terminator are checked before path construction.
        let n = unsafe {
            libc::proc_pidpath(pid as i32, bytes.as_mut_ptr().cast(), bytes.len() as u32)
        };
        if n <= 0 || n as usize > bytes.len() {
            return Err("native executable path unavailable".into());
        }
        let end = bytes
            .iter()
            .position(|b| *b == 0)
            .ok_or("native executable path unterminated")?;
        use std::os::unix::ffi::OsStringExt;
        let path = PathBuf::from(std::ffi::OsString::from_vec(bytes[..end].to_vec()));
        let file = File::open(&path).map_err(|e| e.to_string())?;
        mapped_executable(pid, &file.metadata().map_err(|e| e.to_string())?)?;
        (path, file)
    };
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    let sha256 = file_digest(&mut file)?;
    if process_identity(pid)? != before {
        return Err("native process identity changed during image qualification".into());
    }
    #[cfg(target_os = "macos")]
    mapped_executable(pid, &metadata)?;
    Ok(LoadedImage {
        process: before,
        executable: path,
        device: metadata.dev().to_string(),
        inode: metadata.ino().to_string(),
        bytes: metadata.len().to_string(),
        sha256,
    })
}

/// Existing native kernel only; foreign descriptors and regular stdin refuse.
pub fn unix_peer(fd: i32) -> Result<(u32, u32), String> {
    #[cfg(target_os = "linux")]
    {
        let mut credential = std::mem::MaybeUninit::<libc::ucred>::zeroed();
        let mut size = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
        let result = unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_SOCKET,
                libc::SO_PEERCRED,
                credential.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if result != 0 || size as usize != std::mem::size_of::<libc::ucred>() {
            return Err("native Unix peer unavailable".into());
        }
        let c = unsafe { credential.assume_init() };
        if c.pid <= 0 {
            return Err("native Unix peer PID absent".into());
        }
        Ok((c.pid as u32, c.uid))
    }
    #[cfg(target_os = "macos")]
    {
        let mut pid = 0_i32;
        let mut size = std::mem::size_of::<i32>() as libc::socklen_t;
        let result = unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_LOCAL,
                libc::LOCAL_PEERPID,
                (&mut pid as *mut i32).cast(),
                &mut size,
            )
        };
        if result != 0 || size as usize != std::mem::size_of::<i32>() || pid <= 0 {
            return Err("native Unix peer PID unavailable".into());
        }
        let mut cred = std::mem::MaybeUninit::<libc::xucred>::zeroed();
        size = std::mem::size_of::<libc::xucred>() as libc::socklen_t;
        let result = unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_LOCAL,
                libc::LOCAL_PEERCRED,
                cred.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if result != 0 || size as usize != std::mem::size_of::<libc::xucred>() {
            return Err("native Unix peer UID unavailable".into());
        }
        let cred = unsafe { cred.assume_init() };
        if cred.cr_version != libc::XUCRED_VERSION {
            return Err("native Unix peer credential version differs".into());
        }
        Ok((pid as u32, cred.cr_uid))
    }
}
fn qualify_image<'a>(
    cut: &'a NativeParentCut,
    role: &str,
    image: &LoadedImage,
) -> Result<&'a NativeParentComponent, String> {
    let component = cut
        .components
        .iter()
        .find(|c| {
            c.role == role
                && c.sha256 == image.sha256
                && c.bytes == image.bytes
                && (cut.standing != "source_built_component" || c.executable == image.executable)
        })
        .ok_or_else(|| format!("native loaded {role} image has no independently qualified cut"))?;
    let canonical = component
        .executable
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if canonical != component.executable {
        return Err("native qualified image path is no longer canonical".into());
    }
    let mut file = File::open(&canonical).map_err(|e| e.to_string())?;
    if file_digest(&mut file)? != component.sha256 {
        return Err("native recorded image bytes changed".into());
    }
    // Source component/ordinary Mac executable must still be the same loaded
    // vnode. Installed AppImage's sealed embedded ELF may have another path.
    if cut.standing == "source_built_component" && canonical != image.executable {
        return Err("native loaded source image differs from its actual artifact path".into());
    }
    Ok(component)
}
/// No supplied PID/hash/path. Descriptor 0 and the actual native process chain
/// are the facts. The native CLI discovers data_root before calling this.
pub fn qualify_current_parent_channel() -> Result<Value, String> {
    let (data_root, uid) = native_receipt_root()?;
    let qualifier = loaded_image(std::process::id())?;
    let host = loaded_image(qualifier.process.ppid)?;
    let supervisor = loaded_image(host.process.ppid)?;
    let peer = unix_peer(0)?;
    if peer != (supervisor.process.pid, supervisor.process.uid)
        || qualifier.process.uid != host.process.uid
        || host.process.uid != supervisor.process.uid
    {
        return Err("native parent/QL/qualifier/Unix peer chain differs".into());
    }
    if supervisor.process.uid != uid {
        return Err("native channel has foreign OS account custody".into());
    }
    let cut = locate_native_cut(&data_root, uid)?;
    let q = qualify_image(&cut, "qualifier", &qualifier)?;
    let h = qualify_image(&cut, "ql_host", &host)?;
    let s = qualify_image(&cut, "supervisor", &supervisor)?;
    // Repeat actual chain and peer after reading all image/receipt bytes.
    if process_identity(qualifier.process.pid)? != qualifier.process
        || process_identity(host.process.pid)? != host.process
        || process_identity(supervisor.process.pid)? != supervisor.process
        || unix_peer(0)? != peer
    {
        return Err("native parent channel changed during qualification".into());
    }
    Ok(json!({"schema":QUALIFICATION_SCHEMA,"qualified":true,
        "cut":{"standing":cut.standing,"source_revision":cut.source_revision,"source_tree":cut.source_tree,
            "source_receipt_sha256":cut.source_receipt_sha256,"packaging_sha256":cut.packaging_sha256},
        "supervisor":supervisor,"ql_host":host,"qualifier":qualifier,
        "component_sources":{"supervisor":s.source_revision,"ql_host":h.source_revision,"qualifier":q.source_revision},
        "peer":{"pid":peer.0,"uid":peer.1},
        "standing":"actual OS parent and Unix peer with independently native receipt-owned loaded images; original C Act selection remains separately required"}))
}

/// The existing Manager calls this before adding a private-channel argument.
/// An old installation without an image cut keeps its ordinary host path;
/// it cannot perform selected-Act compilation. Present but invalid cuts refuse.
pub(crate) fn qualify_native_spawn(host_path: &Path) -> Result<Option<Value>, String> {
    let (root, uid) = native_receipt_root()?;
    let developer = root.join("receipts/dev/installed/oi-native-act-parent.json");
    let installed = root.join("receipts/installed-desktop.json");
    if !developer.exists() {
        if !installed.exists() || owned_json(&installed, uid)?["native_parent_cut"].is_null() {
            return Ok(None);
        }
    }
    let cut = locate_native_cut(&root, uid)?;
    let supervisor = loaded_image(std::process::id())?;
    qualify_image(&cut, "supervisor", &supervisor)?;
    let host = host_path.canonicalize().map_err(|e| e.to_string())?;
    let mut file = File::open(&host).map_err(|e| e.to_string())?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    let digest = file_digest(&mut file)?;
    if !cut.components.iter().any(|c| {
        c.role == "ql_host"
            && c.executable == host
            && c.sha256 == digest
            && c.bytes == metadata.len().to_string()
    }) {
        return Err("native selected host is outside the actual qualified image cut".into());
    }
    Ok(Some(
        json!({"schema":"oi.native-act-spawn-qualification/v1",
        "supervisor_pid":supervisor.process.pid,"uid":uid,"host":host,
        "cut":cut}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::fd::AsRawFd;
    #[test]
    fn measures_actual_loaded_image_and_real_unix_peer() {
        let image = loaded_image(std::process::id()).unwrap();
        let path = std::env::current_exe().unwrap().canonicalize().unwrap();
        let mut file = File::open(path).unwrap();
        assert_eq!(image.sha256, file_digest(&mut file).unwrap());
        assert_eq!(image.bytes, file.metadata().unwrap().len().to_string());
        let (a, b) = std::os::unix::net::UnixStream::pair().unwrap();
        assert_eq!(
            unix_peer(a.as_raw_fd()).unwrap(),
            (image.process.pid, image.process.uid)
        );
        assert_eq!(
            unix_peer(b.as_raw_fd()).unwrap(),
            (image.process.pid, image.process.uid)
        );
        assert!(unix_peer(file.as_raw_fd()).is_err());
    }
    #[test]
    fn unknown_cut_roles_and_noncanonical_images_refuse() {
        let image = loaded_image(std::process::id()).unwrap();
        let component = NativeParentComponent {
            role: "supervisor".into(),
            executable: image.executable.clone(),
            sha256: image.sha256.clone(),
            bytes: image.bytes.clone(),
            source_revision: "1".repeat(40),
        };
        let mut cut = NativeParentCut {
            schema: CUT_SCHEMA.into(),
            standing: "source_built_component".into(),
            source_revision: "1".repeat(40),
            source_tree: "2".repeat(40),
            source_receipt_sha256: format!("sha256:{}", "3".repeat(64)),
            packaging_sha256: None,
            components: ["supervisor", "qualifier", "ql_host"]
                .into_iter()
                .map(|role| {
                    let mut c = component.clone();
                    c.role = role.into();
                    c
                })
                .collect(),
        };
        cut.validate().unwrap();
        qualify_image(&cut, "supervisor", &image).unwrap();
        cut.components[0].role = "arbitrary".into();
        assert!(cut.validate().is_err());
        cut.components[0] = component;
        cut.components[0].bytes = "01".into();
        assert!(cut.validate().is_err());
    }
}
