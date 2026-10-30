//! SQLite cache and query layer. The UI never sees the save bytes or the database path.

use std::path::Path;

use chrono::Utc;
use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::layout::{ATTRIBUTE_KEYS, POSITION_KEYS};
use crate::model::{
    Attributes, Club, Contract, ParseReport, Personality, Player, Positions, SaveSummary, Trait,
};
use crate::parse::ParsedSave;

const SCHEMA: &str = include_str!("../../../shared/schema.sql");

pub struct Store {
    conn: Connection,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AttributeFilter {
    pub key: String,
    pub min: Option<u8>,
    pub max: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PlayerQuery {
    pub save_id: i64,
    pub search: Option<String>,
    pub uids: Vec<u32>,
    pub club_uids: Vec<u32>,
    pub nation_ids: Vec<u16>,
    pub age_min: Option<i32>,
    pub age_max: Option<i32>,
    pub ca_min: Option<u16>,
    pub ca_max: Option<u16>,
    pub pa_min: Option<u16>,
    pub pa_max: Option<u16>,
    pub pa_unknown: Option<bool>,
    pub positions: Vec<String>,
    pub position_min: Option<u8>,
    pub attributes: Vec<AttributeFilter>,
    pub value_min: Option<u32>,
    pub value_max: Option<u32>,
    pub wage_min: Option<u32>,
    pub wage_max: Option<u32>,
    pub contract_end_before: Option<String>,
    pub contract_end_after: Option<String>,
    pub on_loan: Option<bool>,
    pub include_hidden: bool,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerRow {
    pub uid: u32,
    pub name: Option<String>,
    pub age: Option<i32>,
    pub club_uid: Option<u32>,
    pub club_name: Option<String>,
    pub nation_id: Option<u16>,
    pub ca: u16,
    pub pa: Option<i16>,
    pub pa_range_code: Option<i16>,
    pub positions_text: Option<String>,
    pub positions: Positions,
    pub attributes: Attributes,
    pub personality: Option<Personality>,
    pub transfer_value: Option<u32>,
    pub transfer_value_state: String,
    pub wage: Option<u32>,
    pub contract_end: Option<String>,
    pub height_cm: Option<u8>,
    pub left_foot: Option<u8>,
    pub right_foot: Option<u8>,
    pub on_loan: Option<bool>,
    pub traits: Vec<Trait>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerPage {
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
    pub rows: Vec<PlayerRow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SaveRecord {
    pub id: i64,
    pub path: String,
    pub file_name: String,
    pub game: String,
    pub build: String,
    pub game_date: Option<String>,
    pub parser_version: String,
    pub parsed_at: String,
    pub players: u64,
    pub clubs: u64,
    pub contracts: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FilterOption {
    pub id: u32,
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FilterOptions {
    pub clubs: Vec<FilterOption>,
    pub nations: Vec<FilterOption>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub min_ca: Option<u16>,
    pub max_ca: Option<u16>,
    pub min_pa: Option<u16>,
    pub max_pa: Option<u16>,
    pub min_value: Option<u32>,
    pub max_value: Option<u32>,
    pub min_wage: Option<u32>,
    pub max_wage: Option<u32>,
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; \
             PRAGMA foreign_keys=ON; PRAGMA wal_autocheckpoint=1000;",
        )?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn find_cached(&self, fingerprint: &str, parser_version: &str) -> Result<Option<i64>> {
        Ok(self
            .conn
            .query_row(
                "SELECT id FROM saves WHERE fingerprint = ?1 AND parser_version = ?2 LIMIT 1",
                params![fingerprint, parser_version],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn insert_parsed(&mut self, parsed: &ParsedSave) -> Result<i64> {
        let transaction = self.conn.transaction()?;
        transaction.execute(
            "INSERT INTO saves
             (path, file_name, file_size, mtime_ns, fingerprint, game, build, game_date,
              db_version, parser_version, parsed_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                parsed.summary.path,
                parsed.summary.file_name,
                parsed.summary.file_size as i64,
                parsed.summary.mtime_ns,
                parsed.summary.fingerprint,
                parsed.summary.game,
                parsed.summary.build,
                parsed.summary.game_date,
                parsed.summary.db_version,
                crate::layout::PARSER_VERSION,
                Utc::now().to_rfc3339(),
            ],
        )?;
        let save_id = transaction.last_insert_rowid();

        {
            let mut player_stmt = transaction.prepare(
                "INSERT INTO players
                 (save_id, uid, unique_id, name, first_name, last_name, common_name, birth_date,
                  age, nation_id, club_uid, club_name, ca, pa, pa_range_code, height_cm,
                  left_foot, right_foot, transfer_value, transfer_value_state, positions_json,
                  positions_text, personality_json, traits_json, attributes_json,
                  raw_attributes_json, contract_end, wage, on_loan, data_json)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,
                         ?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30)",
            )?;
            let mut contract_stmt = transaction.prepare(
                "INSERT INTO contracts
                 (save_id, player_uid, club_uid, club_name, team_id, wage, start_date, end_date,
                  squad_status, contract_type, on_loan, loan_parent_club_uid,
                  loan_parent_club_name, loan_start, loan_end, clauses_json, chain_json)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
            )?;
            for player in &parsed.players {
                let contract = player.contract.as_ref();
                let contract_end = contract.and_then(|value| value.end.clone());
                let wage = contract.and_then(|value| value.wage);
                let on_loan = contract.and_then(|value| value.on_loan);
                player_stmt.execute(params![
                    save_id,
                    player.uid,
                    player.unique_id,
                    player.name,
                    player.first_name,
                    player.last_name,
                    player.common_name,
                    player.birth_date,
                    player.age,
                    player.nation_id,
                    player.club_uid,
                    player.club_name,
                    player.ca,
                    player.pa,
                    player.pa_range_code,
                    player.height_cm,
                    player.left_foot,
                    player.right_foot,
                    player.transfer_value,
                    serde_json::to_string(&player.transfer_value_state)?,
                    serde_json::to_string(&player.positions)?,
                    player.natural_positions.join(" / "),
                    player
                        .personality
                        .as_ref()
                        .map(serde_json::to_string)
                        .transpose()?,
                    serde_json::to_string(&player.traits)?,
                    serde_json::to_string(&player.attributes)?,
                    serde_json::to_string(&player.raw_attributes)?,
                    contract_end,
                    wage,
                    on_loan,
                    serde_json::to_string(player)?,
                ])?;

                if let Some(contract) = contract {
                    contract_stmt.execute(params![
                        save_id,
                        player.uid,
                        contract.club_uid,
                        contract.club_name,
                        contract.team_id,
                        contract.wage,
                        contract.start,
                        contract.end,
                        contract.squad_status,
                        contract.contract_type,
                        contract.on_loan,
                        contract.loan_parent_club_uid,
                        contract.loan_parent_club_name,
                        contract.loan_start,
                        contract.loan_end,
                        serde_json::to_string(&contract.clauses)?,
                        serde_json::to_string(&contract.chain)?,
                    ])?;
                }
            }
        }

        {
            let mut club_stmt = transaction.prepare(
                "INSERT INTO clubs
                 (save_id, uid, name, short_name, nation_id, fa_nation_id, reputation,
                  last_league_position, parent_club_uid, teams_json)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            )?;
            for club in &parsed.clubs {
                club_stmt.execute(params![
                    save_id,
                    club.uid,
                    club.name,
                    club.short_name,
                    club.nation_id,
                    club.fa_nation_id,
                    club.reputation,
                    club.last_league_position,
                    club.parent_club_uid,
                    serde_json::to_string(&club.teams)?,
                ])?;
            }
        }

        transaction.commit()?;
        // A full-career insert creates a large WAL. Fold it back into the database now
        // so the cache does not keep two copies of the same rows on disk.
        self.conn
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        Ok(save_id)
    }

    pub fn list_saves(&self) -> Result<Vec<SaveRecord>> {
        let mut statement = self.conn.prepare(
            "SELECT s.id, s.path, s.file_name, s.game, s.build, s.game_date, s.parser_version,
                    s.parsed_at,
                    (SELECT COUNT(*) FROM players p WHERE p.save_id = s.id),
                    (SELECT COUNT(*) FROM clubs c WHERE c.save_id = s.id),
                    (SELECT COUNT(*) FROM contracts c WHERE c.save_id = s.id)
             FROM saves s ORDER BY s.parsed_at DESC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(SaveRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                file_name: row.get(2)?,
                game: row.get(3)?,
                build: row.get(4)?,
                game_date: row.get(5)?,
                parser_version: row.get(6)?,
                parsed_at: row.get(7)?,
                players: row.get(8)?,
                clubs: row.get(9)?,
                contracts: row.get(10)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Error::from)
    }

    pub fn delete_save(&mut self, save_id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM saves WHERE id = ?1", params![save_id])?;
        Ok(())
    }

    pub fn query_players(&self, query: &PlayerQuery) -> Result<PlayerPage> {
        let mut params: Vec<Value> = Vec::new();
        let where_sql = build_where(query, &mut params)?;
        let count_sql = format!(
            "SELECT COUNT(*) FROM players p
             LEFT JOIN contracts c ON c.save_id = p.save_id AND c.player_uid = p.uid
             WHERE {where_sql}"
        );
        let total: u64 =
            self.conn
                .query_row(&count_sql, params_from_iter(params.iter()), |row| {
                    row.get(0)
                })?;

        let page = query.page.unwrap_or(0);
        let page_size = query.page_size.unwrap_or(150).clamp(1, 500);
        let order = order_by(query);
        let sql = format!(
            "SELECT p.uid, p.name, p.age, p.club_uid, p.club_name, p.nation_id, p.ca, p.pa,
                    p.pa_range_code, p.positions_text, p.positions_json, p.attributes_json,
                    p.personality_json, p.transfer_value, p.transfer_value_state, c.wage,
                    c.end_date, p.height_cm, p.left_foot, p.right_foot, c.on_loan, p.traits_json
             FROM players p
             LEFT JOIN contracts c ON c.save_id = p.save_id AND c.player_uid = p.uid
             WHERE {where_sql}
             {order}
             LIMIT ? OFFSET ?"
        );
        let mut page_params = params;
        page_params.push(Value::Integer(page_size as i64));
        page_params.push(Value::Integer((page as i64) * page_size as i64));
        let mut statement = self.conn.prepare(&sql)?;
        let rows = statement.query_map(params_from_iter(page_params.iter()), |row| {
            Ok(PlayerRow {
                uid: row.get(0)?,
                name: row.get(1)?,
                age: row.get(2)?,
                club_uid: row.get(3)?,
                club_name: row.get(4)?,
                nation_id: row.get(5)?,
                ca: row.get(6)?,
                pa: row.get(7)?,
                pa_range_code: row.get(8)?,
                positions_text: row.get(9)?,
                positions: parse_json_column(row.get::<_, String>(10)?, "positions"),
                attributes: parse_json_column(row.get::<_, String>(11)?, "attributes"),
                personality: row
                    .get::<_, Option<String>>(12)?
                    .and_then(|text| serde_json::from_str::<Personality>(&text).ok()),
                transfer_value: row.get(13)?,
                transfer_value_state: row
                    .get::<_, Option<String>>(14)?
                    .and_then(|text| serde_json::from_str::<String>(&text).ok())
                    .unwrap_or_else(|| "ok".to_owned()),
                wage: row.get(15)?,
                contract_end: row.get(16)?,
                height_cm: row.get(17)?,
                left_foot: row.get(18)?,
                right_foot: row.get(19)?,
                on_loan: row.get(20)?,
                traits: row
                    .get::<_, Option<String>>(21)?
                    .and_then(|text| serde_json::from_str::<Vec<Trait>>(&text).ok())
                    .unwrap_or_default(),
            })
        })?;
        let mut rows = rows.collect::<std::result::Result<Vec<_>, _>>()?;
        if !query.include_hidden {
            for row in &mut rows {
                redact_attributes(&mut row.attributes);
                row.personality = None;
            }
        }
        Ok(PlayerPage {
            total,
            page,
            page_size,
            rows,
        })
    }

    pub fn query_all(&self, query: &PlayerQuery) -> Result<Vec<PlayerRow>> {
        let mut query = query.clone();
        query.page = Some(0);
        query.page_size = Some(500);
        let mut rows = Vec::new();
        loop {
            let page = self.query_players(&query)?;
            let done = page.rows.is_empty() || rows.len() >= page.total as usize;
            rows.extend(page.rows);
            if done {
                break;
            }
            query.page = Some(query.page.unwrap_or(0) + 1);
            if rows.len() > 500_000 {
                break;
            }
        }
        Ok(rows)
    }

    pub fn get_player(
        &self,
        save_id: i64,
        uid: u32,
        include_hidden: bool,
    ) -> Result<Option<Player>> {
        let data: Option<String> = self
            .conn
            .query_row(
                "SELECT data_json FROM players WHERE save_id = ?1 AND uid = ?2",
                params![save_id, uid],
                |row| row.get(0),
            )
            .optional()?;
        let mut player = data
            .map(|text| serde_json::from_str::<Player>(&text).map_err(Error::from))
            .transpose()?;
        if let Some(player) = &mut player {
            if !include_hidden {
                redact_player(player);
            }
        }
        Ok(player)
    }

    pub fn get_contract(&self, save_id: i64, player_uid: u32) -> Result<Option<Contract>> {
        Ok(self
            .get_player(save_id, player_uid, true)?
            .and_then(|player| player.contract))
    }

    pub fn filter_options(&self, save_id: i64) -> Result<FilterOptions> {
        let mut club_stmt = self.conn.prepare(
            "SELECT club_uid, club_name, COUNT(*) FROM players
             WHERE save_id = ?1 AND club_uid IS NOT NULL
             GROUP BY club_uid ORDER BY club_name COLLATE NOCASE",
        )?;
        let clubs = club_stmt
            .query_map(params![save_id], |row| {
                Ok(FilterOption {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    count: row.get(2)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let mut nation_stmt = self.conn.prepare(
            "SELECT nation_id, COUNT(*) FROM players
             WHERE save_id = ?1 AND nation_id IS NOT NULL
             GROUP BY nation_id ORDER BY COUNT(*) DESC, nation_id",
        )?;
        let nations = nation_stmt
            .query_map(params![save_id], |row| {
                let id: u32 = row.get(0)?;
                Ok(FilterOption {
                    id,
                    name: format!("Nation {id}"),
                    count: row.get(1)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        let ranges = self.conn.query_row(
            "SELECT MIN(age), MAX(age), MIN(ca), MAX(ca), MIN(pa), MAX(pa),
                    MIN(transfer_value), MAX(transfer_value)
             FROM players WHERE save_id = ?1",
            params![save_id],
            |row| {
                Ok((
                    row.get::<_, Option<i32>>(0)?,
                    row.get::<_, Option<i32>>(1)?,
                    row.get::<_, Option<u16>>(2)?,
                    row.get::<_, Option<u16>>(3)?,
                    row.get::<_, Option<u16>>(4)?,
                    row.get::<_, Option<u16>>(5)?,
                    row.get::<_, Option<u32>>(6)?,
                    row.get::<_, Option<u32>>(7)?,
                ))
            },
        )?;
        let (min_wage, max_wage) = self.conn.query_row(
            "SELECT MIN(wage), MAX(wage) FROM contracts WHERE save_id = ?1",
            params![save_id],
            |row| Ok((row.get::<_, Option<u32>>(0)?, row.get::<_, Option<u32>>(1)?)),
        )?;

        Ok(FilterOptions {
            clubs,
            nations,
            min_age: ranges.0,
            max_age: ranges.1,
            min_ca: ranges.2,
            max_ca: ranges.3,
            min_pa: ranges.4,
            max_pa: ranges.5,
            min_value: ranges.6,
            max_value: ranges.7,
            min_wage,
            max_wage,
        })
    }
}

fn parse_json_column<T: serde::de::DeserializeOwned + Default>(text: String, _label: &str) -> T {
    serde_json::from_str(&text).unwrap_or_default()
}

fn build_where(query: &PlayerQuery, params: &mut Vec<Value>) -> Result<String> {
    let mut clauses = vec!["p.save_id = ?".to_owned()];
    params.push(Value::Integer(query.save_id));

    if let Some(search) = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        clauses.push(
            "(p.name LIKE ? COLLATE NOCASE OR p.club_name LIKE ? COLLATE NOCASE OR p.common_name LIKE ? COLLATE NOCASE)"
                .to_owned(),
        );
        let pattern = format!("%{search}%");
        params.push(Value::Text(pattern.clone()));
        params.push(Value::Text(pattern.clone()));
        params.push(Value::Text(pattern));
    }
    if !query.uids.is_empty() {
        let placeholders = vec!["?"; query.uids.len()].join(",");
        clauses.push(format!("p.uid IN ({placeholders})"));
        for id in &query.uids {
            params.push(Value::Integer(*id as i64));
        }
    }
    if !query.club_uids.is_empty() {
        let placeholders = vec!["?"; query.club_uids.len()].join(",");
        clauses.push(format!("p.club_uid IN ({placeholders})"));
        for id in &query.club_uids {
            params.push(Value::Integer(*id as i64));
        }
    }
    if !query.nation_ids.is_empty() {
        let placeholders = vec!["?"; query.nation_ids.len()].join(",");
        clauses.push(format!("p.nation_id IN ({placeholders})"));
        for id in &query.nation_ids {
            params.push(Value::Integer(*id as i64));
        }
    }
    add_range(query.age_min, query.age_max, "p.age", params, &mut clauses);
    add_range(query.ca_min, query.ca_max, "p.ca", params, &mut clauses);
    add_range(query.pa_min, query.pa_max, "p.pa", params, &mut clauses);
    if let Some(unknown) = query.pa_unknown {
        clauses.push(if unknown {
            "p.pa_range_code IS NOT NULL".to_owned()
        } else {
            "p.pa IS NOT NULL".to_owned()
        });
    }
    let threshold = query.position_min.unwrap_or(15);
    for position in &query.positions {
        if !POSITION_KEYS.contains(&position.as_str()) {
            return Err(Error::parse(format!(
                "unknown position filter {position:?}"
            )));
        }
        clauses.push(format!(
            "json_extract(p.positions_json, '$.{position}') >= ?"
        ));
        params.push(Value::Integer(threshold as i64));
    }
    for filter in &query.attributes {
        if !ATTRIBUTE_KEYS.contains(&filter.key.as_str()) {
            return Err(Error::parse(format!(
                "unknown attribute filter {:?}",
                filter.key
            )));
        }
        if !query.include_hidden && is_hidden_attribute(&filter.key) {
            return Err(Error::parse(
                "hidden attribute filters require hidden attributes to be enabled",
            ));
        }
        let expression = format!("json_extract(p.attributes_json, '$.{}')", filter.key);
        add_range(filter.min, filter.max, &expression, params, &mut clauses);
    }
    add_range(
        query.value_min,
        query.value_max,
        "p.transfer_value",
        params,
        &mut clauses,
    );
    add_range(
        query.wage_min,
        query.wage_max,
        "c.wage",
        params,
        &mut clauses,
    );
    if let Some(before) = &query.contract_end_before {
        clauses.push("c.end_date <= ?".to_owned());
        params.push(Value::Text(before.clone()));
    }
    if let Some(after) = &query.contract_end_after {
        clauses.push("c.end_date >= ?".to_owned());
        params.push(Value::Text(after.clone()));
    }
    if let Some(on_loan) = query.on_loan {
        clauses.push("c.on_loan = ?".to_owned());
        params.push(Value::Integer(if on_loan { 1 } else { 0 }));
    }
    Ok(clauses.join(" AND "))
}

fn add_range<T: Into<i64>>(
    min: Option<T>,
    max: Option<T>,
    expression: &str,
    params: &mut Vec<Value>,
    clauses: &mut Vec<String>,
) {
    if let Some(min) = min {
        clauses.push(format!("{expression} >= ?"));
        params.push(Value::Integer(min.into()));
    }
    if let Some(max) = max {
        clauses.push(format!("{expression} <= ?"));
        params.push(Value::Integer(max.into()));
    }
}

const HIDDEN_ATTRIBUTES: [&str; 5] = [
    "dirtiness",
    "consistency",
    "important_matches",
    "injury_proneness",
    "versatility",
];

fn is_hidden_attribute(key: &str) -> bool {
    HIDDEN_ATTRIBUTES.contains(&key)
}

fn redact_attributes(attributes: &mut Attributes) {
    for key in HIDDEN_ATTRIBUTES {
        if let Some(index) = ATTRIBUTE_KEYS.iter().position(|name| *name == key) {
            attributes.values[index] = 0;
        }
    }
}

fn redact_player(player: &mut Player) {
    redact_attributes(&mut player.attributes);
    redact_attributes(&mut player.raw_attributes);
    player.personality = None;
}

fn order_by(query: &PlayerQuery) -> String {
    let direction = if query
        .sort_dir
        .as_deref()
        .is_some_and(|value| value.eq_ignore_ascii_case("asc"))
    {
        "ASC"
    } else {
        "DESC"
    };
    let expression = match query.sort_by.as_deref().unwrap_or("ca") {
        "name" => "p.name",
        "age" => "p.age",
        "club" | "club_name" => "p.club_name",
        "nation" | "nation_id" => "p.nation_id",
        "ca" => "p.ca",
        "pa" => "p.pa",
        "value" | "transfer_value" => "p.transfer_value",
        "wage" => "c.wage",
        "contract_end" => "c.end_date",
        "height" | "height_cm" => "p.height_cm",
        "left_foot" => "p.left_foot",
        "positions" => "p.positions_text",
        "uid" => "p.uid",
        _ => "p.ca",
    };
    format!(
        "ORDER BY CASE WHEN {expression} IS NULL THEN 1 ELSE 0 END, {expression} {direction}, p.uid"
    )
}

pub fn summary_from_parse(parsed: &ParsedSave) -> SaveSummary {
    parsed.summary.clone()
}

pub fn report_from_parse(parsed: &ParsedSave) -> ParseReport {
    parsed.report.clone()
}

pub fn club_count(clubs: &[Club]) -> usize {
    clubs.len()
}
