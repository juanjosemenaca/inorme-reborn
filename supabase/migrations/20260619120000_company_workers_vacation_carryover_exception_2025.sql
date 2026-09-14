-- Cierra por defecto el cupo estándar de 2025 para traspaso: 0 días pendientes salvo excepción en ficha.
ALTER TABLE public.company_workers
  ADD COLUMN IF NOT EXISTS vacation_allow_carryover_from_2025 boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.company_workers.vacation_allow_carryover_from_2025 IS
  'Si es true, el trabajador puede solicitar traspaso de días estándar no disfrutados de 2025; por defecto false (empresa cierra ese año).';
