# Validation

## Reference save

- File: `BB KING - Casciavit.fm`
- Size: 49,042,131 bytes
- Build: `27.0.0+2486695`
- Game date: 2026-07-13
- `game_db`: about 137 MB decompressed
- All sections: about 192.5 MB decompressed

## Oracle

The oracle is the experimental FM27 branch of fmsave, installed into a local virtual
environment only for development:

```bash
.venv/bin/python scripts/oracle_export.py --output /tmp/oracle_players.json
```

The export contains 46,273 players with the fields compared by
`scripts/compare_outputs.py`.

## Rust output

```bash
cargo build --release -p fm27-cli
./target/release/fm27scout players "/path/to/save.fm" --limit 50000 \
  --format json --output /tmp/rust_players.json

.venv/bin/python scripts/compare_outputs.py /tmp/oracle_players.json /tmp/rust_players.json
```

## Final result

```text
oracle=46273 rust=46273 missing=0 extra=0
players with differences: 0
```

Compared fields include identity, names, legal/common names, birth date, age, nation,
second/home-grown relations, CA/PA, reputation, height, club/team/slot, join date,
52 attributes and raw values, feet, 15 position ratings, personality, trait bits,
transfer value/state, condition/sharpness, contract club/wage/dates/status/type,
clauses, loans, chain, and club set/names/nations/reputation/league position/teams.

Club comparison:

```text
clubs oracle=26214 rust=26214 missing=0 extra=0
club mismatches: 0
```

## Counts

| Metric | Value |
|---|---:|
| Players | 46,273 |
| Clubs | 26,214 |
| Contracts | 44,341 |
| Markerless player records | 485 |
| Players with a person block | 46,272 |
| Players with a resolved club | 39,333 |
| Parse time (release) | ~1.2 s |
| Parse + SQLite insert | ~4.4 s |
| Men / women / unknown gender | 27,544 / 11,789 / 6,940 |
| Unserved suspensions | 17 |
| Injury history rows | 783 |
| Countries resolved from the nation table | 251 save-local ids |

## Regression test

```bash
FM27_TEST_SAVE="/path/to/save.fm" \
  cargo test -p fm27-core --release -- --ignored
```

The ignored tests check the counts, Modrić's fields, nation names, gender split, role scores,
suspensions, injury history, SQLite query/filter behavior, facet counts, multi-column sorting,
growth snapshots, analysis overview, squad depth, wonderkid filtering, full 46,273-row export,
CSV and JSON export.
