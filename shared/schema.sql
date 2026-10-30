-- FM27 Scout local cache schema.
-- Only the Rust parser writes here. All parsing happens from a read-only save copy.

CREATE TABLE IF NOT EXISTS saves (
  id              INTEGER PRIMARY KEY,
  path            TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  mtime_ns        INTEGER NOT NULL,
  fingerprint     TEXT NOT NULL,
  game            TEXT NOT NULL,
  build           TEXT NOT NULL,
  game_date       TEXT,
  db_version      TEXT,
  parser_version  TEXT NOT NULL,
  parsed_at       TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS saves_fingerprint
  ON saves(fingerprint, parser_version);

CREATE TABLE IF NOT EXISTS players (
  save_id         INTEGER NOT NULL,
  uid             INTEGER NOT NULL,
  unique_id       INTEGER,
  name            TEXT,
  first_name      TEXT,
  last_name       TEXT,
  common_name     TEXT,
  birth_date      TEXT,
  age             INTEGER,
  nation_id       INTEGER,
  club_uid        INTEGER,
  club_name       TEXT,
  ca              INTEGER,
  pa              INTEGER,
  pa_range_code   INTEGER,
  height_cm       INTEGER,
  left_foot       INTEGER,
  right_foot      INTEGER,
  transfer_value  INTEGER,
  transfer_value_state TEXT,
  positions_json  TEXT NOT NULL,
  positions_text  TEXT,
  personality_json TEXT,
  traits_json     TEXT,
  attributes_json TEXT NOT NULL,
  raw_attributes_json TEXT NOT NULL,
  contract_end    TEXT,
  wage            INTEGER,
  on_loan         INTEGER,
  data_json       TEXT NOT NULL,
  PRIMARY KEY (save_id, uid),
  FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS players_name ON players(save_id, name);
CREATE INDEX IF NOT EXISTS players_club ON players(save_id, club_uid);
CREATE INDEX IF NOT EXISTS players_nation ON players(save_id, nation_id);
CREATE INDEX IF NOT EXISTS players_age ON players(save_id, age);
CREATE INDEX IF NOT EXISTS players_ca ON players(save_id, ca);
CREATE INDEX IF NOT EXISTS players_pa ON players(save_id, pa);
CREATE INDEX IF NOT EXISTS players_value ON players(save_id, transfer_value);
CREATE INDEX IF NOT EXISTS players_contract_end ON players(save_id, contract_end);

CREATE TABLE IF NOT EXISTS contracts (
  save_id         INTEGER NOT NULL,
  player_uid      INTEGER NOT NULL,
  club_uid        INTEGER,
  club_name       TEXT,
  team_id         INTEGER,
  wage            INTEGER,
  start_date      TEXT,
  end_date        TEXT,
  squad_status    INTEGER,
  contract_type   INTEGER,
  on_loan         INTEGER,
  loan_parent_club_uid INTEGER,
  loan_parent_club_name TEXT,
  loan_start      TEXT,
  loan_end        TEXT,
  clauses_json    TEXT,
  chain_json      TEXT,
  PRIMARY KEY (save_id, player_uid),
  FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS contracts_wage ON contracts(save_id, wage);
CREATE INDEX IF NOT EXISTS contracts_end ON contracts(save_id, end_date);

CREATE TABLE IF NOT EXISTS clubs (
  save_id         INTEGER NOT NULL,
  uid             INTEGER NOT NULL,
  name            TEXT,
  short_name      TEXT,
  nation_id       INTEGER,
  fa_nation_id    INTEGER,
  reputation      INTEGER,
  last_league_position INTEGER,
  parent_club_uid INTEGER,
  teams_json      TEXT,
  PRIMARY KEY (save_id, uid),
  FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS clubs_name ON clubs(save_id, name);
CREATE INDEX IF NOT EXISTS clubs_nation ON clubs(save_id, nation_id);

CREATE TABLE IF NOT EXISTS snapshots (
  save_id         INTEGER NOT NULL,
  game_date       TEXT NOT NULL,
  player_uid      INTEGER NOT NULL,
  ca              INTEGER,
  pa              INTEGER,
  transfer_value  INTEGER,
  club_uid        INTEGER,
  wage            INTEGER,
  contract_end    TEXT,
  PRIMARY KEY (save_id, game_date, player_uid)
);
