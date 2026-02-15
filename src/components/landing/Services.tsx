import { useLanguage } from "@/contexts/LanguageContext";

const Services = () => {
  const { t, tArray } = useLanguage();
  const services = tArray("services");
  return (
    <section id="servicios" className="py-24 lg:py-32 bg-section-dark relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mb-8">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            {t("services_label")}
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-white leading-tight">
            {t("services_title")}{" "}
            <span className="font-serif italic font-normal text-gradient-orange">{t("services_specialized")}</span>
          </h2>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-2 list-none max-w-4xl">
          {services.map((service, i) => (
            <li
              key={i}
              className="flex items-center gap-3 py-2 text-white/55 text-[15px] tracking-tight hover:text-white transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span>{service}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Services;
