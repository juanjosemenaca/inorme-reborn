/** Año natural cuya parte «no disfrutada» no genera derecho de traspaso salvo excepción en ficha. */
export const VACATION_CLOSED_CARRYOVER_FROM_SOURCE_YEAR = 2025 as const;

/** Devuelve true si el año de origen está cerrado y la ficha no tiene excepción. */
export function vacationStandardCarryoverBlockedFromClosedYear(
  sourceYear: number,
  vacationAllowCarryoverFrom2025: boolean
): boolean {
  return (
    sourceYear === VACATION_CLOSED_CARRYOVER_FROM_SOURCE_YEAR && !vacationAllowCarryoverFrom2025
  );
}
