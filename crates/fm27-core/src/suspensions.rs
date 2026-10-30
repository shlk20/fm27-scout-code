//! Unserved suspensions stored in `game_db`.
//!
//! FM keeps an unserved ban as an 18-byte core entry. The entry is found by its signature and
//! assigned to the player whose record window contains it. Scope code 1 names a competition;
//! codes 5, 6 and 10 name a nation. The save is not modified.

use std::collections::HashMap;

use chrono::Datelike;

use crate::layout::decode_date;
use crate::model::Suspension;
use crate::nations::NationIndex;
use crate::player_scan::PlayerRecords;

const SIGNATURE_OFFSETS: [(usize, u8); 5] =
    [(4, 0xFF), (5, 0xFF), (13, 0x05), (15, 0xFF), (18, 0xFF)];
const OWNER_BACK_OFFSET: usize = 30;
const SCOPE_ID_MIN: u16 = 1;
const SCOPE_ID_MAX: u16 = 60_000;

pub fn read_suspensions(
    game_db: &[u8],
    players: &PlayerRecords,
    nations: &NationIndex,
) -> HashMap<usize, Vec<Suspension>> {
    let mut result: HashMap<usize, Vec<Suspension>> = HashMap::new();
    if players.records.is_empty() {
        return result;
    }
    let offsets: Vec<usize> = players.records.iter().map(|record| record.offset).collect();
    let mut seen: std::collections::HashSet<(usize, u8, u16, u16, u16)> =
        std::collections::HashSet::new();
    for entry in 0..game_db.len() {
        let Some(end) = entry.checked_add(19) else {
            break;
        };
        if end > game_db.len() {
            break;
        }
        if SIGNATURE_OFFSETS
            .iter()
            .any(|(offset, value)| game_db[entry + offset] != *value)
        {
            continue;
        }
        let scope_code = game_db[entry + 14];
        let scope_id = u16::from_le_bytes([game_db[entry + 16], game_db[entry + 17]]);
        if !(SCOPE_ID_MIN..SCOPE_ID_MAX).contains(&scope_id) {
            continue;
        }
        let Some(issued) = decode_date(game_db, entry + 9) else {
            continue;
        };
        let window = entry.saturating_add(OWNER_BACK_OFFSET);
        let insert = offsets.partition_point(|offset| *offset <= window);
        if insert == 0 {
            continue;
        }
        let position = insert - 1;
        if !seen.insert((
            position,
            scope_code,
            scope_id,
            issued.year() as u16,
            issued.ordinal() as u16,
        )) {
            continue;
        }
        let (scope, competition_id, nation_id) = match scope_code {
            1 => ("competition", Some(scope_id), None),
            5 | 6 | 10 => ("nation", None, Some(scope_id)),
            _ => ("unknown", None, None),
        };
        result.entry(position).or_default().push(Suspension {
            scope: scope.to_owned(),
            scope_code,
            competition_id,
            competition_name: None,
            nation_id,
            nation_name: nation_id
                .and_then(|id| nations.name_for(id))
                .map(str::to_owned),
            issued_date: Some(issued.to_string()),
        });
    }
    result
}
