//! Save metadata: game/build recognition and the in-game clock.

use chrono::NaiveDate;
use serde::Serialize;

use crate::container::SaveFile;
use crate::error::{Error, Result};
use crate::layout::{GAME, decode_date, read_u32};

#[derive(Debug, Clone, Serialize)]
pub struct SaveMetadata {
    pub game: String,
    pub build: String,
    pub db_version: String,
    pub game_date: Option<String>,
}

pub fn read_metadata(save: &SaveFile) -> Result<SaveMetadata> {
    let summary = save.read_section("save_game_summary")?;
    let build = find_version(&summary).ok_or_else(|| {
        Error::Unsupported("no game version found in save_game_summary".to_owned())
    })?;
    if !build.starts_with("27.") {
        return Err(Error::Unsupported(format!(
            "save was written by build {build}; this build reads FM27 only"
        )));
    }

    let game_info = save.read_section("game_info")?;
    let db_version = read_length_string(&game_info, 8, 64)
        .map(|(text, _)| text)
        .unwrap_or_else(|| "unknown".to_owned());
    let game_date = read_game_info_date(&game_info)
        .or_else(|| read_summary_clock(&summary, &build))
        .map(|date| date.to_string());

    Ok(SaveMetadata {
        game: GAME.to_owned(),
        build,
        db_version,
        game_date,
    })
}

fn read_summary_clock(summary: &[u8], build: &str) -> Option<NaiveDate> {
    let (_, mut offset) = read_length_string(summary, 8, 65_536)?;
    let (stored_version, next) = read_length_string(summary, offset, 32)?;
    offset = next;
    if stored_version != build {
        return None;
    }
    let division_count = read_u32(summary, offset)? as usize;
    if division_count > 4096 {
        return None;
    }
    offset += 4;
    for _ in 0..division_count {
        let (_, next) = read_length_string(summary, offset, 1024)?;
        offset = next;
    }
    let (_, next) = read_length_string(summary, offset + 8, 1024)?;
    offset = next;
    let (_, next) = read_length_string(summary, offset, 1024)?;
    offset = next;
    decode_date(summary, offset + 4)
}

fn read_game_info_date(game_info: &[u8]) -> Option<NaiveDate> {
    let (_, version_end) = read_length_string(game_info, 8, 64)?;
    let count_at = version_end + 165;
    let count = read_u32(game_info, count_at)? as usize;
    if count > 256 {
        return None;
    }
    let strings_start = count_at + 4;
    let mut cursor = strings_start;
    for _ in 0..count {
        let (_, next) = read_length_string(game_info, cursor, 4096)?;
        cursor = next;
    }
    let variable_bytes = cursor - strings_start;
    let date_at = version_end + variable_bytes + 174;
    decode_date(game_info, date_at)
}

fn find_version(summary: &[u8]) -> Option<String> {
    for offset in 0..summary.len().saturating_sub(4) {
        let Some(length) = read_u32(summary, offset) else {
            continue;
        };
        let length = length as usize;
        if !(5..=32).contains(&length) {
            continue;
        }
        let start = offset + 4;
        let Some(bytes) = summary.get(start..start + length) else {
            continue;
        };
        let Ok(text) = std::str::from_utf8(bytes) else {
            continue;
        };
        if is_version(text) {
            return Some(text.to_owned());
        }
    }
    None
}

fn is_version(text: &str) -> bool {
    let Some((version, build_number)) = text.split_once('+') else {
        return false;
    };
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3
        || !parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
    {
        return false;
    }
    !build_number.is_empty() && build_number.chars().all(|c| c.is_ascii_digit())
}

fn read_length_string(bytes: &[u8], offset: usize, max_len: usize) -> Option<(String, usize)> {
    let length = read_u32(bytes, offset)? as usize;
    if length > max_len {
        return None;
    }
    let start = offset + 4;
    let text = std::str::from_utf8(bytes.get(start..start + length)?).ok()?;
    Some((text.to_owned(), start + length))
}
