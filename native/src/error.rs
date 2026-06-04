use std::fmt;

#[derive(Debug)]
pub enum WristworksError {
    NtpFailure(String),
    InvalidTimezone(String),
    Io(std::io::Error),
}

impl fmt::Display for WristworksError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WristworksError::NtpFailure(msg) => write!(f, "NTP: {msg}"),
            WristworksError::InvalidTimezone(tz) => write!(f, "Invalid timezone: {tz}"),
            WristworksError::Io(e) => write!(f, "IO: {e}"),
        }
    }
}

impl std::error::Error for WristworksError {}

impl From<std::io::Error> for WristworksError {
    fn from(e: std::io::Error) -> Self {
        WristworksError::Io(e)
    }
}
