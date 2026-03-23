/** Dirección de ordenación en tablas del backoffice */
export type SortDir = "asc" | "desc";

export type ColumnSort = { key: string; dir: SortDir };

/**
 * Alterna orden al pulsar la misma columna (asc → desc → asc).
 * Columna distinta: empieza en asc.
 */
export function toggleColumnSort(current: ColumnSort | null, key: string): ColumnSort {
  if (!current || current.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

/**
 * Ordena filas por un valor por fila (texto con locale `es`, numérico cuando aplica, boolean).
 */
export function sortRows<T>(
  rows: T[],
  dir: SortDir,
  getValue: (row: T) => string | number | boolean
): T[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (typeof va === "boolean" && typeof vb === "boolean") {
      return mult * (Number(va) - Number(vb));
    }
    const na = typeof va === "number" ? va : NaN;
    const nb = typeof vb === "number" ? vb : NaN;
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) {
      return mult * (na - nb);
    }
    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    return mult * sa.localeCompare(sb, "es", { sensitivity: "base", numeric: true });
  });
}
