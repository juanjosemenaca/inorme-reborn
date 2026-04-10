import type { BackofficeSession } from "@/types/backoffice";

type Props = { user: BackofficeSession };

function resolveNavLabel(user: BackofficeSession): string {
  const raw = user.name?.trim() ?? "";
  const looksLikeRoleToken = /^(admin|administrator|worker)$/i.test(raw);
  if (raw.length > 0 && !looksLikeRoleToken) return raw;

  const email = user.email?.trim() ?? "";
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  /** Correo tipo admin@…: mostrar dominio para no confundir con la etiqueta «ADMIN DATA». */
  if (/^(admin|administrator|root|postmaster)$/i.test(local) && domain) {
    return domain;
  }
  return email;
}

/**
 * Título del bloque personal en el menú admin: «{nombre o correo} DATA» en un solo texto
 * (evita que el truncado deje solo «admin» + «DATA» leyéndose como «ADMIN DATA»).
 */
export function AdminDataNavHeading({ user }: Props) {
  const line = resolveNavLabel(user);
  const full = `${line} DATA`;

  return (
    <span
      className="min-w-0 truncate font-medium normal-case"
      title={full}
      data-admin-nav-heading="1"
    >
      {full}
    </span>
  );
}
