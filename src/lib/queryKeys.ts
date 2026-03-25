export const queryKeys = {
  clients: ["clients"] as const,
  providers: ["providers"] as const,
  companyWorkers: ["companyWorkers"] as const,
  workerProfileChangeRequests: ["workerProfileChangeRequests"] as const,
  workerProfileChangeRequestsFor: (companyWorkerId: string) =>
    ["workerProfileChangeRequests", companyWorkerId] as const,
  backofficeUsers: ["backofficeUsers"] as const,
  projects: ["projects"] as const,
  workCalendarHolidays: (year: number) => ["workCalendarHolidays", year] as const,
  workCalendarSummerDays: (year: number) => ["workCalendarSummerDays", year] as const,
};
