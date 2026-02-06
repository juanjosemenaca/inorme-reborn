import { Monitor, Code, FolderKanban, Users } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const services = [
  {
    icon: Monitor,
    title: "Consultoría Tecnológica",
    description:
      "Asesoramiento estratégico para la transformación digital de entidades bancarias y aseguradoras. Evaluamos, diseñamos e implementamos soluciones tecnológicas adaptadas a su negocio.",
  },
  {
    icon: Code,
    title: "Desarrollo de Software",
    description:
      "Desarrollo a medida de aplicaciones y plataformas para el sector financiero. Tecnologías de última generación con las mejores prácticas de la industria.",
  },
  {
    icon: FolderKanban,
    title: "Gestión de Proyectos",
    description:
      "Dirección y coordinación de proyectos IT complejos. Metodologías ágiles y waterfall adaptadas a los requisitos regulatorios del sector.",
  },
  {
    icon: Users,
    title: "Outsourcing IT",
    description:
      "Provisión de profesionales altamente cualificados en tecnologías específicas del sector bancario y asegurador. Equipos dedicados y flexibles.",
  },
];

const Services = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="servicios" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6" ref={ref}>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-8 bg-primary" />
            <span className="text-primary font-medium text-sm tracking-widest uppercase">
              Servicios
            </span>
            <div className="h-px w-8 bg-primary" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Soluciones IT especializadas
          </h2>
          <p className="text-muted-foreground text-lg">
            Ofrecemos un conjunto integral de servicios tecnológicos diseñados
            específicamente para el sector financiero.
          </p>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {services.map((service, i) => (
            <div
              key={i}
              className="group relative bg-card border border-border rounded-2xl p-8 hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-start gap-5">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
