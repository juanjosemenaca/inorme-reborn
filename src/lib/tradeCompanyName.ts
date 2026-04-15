/**
 * Si solo hay razón social o solo nombre comercial, replica el valor en ambos.
 * Si están los dos informados, se mantienen distintos (nombre comercial ≠ razón social).
 */
export function mergeTradeAndCompanyName(
  tradeName: string,
  companyName: string
): { tradeName: string; companyName: string } {
  const t = tradeName.trim();
  const c = companyName.trim();
  if (t && c) return { tradeName: t, companyName: c };
  const v = t || c;
  return { tradeName: v, companyName: v };
}
