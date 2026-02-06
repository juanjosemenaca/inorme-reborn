import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
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

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="max-w-[720px]">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-white/70 text-xs font-medium tracking-widest uppercase">
              Consultoría IT · Banca & Seguros
            </span>
          </div>

          {/* Heading */}
          <h1 className="animate-fade-up-delay-1 text-[clamp(2.5rem,6vw,4.5rem)] font-bold text-white leading-[1.08] tracking-tight mb-6">
            Transformamos la
            <br />
            <span className="font-serif italic font-normal text-gradient-orange">
              tecnología
            </span>{" "}
            del sector
            <br />
            financiero
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up-delay-2 text-white/55 text-lg sm:text-xl leading-relaxed max-w-[540px] mb-10">
            Más de 20 años impulsando la innovación en banca y seguros.
            Soluciones a medida que generan resultados reales.
          </p>

          {/* CTA */}
          <div className="animate-fade-up-delay-3 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={() => scrollTo("#contacto")}
              className="rounded-full h-13 px-8 text-[15px] font-semibold gap-2 group shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              Empezar un proyecto
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => scrollTo("#servicios")}
              className="rounded-full h-13 px-8 text-[15px] text-white/70 hover:text-white hover:bg-white/10"
            >
              Ver servicios
            </Button>
          </div>
        </div>

        {/* Stats bar at bottom */}
        <div className="mt-20 lg:mt-28 grid grid-cols-3 gap-px rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm max-w-2xl">
          {[
            { number: "+20", text: "Años de experiencia" },
            { number: "+500", text: "Proyectos realizados" },
            { number: "+200", text: "Profesionales IT" },
          ].map((stat, i) => (
            <div key={i} className="px-6 py-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.number}</p>
              <p className="text-white/40 text-xs font-medium tracking-wide">{stat.text}</p>
            </div>
          ))}
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
