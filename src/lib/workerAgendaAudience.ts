import { cn } from "@/lib/utils";
import type { WorkerAgendaItemRecord } from "@/types/agenda";

export type WorkerAgendaAudienceKind = "worker" | "all" | "project";

export type AgendaAudienceDayCounts = { worker: number; all: number; project: number };

export function workerAgendaAudienceKind(it: WorkerAgendaItemRecord): WorkerAgendaAudienceKind {
  if (it.appliesToAllCompanyWorkers) return "all";
  if (it.projectId) return "project";
  return "worker";
}

function isoLocalFromStartsAt(startsAt: string): string {
  const d = new Date(startsAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Conteos por día local (misma convención que groupAgendaItemsByLocalDay). */
export function buildAgendaAudienceCountsByIso(items: WorkerAgendaItemRecord[]): Map<string, AgendaAudienceDayCounts> {
  const m = new Map<string, AgendaAudienceDayCounts>();
  for (const it of items) {
    const iso = isoLocalFromStartsAt(it.startsAt);
    const k = workerAgendaAudienceKind(it);
    const row = m.get(iso) ?? { worker: 0, all: 0, project: 0 };
    row[k] += 1;
    m.set(iso, row);
  }
  return m;
}

const chipKindClass: Record<WorkerAgendaAudienceKind, string> = {
  worker:
    "border-emerald-400/70 bg-emerald-100/90 text-emerald-950 hover:bg-emerald-200/90 dark:border-emerald-700/60 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55",
  all: "border-sky-400/70 bg-sky-100/90 text-sky-950 hover:bg-sky-200/90 dark:border-sky-700/60 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55",
  project:
    "border-amber-400/70 bg-amber-100/90 text-amber-950 hover:bg-amber-200/90 dark:border-amber-700/60 dark:bg-amber-950/45 dark:text-amber-100 dark:hover:bg-amber-900/55",
};

/** Píldoras del calendario (mes / semana / resumen de día). */
export function agendaItemChipClass(it: WorkerAgendaItemRecord, size: "compact" | "comfortable"): string {
  const k = workerAgendaAudienceKind(it);
  const sizeCls =
    size === "compact"
      ? "px-0.5 py-px text-[10px] leading-tight sm:text-[11px]"
      : "px-2 py-1.5 text-xs";
  return cn(
    "truncate rounded border text-left font-medium transition-colors",
    sizeCls,
    chipKindClass[k]
  );
}

const listAccentClass: Record<WorkerAgendaAudienceKind, string> = {
  worker: "border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/15",
  all: "border-l-4 border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/15",
  project: "border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/15",
};

/** Tarjetas de lista en admin (fondo + borde izquierdo por alcance). */
export function agendaAdminListItemClass(it: WorkerAgendaItemRecord): string {
  const k = workerAgendaAudienceKind(it);
  return cn("rounded-lg border p-3", listAccentClass[k]);
}

const dialogAccentClass: Record<WorkerAgendaAudienceKind, string> = {
  worker: "border-l-4 border-l-emerald-500 pl-4",
  all: "border-l-4 border-l-sky-500 pl-4",
  project: "border-l-4 border-l-amber-500 pl-4",
};

/** Borde izquierdo en el diálogo de detalle. */
export function agendaDetailDialogAccentClass(it: WorkerAgendaItemRecord): string {
  return dialogAccentClass[workerAgendaAudienceKind(it)];
}

const dotClass: Record<WorkerAgendaAudienceKind, string> = {
  worker: "bg-emerald-600 dark:bg-emerald-400",
  all: "bg-sky-600 dark:bg-sky-400",
  project: "bg-amber-600 dark:bg-amber-400",
};

export function agendaAudienceDotClass(kind: WorkerAgendaAudienceKind): string {
  return cn("size-1.5 shrink-0 rounded-full", dotClass[kind]);
}
