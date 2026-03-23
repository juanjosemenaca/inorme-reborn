import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

const navKeys = [
  { href: "#historia", key: "nav_company" },
  { href: "#servicios", key: "nav_services" },
  { href: "#productos", key: "nav_products" },
  { href: "#nosotros", key: "nav_about" },
  { href: "#clientes", key: "nav_clients" },
  { href: "#contacto", key: "nav_contact" },
] as const;

const languageLabels: Record<Language, string> = {
  es: "ES",
  ca: "CA",
  en: "EN",
  eu: "EU",
};

const Header = () => {
  const { t, language, setLanguage } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (href: string) => {
    setIsMobileMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-[72px]">
        <a href="#" className="relative z-10 flex items-center">
          {!logoError ? (
            <img
              src="/logo-inorme.png"
              alt="Inorme S.L. - Informática, organización y métodos"
              className="h-9 w-auto"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-[22px] font-bold tracking-tight">
              <span className="text-primary">in</span>
              <span className={isScrolled ? "text-foreground" : "text-white"}>orme</span>
            </span>
          )}
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {navKeys.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className={`px-4 py-2 text-[13px] font-medium tracking-wide uppercase transition-all duration-300 rounded-lg hover:bg-white/10 ${
                isScrolled
                  ? "text-foreground/70 hover:text-foreground hover:bg-muted"
                  : "text-white/75 hover:text-white"
              }`}
            >
              {t(link.key)}
            </button>
          ))}
          <Link
            to="/admin/login"
            className={`ml-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide rounded-lg transition-colors ${
              isScrolled
                ? "text-foreground/60 hover:text-foreground hover:bg-muted"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            {t("nav_backoffice")}
          </Link>
          <span className="ml-1 flex items-center gap-1 border-l border-current/20 pl-3">
            {(Object.keys(languageLabels) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`text-[10px] font-medium uppercase transition-colors ${
                  language === lang
                    ? "text-primary opacity-100"
                    : isScrolled
                      ? "text-foreground/50 hover:text-foreground"
                      : "text-white/50 hover:text-white"
                }`}
                aria-label={lang}
              >
                {languageLabels[lang]}
              </button>
            ))}
          </span>
          <Button
            onClick={() => scrollTo("#contacto")}
            size="sm"
            className="ml-4 rounded-full px-6 h-9 text-[13px] font-semibold tracking-wide shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            {t("nav_contactBtn")}
          </Button>
        </nav>

        <div className="flex lg:hidden items-center gap-2 relative z-10">
          <span className="flex items-center gap-1">
            {(Object.keys(languageLabels) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`text-[10px] font-medium uppercase px-1.5 py-1 rounded transition-colors ${
                  language === lang
                    ? "text-primary opacity-100"
                    : isScrolled
                      ? "text-foreground/50 hover:text-foreground"
                      : "text-white/50 hover:text-white"
                }`}
                aria-label={lang}
              >
                {languageLabels[lang]}
              </button>
            ))}
          </span>
          <div className="relative">
            <button
              className="p-2 -mr-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menú"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className={`h-5 w-5 ${isScrolled ? "text-foreground" : "text-white"}`} />
              ) : (
                <Menu className={`h-5 w-5 ${isScrolled ? "text-foreground" : "text-white"}`} />
              )}
            </button>
            {/* Menú desplegable pequeño debajo del icono */}
            <div
              className={`lg:hidden absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border bg-background py-1.5 shadow-lg transition-all duration-200 text-center ${
                isMobileMenuOpen
                  ? "opacity-100 visible translate-y-0"
                  : "opacity-0 invisible -translate-y-1 pointer-events-none"
              }`}
            >
              {navKeys.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full px-3 py-1.5 text-center text-[11px] font-medium uppercase text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                >
                  {t(link.key)}
                </button>
              ))}
              <Link
                to="/admin/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full px-3 py-1.5 text-center text-[11px] font-medium uppercase text-primary hover:bg-muted transition-colors"
              >
                {t("nav_backoffice")}
              </Link>
              <div className="my-1 border-t border-border" />
              <div className="px-2 pt-0.5 flex justify-center">
                <Button
                  onClick={() => scrollTo("#contacto")}
                  size="sm"
                  className="h-7 rounded-full px-4 text-[10px] font-semibold"
                >
                  {t("nav_contactBtn")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
