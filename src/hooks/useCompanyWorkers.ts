import { useSyncExternalStore } from "react";
import { getCompanyWorkersSnapshot, subscribeCompanyWorkers } from "@/lib/companyWorkerStore";

export function useCompanyWorkers() {
  return useSyncExternalStore(
    subscribeCompanyWorkers,
    getCompanyWorkersSnapshot,
    getCompanyWorkersSnapshot
  );
}
