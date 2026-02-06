import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Building2, Shield, Landmark, CreditCard, PiggyBank, BarChart3 } from "lucide-react";

const sectors = [
  { icon: Landmark, name: "Banca Retail" },
  { icon: Building2, name: "Banca Corporativa" },
  { icon: Shield, name: "Seguros Generales" },
  { icon: CreditCard, name: "Medios de Pago" },
  { icon: PiggyBank, name: "Gestión de Activos" },
  { icon: BarChart3, name: "Mercados Financieros" },
];

const testimonials = [
  {
    quote:
      "Inorme ha sido clave en nuestra transformación digital. Su conocimiento del sector bancario marca la diferencia.",
    author: "Director de Tecnología",
    company: "Entidad Bancaria Nacional",
  },
  {
    quote:
      "Profesionalismo, calidad y compromiso. Llevamos más de 10 años confiando en Inorme para nuestros proyectos críticos.",
    author: "CIO",
    company: "Compañía Aseguradora Líder",
  },
];

const Clients = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="clientes" className="py-24 lg:py-32 bg-secondary">
      <div className="container mx-auto px-6" ref={ref}>
        <div
          className={`transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-8 bg-primary" />
              <span className="text-primary font-medium text-sm tracking-widest uppercase">
                Clientes
              </span>
              <div className="h-px w-8 bg-primary" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Sectores en los que operamos
            </h2>
            <p className="text-muted-foreground text-lg">
              Trabajamos con las principales entidades del sector financiero español 
              e internacional.
            </p>
          </div>

          {/* Sectors grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-20">
            {sectors.map((sector, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 p-6 bg-card rounded-2xl border border-border hover:border-primary/20 hover:shadow-md transition-all duration-300"
              >
                <div className="p-3 rounded-xl bg-primary/10">
                  <sector.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-foreground text-sm font-medium text-center">
                  {sector.name}
                </span>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-card rounded-2xl p-8 border border-border relative"
              >
                <div className="text-primary text-5xl font-display leading-none mb-4">"</div>
                <p className="text-foreground/80 leading-relaxed mb-6 italic">
                  {t.quote}
                </p>
                <div>
                  <p className="text-foreground font-semibold text-sm">{t.author}</p>
                  <p className="text-muted-foreground text-sm">{t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Clients;
