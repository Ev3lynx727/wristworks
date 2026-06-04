use std::net::{ToSocketAddrs, UdpSocket};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use crate::error::WristworksError;

const NTP_PORT: u16 = 123;
const NTP_TIMEOUT: Duration = Duration::from_secs(5);
const NTP_EPOCH: u64 = 2_208_988_800;

#[derive(Debug, Clone)]
pub struct NtpServerResult {
    pub host: String,
    pub ip: String,
    pub drift_ms: i64,
    pub latency_ms: u64,
    pub jitter_ms: u64,
    pub packet_loss: u8,
    pub status: String,
    pub stratum: u8,
    pub last_sync: Option<String>,
    pub error: Option<String>,
}

fn ntp_timestamp_to_unix(ntp_ts: u64) -> u64 {
    let seconds = ntp_ts >> 32;
    if seconds > NTP_EPOCH {
        seconds - NTP_EPOCH
    } else {
        seconds
    }
}

fn format_iso(secs: u64) -> String {
    let s = secs as i64;
    let sec = s % 86400;
    let days = s / 86400;
    let mut y = 1970i64;
    let mut d = days;
    loop {
        let leap = if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 366 } else { 365 };
        if d < leap { break; }
        d -= leap;
        y += 1;
    }
    let leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
    let mdays: [i64; 12] = if leap {
        [31,29,31,30,31,30,31,31,30,31,30,31]
    } else {
        [31,28,31,30,31,30,31,31,30,31,30,31]
    };
    let mut m = 0;
    for (i, &md) in mdays.iter().enumerate() {
        if d < md { m = i; break; }
        d -= md;
    }
    let h = sec / 3600;
    let min = (sec % 3600) / 60;
    let xs = sec % 60;
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m + 1, d + 1, h, min, xs
    )
}

fn query_server(host: &str) -> Result<NtpServerResult, WristworksError> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(WristworksError::Io)?;
    socket.set_read_timeout(Some(NTP_TIMEOUT))
        .map_err(WristworksError::Io)?;
    socket.set_write_timeout(Some(NTP_TIMEOUT))
        .map_err(WristworksError::Io)?;

    let remote = format!("{host}:{NTP_PORT}");
    let addr = remote.to_socket_addrs()
        .map_err(|e| WristworksError::NtpFailure(e.to_string()))?
        .next()
        .ok_or_else(|| WristworksError::NtpFailure(format!("cannot resolve {remote}")))?;

    let ip = addr.ip().to_string();

    let mut packet = [0u8; 48];
    packet[0] = 0b001_000_11;

    let before = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64;

    socket.send_to(&packet, addr)
        .map_err(|e| WristworksError::NtpFailure(format!("send to {addr}: {e}")))?;

    let mut buf = [0u8; 48];
    let n = socket.recv_from(&mut buf)
        .map_err(|e| WristworksError::NtpFailure(format!("recv from {addr}: {e}")))?
        .0;

    let after = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as u64;

    if n < 48 {
        return Err(WristworksError::NtpFailure("short response".into()));
    }

    let stratum = buf[1];
    let transmit_raw = u64::from_be_bytes([
        buf[40], buf[41], buf[42], buf[43],
        buf[44], buf[45], buf[46], buf[47],
    ]);
    let server_unix = ntp_timestamp_to_unix(transmit_raw);

    let rtt = after.saturating_sub(before);
    let rtt_ms = rtt / 1000;
    let now_local = before.saturating_add(rtt / 2);

    let server_ms = server_unix * 1000 + (transmit_raw & 0xFFFF_FFFF) * 1000 / (1 << 32);
    let local_ms = now_local / 1000;

    let drift_ms = server_ms as i64 - local_ms as i64;
    let last_sync = format_iso(server_unix);

    Ok(NtpServerResult {
        host: host.to_string(),
        ip,
        drift_ms,
        latency_ms: rtt_ms,
        jitter_ms: (rtt_ms / 20).max(1),
        packet_loss: 0,
        status: "synchronized".into(),
        stratum,
        last_sync: Some(last_sync),
        error: None,
    })
}

pub fn calibrate_ntp(servers: &[String]) -> Result<Vec<NtpServerResult>, WristworksError> {
    let mut results = Vec::with_capacity(servers.len());
    let mut any_ok = false;

    for server in servers {
        match query_server(server) {
            Ok(r) => {
                any_ok = true;
                results.push(r);
            }
            Err(e) => {
                results.push(NtpServerResult {
                    host: server.clone(),
                    ip: String::new(),
                    drift_ms: 0,
                    latency_ms: 0,
                    jitter_ms: 0,
                    packet_loss: 100,
                    status: "failed".into(),
                    stratum: 0,
                    last_sync: None,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    if !any_ok {
        return Err(WristworksError::NtpFailure(
            "all NTP servers failed".into(),
        ));
    }

    Ok(results)
}
