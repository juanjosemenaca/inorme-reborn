import { describe, expect, it } from "vitest";
import { formatDateEs, formatEuro, formatPercent, reportToMarkdown, variationTrend } from "@/lib/ai/format";
import type { AiReport } from "@/types/ai";

describe("ai/format", () => {
  it("formatea euros en formato español", () => {
    expect(formatEuro(12345.6).replace(/\u00a0/g, " ")).toBe("12.345,60 €");
    expect(formatEuro(Number.NaN)).toBe("—");
  });

  it("formatea porcentajes con signo", () => {
    expect(formatPercent(12.34).replace(/\u00a0/g, " ")).toBe("+12,3 %");
    expect(formatPercent(-5).replace(/\u00a0/g, " ")).toBe("−5,0 %");
    expect(formatPercent(null)).toBe("—");
  });

  it("formatea fechas ISO a dd/mm/yyyy", () => {
    expect(formatDateEs("2026-09-30")).toBe("30/09/2026");
    expect(formatDateEs("2026-09-30T10:00:00Z")).toBe("30/09/2026");
    expect(formatDateEs(null)).toBe("—");
  });

  it("detecta la tendencia de una variación", () => {
    expect(variationTrend("+12,4 %")).toBe("up");
    expect(variationTrend("−3 %")).toBe("down");
    expect(variationTrend("-3 %")).toBe("down");
    expect(variationTrend(undefined)).toBe("flat");
  });

  it("convierte un informe a Markdown con KPIs y tablas", () => {
    const report: AiReport = {
      title: "Informe",
      period: "Septiembre 2026",
      summary: "Resumen.",
      kpis: [{ label: "Facturado", value: "1.000,00 €", variation: "+10 %" }],
      sections: [{ title: "Detalle", content: "Texto." }],
      tables: [{ title: "Top", columns: ["Cliente", "Total"], rows: [["ACME", "1.000,00 €"]] }],
    };
    const md = reportToMarkdown(report);
    expect(md).toContain("## Informe");
    expect(md).toContain("*Período: Septiembre 2026*");
    expect(md).toContain("- **Facturado:** 1.000,00 € (+10 %)");
    expect(md).toContain("| Cliente | Total |");
    expect(md).toContain("| ACME | 1.000,00 € |");
  });
});
