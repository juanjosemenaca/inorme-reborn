import { fetchBillingIssuerLogoDataUrl } from "@/api/billingApi";
import { resolvePdfPrivacyFooterText } from "@/lib/billingPrivacyFooter";
import { drawBillingRichLinePdf } from "@/lib/billingRichTextPdf";
import type { BillingInvoiceLineInput, BillingInvoiceLineRecord, BillingInvoiceRecord } from "@/types/billing";

/**
 * Dibuja el aviso legal al pie de la última hoja. Si el cuerpo ya ocupa hasta abajo, añade una hoja y coloca el texto al pie de esa hoja.
 */
function drawBillingPdfPrivacyFooter(
  doc: import("jspdf").jsPDF,
  contentBottomY: number,
  pageW: number,
  margin: number,
  footerText: string
): void {
  const pageH = 297;
  const fs = 5;
  const lineH = 1.9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fs);
  const maxW = pageW - 2 * margin;
  const lines = doc.splitTextToSize(footerText, maxW) as string[];
  const blockH = lines.length * lineH + 1;

  doc.setPage(doc.getNumberOfPages());

  let footerTop = pageH - margin - blockH;
  if (footerTop < contentBottomY) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
    footerTop = pageH - margin - blockH;
  }

  doc.setTextColor(72, 72, 72);
  let ty = footerTop;
  for (const line of lines) {
    doc.text(line, margin, ty);
    ty += lineH;
  }
  doc.setTextColor(0, 0, 0);
}

function money(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Fecha YYYY-MM-DD o ISO → dd/mm/aaaa (sin desfase por zona). */
function formatInvoiceDateEs(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return s;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const PDF_PAGE_H_MM = 297;

/**
 * Estima altura vertical (mm) de una fila de concepto antes de dibujarla (paginación).
 * Conservador: usa splitTextToSize como aproximación al ajuste de línea del PDF.
 */
function estimateInvoiceLineRowHeightMm(
  doc: import("jspdf").jsPDF,
  line: BillingInvoiceLineRecord,
  descMaxMm: number,
  gapAfterLine: number
): number {
  if (line.lineType === "BLOCK_TITLE") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const raw = (line.description || "—").trim() || "—";
    const lines = doc.splitTextToSize(raw.toUpperCase(), descMaxMm) as string[];
    return lines.length * 6.5 + gapAfterLine + 1.2;
  }
  if (line.lineType === "BLOCK_SUBTITLE") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(line.description || "—", descMaxMm - 2) as string[];
    return lines.length * 5.7 + gapAfterLine + 0.6;
  }
  if (line.lineType === "CONCEPT") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(line.description || "—", descMaxMm - 4) as string[];
    return lines.length * 5.7 + gapAfterLine + 0.6;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const lines = doc.splitTextToSize(line.description || "—", descMaxMm) as string[];
  const descH = Math.max(lines.length * 5.7, 6);
  return descH + gapAfterLine;
}

/** Misma lógica de importes que en BD (líneas BILLABLE). */
function derivedAmountsForLine(line: BillingInvoiceLineInput): Pick<
  BillingInvoiceLineRecord,
  "taxableBase" | "vatAmount" | "irpfAmount" | "lineTotal"
> {
  if (line.lineType !== "BILLABLE") {
    return { taxableBase: 0, vatAmount: 0, irpfAmount: 0, lineTotal: 0 };
  }
  const taxableBase = round2(line.quantity * line.unitPrice);
  const vatAmount = round2((taxableBase * line.vatRate) / 100);
  const irpfAmount = round2((taxableBase * line.irpfRate) / 100);
  const lineTotal = round2(taxableBase + vatAmount - irpfAmount);
  return { taxableBase, vatAmount, irpfAmount, lineTotal };
}

/** Totales facturables desde el borrador en pantalla (misma regla que BD / PDF proforma). */
export function computeDraftBillableTotals(draftLines: BillingInvoiceLineInput[]): {
  taxableBaseTotal: number;
  vatTotal: number;
  irpfTotal: number;
  grandTotal: number;
} {
  let taxableBaseTotal = 0;
  let vatTotal = 0;
  let irpfTotal = 0;
  for (const line of draftLines) {
    if (line.lineType !== "BILLABLE") continue;
    const d = derivedAmountsForLine(line);
    taxableBaseTotal += d.taxableBase;
    vatTotal += d.vatAmount;
    irpfTotal += d.irpfAmount;
  }
  taxableBaseTotal = round2(taxableBaseTotal);
  vatTotal = round2(vatTotal);
  irpfTotal = round2(irpfTotal);
  const grandTotal = round2(taxableBaseTotal + vatTotal - irpfTotal);
  return { taxableBaseTotal, vatTotal, irpfTotal, grandTotal };
}

/**
 * Vista previa no fiscal: totales recalculados desde las líneas del formulario,
 * sin hash ni QR (se añaden al emitir).
 */
export function buildProformaInvoiceSnapshot(
  base: BillingInvoiceRecord,
  draftLines: BillingInvoiceLineInput[]
): BillingInvoiceRecord {
  const lines: BillingInvoiceLineRecord[] = draftLines.map((l, idx) => {
    const d = derivedAmountsForLine(l);
    return {
      id: `proforma-line-${idx}`,
      invoiceId: base.id,
      lineOrder: idx + 1,
      lineType: l.lineType,
      description: l.description,
      quantity: l.lineType === "BILLABLE" ? l.quantity : 0,
      unitPrice: l.lineType === "BILLABLE" ? l.unitPrice : 0,
      vatRate: l.vatRate,
      irpfRate: l.lineType === "BILLABLE" ? l.irpfRate : 0,
      ...d,
    };
  });

  const { taxableBaseTotal, vatTotal, irpfTotal, grandTotal } = computeDraftBillableTotals(draftLines);

  /** Si la cabecera trae fecha (p. ej. histórica en borrador), úsala; si no, hoy. */
  const previewIssueDate = base.issueDate?.trim() || new Date().toISOString().slice(0, 10);

  return {
    ...base,
    lines,
    taxableBaseTotal,
    vatTotal,
    irpfTotal,
    grandTotal,
    issueDate: previewIssueDate,
    invoiceNumber: null,
    fiscalYear: null,
    recordHash: null,
    previousHash: null,
    verifactuQrPayload: null,
  };
}

export type BillingInvoicePdfVariant = "issued" | "proforma";

async function buildQrDataUrl(invoice: BillingInvoiceRecord): Promise<string> {
  const { toDataURL } = await import("qrcode");
  const payload =
    invoice.verifactuQrPayload ??
    ({
      schema: "ES_VERIFACTU_PREP",
      issuerTaxId: invoice.issuerTaxId,
      invoiceNumber: invoice.invoiceNumber,
      fiscalYear: invoice.fiscalYear,
      issueDate: invoice.issueDate,
      amountTotal: invoice.grandTotal,
    } as Record<string, unknown>);
  return toDataURL(JSON.stringify(payload), { margin: 1, width: 180 });
}

function getImagePixelSizeFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("logo decode failed"));
    img.src = dataUrl;
  });
}

/** Dibuja el logo en la esquina superior derecha sin deformar (mantiene proporción dentro de un máximo). */
async function drawIssuerLogoTopRight(
  doc: import("jspdf").jsPDF,
  logoDataUrl: string,
  pageW: number,
  margin: number
): Promise<void> {
  const fmt = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
  const maxW = 44;
  const maxH = 22;
  const { width: pxW, height: pxH } = await getImagePixelSizeFromDataUrl(logoDataUrl);
  if (pxW <= 0 || pxH <= 0) return;
  const ar = pxW / pxH;
  let logoW = maxW;
  let logoH = logoW / ar;
  if (logoH > maxH) {
    logoH = maxH;
    logoW = logoH * ar;
  }
  /** Más arriba y separado del bloque de datos (y menor = más cerca del borde superior). */
  const logoTopMm = 7;
  doc.addImage(logoDataUrl, fmt, pageW - margin - logoW, logoTopMm, logoW, logoH);
}

function hrefFromWebsite(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function addProformaWatermark(doc: import("jspdf").jsPDF): void {
  const pageW = 210;
  const pageH = 297;
  doc.saveGraphicsState();
  doc.setTextColor(236, 236, 236);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(92);
  doc.text("PROFORMA", pageW / 2, pageH / 2 + 18, { align: "center", angle: 32 });
  doc.restoreGraphicsState();
}

export async function generateBillingInvoicePdfBlob(
  invoice: BillingInvoiceRecord,
  options?: { variant?: BillingInvoicePdfVariant; logoDataUrl?: string | null }
): Promise<Blob> {
  const variant = options?.variant ?? "issued";
  const mod = await import("jspdf");
  const JsPDF = mod.jsPDF ?? mod.default;
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const qrDataUrl = variant === "proforma" ? null : await buildQrDataUrl(invoice);

  const resolvedLogoDataUrl =
    options?.logoDataUrl !== undefined ? options.logoDataUrl : await fetchBillingIssuerLogoDataUrl(invoice.issuerLogoStoragePath);

  const pageW = 210;
  const margin = 14;

  if (variant === "proforma") {
    addProformaWatermark(doc);
  }

  if (resolvedLogoDataUrl) {
    try {
      await drawIssuerLogoTopRight(doc, resolvedLogoDataUrl, pageW, margin);
    } catch {
      /* logo opcional; si falla el decode, seguimos sin él */
    }
  }

  let y = margin;

  /** Avance vertical según tamaño de fuente (más compacto en cuerpos pequeños). */
  const bump = (size: number) => size * 0.42 + (size <= 8.5 ? 1.85 : 2.1);

  const write = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(text, margin, y);
    y += bump(size);
  };

  const writeRight = (text: string, xRight: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(text, xRight, y, { align: "right" });
    y += bump(size);
  };

  const metaSize = 7;
  const boxLabel = 7;
  const boxBody = 6.3;
  /** Interlineado más compacto dentro del recuadro. */
  const bumpBox = (size: number) => size * 0.34 + (size <= 7 ? 1.35 : 1.65);

  write(variant === "proforma" ? "FACTURA (proforma)" : "FACTURA", 15, true);
  const numberLabel =
    variant === "proforma"
      ? "Sin número (borrador — no válida fiscalmente)"
      : invoice.invoiceNumber && invoice.fiscalYear
        ? `${invoice.seriesCode}-${invoice.fiscalYear}/${String(invoice.invoiceNumber).padStart(4, "0")}`
        : "BORRADOR";
  write(`Numero: ${numberLabel}`, metaSize, true);

  const innerPad = 4;
  const innerLeft = margin + innerPad;
  /** Franja derecha del recuadro para QR emitido (texto del cuadro no la invade). */
  const headerQrMm = variant === "issued" && qrDataUrl ? 28 : 0;
  const headerQrTextGap = 4;
  const headerReserveQr = headerQrMm > 0 ? headerQrMm + headerQrTextGap : 0;
  const innerMaxW = Math.max(36, pageW - margin - innerLeft - innerPad - headerReserveQr);
  const yBoxTop = y;

  const issueFmt = formatInvoiceDateEs(invoice.issueDate);
  const dueFmt = formatInvoiceDateEs(invoice.dueDate);
  const facturaLine =
    variant === "proforma" ? `Fecha factura (prevista): ${issueFmt}` : `Fecha factura: ${issueFmt}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(0, 0, 0);
  doc.text(facturaLine, innerLeft, y, { maxWidth: innerMaxW });
  y += bumpBox(8.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(88, 88, 88);
  doc.text(`Vencimiento: ${dueFmt}`, innerLeft, y, { maxWidth: innerMaxW });
  y += bumpBox(6) + 0.8;
  doc.setTextColor(0, 0, 0);

  y += 0.8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(boxLabel);
  doc.text("Emisor", innerLeft, y);
  y += bumpBox(boxLabel);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(boxBody);
  const issuerLines = doc.splitTextToSize(invoice.issuerName || "—", innerMaxW) as string[];
  for (const ln of issuerLines) {
    doc.text(ln, innerLeft, y);
    y += bumpBox(boxBody);
  }
  doc.text(`NIF: ${invoice.issuerTaxId}`, innerLeft, y);
  y += bumpBox(boxBody);
  for (const ln of doc.splitTextToSize(invoice.issuerFiscalAddress, innerMaxW) as string[]) {
    doc.text(ln, innerLeft, y);
    y += bumpBox(boxBody);
  }

  const tel = invoice.issuerPhone?.trim();
  const em = invoice.issuerEmail?.trim();
  if (tel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(boxBody);
    doc.setTextColor(0, 0, 0);
    doc.text(`Tel.: ${tel}`, innerLeft, y);
    y += bumpBox(boxBody);
  }
  if (em) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(boxBody);
    doc.setTextColor(0, 0, 0);
    doc.text("Email: ", innerLeft, y);
    const pw = doc.getTextWidth("Email: ");
    doc.setTextColor(0, 0, 130);
    const display = em.length > 72 ? `${em.slice(0, 69)}…` : em;
    doc.textWithLink(display, innerLeft + pw, y, { url: `mailto:${em}` });
    doc.setTextColor(0, 0, 0);
    y += bumpBox(boxBody);
  }

  const writeWebBox = (label: string, raw: string | null | undefined) => {
    const t = raw?.trim();
    if (!t) return;
    const href = hrefFromWebsite(t);
    if (!href) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(boxBody);
    doc.setTextColor(0, 0, 130);
    const prefix = `${label}: `;
    doc.text(prefix, innerLeft, y);
    const pw = doc.getTextWidth(prefix);
    const display = t.length > 80 ? `${t.slice(0, 77)}…` : t;
    doc.textWithLink(display, innerLeft + pw, y, { url: href });
    doc.setTextColor(0, 0, 0);
    y += bumpBox(boxBody);
  };

  writeWebBox("Web", invoice.issuerWebsiteUrl);

  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(boxLabel);
  doc.text("Cliente / Razón social", innerLeft, y);
  y += bumpBox(boxLabel);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(boxBody);
  for (const ln of doc.splitTextToSize(invoice.recipientName || "—", innerMaxW) as string[]) {
    doc.text(ln, innerLeft, y);
    y += bumpBox(boxBody);
  }
  doc.text(`NIF/CIF: ${invoice.recipientTaxId}`, innerLeft, y);
  y += bumpBox(boxBody);
  for (const ln of doc.splitTextToSize(invoice.recipientFiscalAddress, innerMaxW) as string[]) {
    doc.text(ln, innerLeft, y);
    y += bumpBox(boxBody);
  }
  writeWebBox("Web", invoice.recipientWebsiteUrl);

  const addressee = invoice.recipientAddresseeLine?.trim();
  if (addressee) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(boxBody);
    doc.setTextColor(0, 0, 0);
    doc.text("Factura dirigida a:", innerLeft, y);
    y += bumpBox(boxBody);
    for (const ln of doc.splitTextToSize(addressee, innerMaxW) as string[]) {
      doc.text(ln, innerLeft, y);
      y += bumpBox(boxBody);
    }
  }

  const boxPadTop = 3.2;
  const boxPadBottom = 3.5;
  const boxTop = yBoxTop - boxPadTop;
  const boxH = y - yBoxTop + boxPadTop + boxPadBottom;
  doc.setDrawColor(175, 175, 175);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, boxTop, pageW - 2 * margin, boxH, 1.2, 1.2, "S");

  /** QR dentro del recuadro (franja derecha), centrado verticalmente; leyenda bajo el código. */
  if (variant === "issued" && qrDataUrl && headerQrMm > 0) {
    const qrX = pageW - margin - innerPad - headerQrMm;
    const captionH = 3.2;
    let qrY = boxTop + Math.max(innerPad, (boxH - headerQrMm - captionH) / 2);
    if (qrY + headerQrMm + captionH > boxTop + boxH - 1.5) {
      qrY = Math.max(boxTop + innerPad, boxTop + boxH - headerQrMm - captionH - 2);
    }
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, headerQrMm, headerQrMm);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(72, 72, 72);
    doc.text("VeriFactu-ready", qrX + headerQrMm / 2, qrY + headerQrMm + 2.4, { align: "center" });
    doc.setTextColor(0, 0, 0);
  } else if (variant === "proforma") {
    const stubW = 40;
    const qrX = pageW - margin - innerPad - stubW;
    const qrY = boxTop + Math.max(innerPad, (boxH - 10) / 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("Sin código QR (se genera al emitir)", qrX + stubW / 2, qrY + 2, { align: "center", maxWidth: stubW });
    doc.setTextColor(0, 0, 0);
  }

  /** Cursor justo debajo del marco + separación respecto a la tabla de conceptos. */
  const gapAfterHeaderBox = 14;
  y = boxTop + boxH + gapAfterHeaderBox;

  /**
   * Columnas numéricas: bordes derechos (mm). Evita solapamiento Precio/IVA.
   * Concepto usa desde `margin` hasta `colQtyR - gapConcept`.
   */
  const gapConcept = 4;
  /** Más hueco entre columnas de importes para textos largos tipo "1.234,56 (21%)". */
  const colQtyR = 112;
  const colPriceR = 128;
  const colVatR = 150;
  const colIrpfR = 170;
  const colTotalR = pageW - margin;
  const descMaxMm = colQtyR - margin - gapConcept;

  /** Última coordenada Y segura para el cuerpo (evita cortes al no paginar). */
  const maxContentY = PDF_PAGE_H_MM - margin;

  const drawConceptTableHeader = (yHeader: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Concepto", margin, yHeader);
    doc.text("Cant.", colQtyR, yHeader, { align: "right" });
    doc.text("Precio", colPriceR, yHeader, { align: "right" });
    doc.text("IVA", colVatR, yHeader, { align: "right" });
    doc.text("IRPF", colIrpfR, yHeader, { align: "right" });
    doc.text("Total", colTotalR, yHeader, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    return yHeader + 6;
  };

  y = drawConceptTableHeader(y);

  const numFont = 7.4;
  /** Más aire entre filas y entre tipos de línea para legibilidad en PDF multipágina. */
  const gapAfterLine = 6.2;

  const startConceptsContinuationPage = (): number => {
    doc.addPage();
    if (variant === "proforma") {
      addProformaWatermark(doc);
    }
    return drawConceptTableHeader(margin);
  };

  /** Evita cortes si el texto enriquecido ocupa más líneas que splitTextToSize. */
  const lineHeightPaginationFudgeMm = 8;

  for (const line of invoice.lines) {
    const estH = estimateInvoiceLineRowHeightMm(doc, line, descMaxMm, gapAfterLine);
    if (y + estH + lineHeightPaginationFudgeMm > maxContentY) {
      y = startConceptsContinuationPage();
    }

    if (line.lineType === "BLOCK_TITLE") {
      const h = drawBillingRichLinePdf(doc, margin, y, descMaxMm, line.description || "—", {
        fontSize: 10,
        lineHeightMm: 6.5,
        blockTitlePlain: true,
      });
      y += h + gapAfterLine + 1;
      continue;
    }
    if (line.lineType === "BLOCK_SUBTITLE") {
      const h = drawBillingRichLinePdf(doc, margin + 2, y, descMaxMm - 2, line.description || "—", {
        fontSize: 9,
        lineHeightMm: 5.7,
        defaultBold: true,
      });
      y += h + gapAfterLine;
      continue;
    }
    if (line.lineType === "CONCEPT") {
      const h = drawBillingRichLinePdf(doc, margin + 4, y, descMaxMm - 4, line.description || "—", {
        fontSize: 8.5,
        lineHeightMm: 5.7,
        defaultBold: true,
      });
      y += h + gapAfterLine;
      continue;
    }
    const numY = y;
    const descH = drawBillingRichLinePdf(doc, margin, y, descMaxMm, line.description || "—", {
      fontSize: 8.5,
      lineHeightMm: 5.7,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(numFont);
    doc.text(String(line.quantity), colQtyR, numY, { align: "right" });
    doc.text(money(line.unitPrice), colPriceR, numY, { align: "right" });
    doc.text(`${money(line.vatAmount)} (${line.vatRate}%)`, colVatR, numY, { align: "right" });
    doc.text(`${money(line.irpfAmount)} (${line.irpfRate}%)`, colIrpfR, numY, { align: "right" });
    doc.text(money(line.lineTotal), colTotalR, numY, { align: "right" });
    doc.setFontSize(8.5);
    y += Math.max(descH, 6) + gapAfterLine;
  }

  /** Separador + totales + hash / nota proforma deben caber en la página o pasan a una nueva. */
  const reserveAfterConceptsMm =
    6 +
    6 +
    28 +
    2 +
    (variant === "issued" && invoice.recordHash ? 6 : 0) +
    (variant === "proforma" ? 14 : 0);
  if (y + reserveAfterConceptsMm > maxContentY) {
    doc.addPage();
    if (variant === "proforma") {
      addProformaWatermark(doc);
    }
    y = margin;
  }

  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  writeRight(`Base imponible: ${money(invoice.taxableBaseTotal)} EUR`, pageW - margin, 10, true);
  y += 0.6;
  writeRight(`IVA: ${money(invoice.vatTotal)} EUR`, pageW - margin, 10, true);
  y += 0.6;
  writeRight(`IRPF: ${money(invoice.irpfTotal)} EUR`, pageW - margin, 10, true);
  y += 0.8;
  writeRight(`TOTAL: ${money(invoice.grandTotal)} EUR`, pageW - margin, 12, true);

  y += 2;
  if (variant === "issued" && invoice.recordHash) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Hash: ${invoice.recordHash}`, margin, y, { maxWidth: 130 });
    y += 5;
  }

  if (variant === "proforma") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(
      "Documento de comprobación. No tiene validez fiscal. Al emitir la factura se asignará numeración oficial y huella digital.",
      margin,
      y,
      { maxWidth: pageW - 2 * margin }
    );
    y += 12;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  }

  const bankRowCount =
    (invoice.issuerBankName ? 1 : 0) +
    (invoice.issuerBankAccountIban ? 1 : 0) +
    (invoice.issuerBankAccountSwift ? 1 : 0);

  if (invoice.issuerBankAccountIban || invoice.issuerBankAccountSwift || invoice.issuerBankName) {
    const bankBlockMm = 4 + bankRowCount * 3.7 + 4;
    if (y + bankBlockMm > maxContentY) {
      doc.addPage();
      if (variant === "proforma") {
        addProformaWatermark(doc);
      }
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Datos de abono", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (invoice.issuerBankName) {
      doc.text(`Banco: ${invoice.issuerBankName}`, margin, y);
      y += 3.7;
    }
    if (invoice.issuerBankAccountIban) {
      doc.text(`IBAN: ${invoice.issuerBankAccountIban}`, margin, y);
      y += 3.7;
    }
    if (invoice.issuerBankAccountSwift) {
      doc.text(`SWIFT/BIC: ${invoice.issuerBankAccountSwift}`, margin, y);
      y += 3.7;
    }
  }

  doc.setPage(doc.getNumberOfPages());

  const privacyFooter = resolvePdfPrivacyFooterText(invoice);
  if (privacyFooter) {
    drawBillingPdfPrivacyFooter(doc, y, pageW, margin, privacyFooter);
  }

  return doc.output("blob");
}

export async function openBillingInvoicePdfDownload(invoice: BillingInvoiceRecord): Promise<void> {
  const blob = await generateBillingInvoicePdfBlob(invoice);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("El navegador bloqueó la apertura del PDF.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openBillingInvoiceProformaDownload(
  base: BillingInvoiceRecord,
  draftLines: BillingInvoiceLineInput[]
): Promise<void> {
  const snap = buildProformaInvoiceSnapshot(base, draftLines);
  const blob = await generateBillingInvoicePdfBlob(snap, { variant: "proforma" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("El navegador bloqueó la apertura del PDF.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
