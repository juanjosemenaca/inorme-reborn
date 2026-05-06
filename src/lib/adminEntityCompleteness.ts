import type { ClientRecord } from "@/types/clients";
import type { ProviderRecord } from "@/types/providers";
import type { ProjectWithDocuments } from "@/types/projects";

export type AdminCompletenessLevel = "green" | "yellow" | "red";

export function completenessLevelFromMissingCount(missingCount: number): AdminCompletenessLevel {
  if (missingCount === 0) return "green";
  if (missingCount <= 2) return "yellow";
  return "red";
}

export function getProviderCompleteness(p: ProviderRecord): {
  level: AdminCompletenessLevel;
  missingCount: number;
  missingRuleIds: string[];
} {
  const missingRuleIds: string[] = [];
  if (!p.tradeName.trim() && !p.companyName.trim()) missingRuleIds.push("identity");
  if (!p.cif.trim()) missingRuleIds.push("cif");
  if (!p.fiscalAddress.trim()) missingRuleIds.push("fiscalAddress");
  if (!p.phone.trim()) missingRuleIds.push("phone");
  if (!p.contactEmail.trim()) missingRuleIds.push("contactEmail");
  const missingCount = missingRuleIds.length;
  return { level: completenessLevelFromMissingCount(missingCount), missingCount, missingRuleIds };
}

export function getClientCompleteness(c: ClientRecord): {
  level: AdminCompletenessLevel;
  missingCount: number;
  missingRuleIds: string[];
} {
  const missingRuleIds: string[] = [];
  if (!c.tradeName.trim() && !c.companyName.trim()) missingRuleIds.push("identity");
  if (!c.cif.trim()) missingRuleIds.push("cif");
  if (!c.postalAddress.trim()) missingRuleIds.push("postalAddress");
  if (!c.fiscalAddress.trim()) missingRuleIds.push("fiscalAddress");
  if (!c.phone.trim()) missingRuleIds.push("phone");
  if (!c.contactEmail.trim()) missingRuleIds.push("contactEmail");
  if (!c.invoiceAddresseeLine.trim()) missingRuleIds.push("invoiceAddresseeLine");
  if (c.clientKind === "INTERMEDIARIO" && !c.linkedFinalClientId?.trim()) {
    missingRuleIds.push("linkedFinalClient");
  }
  const missingCount = missingRuleIds.length;
  return { level: completenessLevelFromMissingCount(missingCount), missingCount, missingRuleIds };
}

export function getProjectCompleteness(
  p: ProjectWithDocuments,
  client: ClientRecord | undefined
): { level: AdminCompletenessLevel; missingCount: number; missingRuleIds: string[] } {
  const missingRuleIds: string[] = [];
  if (!p.title.trim()) missingRuleIds.push("title");
  if (!p.clientId.trim()) missingRuleIds.push("clientId");
  if (!p.startDate?.trim()) missingRuleIds.push("startDate");
  if (!p.endDate?.trim()) missingRuleIds.push("endDate");
  if (!p.responsibleCompanyWorkerId?.trim()) missingRuleIds.push("responsible");
  if (client?.clientKind === "INTERMEDIARIO" && !p.finalClientId?.trim()) {
    missingRuleIds.push("finalClient");
  }
  const s = p.startDate?.trim() ?? "";
  const e = p.endDate?.trim() ?? "";
  if (s && e && e < s) missingRuleIds.push("dateRange");
  const missingCount = missingRuleIds.length;
  return { level: completenessLevelFromMissingCount(missingCount), missingCount, missingRuleIds };
}

export function completenessDotClass(level: AdminCompletenessLevel): string {
  if (level === "green") return "bg-emerald-500";
  if (level === "yellow") return "bg-amber-400";
  return "bg-rose-500";
}
