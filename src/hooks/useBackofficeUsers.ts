import { useSyncExternalStore } from "react";
import { getUsersSnapshot, subscribeUsers } from "@/lib/backofficeUserStore";

/** Lista de usuarios reactiva (localStorage) para tableros y listados */
export function useBackofficeUsers() {
  return useSyncExternalStore(subscribeUsers, getUsersSnapshot, getUsersSnapshot);
}
