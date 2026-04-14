import { useQuery } from "@tanstack/react-query";
import { fetchBillingInvoices, fetchBillingIssuers, fetchBillingSeries } from "@/api/billingApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useBillingIssuers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billingIssuers,
    queryFn: fetchBillingIssuers,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useBillingSeries(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billingSeries,
    queryFn: fetchBillingSeries,
    enabled: isSupabaseConfigured() && enabled,
  });
}

export function useBillingInvoices(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billingInvoices,
    queryFn: fetchBillingInvoices,
    enabled: isSupabaseConfigured() && enabled,
  });
}
