import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Sobre Nosotros" },
  { href: "#clientes", label: "Clientes" },
  { href: "#contacto", label: "Contacto" },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        <a href="#" className="relative z-10">
          <span className="text-[22px] font-bold tracking-tight">
            <span className="text-primary">in</span>
            <span className={isScrolled ? "text-foreground" : "text-white"}>orme</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className={`px-4 py-2 text-[13px] font-medium tracking-wide uppercase transition-all duration-300 rounded-lg hover:bg-white/10 ${
                isScrolled
                  ? "text-foreground/70 hover:text-foreground hover:bg-muted"
                  : "text-white/75 hover:text-white"
              }`}
            >
              {link.label}
            </button>
          ))}
          <Button
            onClick={() => scrollTo("#contacto")}
            size="sm"
            className="ml-4 rounded-full px-6 h-9 text-[13px] font-semibold tracking-wide shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            Contáctanos
          </Button>
        </nav>

        <button
          className="lg:hidden relative z-10 p-2 -mr-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Menú"
        >
          {isMobileMenuOpen ? (
            <X className={`h-5 w-5 ${isScrolled ? "text-foreground" : "text-white"}`} />
          ) : (
            <Menu className={`h-5 w-5 ${isScrolled ? "text-foreground" : "text-white"}`} />
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      <div
        className={`lg:hidden fixed inset-0 bg-white z-40 transition-all duration-300 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center justify-center h-full gap-6">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => scrollTo(link.href)}
              className="text-foreground text-2xl font-medium hover:text-primary transition-colors"
            >
              {link.label}
            </button>
          ))}
          <Button
            onClick={() => scrollTo("#contacto")}
            size="lg"
            className="rounded-full px-10 mt-4"
          >
            Contáctanos
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
