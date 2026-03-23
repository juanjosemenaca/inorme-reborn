import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold">{t("admin.notfound.title")}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("admin.notfound.message")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("admin.notfound.home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
