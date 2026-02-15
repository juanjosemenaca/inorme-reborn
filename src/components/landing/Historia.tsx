import { useLanguage } from "@/contexts/LanguageContext";

const Historia = () => {
  const { t } = useLanguage();
  return (
    <section id="historia" className="pt-12 pb-24 lg:pt-16 lg:pb-32 bg-background relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            {t("historia_label")}
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight mb-6">
            {t("historia_title_prefix")}{" "}
            <span className="font-serif italic font-normal text-gradient-orange">{t("historia_title")}</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            {t("historia_inorme")}
          </p>
        </div>

        <div>
          <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
            {t("historia_p1")}
          </p>
          <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-6">
            {t("historia_p2")}
          </p>
          <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-8">
            {t("historia_p3")}
          </p>
          <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-8">
            {t("historia_p4")}
          </p>

          <ul className="space-y-3 text-muted-foreground text-base leading-relaxed list-none">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
              <span>{t("historia_li1")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
              <span>{t("historia_li2")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
              <span>{t("historia_li3")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
              <span>{t("historia_li4")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
              <span>{t("historia_li5")}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Historia;
