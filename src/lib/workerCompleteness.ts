import { completenessLevelFromMissingCount } from "@/lib/adminEntityCompleteness";
import type { CompanyWorkerRecord } from "@/types/companyWorkers";

export type WorkerCompletenessLevel = "green" | "yellow" | "red";

type Rule = {
  id: string;
  missing: (w: CompanyWorkerRecord) => boolean;
};

const BASE_RULES: Rule[] = [
  { id: "firstName", missing: (w) => !w.firstName.trim() },
  { id: "lastName", missing: (w) => !w.lastName.trim() },
  { id: "dni", missing: (w) => !w.dni.trim() },
  { id: "email", missing: (w) => !w.email.trim() },
  { id: "mobile", missing: (w) => !w.mobile.trim() },
  { id: "postalAddress", missing: (w) => !w.postalAddress.trim() },
  { id: "city", missing: (w) => !w.city.trim() },
  { id: "workCalendarSiteId", missing: (w) => !w.workCalendarSiteId.trim() },
  { id: "vacationDays", missing: (w) => !Number.isFinite(w.vacationDays) || w.vacationDays < 0 },
];

const CONDITIONAL_RULES: Rule[] = [
  {
    id: "providerForSubcontratado",
    missing: (w) => w.employmentType === "SUBCONTRATADO" && !w.providerId,
  },
  {
    id: "autonomoVia",
    missing: (w) => w.employmentType === "AUTONOMO" && !w.autonomoVia,
  },
  {
    id: "providerForAutonomoEmpresa",
    missing: (w) => w.employmentType === "AUTONOMO" && w.autonomoVia === "EMPRESA" && !w.providerId,
  },
];

const RULES: Rule[] = [...BASE_RULES, ...CONDITIONAL_RULES];

export function getWorkerCompleteness(
  w: CompanyWorkerRecord,
  options: { hasCvFile: boolean }
): {
  level: WorkerCompletenessLevel;
  missingCount: number;
  missingRuleIds: string[];
} {
  const missingRuleIds = [
    ...RULES.filter((r) => r.missing(w)).map((r) => r.id),
    ...(!options.hasCvFile ? (["cvFile"] as const) : []),
  ];
  const missingCount = missingRuleIds.length;
  return {
    level: completenessLevelFromMissingCount(missingCount),
    missingCount,
    missingRuleIds,
  };
}
