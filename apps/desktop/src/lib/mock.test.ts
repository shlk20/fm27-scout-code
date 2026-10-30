import { describe, expect, it } from "vitest";
import {
  MOCK_PLAYERS,
  MOCK_SAVE_ID,
  mockAnalysisOverview,
  mockQuery,
  mockSquadAnalysis,
} from "./mock";

describe("mock player query", () => {
  it("searches name and club", () => {
    const page = mockQuery({
      save_id: MOCK_SAVE_ID,
      search: "Modrić",
      page_size: 10,
    });
    expect(page.total).toBeGreaterThan(0);
    expect(page.rows[0].name).toContain("Modrić");
  });

  it("filters positions and attributes", () => {
    const page = mockQuery({
      save_id: MOCK_SAVE_ID,
      positions: ["mc"],
      position_min: 18,
      attributes: [{ key: "passing", min: 15 }],
      page_size: 500,
    });
    expect(page.rows.length).toBeGreaterThan(0);
    for (const row of page.rows) {
      expect(row.positions.mc).toBeGreaterThanOrEqual(18);
      expect(row.attributes.passing).toBeGreaterThanOrEqual(15);
    }
  });

  it("sorts by CA descending and paginates", () => {
    const page = mockQuery({
      save_id: MOCK_SAVE_ID,
      sort_by: "ca",
      sort_dir: "desc",
      page: 0,
      page_size: 5,
    });
    expect(page.rows).toHaveLength(5);
    expect(page.rows[0].ca).toBeGreaterThanOrEqual(page.rows[4].ca);
  });
});

  it("aggregates analysis overview and squad depth", () => {
    const overview = mockAnalysisOverview();
    expect(overview.total_players).toBe(MOCK_PLAYERS.length);
    expect(overview.age_bands.length).toBe(6);
    expect(overview.top_clubs.length).toBeGreaterThan(0);

    const clubUid = MOCK_PLAYERS[0].club_uid;
    expect(clubUid).not.toBeNull();
    const squad = mockSquadAnalysis(clubUid!);
    expect(squad.player_count).toBeGreaterThan(0);
    expect(squad.players[0].club_uid).toBe(clubUid);
  });

  it("applies the PA-CA gap filter", () => {
    const page = mockQuery({
      save_id: MOCK_SAVE_ID,
      pa_ca_gap_min: 10,
      page_size: 500,
    });
    for (const row of page.rows) {
      expect(row.pa).not.toBeNull();
      expect((row.pa ?? 0) - row.ca).toBeGreaterThanOrEqual(10);
    }
  });
