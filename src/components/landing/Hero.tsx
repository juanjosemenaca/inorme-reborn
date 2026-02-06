import { motion } from "framer-motion";
import { ArrowRight, Shield, Cpu, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  const scrollToContact = () => {
    document.querySelector("#contacto")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center bg-hero-gradient overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Orange accent glow */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />

      <div className="container mx-auto px-6 pt-24 pb-16 relative z-10">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px w-12 bg-primary" />
              <span className="text-primary font-medium text-sm tracking-widest uppercase">
                Consultoría IT
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Transformamos la{" "}
              <span className="text-gradient font-display italic">tecnología</span>
              <br />
              del sector financiero
            </h1>

            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mb-10 leading-relaxed">
              Más de 20 años impulsando la innovación tecnológica en banca y seguros. 
              Soluciones a medida que generan resultados reales.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 mb-16"
          >
            <Button
              size="lg"
              onClick={scrollToContact}
              className="rounded-full px-8 text-base h-14 gap-2 group"
            >
              Contáctanos
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                document
                  .querySelector("#servicios")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-full px-8 text-base h-14 border-white/20 text-white hover:bg-white/10 hover:text-white"
            >
              Conoce nuestros servicios
            </Button>
          </motion.div>

          {/* Stats cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl"
          >
            {[
              { icon: Shield, label: "Banca & Seguros", desc: "Especialización sectorial" },
              { icon: Cpu, label: "+500 Proyectos", desc: "Ejecutados con éxito" },
              { icon: TrendingUp, label: "+20 Años", desc: "De experiencia" },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5"
              >
                <div className="p-3 rounded-xl bg-primary/15">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{stat.label}</p>
                  <p className="text-white/50 text-xs">{stat.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
