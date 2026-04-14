import { useQuery } from "@tanstack/react-query";
import { fetchBillingInvoices, fetchBillingIssuerProfile, fetchBillingSeries } from "@/api/billingApi";
import { queryKeys } from "@/lib/queryKeys";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function useBillingIssuerProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.billingIssuerProfile,
    queryFn: fetchBillingIssuerProfile,
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
