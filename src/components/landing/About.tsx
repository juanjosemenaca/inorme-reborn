import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Target, Lightbulb, Handshake, Award } from "lucide-react";

const stats = [
  { value: "+20", label: "Años de experiencia" },
  { value: "+500", label: "Proyectos realizados" },
  { value: "+200", label: "Profesionales" },
  { value: "+50", label: "Clientes activos" },
];

const values = [
  {
    icon: Target,
    title: "Compromiso",
    description: "Nos involucramos en cada proyecto como si fuera nuestro propio negocio.",
  },
  {
    icon: Lightbulb,
    title: "Innovación",
    description: "Incorporamos las últimas tecnologías y metodologías del mercado.",
  },
  {
    icon: Handshake,
    title: "Confianza",
    description: "Relaciones duraderas basadas en la transparencia y los resultados.",
  },
  {
    icon: Award,
    title: "Excelencia",
    description: "Los más altos estándares de calidad en cada entrega.",
  },
];

const About = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="nosotros" className="py-24 lg:py-32 bg-dark-gradient">
      <div className="container mx-auto px-6" ref={ref}>
        <div
          className={`transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {/* Intro */}
          <div className="max-w-3xl mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8 bg-primary" />
              <span className="text-primary font-medium text-sm tracking-widest uppercase">
                Sobre Nosotros
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Tu socio tecnológico en el{" "}
              <span className="text-gradient font-display italic">sector financiero</span>
            </h2>
            <p className="text-white/70 text-lg leading-relaxed">
              Inorme es una consultora tecnológica especializada en banca y seguros. 
              Desde nuestra fundación, hemos acompañado a las principales entidades 
              financieras en su transformación digital, aportando conocimiento sectorial 
              profundo y capacidad técnica de primer nivel.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="text-center p-6 rounded-2xl bg-white/5 border border-white/10"
              >
                <p className="text-4xl lg:text-5xl font-bold text-primary mb-2">
                  {stat.value}
                </p>
                <p className="text-white/60 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <div key={i} className="p-6">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <value.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
