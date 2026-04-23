/** Orden alfabético para listas en desplegables (español, mayúsculas/acentos no discriminan criterio primario). */
export function compareLocale(a: string, b: string): number {
  return a.trim().localeCompare(b.trim(), "es", { sensitivity: "base" });
}

export function sortByLocaleKey<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((x, y) => compareLocale(key(x), key(y)));
}
