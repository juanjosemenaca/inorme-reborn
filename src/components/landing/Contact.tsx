import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      toast({
        title: "Mensaje enviado",
        description: "Nos pondremos en contacto contigo lo antes posible.",
      });
      setIsSubmitting(false);
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <section id="contacto" className="py-24 lg:py-32 bg-background relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left side */}
          <div>
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
              Contacto
            </span>
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight mb-6">
              Hablemos de tu{" "}
              <span className="font-serif italic font-normal text-gradient-orange">
                próximo proyecto
              </span>
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-12 max-w-md">
              Cuéntanos qué necesitas y te ayudaremos a encontrar la solución tecnológica ideal para tu entidad.
            </p>

            <div className="space-y-6">
              {[
                { icon: Mail, label: "Email", value: "info@inorme.com", href: "mailto:info@inorme.com" },
                { icon: Phone, label: "Teléfono", value: "+34 91 234 56 78", href: "tel:+34912345678" },
                { icon: MapPin, label: "Ubicación", value: "Madrid, España" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-foreground font-medium text-sm hover:text-primary transition-colors"
                      >
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-foreground font-medium text-sm">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-muted/40 rounded-3xl p-8 lg:p-10 border border-border/50">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Nombre *
                  </label>
                  <Input
                    required
                    placeholder="Tu nombre"
                    className="rounded-xl h-11 bg-background border-border/60 focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Empresa
                  </label>
                  <Input
                    placeholder="Tu empresa"
                    className="rounded-xl h-11 bg-background border-border/60 focus:border-primary/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  className="rounded-xl h-11 bg-background border-border/60 focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  ¿En qué podemos ayudarte? *
                </label>
                <Textarea
                  required
                  placeholder="Cuéntanos sobre tu proyecto o necesidad..."
                  className="rounded-xl min-h-[130px] bg-background border-border/60 focus:border-primary/40 resize-none"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="rounded-full h-12 px-8 text-sm font-semibold gap-2 group w-full sm:w-auto shadow-md shadow-primary/20"
              >
                {isSubmitting ? "Enviando..." : "Enviar mensaje"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
