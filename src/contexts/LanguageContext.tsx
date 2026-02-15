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
import eu from "@/locales/eu.json";

export type Language = "es" | "ca" | "en" | "eu";

const translations: Record<Language, Record<string, unknown>> = {
  es: es as Record<string, unknown>,
  ca: ca as Record<string, unknown>,
  en: en as Record<string, unknown>,
  eu: eu as Record<string, unknown>,
};

const STORAGE_KEY = "inorme-lang";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tArray: (key: string) => string[];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "es" || stored === "ca" || stored === "en" || stored === "eu")) {
        return stored as Language;
      }
    } catch {
      // ignore
    }
    return "es";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const value = translations[language][key];
      if (typeof value === "string") return value;
      return key;
    },
    [language]
  );

  const tArray = useCallback(
    (key: string): string[] => {
      const value = translations[language][key];
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        return value as string[];
      }
      return [];
    },
    [language]
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
