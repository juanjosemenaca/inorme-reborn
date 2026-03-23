import { useSyncExternalStore } from "react";
import { getProvidersSnapshot, subscribeProviders } from "@/lib/providerStore";

export function useProviders() {
  return useSyncExternalStore(subscribeProviders, getProvidersSnapshot, getProvidersSnapshot);
}
