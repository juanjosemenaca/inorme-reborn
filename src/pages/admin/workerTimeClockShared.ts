import type { TimeClockEventRecord } from "@/types/timeTracking";

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function timeClockKindLabel(kind: string, t: (k: string) => string): string {
  return t(`admin.timeClock.kind_${kind.toLowerCase()}`);
}

export type TodayWorkerTimeClockDerived = {
  todayState: {
    inWork: boolean;
    onBreak: boolean;
    absent: boolean;
    hasClockIn: boolean;
    hasClockOut: boolean;
  };
  /** Motivo de la pausa activa (último BREAK_START abierto). */
  openBreakComment: string | null;
  /** Motivo de ausencia del día si aplica. */
  absenceReasonDisplay: string | null;
  /** Hora del último fichaje de entrada hoy. */
  lastClockInAt: string | null;
};

export function deriveTodayWorkerTimeClock(todayEvents: TimeClockEventRecord[]): TodayWorkerTimeClockDerived {
  let inWork = false;
  let onBreak = false;
  let absent = false;
  let hasClockIn = false;
  let hasClockOut = false;
  let openBreakComment: string | null = null;
  let absenceReasonDisplay: string | null = null;
  let lastClockInAt: string | null = null;

  for (const e of [...todayEvents].sort((a, b) => a.eventAt.localeCompare(b.eventAt))) {
    if (e.eventKind === "ABSENCE") {
      absent = true;
      inWork = false;
      onBreak = false;
      openBreakComment = null;
      absenceReasonDisplay = e.absenceReason?.trim() || null;
    } else if (e.eventKind === "CLOCK_IN") {
      hasClockIn = true;
      lastClockInAt = e.eventAt;
      inWork = true;
      onBreak = false;
      openBreakComment = null;
    } else if (e.eventKind === "BREAK_START" && inWork) {
      onBreak = true;
      openBreakComment = e.comment?.trim() || null;
    } else if (e.eventKind === "BREAK_END" && inWork) {
      onBreak = false;
      openBreakComment = null;
    } else if (e.eventKind === "CLOCK_OUT") {
      hasClockOut = true;
      inWork = false;
      onBreak = false;
      openBreakComment = null;
    }
  }

  return {
    todayState: { inWork, onBreak, absent, hasClockIn, hasClockOut },
    openBreakComment,
    absenceReasonDisplay: absent ? absenceReasonDisplay : null,
    lastClockInAt,
  };
}
