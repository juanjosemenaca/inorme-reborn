/** Parte el texto del cliente en opciones para el selector (separadores: `;` o saltos de línea). */
export function parseInvoiceAddresseeOptions(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}
