import type { BillingInvoiceRecord } from "@/types/billing";

/**
 * Texto RGPD al pie del PDF solo para INORME (Informática Organización y Métodos S.L.).
 * Otros emisores: texto opcional en `issuerPrivacyFooter` / `privacy_footer_text` del emisor.
 */
export const BILLING_PDF_PRIVACY_NOTICE_INORME_ES =
  "De acuerdo con lo dispuesto en el Reglamento General (UE) 2016/679 de Protección de Datos y en la Ley Orgánica 3/2018, de 5 de diciembre, de " +
  "Protección de Datos Personales y garantía de los derechos digitales, le informamos que los datos facilitados a lo largo de la prestación del servicio se " +
  "incorporarán a las Actividades de Tratamiento titularidad de INORME S.L. con CIF número B-60.340.601 y domicilio social en Calle Entenza, Nº218-224, Local 2, " +
  "08.029, Les Corts (Barcelona). La finalidad de dicho tratamiento es prestarle un óptimo servicio como cliente y el mantenimiento de la relación comercial en su caso " +
  "establecida. " +
  "Puede ejercitar los derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad en cualquier momento, mediante escrito, acompañado de " +
  "copia de documento oficial que le identifique dirigido a la dirección Calle Entenza, Nº218-224, Local 2, 08.029, Les Corts (Barcelona), o al correo electrónico " +
  "juanjosemena@informe.com " +
  "Puede consultar información adicional y detallada sobre Protección de Datos en nuestra Política de Privacidad del sitio web www.inorme.com";

/** CIF de Informática Organización y Métodos S.L. (variantes B-60.340.601, espacios, etc.). */
const INORME_IOM_TAX_ID_NORMALIZED = "B60340601";

export function normalizeIssuerTaxIdForCompare(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s.-]/g, "").toUpperCase();
}

export function isInormeInformaticaOrganizacionIssuer(issuerTaxId: string | null | undefined): boolean {
  const n = normalizeIssuerTaxIdForCompare(issuerTaxId);
  if (!n) return false;
  return n === INORME_IOM_TAX_ID_NORMALIZED;
}

/**
 * Texto a imprimir al pie del PDF: bloque fijo INORME por CIF, u otro texto si está definido en el snapshot (otros emisores).
 */
export function resolvePdfPrivacyFooterText(
  invoice: Pick<BillingInvoiceRecord, "issuerTaxId" | "issuerPrivacyFooter">
): string | null {
  if (isInormeInformaticaOrganizacionIssuer(invoice.issuerTaxId)) {
    return BILLING_PDF_PRIVACY_NOTICE_INORME_ES;
  }
  const custom = invoice.issuerPrivacyFooter?.trim();
  return custom || null;
}
