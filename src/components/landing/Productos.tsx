import { Landmark, Building2, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Productos = () => {
  const { t, tArray } = useLanguage();
  const list0 = tArray("productos_0");
  const list1 = tArray("productos_1");
  const list2 = tArray("productos_2");
  return (
    <section id="productos" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="mb-12">
          <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-3 block">
            {t("productos_label")}
          </span>
          <h2 className="text-3xl lg:text-[2.75rem] font-bold text-foreground leading-tight">
            {t("productos_title_prefix")}{" "}
            <span className="font-serif italic font-normal text-gradient-orange">{t("productos_title")}</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-12">
          {/* Columna 1: Banca y Seguros */}
          <div className="group pl-12 lg:pl-20">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Landmark className="h-5 w-5" />
              </div>
              <h3 className="text-foreground font-semibold text-lg">
                {t("productos_mercado1")}
              </h3>
            </div>
            <ul className="flex flex-col gap-0.5 list-none">
              {list0.map((producto, j) => (
                <li
                  key={j}
                  className="flex items-center gap-2.5 py-1.5 text-muted-foreground text-[15px] tracking-tight transition-colors hover:text-foreground"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{producto}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 2: Banca Internacional + Empresa y Administración */}
          <div className="flex flex-col gap-10 lg:gap-12">
            <div className="group">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">
                  {t("productos_mercado3")}
                </h3>
              </div>
              <ul className="flex flex-col gap-0.5 list-none">
                {list2.map((producto, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-2.5 py-1.5 text-muted-foreground text-[15px] tracking-tight transition-colors hover:text-foreground"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{producto}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="group">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">
                  {t("productos_mercado2")}
                </h3>
              </div>
              <ul className="flex flex-col gap-0.5 list-none">
                {list1.map((producto, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-2.5 py-1.5 text-muted-foreground text-[15px] tracking-tight transition-colors hover:text-foreground"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{producto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Productos;
