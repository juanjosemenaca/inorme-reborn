import { useLanguage } from "@/contexts/LanguageContext";

export function PendingRequestNotice() {
  const { t } = useLanguage();
  return (
    <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
      {t("admin.common.pending_request_sent")}
    </p>
  );
}
