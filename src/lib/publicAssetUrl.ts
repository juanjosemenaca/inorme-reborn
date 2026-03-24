/** URL a un fichero de `public/` (respeta `base` de Vite en deploy). */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const p = path.startsWith("/") ? path.slice(1) : path;
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${p}`;
}
