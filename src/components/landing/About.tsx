import { Target, Lightbulb, Handshake, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const statsKeys = [
  { value: "+30", labelKey: "about_stat_years", subKey: "about_stat_years_sub" },
  { value: "+500", labelKey: "about_stat_projects", subKey: "about_stat_projects_sub" },
  { value: "+100", labelKey: "about_stat_professionals", subKey: "about_stat_professionals_sub" },
];

const valueKeys = [
  { icon: Target, titleKey: "about_compromiso", descKey: "about_compromiso_desc" },
  { icon: Lightbulb, titleKey: "about_innovacion", descKey: "about_innovacion_desc" },
  { icon: Handshake, titleKey: "about_confianza", descKey: "about_confianza_desc" },
  { icon: Award, titleKey: "about_excelencia", descKey: "about_excelencia_desc" },
];

const About = () => {
  const { t } = useLanguage();
  return (
    <section id="nosotros" className="py-24 lg:py-32 bg-section-dark relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[150px]" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="mb-20">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            {t("about_label")}
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-white leading-tight">
            {t("about_title")}{" "}
            <span className="font-serif italic font-normal text-gradient-orange">
              {t("about_sector")}
            </span>
          </h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-20 max-w-3xl mx-auto">
          {statsKeys.map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6 lg:p-8 text-center hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-4xl lg:text-5xl font-bold text-primary mb-1">
                {stat.value}
              </p>
              <p className="text-white/80 font-semibold text-sm">{t(stat.labelKey)}</p>
              <p className="text-white/40 text-xs">{t(stat.subKey)}</p>
            </div>
          ))}
        </div>

        {/* Values */}
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-6">
            {t("about_values")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {valueKeys.map((v, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4 text-center hover:bg-white/[0.06] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <v.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-white/80 font-semibold text-sm uppercase tracking-wide mb-1">{t(v.titleKey)}</p>
                <p className="text-white/40 text-[11px] leading-relaxed">{t(v.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
