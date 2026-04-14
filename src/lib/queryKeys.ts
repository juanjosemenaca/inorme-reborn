export const queryKeys = {
  clients: ["clients"] as const,
  providers: ["providers"] as const,
  companyWorkers: ["companyWorkers"] as const,
  workerProfileChangeRequests: ["workerProfileChangeRequests"] as const,
  workerProfileChangeRequestsFor: (companyWorkerId: string) =>
    ["workerProfileChangeRequests", companyWorkerId] as const,
  backofficeUsers: ["backofficeUsers"] as const,
  backofficeMessages: ["backofficeMessages"] as const,
  backofficeMessageUnreadCount: ["backofficeMessageUnreadCount"] as const,
  projects: ["projects"] as const,
  workCalendarHolidays: (year: number) => ["workCalendarHolidays", year] as const,
  workCalendarSummerDays: (year: number) => ["workCalendarSummerDays", year] as const,
  workCalendarSites: ["workCalendarSites"] as const,
  workerVacationDays: (companyWorkerId: string, year: number) =>
    ["workerVacationDays", companyWorkerId, year] as const,
  workerVacationChangeRequests: ["workerVacationChangeRequests"] as const,
  workerVacationChangeRequestsFor: (companyWorkerId: string) =>
    ["workerVacationChangeRequests", companyWorkerId] as const,
  adminVacationSummaries: (year: number) => ["adminVacationSummaries", year] as const,
  adminVacationNotifications: ["adminVacationNotifications"] as const,
  adminVacationNotificationCount: (sinceDays: number) =>
    ["adminVacationNotificationCount", sinceDays] as const,
  myTimeClockEvents: (fromIsoDate: string, toIsoDate: string) =>
    ["myTimeClockEvents", fromIsoDate, toIsoDate] as const,
  workerTimeClockEvents: (workerId: string, fromIsoDate: string, toIsoDate: string) =>
    ["workerTimeClockEvents", workerId, fromIsoDate, toIsoDate] as const,
  workersTimeClockEvents: (workerIdsKey: string, fromIsoDate: string, toIsoDate: string) =>
    ["workersTimeClockEvents", workerIdsKey, fromIsoDate, toIsoDate] as const,
  workerAgendaItems: (companyWorkerId: string, fromIsoDate: string, toIsoDate: string) =>
    ["workerAgendaItems", companyWorkerId, fromIsoDate, toIsoDate] as const,
  billingIssuers: ["billingIssuers"] as const,
  billingSeries: ["billingSeries"] as const,
  billingInvoices: ["billingInvoices"] as const,
  workerExpenseSheets: (companyWorkerId: string) => ["workerExpenseSheets", companyWorkerId] as const,
  workerExpenseSheetsAdmin: ["workerExpenseSheets", "admin"] as const,
};
