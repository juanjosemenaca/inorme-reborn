import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Building2, Shield, Landmark, CreditCard, PiggyBank, BarChart3 } from "lucide-react";

const sectors = [
  { icon: Landmark, name: "Banca Retail" },
  { icon: Building2, name: "Banca Corporativa" },
  { icon: Shield, name: "Seguros" },
  { icon: CreditCard, name: "Medios de Pago" },
  { icon: PiggyBank, name: "Gestión de Activos" },
  { icon: BarChart3, name: "Mercados" },
];

const testimonials = [
  {
    quote:
      "Inorme ha sido clave en nuestra transformación digital. Su conocimiento del sector bancario marca la diferencia frente a otros proveedores.",
    author: "Director de Tecnología",
    company: "Entidad Bancaria Nacional",
  },
  {
    quote:
      "Profesionalismo, calidad y compromiso. Llevamos más de 10 años confiando en Inorme para nuestros proyectos más críticos.",
    author: "CIO",
    company: "Compañía Aseguradora Líder",
  },
];

const Clients = () => {
  const ref = useScrollReveal();

  return (
    <section id="clientes" className="py-24 lg:py-32 bg-muted/50 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8" ref={ref}>
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            Clientes & Sectores
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight">
            Donde generamos{" "}
            <span className="font-serif italic font-normal text-gradient-orange">impacto</span>
          </h2>
        </div>

        {/* Sectors */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-20 max-w-4xl mx-auto">
          {sectors.map((sector, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2.5 p-5 bg-background rounded-2xl border border-border/50 hover:border-primary/20 hover:shadow-sm transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                <sector.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-foreground/80 text-xs font-medium text-center leading-tight">
                {sector.name}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="bg-background rounded-2xl p-8 lg:p-10 border border-border/50 relative"
            >
              <div className="text-primary/20 text-[72px] font-serif leading-none absolute top-4 left-6">
                "
              </div>
              <div className="relative pt-8">
                <p className="text-foreground/75 leading-relaxed mb-8 text-[15px]">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">
                      {t.author[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-sm">{t.author}</p>
                    <p className="text-muted-foreground text-xs">{t.company}</p>
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
