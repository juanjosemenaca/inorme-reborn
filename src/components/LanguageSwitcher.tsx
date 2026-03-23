import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const LABELS: Record<Language, string> = {
  es: "ES",
  ca: "CA",
  en: "EN",
};

const LANGUAGES: Language[] = ["es", "ca", "en"];

type Props = {
  /** Estilo claro sobre fondo oscuro (hero) */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * Selector ES / CA / EN compartido entre la web pública y el backoffice.
 */
export function LanguageSwitcher({ variant = "dark", className }: Props) {
  const { language, setLanguage } = useLanguage();

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          className={cn(
            "text-[10px] font-medium uppercase transition-colors rounded px-1 py-0.5",
            language === lang
              ? "text-primary opacity-100"
              : variant === "light"
                ? "text-white/50 hover:text-white"
                : "text-foreground/50 hover:text-foreground"
          )}
          aria-pressed={language === lang}
          aria-label={lang === "es" ? "Castellano" : lang === "ca" ? "Català" : "English"}
        >
          {LABELS[lang]}
        </button>
      ))}
    </span>
  );
}
