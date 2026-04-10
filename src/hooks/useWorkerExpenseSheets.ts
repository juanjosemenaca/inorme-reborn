import { useQuery } from "@tanstack/react-query";
import {
  fetchAllWorkerExpenseSheets,
  fetchPendingWorkerExpenseSheets,
  fetchWorkerExpenseSheetsForWorker,
} from "@/api/workerExpenseSheetsApi";
import { queryKeys } from "@/lib/queryKeys";

export function useWorkerExpenseSheets(companyWorkerId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workerExpenseSheets(companyWorkerId ?? ""),
    queryFn: () => fetchWorkerExpenseSheetsForWorker(companyWorkerId!),
    enabled: Boolean(enabled && companyWorkerId),
  });
}

export function useAllWorkerExpenseSheets(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workerExpenseSheetsAdmin,
    queryFn: fetchAllWorkerExpenseSheets,
    enabled,
  });
}

export function usePendingWorkerExpenseSheets(enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.workerExpenseSheetsAdmin, "pending"] as const,
    queryFn: fetchPendingWorkerExpenseSheets,
    enabled,
  });
}
