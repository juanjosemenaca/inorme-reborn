import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { publicAssetUrl } from "@/lib/publicAssetUrl";

const navKeys = [
  { href: "#historia", key: "nav_company" },
  { href: "#servicios", key: "nav_services" },
  { href: "#productos", key: "nav_products" },
  { href: "#nosotros", key: "nav_about" },
  { href: "#clientes", key: "nav_clients" },
  { href: "#contacto", key: "nav_contact" },
] as const;

const Header = () => {
  const { t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const logoSrc = publicAssetUrl("logo-inorme.png");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (href: string) => {
    setSheetOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  const sheetLinkClass =
    "text-left rounded-lg transition-all duration-300 uppercase font-medium w-full px-4 py-3 text-sm text-foreground hover:bg-muted";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 overflow-x-hidden transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 min-h-[72px] py-2">
        <a href="#" className="relative z-10 flex min-w-0 shrink items-center">
          {!logoError ? (
            <div className="flex h-9 max-h-9 w-auto max-w-[min(280px,calc(100vw-8rem))] items-center">
              <img
                src={logoSrc}
                alt="Inorme S.L. - Informática, organización y métodos"
                className="max-h-full w-auto max-w-full object-contain object-left"
                loading="eager"
                decoding="async"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <span className="text-[22px] font-bold tracking-tight">
              <span className="text-primary">in</span>
              <span className={isScrolled ? "text-foreground" : "text-white"}>orme</span>
            </span>
          )}
        </a>

        {/* Navegación solo vía hamburguesa → Sheet. Sin breakpoints: mismo patrón en todos los dispositivos. */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher variant={isScrolled ? "dark" : "light"} />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex p-2 -mr-1 rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t("nav_menu_aria")}
                aria-expanded={sheetOpen}
              >
                <Menu className={`h-6 w-6 ${isScrolled ? "text-foreground" : "text-white"}`} />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(100vw-2rem,20rem)] flex-col border-l bg-background p-0 sm:max-w-sm">
              <SheetHeader className="border-b px-6 py-4 text-left">
                <SheetTitle>{t("nav_menu_title")}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4" aria-label="Principal">
                {navKeys.map((link) => (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => scrollTo(link.href)}
                    className={sheetLinkClass}
                  >
                    {t(link.key)}
                  </button>
                ))}
                <Link
                  to="/admin/login"
                  onClick={() => setSheetOpen(false)}
                  className="w-full px-4 py-3 text-left text-sm font-medium uppercase text-primary hover:bg-muted rounded-lg"
                >
                  {t("nav_backoffice")}
                </Link>
                <div className="mt-4 px-2">
                  <Button
                    type="button"
                    onClick={() => scrollTo("#contacto")}
                    className="w-full rounded-full"
                  >
                    {t("nav_contactBtn")}
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
