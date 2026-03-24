import { useState, useEffect } from "react";

/**
 * `matchMedia` + `resize` para que al cambiar tamaño de ventana o orientación
 * el layout del header coincida con el ancho real (Safari, ventana encajada, etc.).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const sync = () => setMatches(window.matchMedia(query).matches);
    sync();
    const media = window.matchMedia(query);
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [query]);

  return matches;
}
