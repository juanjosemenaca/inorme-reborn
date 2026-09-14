import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Desplaza a una sección de la landing. Desde otra ruta (páginas legales, etc.)
 * navega primero al inicio con el ancla para que la sección exista.
 */
export function useScrollToSection() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (href: string) => {
      if (pathname !== "/") {
        navigate({ pathname: "/", hash: href });
        return;
      }
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    },
    [navigate, pathname]
  );
}
