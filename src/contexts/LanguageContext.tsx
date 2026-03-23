import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import es from "@/locales/es.json";
import ca from "@/locales/ca.json";
import en from "@/locales/en.json";
import adminEs from "@/locales/admin.es.json";
import adminCa from "@/locales/admin.ca.json";
import adminEn from "@/locales/admin.en.json";
import { getTranslationValue } from "@/lib/i18nResolve";

/** Idiomas de la aplicación: castellano, catalán, inglés */
export type Language = "es" | "ca" | "en";

const baseTranslations: Record<Language, Record<string, unknown>> = {
  es: es as Record<string, unknown>,
  ca: ca as Record<string, unknown>,
  en: en as Record<string, unknown>,
};

const adminByLang = {
  es: adminEs as Record<string, unknown>,
  ca: adminCa as Record<string, unknown>,
  en: adminEn as Record<string, unknown>,
};

function mergeTranslations(lang: Language): Record<string, unknown> {
  return {
    ...baseTranslations[lang],
    admin: adminByLang[lang],
  };
}

const STORAGE_KEY = "inorme-lang";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tArray: (key: string) => string[];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === "es" || value === "ca" || value === "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "eu") return "es";
      if (isLanguage(stored)) return stored;
    } catch {
      // ignore
    }
    return "es";
  });

  const translations = useMemo(() => mergeTranslations(language), [language]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  useEffect(() => {
    const htmlLang = language === "ca" ? "ca" : language === "en" ? "en" : "es";
    document.documentElement.lang = htmlLang;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const value = getTranslationValue(translations, key);
      if (typeof value === "string") return value;
      return key;
    },
    [translations]
  );

  const tArray = useCallback(
    (key: string): string[] => {
      const value = getTranslationValue(translations, key);
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        return value as string[];
      }
      return [];
    },
    [translations]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, tArray }),
    [language, setLanguage, t, tArray]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
