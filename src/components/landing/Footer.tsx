import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { publicAssetUrl } from "@/lib/publicAssetUrl";

const footerLinkKeys = [
  { key: "nav_company", href: "#historia" },
  { key: "nav_services", href: "#servicios" },
  { key: "nav_products", href: "#productos" },
  { key: "nav_about", href: "#nosotros" },
  { key: "nav_clients", href: "#clientes" },
  { key: "nav_contact", href: "#contacto" },
];

const Footer = () => {
  const { t } = useLanguage();
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
            <a href="#" className="inline-block">
              <img
                src={publicAssetUrl("logo-inorme.png")}
                alt="Inorme S.L. - Informática, organización y métodos"
                className="h-10 w-auto max-h-10 object-contain object-left [max-width:min(280px,85vw)]"
                decoding="async"
              />
            </a>
            <p className="text-white/40 mt-4 text-sm leading-relaxed max-w-sm">
              {t("footer_tagline")}
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-3">
            <h4 className="text-white/60 font-semibold mb-5 text-xs uppercase tracking-wider">
              {t("footer_nav")}
            </h4>
            <ul className="space-y-3">
              {footerLinkKeys.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => scrollTo(link.href)}
                    className="text-white/40 text-sm hover:text-primary transition-colors"
                  >
                    {t(link.key)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-white/60 font-semibold mb-5 text-xs uppercase tracking-wider">
              {t("footer_contact")}
            </h4>
            <div className="space-y-3 text-sm text-white/40">
              <p>
                <a href="mailto:admon@inorme.com" className="hover:text-primary transition-colors">
                  admon@inorme.com
                </a>
              </p>
              <p>
                {[
                  "contact_location_madrid",
                  "contact_location_barcelona",
                  "contact_location_sevilla",
                  "contact_location_pais_vasco",
                ].map((key) => t(key)).join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Inorme. {t("footer_rights")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-white/25">
            <LanguageSwitcher variant="light" />
            <span className="text-white/10">|</span>
            <button className="hover:text-white/50 transition-colors">
              {t("footer_legal")}
            </button>
            <button className="hover:text-white/50 transition-colors">
              {t("footer_privacy")}
            </button>
            <button className="hover:text-white/50 transition-colors">
              {t("footer_cookies")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
