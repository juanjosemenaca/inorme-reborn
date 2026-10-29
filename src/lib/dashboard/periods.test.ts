import { describe, expect, it } from "vitest";
import { resolvePeriod, previousEqualPeriod } from "@/lib/dashboard/periods";

describe("dashboard periods", () => {
  it("resuelve last_30_days y current_month", () => {
    expect(resolvePeriod("last_30_days", "2026-10-08")).toEqual({ start: "2026-09-09", end: "2026-10-08" });
    expect(resolvePeriod("current_month", "2026-10-08")).toEqual({ start: "2026-10-01", end: "2026-10-08" });
  });

  it("periodo equivalente anterior para KPI_VARIATION", () => {
    expect(previousEqualPeriod("2026-10-01", "2026-10-08")).toEqual({ start: "2026-09-23", end: "2026-09-30" });
  });
});
