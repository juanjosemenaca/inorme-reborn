import { z } from "zod";

/** Email vacío o formato válido (tras trim). */
export const optionalEmail = z.string().refine(
  (s) => {
    const t = s.trim();
    return t === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  },
  { message: "Email no válido" }
);
