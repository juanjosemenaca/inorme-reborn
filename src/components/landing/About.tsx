import { Target, Lightbulb, Handshake, Award } from "lucide-react";

const stats = [
  { value: "+20", label: "Años", sublabel: "de experiencia" },
  { value: "+500", label: "Proyectos", sublabel: "realizados" },
  { value: "+200", label: "Profesionales", sublabel: "IT en activo" },
  { value: "+50", label: "Clientes", sublabel: "activos" },
];

const values = [
  {
    icon: Target,
    title: "Compromiso",
    description: "Nos involucramos en cada proyecto como si fuera propio.",
  },
  {
    icon: Lightbulb,
    title: "Innovación",
    description: "Las últimas tecnologías y metodologías del mercado.",
  },
  {
    icon: Handshake,
    title: "Confianza",
    description: "Relaciones duraderas basadas en transparencia y resultados.",
  },
  {
    icon: Award,
    title: "Excelencia",
    description: "Los más altos estándares de calidad en cada entrega.",
  },
];

const About = () => {
  return (
    <section id="nosotros" className="py-24 lg:py-32 bg-section-dark relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[150px]" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Header + description */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-20">
          <div>
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
              Sobre Nosotros
            </span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-white leading-tight">
              Tu socio tecnológico en el{" "}
              <span className="font-serif italic font-normal text-gradient-orange">
                sector financiero
              </span>
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-white/55 text-base lg:text-lg leading-relaxed">
              Inorme es una consultora tecnológica especializada en banca y seguros.
              Desde nuestra fundación, hemos acompañado a las principales entidades
              financieras en su transformación digital, aportando conocimiento sectorial
              profundo y capacidad técnica de primer nivel.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6 lg:p-8 text-center hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-4xl lg:text-5xl font-bold text-primary mb-1">
                {stat.value}
              </p>
              <p className="text-white/80 text-sm font-semibold">{stat.label}</p>
              <p className="text-white/40 text-xs">{stat.sublabel}</p>
            </div>
          ))}
        </div>

        {/* Values */}
        <div>
          <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-8">
            Nuestros valores
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <div key={i} className="group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <value.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
