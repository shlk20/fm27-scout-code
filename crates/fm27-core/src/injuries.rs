//! The `injury_manager` section: current expected return dates and past injury rows.
//!
//! The section is a compact array-of-arrays store. We walk it whole; a count that does not fit
//! the remaining bytes rejects the section rather than guessing. The typed array holds one row
//! per injured person with an expected return date. The log array holds past injuries.

use std::collections::HashMap;

use chrono::{Datelike, NaiveDate};

use crate::clubs::ClubIndex;
use crate::layout::decode_date;
use crate::model::Injury;
use crate::player_scan::PlayerRecords;

const ARRAYS_OFFSET: usize = 12;
const ARRAY_STRIDES: [usize; 4] = [14, 14, 13, 15];
const TYPED_ARRAY: usize = 2;
const LOG_ARRAY: usize = 3;
const LIST_ENTRY_BYTES: [usize; 3] = [4, 4, 5];
const TAIL: [u8; 8] = [1, 0, 0, 0, 0, 0, 0xFF, 0xFF];

#[derive(Debug, Default)]
struct Walk {
    typed_rows: Vec<usize>,
    log_rows: Vec<usize>,
}

pub fn read_injuries(
    section: &[u8],
    players: &PlayerRecords,
    clubs: &ClubIndex,
    clock: Option<NaiveDate>,
) -> HashMap<usize, Vec<Injury>> {
    let Some(walk) = walk(section) else {
        return HashMap::new();
    };
    let mut result: HashMap<usize, Vec<Injury>> = HashMap::new();
    for offset in walk.log_rows {
        let Some(row) = section.get(offset..offset + 15) else {
            continue;
        };
        let Some(injury_date) = decode_date(row, 1) else {
            continue;
        };
        let selector = u32::from_le_bytes([row[5], row[6], row[7], row[8]]);
        let Some(position) = selector
            .checked_sub(1)
            .and_then(|pindex| players.by_pindex.get(&pindex).copied())
        else {
            continue;
        };
        let team_id = u32::from_le_bytes([row[9], row[10], row[11], row[12]]);
        let team_id = (team_id != 0 && team_id != u32::MAX).then_some(team_id);
        let club = team_id.and_then(|id| clubs.team_fields(id));
        result.entry(position).or_default().push(Injury {
            kind: "history".to_owned(),
            date: Some(injury_date.to_string()),
            expected_return: None,
            type_id: None,
            type_name: None,
            cause: Some(row[13]),
            severity: Some(row[14]),
            team_id,
            club_uid: club.map(|(uid, _, _)| uid),
            club_name: club.map(|(_, club, _)| club.name.clone()),
        });
    }
    for offset in walk.typed_rows {
        let Some(row) = section.get(offset..offset + 13) else {
            continue;
        };
        let Some(expected_return) = decode_date(row, 1) else {
            continue;
        };
        let selector = u32::from_le_bytes([row[5], row[6], row[7], row[8]]);
        let Some(position) = selector
            .checked_sub(1)
            .and_then(|pindex| players.by_pindex.get(&pindex).copied())
        else {
            continue;
        };
        let type_id = u16::from_le_bytes([row[9], row[10]]);
        let current = clock.is_none_or(|date| expected_return >= date);
        result.entry(position).or_default().push(Injury {
            kind: if current { "current" } else { "history" }.to_owned(),
            date: None,
            expected_return: Some(expected_return.to_string()),
            type_id: Some(type_id),
            type_name: None,
            cause: None,
            severity: None,
            team_id: None,
            club_uid: None,
            club_name: None,
        });
    }
    result
}

fn walk(section: &[u8]) -> Option<Walk> {
    let mut cursor = ARRAYS_OFFSET;
    let mut row_offsets = Vec::new();
    let mut row_counts = Vec::new();
    for stride in ARRAY_STRIDES {
        let count = read_u32(section, cursor)? as usize;
        cursor += 4;
        if count > section.len().saturating_sub(cursor) / stride {
            return None;
        }
        row_offsets.push(cursor);
        row_counts.push(count);
        cursor += count * stride;
    }
    for entry_bytes in LIST_ENTRY_BYTES {
        let count = read_u32(section, cursor)? as usize;
        cursor += 4;
        if count > section.len().saturating_sub(cursor) / entry_bytes {
            return None;
        }
        cursor += count * entry_bytes;
    }
    if section.get(cursor..cursor + TAIL.len())? != TAIL || cursor + TAIL.len() != section.len() {
        return None;
    }
    let typed_start = row_offsets[TYPED_ARRAY];
    let typed_rows = (0..row_counts[TYPED_ARRAY])
        .map(|index| typed_start + index * ARRAY_STRIDES[TYPED_ARRAY])
        .collect();
    let log_start = row_offsets[LOG_ARRAY];
    let log_rows = (0..row_counts[LOG_ARRAY])
        .map(|index| log_start + index * ARRAY_STRIDES[LOG_ARRAY])
        .collect();
    Some(Walk {
        typed_rows,
        log_rows,
    })
}

fn read_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    let slice = bytes.get(offset..offset + 4)?;
    Some(u32::from_le_bytes(slice.try_into().ok()?))
}

pub fn current_injury(injuries: &[Injury]) -> Option<&Injury> {
    injuries
        .iter()
        .find(|injury| injury.kind == "current" && injury.expected_return.is_some())
}

pub fn injury_until(injuries: &[Injury], clock: Option<NaiveDate>) -> Option<String> {
    let clock = clock?;
    injuries
        .iter()
        .filter_map(|injury| {
            let date = injury.expected_return.as_deref()?;
            let parsed = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
            (injury.kind == "current" && parsed >= clock).then_some((parsed, date.to_owned()))
        })
        .min_by_key(|(date, _)| *date)
        .map(|(_, text)| text)
}

pub fn recent_injury_date(injuries: &[Injury]) -> Option<String> {
    injuries
        .iter()
        .filter_map(|injury| injury.date.as_deref())
        .max()
        .map(str::to_owned)
}

pub fn days_until(date: &str, clock: Option<NaiveDate>) -> Option<i64> {
    let clock = clock?;
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    Some((date - clock).num_days())
}

pub fn year_of(date: &str) -> Option<i32> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .map(|date| date.year())
}
