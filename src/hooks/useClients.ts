import { useSyncExternalStore } from "react";
import { getClientsSnapshot, subscribeClients } from "@/lib/clientStore";

export function useClients() {
  return useSyncExternalStore(subscribeClients, getClientsSnapshot, getClientsSnapshot);
}
