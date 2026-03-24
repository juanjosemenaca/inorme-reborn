import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [logoError, setLogoError] = useState(false);

  const logoSrc = publicAssetUrl("logo-inorme.png");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

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

        {/* Siempre: idioma + menú desplegable (Radix). Sin barra horizontal en ningún ancho ni breakpoint. */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher variant={isScrolled ? "dark" : "light"} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex p-2 -mr-1 rounded-md hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t("nav_menu_aria")}
              >
                <Menu className={`h-6 w-6 ${isScrolled ? "text-foreground" : "text-white"}`} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="z-[100] w-[min(20rem,calc(100vw-1rem))] max-h-[min(80vh,28rem)] overflow-y-auto p-2"
            >
              <DropdownMenuLabel className="text-base font-semibold">{t("nav_menu_title")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {navKeys.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  className="cursor-pointer text-sm font-medium uppercase"
                  onSelect={() => scrollTo(link.href)}
                >
                  {t(link.key)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer uppercase text-primary">
                <Link to="/admin/login">{t("nav_backoffice")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="p-1 focus:bg-transparent">
                <Button
                  type="button"
                  className="w-full rounded-full"
                  onClick={() => scrollTo("#contacto")}
                >
                  {t("nav_contactBtn")}
                </Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
