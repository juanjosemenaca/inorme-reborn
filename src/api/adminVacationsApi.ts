import { fetchCompanyWorkers } from "@/api/companyWorkersApi";
import { fetchWorkCalendarSites } from "@/api/workCalendarSitesApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import { isoDateOnlyFromDb } from "@/lib/isoDate";
import { companyWorkerDisplayName } from "@/types/companyWorkers";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";

function throwSupabaseError(err: unknown): never {
  throw new Error(getErrorMessage(err));
}

export type WorkerVacationAdminSummary = {
  workerId: string;
  workerName: string;
  active: boolean;
  siteName: string;
  /** Cupo anual según la ficha actual (`vacation_days`). */
  annualAllowance: number;
  /** Días aprobados (marcados) del año seleccionado, sin filtrar por fecha actual. */
  usedInSelectedYear: number;
  /** Días de traspaso (año anterior) ya marcados en el año seleccionado. */
  carryoverUsedInSelectedYear: number;
  /** Días de traspaso aprobados para disfrutar en el año seleccionado (desde el año previo). */
  carryoverApprovedForSelectedYear: number;
  /** Días usados cuyo día ya pasó respecto a hoy (disfrutados). */
  enjoyedInSelectedYear: number;
  pendingInSelectedYear: number;
  selectedYear: number;
  previousYear: number;
  usedInPreviousYear: number;
  /** max(0, cupo − usados en el año natural anterior al seleccionado). */
  unusedFromPreviousYear: number;
};

export type VacationBookingRow = {
  companyWorkerId: string;
  vacationDate: string;
  carryoverFromYear: number | null;
};

export async function fetchVacationBookingRowsForYearRange(
  fromYear: number,
  toYear: number
): Promise<VacationBookingRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("company_worker_vacation_days")
    .select("company_worker_id, vacation_date, carryover_from_year")
    .gte("vacation_date", `${fromYear}-01-01`)
    .lte("vacation_date", `${toYear}-12-31`);
  if (error) throwSupabaseError(error);
  return (data ?? []).map((r) => {
    const row = r as { company_worker_id: string; vacation_date: string; carryover_from_year: number | null };
    return {
      companyWorkerId: row.company_worker_id,
      vacationDate: isoDateOnlyFromDb(String(row.vacation_date)),
      carryoverFromYear: row.carryover_from_year == null ? null : Number(row.carryover_from_year),
    };
  });
}

async function fetchCarryoverApprovedByWorkerForTarget(
  targetYear: number
): Promise<Map<string, number>> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("worker_vacation_carryover_requests")
    .select("company_worker_id, days_approved")
    .eq("target_year", targetYear)
    .eq("status", "APPROVED");
  if (error) throwSupabaseError(error);
  const m = new Map<string, number>();
  for (const raw of data ?? []) {
    const r = raw as { company_worker_id: string; days_approved: number | null };
    const d = r.days_approved;
    if (d == null || d <= 0) continue;
    const w = r.company_worker_id;
    m.set(w, (m.get(w) ?? 0) + d);
  }
  return m;
}

export function computeVacationSummaries(
  workers: CompanyWorkerRecord[],
  siteNameById: Map<string, string>,
  rows: VacationBookingRow[],
  selectedYear: number,
  carryoverApprovedByWorker: Map<string, number>
): WorkerVacationAdminSummary[] {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const prevYear = selectedYear - 1;
  const byWorkerYear = new Map<string, Map<number, number>>();
  const carryoverInSelected = new Map<string, number>();
  const enjoyedBeforeTodayByWorker = new Map<string, number>();
  for (const r of rows) {
    const y = parseInt(r.vacationDate.slice(0, 4), 10);
    if (y !== selectedYear && y !== prevYear) continue;
    if (!byWorkerYear.has(r.companyWorkerId)) {
      byWorkerYear.set(r.companyWorkerId, new Map());
    }
    const ym = byWorkerYear.get(r.companyWorkerId)!;
    ym.set(y, (ym.get(y) ?? 0) + 1);
    if (y === selectedYear && r.carryoverFromYear != null) {
      carryoverInSelected.set(
        r.companyWorkerId,
        (carryoverInSelected.get(r.companyWorkerId) ?? 0) + 1
      );
    }
    if (y === selectedYear && r.vacationDate < todayIso) {
      enjoyedBeforeTodayByWorker.set(
        r.companyWorkerId,
        (enjoyedBeforeTodayByWorker.get(r.companyWorkerId) ?? 0) + 1
      );
    }
  }

  return workers.map((w) => {
    const allowance = w.vacationDays;
    const ym = byWorkerYear.get(w.id);
    const usedSel = ym?.get(selectedYear) ?? 0;
    const enjoyedSel = enjoyedBeforeTodayByWorker.get(w.id) ?? 0;
    const usedPrev = ym?.get(prevYear) ?? 0;
    const cUsed = carryoverInSelected.get(w.id) ?? 0;
    const cApp = carryoverApprovedByWorker.get(w.id) ?? 0;
    return {
      workerId: w.id,
      workerName: companyWorkerDisplayName(w),
      active: w.active,
      siteName: siteNameById.get(w.workCalendarSiteId) ?? "—",
      annualAllowance: allowance,
      usedInSelectedYear: usedSel,
      carryoverUsedInSelectedYear: cUsed,
      carryoverApprovedForSelectedYear: cApp,
      enjoyedInSelectedYear: enjoyedSel,
      /** Pendientes del cupo anual (sin traspaso). */
      pendingInSelectedYear: Math.max(0, allowance - (usedSel - cUsed)),
      selectedYear,
      previousYear: prevYear,
      usedInPreviousYear: usedPrev,
      unusedFromPreviousYear: Math.max(0, allowance - usedPrev),
    };
  });
}

/**
 * Listado admin: trabajadores con cupo, usados y pendientes del año seleccionado,
 * y días no disfrutados del año natural anterior (mismo cupo actual de ficha).
 */
export async function fetchAdminVacationSummaries(
  selectedYear: number
): Promise<WorkerVacationAdminSummary[]> {
  const [workers, sites, carryoverApprovedByWorker] = await Promise.all([
    fetchCompanyWorkers(),
    fetchWorkCalendarSites(),
    fetchCarryoverApprovedByWorkerForTarget(selectedYear),
  ]);
  const siteNameById = new Map(sites.map((s) => [s.id, s.name] as const));
  const prevYear = selectedYear - 1;
  const rows = await fetchVacationBookingRowsForYearRange(prevYear, selectedYear);
  return computeVacationSummaries(workers, siteNameById, rows, selectedYear, carryoverApprovedByWorker);
}
