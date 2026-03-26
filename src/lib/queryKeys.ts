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
};
