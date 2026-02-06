import { Linkedin } from "lucide-react";

const footerLinks = [
  { label: "Servicios", href: "#servicios" },
  { label: "Sobre Nosotros", href: "#nosotros" },
  { label: "Clientes", href: "#clientes" },
  { label: "Contacto", href: "#contacto" },
];

const Footer = () => {
  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-section-dark relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-5">
            <span className="text-[22px] font-bold tracking-tight">
              <span className="text-primary">in</span>
              <span className="text-white">orme</span>
            </span>
            <p className="text-white/40 mt-4 text-sm leading-relaxed max-w-sm">
              Consultora tecnológica especializada en banca y seguros.
              Transformamos la tecnología del sector financiero desde hace más de 20 años.
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-3">
            <h4 className="text-white/60 font-semibold mb-5 text-xs uppercase tracking-wider">
              Navegación
            </h4>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => scrollTo(link.href)}
                    className="text-white/40 text-sm hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-white/60 font-semibold mb-5 text-xs uppercase tracking-wider">
              Contacto
            </h4>
            <div className="space-y-3 text-sm text-white/40">
              <p>
                <a href="mailto:info@inorme.com" className="hover:text-primary transition-colors">
                  info@inorme.com
                </a>
              </p>
              <p>
                <a href="tel:+34912345678" className="hover:text-primary transition-colors">
                  +34 91 234 56 78
                </a>
              </p>
              <p>Madrid, España</p>
            </div>
            <div className="mt-6">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-primary transition-all"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Inorme. Todos los derechos reservados.
          </p>
          <div className="flex gap-6 text-xs text-white/25">
            <button className="hover:text-white/50 transition-colors">
              Aviso Legal
            </button>
            <button className="hover:text-white/50 transition-colors">
              Política de Privacidad
            </button>
            <button className="hover:text-white/50 transition-colors">
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
