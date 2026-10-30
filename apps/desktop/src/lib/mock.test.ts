import { describe, expect, it } from "vitest";
import { MOCK_SAVE_ID, mockQuery } from "./mock";

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
