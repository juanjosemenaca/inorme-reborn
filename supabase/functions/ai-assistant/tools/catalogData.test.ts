import { describe, expect, it } from "vitest";
import { CATALOG_ENTITIES, entitiesForTopic, resolveCatalogTopic } from "./catalogData.ts";

describe("catálogo de datos de negocio", () => {
  it("resuelve factura y aliases", () => {
    expect(resolveCatalogTopic("factura")).toBe("invoice");
    expect(resolveCatalogTopic("campos")).toBe("all");
    expect(resolveCatalogTopic(undefined)).toBe("all");
  });

  it("describe los campos de una factura emitida", () => {
    const invoice = entitiesForTopic("invoice")[0];
    const names = invoice.groups.flatMap((g) => g.fields.map((f) => f.name)).join(" | ");
    expect(names).toMatch(/Número/);
    expect(names).toMatch(/Fecha de factura/);
    expect(names).toMatch(/Cliente/);
    expect(names).toMatch(/Total/);
    expect(names).toMatch(/Cantidad/);
  });

  it("no incluye SQL ni secretos", () => {
    const blob = JSON.stringify(CATALOG_ENTITIES);
    expect(blob).not.toMatch(/SELECT |execute_sql|API_KEY|service_role/i);
  });
});
