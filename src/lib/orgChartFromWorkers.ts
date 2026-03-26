import {
  COMPANY_WORKER_EMPLOYMENT_LABELS,
  companyWorkerDisplayName,
  type CompanyWorkerRecord,
} from "@/types/companyWorkers";
import type { OrgChartEmployee } from "@/types/orgChart";

export function companyWorkersToOrgEmployees(workers: CompanyWorkerRecord[]): OrgChartEmployee[] {
  return workers.map((w) => ({
    id: w.id,
    name: companyWorkerDisplayName(w),
    managerId: w.managerId,
    roles:
      w.orgRoles.length > 0 ? w.orgRoles : [COMPANY_WORKER_EMPLOYMENT_LABELS[w.employmentType]],
    teams: w.teamLabels,
  }));
}
