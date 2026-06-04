use chrono::{DateTime, TimeZone, Utc, NaiveDate, Datelike, Offset};
use chrono_tz::Tz;
use crate::error::WristworksError;

#[derive(Debug)]
pub struct TargetInput {
    pub name: String,
    pub timezone: String,
    pub label: String,
}

#[derive(Debug)]
pub struct TimeResult {
    pub name: String,
    pub timezone: String,
    pub label: String,
    pub datetime: String,
    pub offset: String,
    pub dst_active: bool,
}

fn parse_tz(s: &str) -> Result<Tz, WristworksError> {
    s.parse::<Tz>()
        .map_err(|_| WristworksError::InvalidTimezone(s.to_string()))
}

fn offset_at_date(tz: &Tz, year: i32, month: u32, day: u32) -> Option<i32> {
    NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .and_then(|d| tz.from_local_datetime(&d).single())
        .map(|dt| dt.offset().fix().local_minus_utc())
}

fn offset_to_gmt(offset_secs: i32) -> String {
    let total_min = offset_secs / 60;
    let sign = if total_min < 0 { '-' } else { '+' };
    let abs = total_min.unsigned_abs();
    let h = abs / 60;
    let m = abs % 60;
    if m == 0 {
        format!("GMT{}{}", sign, h)
    } else {
        format!("GMT{}{:02}:{:02}", sign, h, m)
    }
}

pub fn format_times(
    corrected_utc_ms: i64,
    targets: &[TargetInput],
) -> Result<Vec<TimeResult>, WristworksError> {
    let secs = corrected_utc_ms / 1000;
    let nsecs = ((corrected_utc_ms % 1000) * 1_000_000) as u32;
    let utc = Utc
        .timestamp_opt(secs, nsecs)
        .single()
        .ok_or_else(|| WristworksError::NtpFailure("invalid timestamp".into()))?;

    let mut results = Vec::with_capacity(targets.len());

    for target in targets {
        let tz: Tz = parse_tz(&target.timezone)?;
        let local: DateTime<Tz> = utc.with_timezone(&tz);

        let jan_offset = offset_at_date(&tz, local.year(), 1, 1).unwrap_or(0);
        let jul_offset = offset_at_date(&tz, local.year(), 7, 1).unwrap_or(0);
        let current_offset = local.offset().fix().local_minus_utc();

        let dst_active = if jan_offset == jul_offset {
            false
        } else {
            let summer = jan_offset.max(jul_offset);
            current_offset == summer
        };

        let datetime = local.format("%Y-%m-%d %H:%M:%S").to_string();
        let offset = offset_to_gmt(current_offset);

        results.push(TimeResult {
            name: target.name.clone(),
            timezone: target.timezone.clone(),
            label: target.label.clone(),
            datetime,
            offset,
            dst_active,
        });
    }

    Ok(results)
}
