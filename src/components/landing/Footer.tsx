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
    <footer className="bg-dark-gradient border-t border-white/10">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Logo & description */}
          <div className="md:col-span-1">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-primary">in</span>
              <span className="text-white">orme</span>
            </span>
            <p className="text-white/50 mt-4 text-sm leading-relaxed max-w-xs">
              Consultora tecnológica especializada en banca y seguros. Transformamos
              la tecnología del sector financiero.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Enlaces
            </h4>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => scrollTo(link.href)}
                    className="text-white/50 text-sm hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact info */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              Contacto
            </h4>
            <div className="space-y-3 text-sm text-white/50">
              <p>info@inorme.com</p>
              <p>+34 91 234 56 78</p>
              <p>Madrid, España</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} Inorme. Todos los derechos reservados.
          </p>
          <div className="flex gap-6 text-sm text-white/30">
            <button className="hover:text-white/60 transition-colors">
              Aviso Legal
            </button>
            <button className="hover:text-white/60 transition-colors">
              Política de Privacidad
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
