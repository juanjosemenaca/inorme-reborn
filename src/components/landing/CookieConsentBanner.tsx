import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LEGAL_PATHS } from "@/constants/legalPaths";
import { getCookieConsent, setCookieConsent } from "@/lib/cookieConsent";

const CookieConsentBanner = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      setVisible(false);
      return;
    }
    setVisible(getCookieConsent() === null);
  }, [location.pathname]);

  const dismiss = (status: "accepted" | "rejected") => {
    setCookieConsent(status);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("legal.banner.title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 p-4 sm:p-6 shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 max-w-3xl">
          <p className="font-semibold text-foreground">{t("legal.banner.title")}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("legal.banner.description")}{" "}
            <Link to={LEGAL_PATHS.cookies} className="text-primary underline underline-offset-2">
              {t("legal.banner.policyLink")}
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => dismiss("rejected")}>
            {t("legal.banner.reject")}
          </Button>
          <Button size="sm" onClick={() => dismiss("accepted")}>
            {t("legal.banner.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
