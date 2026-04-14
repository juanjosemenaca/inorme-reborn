/**
 * IP pública aproximada del cliente (útil con Supabase solo desde el navegador).
 * Si falla la petición, devuelve null y el fichaje se guarda igual sin IP.
 */
export async function fetchClientPublicIp(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    window.clearTimeout(t);
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: unknown };
    const ip = typeof data.ip === "string" ? data.ip.trim() : "";
    if (!ip || ip.length > 64) return null;
    return ip;
  } catch {
    return null;
  }
}
