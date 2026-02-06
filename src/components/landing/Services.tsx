import { Monitor, Code2, FolderKanban, Users } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const services = [
  {
    icon: Monitor,
    title: "Consultoría Tecnológica",
    description:
      "Asesoramiento estratégico para la transformación digital de entidades bancarias y aseguradoras.",
    tags: ["Estrategia Digital", "Arquitectura"],
  },
  {
    icon: Code2,
    title: "Desarrollo de Software",
    description:
      "Desarrollo a medida de aplicaciones y plataformas para el sector financiero con tecnologías de última generación.",
    tags: ["Full Stack", "Microservicios"],
  },
  {
    icon: FolderKanban,
    title: "Gestión de Proyectos",
    description:
      "Dirección y coordinación de proyectos IT complejos con metodologías adaptadas al sector regulado.",
    tags: ["Agile", "PMO"],
  },
  {
    icon: Users,
    title: "Outsourcing IT",
    description:
      "Profesionales altamente cualificados en tecnologías específicas del sector bancario y asegurador.",
    tags: ["Equipos Dedicados", "Staffing"],
  },
];

const Services = () => {
  const ref = useScrollReveal();

  return (
    <section id="servicios" className="py-24 lg:py-32 bg-background relative">
      {/* Subtle top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8" ref={ref}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
          <div className="max-w-xl">
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
              Servicios
            </span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight">
              Soluciones IT{" "}
              <span className="font-serif italic font-normal text-gradient-orange">especializadas</span>
            </h2>
          </div>
          <p className="text-muted-foreground text-base lg:text-lg max-w-md lg:text-right leading-relaxed">
            Un conjunto integral de servicios tecnológicos diseñados para el sector financiero.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((service, i) => (
            <div
              key={i}
              className="group relative bg-card rounded-2xl p-8 lg:p-10 border border-border/60 hover:border-primary/25 transition-all duration-500 hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)]"
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
                  <service.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6 flex-1">
                  {service.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
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
