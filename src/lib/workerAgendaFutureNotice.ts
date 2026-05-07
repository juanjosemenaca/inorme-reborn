import type { WorkerAgendaItemRecord } from "@/types/agenda";
import { addDays, dateToLocalYmd, startOfWeekMonday } from "@/components/admin/WorkerAgendaTimeViews";

function sortAgendaByTime(items: WorkerAgendaItemRecord[]): WorkerAgendaItemRecord[] {
  return [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function itemsInLocalDateRange(
  items: WorkerAgendaItemRecord[],
  fromIso: string,
  toIso: string
): WorkerAgendaItemRecord[] {
  return items.filter((it) => {
    const d = dateToLocalYmd(new Date(it.startsAt));
    return d >= fromIso && d <= toIso;
  });
}

/**
 * Entradas de agenda posteriores al resumen semanal del panel (misma regla que WorkerDashboard).
 */
export function computeAgendaFutureBeyondDashboardSummary(params: {
  rawAgendaHorizon: WorkerAgendaItemRecord[];
  referenceLocalYmd: string;
}): WorkerAgendaItemRecord[] {
  const { rawAgendaHorizon, referenceLocalYmd } = params;
  const ref = new Date(`${referenceLocalYmd}T12:00:00`);
  const agendaWeekMonday = startOfWeekMonday(ref);
  const isFriday = ref.getDay() === 5;
  const currentWeekFromIso = dateToLocalYmd(agendaWeekMonday);
  const currentWeekToIso = dateToLocalYmd(addDays(agendaWeekMonday, 6));
  const nextWeekFromIso = dateToLocalYmd(addDays(agendaWeekMonday, 7));
  const nextWeekToIso = dateToLocalYmd(addDays(agendaWeekMonday, 13));

  const currentWeekItems = sortAgendaByTime(
    itemsInLocalDateRange(rawAgendaHorizon, currentWeekFromIso, currentWeekToIso)
  );
  const nextWeekItems = isFriday
    ? sortAgendaByTime(itemsInLocalDateRange(rawAgendaHorizon, nextWeekFromIso, nextWeekToIso))
    : [];

  const shown = new Set<string>();
  for (const it of currentWeekItems) shown.add(it.id);
  if (isFriday) for (const it of nextWeekItems) shown.add(it.id);

  return rawAgendaHorizon.filter((it) => {
    if (shown.has(it.id)) return false;
    const d = dateToLocalYmd(new Date(it.startsAt));
    return d > currentWeekToIso;
  });
}

export function agendaFutureNoticeSignature(items: WorkerAgendaItemRecord[]): string {
  return [...items]
    .map((i) => i.id)
    .sort()
    .join("|");
}

function storageKey(workerId: string): string {
  return `worker_agenda_future_ack:${workerId}`;
}

export function readAgendaFutureNoticeAck(workerId: string): string | null {
  try {
    return localStorage.getItem(storageKey(workerId));
  } catch {
    return null;
  }
}

export function writeAgendaFutureNoticeAck(workerId: string, signature: string): void {
  try {
    localStorage.setItem(storageKey(workerId), signature);
  } catch {
    /* private mode / quota */
  }
}
