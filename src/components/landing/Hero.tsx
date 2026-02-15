import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t } = useLanguage();
  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[100vh] flex items-center bg-hero-dark overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Orange gradient blob */}
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[150px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[120px]" />
        {/* Side accent line */}
        <div className="absolute left-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-8 w-full">
        <div className="max-w-[720px] -mt-8">
          {/* Heading */}
          <h1 className="animate-fade-up-delay-1 text-[clamp(2.5rem,6vw,4.5rem)] font-bold text-white leading-[1.08] tracking-tight mb-6">
            {t("hero_title_1")}
            <br />
            <span className="font-serif italic font-normal text-gradient-orange">
              {t("hero_title_2")}
            </span>{" "}
            {t("hero_title_3")}
            <br />
            {t("hero_title_4")}
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up-delay-2 text-white/55 text-lg sm:text-xl leading-relaxed max-w-[540px]">
            {t("hero_subtitle")}
          </p>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => scrollTo("#servicios")}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 hover:text-white/60 transition-colors animate-bounce"
      >
        <ChevronDown className="h-6 w-6" />
      </button>
    </section>
  );
};

export default Hero;
