import { describe, expect, it } from "vitest";
import { chartCompanionText, parseAiCharts, preparePieSlices } from "./charts";
import type { AiChart } from "@/types/ai";

const samplePie = (categories: string[], values: number[]): AiChart => ({
  type: "pie",
  title: "Facturación 2026 por cliente",
  unit: "eur",
  categories,
  series: [{ name: "Facturación", values }],
});

describe("parseAiCharts", () => {
  it("acepta un quesito con una serie", () => {
    const charts = parseAiCharts([
      {
        type: "pie",
        title: "Por cliente",
        unit: "eur",
        categories: ["A", "B"],
        series: [{ name: "Facturación", values: [70, 30] }],
      },
    ]);
    expect(charts).toHaveLength(1);
    expect(charts[0].type).toBe("pie");
    expect(charts[0].series[0].values).toEqual([70, 30]);
  });

  it("descarta series desalineadas y entradas inválidas", () => {
    expect(
      parseAiCharts([
        { type: "column", title: "X", categories: ["A"], series: [{ name: "S", values: [1, 2] }] },
        { type: "sql", title: "no" },
      ])
    ).toEqual([]);
  });

  it("ordena el quesito y agrupa el resto en Otros", () => {
    const { slices, total } = preparePieSlices(
      samplePie(
        ["A", "B", "C", "D", "E", "F", "G", "H"],
        [10, 80, 5, 4, 3, 2, 1, 1]
      ),
      5
    );
    expect(total).toBe(106);
    expect(slices[0].label).toBe("B");
    expect(slices[0].value).toBe(80);
    expect(slices.at(-1)?.label).toBe("Otros");
    expect(slices).toHaveLength(5);
  });

  it("oculta el texto placeholder si ya hay gráfico", () => {
    const text = chartCompanionText(
      "## Facturación 2026 por cliente\n\nGráfico de pastel (quesito)\n<rendered chart>",
      [samplePie(["A"], [1])]
    );
    expect(text).toBe("");
  });
});
