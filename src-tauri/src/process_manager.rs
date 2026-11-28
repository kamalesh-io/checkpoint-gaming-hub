use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
pub struct JobObjectGuard(usize);

#[cfg(windows)]
impl Drop for JobObjectGuard {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.0 as windows_sys::Win32::Foundation::HANDLE);
            }
        }
    }
}

#[cfg(windows)]
fn assign_child_to_kill_job(child: &Child) -> Option<JobObjectGuard> {
    use std::mem::size_of;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return None;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            CloseHandle(job);
            return None;
        }
        let proc_handle = child.as_raw_handle() as windows_sys::Win32::Foundation::HANDLE;
        if AssignProcessToJobObject(job, proc_handle) == 0 {
            CloseHandle(job);
            return None;
        }
        Some(JobObjectGuard(job as usize))
    }
}

#[cfg(not(windows))]
pub struct JobObjectGuard;

#[cfg(not(windows))]
fn assign_child_to_kill_job(_child: &Child) -> Option<JobObjectGuard> {
    None
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BackendStatus {
    Initializing,
    Ready,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStatusInfo {
    pub status: BackendStatus,
    pub port: Option<u16>,
    pub base_url: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalApiConfig {
    pub base_url: String,
    pub token: Option<String>,
}

pub struct BackendState {
    pub status: BackendStatus,
    pub port: Option<u16>,
    pub base_url: String,
    pub token: String,
    pub error_message: Option<String>,
    pub child: Option<Child>,
    pub job_guard: Option<JobObjectGuard>,
    pub data_dir: PathBuf,
}

impl BackendState {
    pub fn new() -> Self {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        let data_dir = PathBuf::from(appdata).join("Checkpoint");
        let _ = fs::create_dir_all(&data_dir);
        let _ = fs::create_dir_all(data_dir.join("artwork_cache"));

        // Generate cryptographically secure ephemeral 32-character hex token
        let token = generate_ephemeral_token();

        Self {
            status: BackendStatus::Initializing,
            port: None,
            base_url: "http://127.0.0.1:8765/api/v1".to_string(),
            token,
            error_message: None,
            child: None,
            job_guard: None,
            data_dir,
        }
    }
}

pub type SharedBackendState = Arc<Mutex<BackendState>>;

fn generate_ephemeral_token() -> String {
    use rand::RngExt;
    let mut bytes = [0u8; 16];
    rand::rng().fill(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Resolves path to the backend executable or fallback Python runner
pub fn locate_backend_binary() -> Result<(PathBuf, Vec<String>), String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join("checkpoint-backend-x86_64-pc-windows-msvc.exe"));
            candidates.push(exe_dir.join("checkpoint-backend.exe"));
            candidates.push(exe_dir.join("binaries").join("checkpoint-backend-x86_64-pc-windows-msvc.exe"));
            candidates.push(exe_dir.join("..").join("binaries").join("checkpoint-backend-x86_64-pc-windows-msvc.exe"));
            candidates.push(exe_dir.join("../..").join("binaries").join("checkpoint-backend-x86_64-pc-windows-msvc.exe"));
            candidates.push(exe_dir.join("../../..").join("backend/dist").join("checkpoint-backend-x86_64-pc-windows-msvc.exe"));
        }
    }

    // Relative candidates from dev working directory
    candidates.push(PathBuf::from("binaries/checkpoint-backend-x86_64-pc-windows-msvc.exe"));
    candidates.push(PathBuf::from("src-tauri/binaries/checkpoint-backend-x86_64-pc-windows-msvc.exe"));
    candidates.push(PathBuf::from("../src-tauri/binaries/checkpoint-backend-x86_64-pc-windows-msvc.exe"));
    candidates.push(PathBuf::from("backend/dist/checkpoint-backend-x86_64-pc-windows-msvc.exe"));
    candidates.push(PathBuf::from("../backend/dist/checkpoint-backend-x86_64-pc-windows-msvc.exe"));

    for candidate in candidates {
        if candidate.is_file() {
            if let Ok(canonical) = candidate.canonicalize() {
                return Ok((canonical, Vec::new()));
            }
            return Ok((candidate, Vec::new()));
        }
    }

    // Dev fallback: run backend/run_sidecar.py with Python
    let python_candidates = vec![
        PathBuf::from("backend/.venv/Scripts/python.exe"),
        PathBuf::from("../backend/.venv/Scripts/python.exe"),
    ];

    for py in python_candidates {
        if py.is_file() {
            let script = if Path::new("backend/run_sidecar.py").is_file() {
                PathBuf::from("backend/run_sidecar.py")
            } else {
                PathBuf::from("../backend/run_sidecar.py")
            };
            if script.is_file() {
                return Ok((py, vec![script.to_string_lossy().to_string()]));
            }
        }
    }

    Err("Could not locate packaged backend executable checkpoint-backend-x86_64-pc-windows-msvc.exe or dev Python runner".to_string())
}

/// Minimal FIPS 180-4 SHA-256 + RFC 2104 HMAC-SHA256 for readiness proof verification.
fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        for (slot, val) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *slot = slot.wrapping_add(val);
        }
    }
    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

pub fn hmac_sha256_hex(key: &[u8], message: &[u8]) -> String {
    let mut key_block = [0u8; 64];
    if key.len() > 64 {
        let hashed = sha256(key);
        key_block[..32].copy_from_slice(&hashed);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut i_pad = Vec::with_capacity(64 + message.len());
    let mut o_pad = Vec::with_capacity(64 + 32);
    for b in key_block {
        i_pad.push(b ^ 0x36);
        o_pad.push(b ^ 0x5c);
    }
    i_pad.extend_from_slice(message);
    let inner_hash = sha256(&i_pad);
    o_pad.extend_from_slice(&inner_hash);
    sha256(&o_pad).iter().map(|b| format!("{:02x}", b)).collect()
}

/// Validates an HTTP status/header/body response from GET /api/v1/system/status against our ephemeral HMAC proof.
pub fn verify_status_response(raw_response: &str, token: &str, nonce: &str) -> bool {
    let Some((header_block, body)) = raw_response.split_once("\r\n\r\n") else {
        return false;
    };
    let mut lines = header_block.lines();
    let Some(status_line) = lines.next() else {
        return false;
    };
    if !status_line.starts_with("HTTP/1.1 200") && !status_line.starts_with("HTTP/1.0 200") {
        return false;
    }

    let expected_proof = hmac_sha256_hex(token.as_bytes(), nonce.as_bytes());
    let mut proof_matched = false;
    for line in lines {
        if let Some((name, val)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("x-checkpoint-proof") {
                proof_matched = val.trim().eq_ignore_ascii_case(&expected_proof);
                break;
            }
        }
    }

    proof_matched && body.contains("\"status\"") && body.contains("\"healthy\"") && body.contains("\"database\"") && body.contains("\"connected\"")
}

/// Performs authenticated readiness handshake with HMAC nonce/proof verification.
pub fn check_health_socket(port: u16, token: &str) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let Ok(socket_addr) = addr.parse() else {
        return false;
    };

    let Ok(mut stream) = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1500)) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(2000)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(2000)));

    let nonce = generate_ephemeral_token();
    let request = format!(
        "GET /api/v1/system/status HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nX-Checkpoint-Token: {}\r\nX-Checkpoint-Nonce: {}\r\n\r\n",
        port, token, nonce
    );

    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut buf = Vec::with_capacity(2048);
    if stream.read_to_end(&mut buf).is_ok() {
        let response = String::from_utf8_lossy(&buf);
        verify_status_response(&response, token, &nonce)
    } else {
        false
    }
}

/// Sends graceful shutdown HTTP request to backend
pub fn send_shutdown_signal(port: u16, token: &str) {
    let addr = format!("127.0.0.1:{}", port);
    if let Ok(socket_addr) = addr.parse() {
        if let Ok(mut stream) = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1000)) {
            let _ = stream.set_write_timeout(Some(Duration::from_millis(1000)));
            let request = format!(
                "POST /api/v1/system/shutdown HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\nX-Checkpoint-Token: {}\r\n\r\n{{}}",
                port, token
            );
            let _ = stream.write_all(request.as_bytes());
        }
    }
}

pub struct ProcessManager;

impl ProcessManager {
    pub fn start_backend(state: SharedBackendState) -> Result<(), String> {
        let (binary_path, extra_args) = locate_backend_binary()?;
        println!("[CHECKPOINT Rust] Launching backend binary: {:?}", binary_path);

        let (token, data_dir) = {
            let lock = state.lock().map_err(|e| e.to_string())?;
            (lock.token.clone(), lock.data_dir.clone())
        };

        let mut cmd = Command::new(&binary_path);
        for arg in extra_args {
            cmd.arg(arg);
        }

        cmd.env("CHECKPOINT_AUTH_TOKEN", &token)
            .env("CHECKPOINT_DATA_DIR", &data_dir)
            .env("CHECKPOINT_CACHE_DIR", data_dir.join("artwork_cache"))
            .env("CHECKPOINT_PORT", "8765")
            .env("APP_ENV", "production")
            .env("CHECKPOINT_APP_ENV", "production")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            // CREATE_NO_WINDOW (0x08000000) prevents console popup
            cmd.creation_flags(0x08000000);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn backend process: {}", e))?;
        let job_guard = assign_child_to_kill_job(&child);
        let stdout = child.stdout.take().ok_or("Failed to capture child stdout")?;
        let stderr = child.stderr.take();

        let reader = BufReader::new(stdout);
        let (tx, rx) = std::sync::mpsc::channel::<Result<u16, String>>();

        // Continuously drain stdout so pipe never fills and blocks the child process
        thread::spawn(move || {
            let mut tx_opt = Some(tx);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    println!("[Backend Out] {}", line);
                    if line.contains("CHECKPOINT_READY=") {
                        if let Some(port_str) = line.split("CHECKPOINT_READY=").nth(1) {
                            if let Ok(p) = port_str.trim().parse::<u16>() {
                                if let Some(sender) = tx_opt.take() {
                                    let _ = sender.send(Ok(p));
                                }
                            }
                        }
                    }
                } else {
                    break;
                }
            }
        });

        // Continuously drain stderr so pipe never fills and blocks the child process
        if let Some(err_stream) = stderr {
            thread::spawn(move || {
                let err_reader = BufReader::new(err_stream);
                for line_res in err_reader.lines() {
                    if let Ok(line) = line_res {
                        eprintln!("[Backend Err] {}", line);
                    } else {
                        break;
                    }
                }
            });
        }

        // Await readiness handshake with a 35-second timeout (accommodates PyInstaller archive extraction on slower disks)
        let port = match rx.recv_timeout(Duration::from_secs(35)) {
            Ok(Ok(port)) => port,
            Ok(Err(e)) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Error parsing backend port: {}", e));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Timed out waiting for CHECKPOINT_READY signal from sidecar process".to_string());
            }
        };

        // Verify child liveness and authenticated HTTP readiness handshake
        let mut healthy = false;
        let start_time = Instant::now();
        while start_time.elapsed() < Duration::from_secs(5) {
            if let Ok(Some(exit_status)) = child.try_wait() {
                return Err(format!("Backend process exited prematurely ({}) before passing readiness handshake", exit_status));
            }
            if check_health_socket(port, &token) {
                healthy = true;
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }

        if !healthy {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("Backend at port {} did not pass authenticated health check", port));
        }

        println!("[CHECKPOINT Rust] Backend successfully verified and healthy on port {}", port);

        let mut lock = state.lock().map_err(|e| e.to_string())?;
        lock.port = Some(port);
        lock.base_url = format!("http://127.0.0.1:{}/api/v1", port);
        lock.status = BackendStatus::Ready;
        lock.child = Some(child);
        lock.job_guard = job_guard;

        Ok(())
    }

    pub fn stop_backend(state: SharedBackendState) {
        let (port, token, child_opt, job_opt) = {
            let mut lock = match state.lock() {
                Ok(l) => l,
                Err(_) => return,
            };
            (lock.port.take(), lock.token.clone(), lock.child.take(), lock.job_guard.take())
        };

        if let Some(port) = port {
            println!("[CHECKPOINT Rust] Sending shutdown signal to backend port {}...", port);
            send_shutdown_signal(port, &token);
        }

        if let Some(mut child) = child_opt {
            // Drop stdin to signal the backend stdin monitor thread
            drop(child.stdin.take());

            // Wait up to 3 seconds for graceful exit
            let start = Instant::now();
            let mut exited = false;
            while start.elapsed() < Duration::from_secs(3) {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        println!("[CHECKPOINT Rust] Backend exited gracefully with status: {:?}", status);
                        exited = true;
                        break;
                    }
                    Ok(None) => {
                        thread::sleep(Duration::from_millis(100));
                    }
                    Err(_) => break,
                }
            }

            if !exited {
                println!("[CHECKPOINT Rust] Backend did not exit within timeout. Force-killing...");
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        // Dropping the Job Object handle guarantees OS terminates any descendant processes
        drop(job_opt);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ephemeral_token_generation() {
        let t1 = generate_ephemeral_token();
        let t2 = generate_ephemeral_token();
        assert_eq!(t1.len(), 32);
        assert_eq!(t2.len(), 32);
        assert_ne!(t1, t2);
        assert!(t1.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_locate_packaged_sidecar_binary() {
        let (path, args) = locate_backend_binary().expect("Should locate packaged sidecar exe");
        assert!(path.exists());
        assert!(
            path.to_string_lossy()
                .contains("checkpoint-backend-x86_64-pc-windows-msvc.exe")
        );
        assert!(args.is_empty());
    }

    #[test]
    fn test_hmac_sha256_rfc4231_and_proof_verification() {
        // RFC 4231 Test Case 2: key = "Jefe", data = "what do ya want for nothing?"
        let mac = hmac_sha256_hex(b"Jefe", b"what do ya want for nothing?");
        assert_eq!(
            mac,
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );

        let token = "my_ephemeral_token";
        let nonce = "nonce_1234";
        let proof = hmac_sha256_hex(token.as_bytes(), nonce.as_bytes());
        let valid_resp = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Checkpoint-Proof: {}\r\n\r\n{{\"status\":\"healthy\",\"database\":\"connected\"}}",
            proof
        );
        assert!(verify_status_response(&valid_resp, token, nonce));

        // Unrelated HTTP 200 service without valid cryptographic proof MUST fail
        let spoofed_resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"healthy\",\"database\":\"connected\"}";
        assert!(!verify_status_response(spoofed_resp, token, nonce));

        // Unrelated server echoing wrong token proof MUST fail
        let wrong_proof_resp = "HTTP/1.1 200 OK\r\nX-Checkpoint-Proof: deadbeef\r\n\r\n{\"status\":\"healthy\",\"database\":\"connected\"}";
        assert!(!verify_status_response(wrong_proof_resp, token, nonce));
    }
}
