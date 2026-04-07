export type TimeClockEventKind =
  | "CLOCK_IN"
  | "CLOCK_OUT"
  | "BREAK_START"
  | "BREAK_END"
  | "ABSENCE";

export type TimeClockSource = "WORKER" | "ADMIN";

export interface TimeClockEventRecord {
  id: string;
  companyWorkerId: string;
  eventKind: TimeClockEventKind;
  eventAt: string;
  absenceReason: string | null;
  comment: string;
  source: TimeClockSource;
  createdByBackofficeUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeClockDailySummary {
  dayIso: string;
  workedMinutes: number;
  hasAbsence: boolean;
  absenceReason: string | null;
}
