import { Building2, Shield, Landmark, CreditCard, PiggyBank, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const sectorKeys = [
  { icon: Landmark, key: "sector_banca_retail" },
  { icon: Building2, key: "sector_banca_corp" },
  { icon: Shield, key: "sector_seguros" },
  { icon: CreditCard, key: "sector_pagos" },
  { icon: PiggyBank, key: "sector_activos" },
  { icon: BarChart3, key: "sector_mercados" },
];

const testimonialKeys = [
  { quoteKey: "testimonial1_quote", authorKey: "testimonial1_author", companyKey: "testimonial1_company" },
  { quoteKey: "testimonial2_quote", authorKey: "testimonial2_author", companyKey: "testimonial2_company" },
];

const Clients = () => {
  const { t } = useLanguage();
  return (
    <section id="clientes" className="py-24 lg:py-32 bg-background relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            {t("clients_label")}
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight">
            {t("clients_title")}{" "}
            <span className="font-serif italic font-normal text-gradient-orange">{t("clients_impact")}</span>
          </h2>
        </div>

        {/* Sectors */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-20 max-w-4xl mx-auto">
          {sectorKeys.map((sector, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2.5 p-5 bg-muted/50 rounded-2xl border border-border/50 hover:border-primary/20 hover:shadow-sm transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <sector.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-foreground/80 text-xs font-medium text-center leading-tight">
                {t(sector.key)}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonialKeys.map((test, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-8 lg:p-10 border border-border/50 relative"
            >
              <div className="text-primary/20 text-[72px] font-serif leading-none absolute top-4 left-6">
                "
              </div>
              <div className="relative pt-8">
                <p className="text-foreground/75 leading-relaxed mb-8 text-[15px]">
                  {t(test.quoteKey)}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">
                      {t(test.authorKey)[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-sm">{t(test.authorKey)}</p>
                    <p className="text-muted-foreground text-xs">{t(test.companyKey)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Clients;
