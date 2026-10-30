//! Real-save regression test.
//!
//! Fixtures are intentionally not committed. Set `FM27_TEST_SAVE` to a
//! 27.0.0+2486695 career save and run:
//!
//! ```text
//! FM27_TEST_SAVE="/path/to/save.fm" cargo test --release -- --ignored
//! ```

use fm27_core::parse_save;

#[test]
#[ignore = "requires a real FM27 save and FM27_TEST_SAVE"]
fn parses_the_reference_career() {
    let path = std::env::var("FM27_TEST_SAVE").expect("set FM27_TEST_SAVE");
    let parsed = parse_save(&path).expect("parse save");
    assert_eq!(parsed.players.len(), 46_273, "player count");
    assert_eq!(parsed.clubs.len(), 26_214, "club count");
    assert_eq!(parsed.report.contracts, 44_341, "contract count");
    assert_eq!(parsed.report.players_with_person, 46_272);
    assert_eq!(parsed.report.markerless_players, 485);

    let modric = parsed
        .players
        .iter()
        .find(|player| player.name.as_deref() == Some("Luka Modrić"))
        .expect("Luka Modrić");
    assert_eq!(modric.ca, 158);
    assert_eq!(modric.pa, Some(180));
    assert_eq!(modric.club_name.as_deref(), Some("Casciavit Milano"));
    assert_eq!(modric.attributes.get("passing"), Some(18));
    assert_eq!(modric.attributes.get("important_matches"), Some(18));
    assert_eq!(
        modric.personality.map(|value| value.professionalism),
        Some(20)
    );
    assert_eq!(
        modric.contract.as_ref().and_then(|value| value.wage),
        Some(106_965)
    );
    assert_eq!(
        modric
            .contract
            .as_ref()
            .and_then(|value| value.end.as_deref()),
        Some("2027-06-30")
    );
}

#[test]
#[ignore = "requires a real FM27 save and FM27_TEST_SAVE"]
fn caches_queries_and_exports_the_reference_career() {
    use fm27_core::export::write_export;
    use fm27_core::store::{PlayerQuery, Store};

    let path = std::env::var("FM27_TEST_SAVE").expect("set FM27_TEST_SAVE");
    let parsed = parse_save(&path).expect("parse save");
    let mut store = Store::open_in_memory().expect("open store");
    let save_id = store.insert_parsed(&parsed).expect("insert");

    let page = store
        .query_players(&PlayerQuery {
            save_id,
            search: Some("Modrić".to_owned()),
            page_size: Some(20),
            ..PlayerQuery::default()
        })
        .expect("query");
    assert!(page.total >= 1);
    assert!(
        page.rows
            .iter()
            .any(|row| row.name.as_deref() == Some("Luka Modrić"))
    );

    let attributes = store
        .query_players(&PlayerQuery {
            save_id,
            age_max: Some(23),
            ca_min: Some(140),
            attributes: vec![fm27_core::store::AttributeFilter {
                key: "passing".to_owned(),
                min: Some(16),
                max: None,
            }],
            page_size: Some(20),
            ..PlayerQuery::default()
        })
        .expect("attribute query");
    assert!(
        attributes
            .rows
            .iter()
            .all(|row| row.age.unwrap_or(99) <= 23)
    );

    let player = store
        .get_player(save_id, 652912, true)
        .expect("get player")
        .expect("Modrić");
    assert_eq!(player.name.as_deref(), Some("Luka Modrić"));

    let redacted = store
        .get_player(save_id, 652912, false)
        .expect("get redacted")
        .expect("Modrić");
    assert_eq!(redacted.attributes.get("consistency"), Some(0));
    assert!(redacted.personality.is_none());

    let rows = store
        .query_all(&PlayerQuery {
            save_id,
            ..PlayerQuery::default()
        })
        .expect("all rows");
    assert_eq!(rows.len(), 46_273);

    let dir = tempfile::tempdir().expect("temp dir");
    let csv = write_export(&dir.path().join("players.csv"), "csv", &rows).expect("csv");
    assert_eq!(csv.rows, 46_273);
    let json = write_export(&dir.path().join("players.json"), "json", &rows).expect("json");
    assert_eq!(json.rows, 46_273);
}
