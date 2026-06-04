#[macro_use]
extern crate napi_derive;

mod error;
mod fetcher;
mod ntp;

use napi::bindgen_prelude::*;

#[napi(object)]
pub struct NtpServerResult {
    pub host: String,
    pub ip: String,
    pub drift_ms: i64,
    pub latency_ms: i64,
    pub jitter_ms: i64,
    pub packet_loss: i32,
    pub status: String,
    pub stratum: i32,
    pub last_sync: Option<String>,
    pub error: Option<String>,
}

#[napi(object)]
pub struct FormattedTimeResult {
    pub name: String,
    pub timezone: String,
    pub label: String,
    pub datetime: String,
    pub offset: String,
    pub dst_active: bool,
}

#[napi(object)]
pub struct TargetInput {
    pub name: String,
    pub timezone: String,
    pub label: String,
}

fn map_err(e: error::WristworksError) -> napi::Error {
    napi::Error::from_reason(e.to_string())
}

#[napi]
pub fn calibrate_ntp(servers: Vec<String>) -> Result<Vec<NtpServerResult>> {
    let results = ntp::calibrate_ntp(&servers).map_err(map_err)?;
    Ok(results
        .into_iter()
        .map(|r| NtpServerResult {
            host: r.host,
            ip: r.ip,
            drift_ms: r.drift_ms,
            latency_ms: r.latency_ms as i64,
            jitter_ms: r.jitter_ms as i64,
            packet_loss: r.packet_loss as i32,
            status: r.status,
            stratum: r.stratum as i32,
            last_sync: r.last_sync,
            error: r.error,
        })
        .collect())
}

#[napi]
pub fn format_times(
    corrected_utc_ms: i64,
    targets: Vec<TargetInput>,
) -> Result<Vec<FormattedTimeResult>> {
    let inputs: Vec<fetcher::TargetInput> = targets
        .into_iter()
        .map(|t| fetcher::TargetInput {
            name: t.name,
            timezone: t.timezone,
            label: t.label,
        })
        .collect();

    let results = fetcher::format_times(corrected_utc_ms, &inputs).map_err(map_err)?;

    Ok(results
        .into_iter()
        .map(|r| FormattedTimeResult {
            name: r.name,
            timezone: r.timezone,
            label: r.label,
            datetime: r.datetime,
            offset: r.offset,
            dst_active: r.dst_active,
        })
        .collect())
}
