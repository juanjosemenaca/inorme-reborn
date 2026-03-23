/** Obtiene un valor en un objeto de traducciones (claves planas o anidadas con puntos). */
export function getTranslationValue(obj: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) {
    return obj[key];
  }
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}
