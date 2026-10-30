# Parser notes

This document records the FM27 facts that the Rust parser relies on, and the places
where the implementation intentionally stops instead of guessing.

## Reference

- Save: `BB KING - Casciavit.fm`
- Build: `27.0.0+2486695`
- `game_db` schema: 4000
- Game date: 2026-07-13
- Containers: 26-byte header + zstd frames + trailer directory
- Decompressed `game_db`: about 137 MB

The Python reference implementation is the `experiment/fm27-bounded` branch of
[fmsave](https://github.com/rhiever/fmsave). It is used only for development-time
comparison and is not shipped.

## Container

```text
0..26          header, magic 02 01 "fmf."
+9             u64 trailer pointer; trailer offset = 9 + value
trailer        starts with magic, 9-byte header, one zstd frame
directory      save name, reserved u32, entries
entry          name u32-length + name, ext u32-length + ext,
               5 × u64: relative offset, compressed size, decompressed size,
               two trailing values
frame offset   26 + relative offset
```

The parser validates the declared sizes, caps decompression at 1 GiB per frame and
4 GiB total, and never assumes one frame contains the whole section.

## Snapshot policy

The desktop app copies the selected save to `~/Library/Application Support/com.fm27scout.app/snapshots/`
before parsing, compares the source size and mtime before/after the copy, and removes the
snapshot after parsing. This keeps a game that is still writing from being read half-way.
Stale snapshots are removed on the next launch.

## Metadata

- `save_game_summary` holds the length-prefixed version string. The structured clock is
  after the setup string, version string, counted division names, manager header,
  manager name, club name and club uid.
- `game_info` schema 47 has a changed filename/migration area. In this save its clock is
  unset, so the summary clock is authoritative (2026-07-13).
- `db_version` is read from `game_info` at offset 8.

## Name pools

The pools are preceded by the signature `55 b5 00 00 00 00 00 00 00 04 00 00 00 01 00 00 00 08 00 00 00 00 00 00`
(6 little-endian u32 words: 46421, 0, 1024, 256, 2048, 0). The parser accepts the
observed scaled form and validates every entry id and length. Entries are
`u32 id + u32 byte length + UTF-8 text`.

## Player records

Marker: `01 00 6c 07`, at `record_start + 102`.

```text
-19   pindex
-15   uid
-11   uid copy
-7    object kind (2 or 3)
-6    home reputation
-4    current reputation
-2    world reputation
+0    CA (u16)
+2    PA (i16; negative is a range code)
+8    reputation bucket
+16   team id
+24   15 position ratings
+39   54 attribute bytes (52 attributes + left/right foot at indices 24,25)
+93   transfer value
+98   club join date
+106  match sharpness
+110  condition
+121  height cm
+122  decode extent
```

Acceptance requires non-zero/doubled uid, valid CA/PA/bucket, the 15+54 shape, and
edited-value bounds. Allocated uid headers may differ from their copy only when the
object kind is 2 or 3. The completeness scan is an O(n) pass that finds 15 consecutive
bytes in `1..=20` and then validates 54 bytes in `1..=125`; it found 485 markerless
records in the reference save.

Attribute display values use `max(1, (raw + 2) / 5)`. Natural positions are ratings
≥18; accomplished are 15–17, both sorted by rating descending.

## Person block

The block is found by a zero byte followed by eight personality bytes in `1..=20`.
FM27 moved the block one byte later than FM26:

```text
search start        record + 100
personality offset  birth + 22   (FM26: 21)
zero region         birth + 15, 6 bytes (FM26: 14, 7)
nation id           birth + 14
relation present    birth + 38
relation count      birth + 39
relation entries    birth + 40, 16 bytes each
legal name          block_start + 19, preceded by u32 length at birth - 4
trait bits          block_start - 8 (u64)
name ids            block_start + 0/5/10, each followed by a zero byte
```

FM27 requires exactly one valid candidate in the window; ambiguous windows return no
person data. Relation keys are `(role << 8) | kind`; the observed pairs are
`(8,9)` second nation, `(8,70)` home-grown nation, `(1,72)` home-grown club.

## Clubs

The counted club table supplies exact record bounds and the initial club (uid 0).
The FM27 table differs from FM26 in two places:

- the full-finance leading step is 66 bytes instead of 70;
- `after_finance` steps 5, 6 and 7 use 2-byte counts instead of 1-byte counts.

Each row has a kind byte (0 ordinary, 12 extended), two length-prefixed names,
variable finance steps, team counts, affiliate team counts and a 12-byte footer.
A team controlled by another club is fielded by that parent for player joins, while
the registration club remains available in the contract chain.

The anchor scan remains as a fragment fallback. On full saves the counted table is
required; a framing failure is reported rather than guessed around.

## Contracts

The player's selector is `pindex + 1`, searched in a window starting at `record - 30`.
A chain record starts at the selector offset minus 5; its first four bytes are the tag
`01 00 6c 07` or a date-marked equivalent. Team id and wage are at +9/+17; the start
date is at -19.

The tail locator starts at `tag - 66`, checks two zero bytes, the sentinel `03 00 00 00 04`
at +3, and `event_count = 0` at +42. Event-counted tails step backwards by 29 bytes.
End date is at tail +28, squad status at +36. Clause tables are checked directly at
`tail - 8*n`; the fallback walk finds tables with bonus lists that end exactly at the
tail. Contract type is read from the head at clause base -35 (gate 5).

Loans use the tail-shaped block before a no-terms chain record: marker `FFFFFFFF` at
+24 and an end date at +28.

## Validation

The Rust output is normalized to the same JSON keys as the oracle and compared for all
46,273 players. The final run reported **0 differences** across:

- identity, names, birth date, age, nation, home-grown relations
- CA/PA, height, reputation, club/team/slot, join date
- all 52 attributes and raw values, feet, 15 position ratings
- personality, trait bits, transfer value/state, condition/sharpness
- contract club, wage, dates, status, type, clauses, loans and chain
- club set, names, nations, reputation, league position and team lists

See [validation.md](validation.md) for the commands and counts.
