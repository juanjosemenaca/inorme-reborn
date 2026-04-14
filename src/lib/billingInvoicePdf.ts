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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  let taxableBaseTotal = 0;
  let vatTotal = 0;
  let irpfTotal = 0;
  for (const line of lines) {
    if (line.lineType !== "BILLABLE") continue;
    taxableBaseTotal += line.taxableBase;
    vatTotal += line.vatAmount;
    irpfTotal += line.irpfAmount;
  }
  taxableBaseTotal = round2(taxableBaseTotal);
  vatTotal = round2(vatTotal);
  irpfTotal = round2(irpfTotal);
  const grandTotal = round2(taxableBaseTotal + vatTotal - irpfTotal);

  const previewIssueDate = new Date().toISOString().slice(0, 10);

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
  doc.addImage(logoDataUrl, fmt, pageW - margin - logoW, margin, logoW, logoH);
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

  const metaSize = 8;
  const sectionLabelSize = 8.5;
  const sectionBodySize = 7.5;

  write(variant === "proforma" ? "FACTURA (proforma)" : "FACTURA", 18, true);
  const numberLabel =
    variant === "proforma"
      ? "Sin número (borrador — no válida fiscalmente)"
      : invoice.invoiceNumber && invoice.fiscalYear
        ? `${invoice.seriesCode}-${invoice.fiscalYear}/${String(invoice.invoiceNumber).padStart(4, "0")}`
        : "BORRADOR";
  write(`Numero: ${numberLabel}`, metaSize, true);
  write(
    variant === "proforma"
      ? `Fecha emision prevista: ${invoice.issueDate ?? "—"}`
      : `Fecha emision: ${invoice.issueDate ?? "—"}`,
    metaSize
  );
  write(`Vencimiento: ${invoice.dueDate ?? "—"}`, metaSize);

  y += 2;
  write("Emisor", sectionLabelSize, true);
  write(invoice.issuerName, sectionBodySize);
  write(`NIF: ${invoice.issuerTaxId}`, sectionBodySize);
  write(invoice.issuerFiscalAddress, sectionBodySize);

  const writeWeb = (label: string, raw: string | null | undefined) => {
    const t = raw?.trim();
    if (!t) return;
    const href = hrefFromWebsite(t);
    if (!href) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(sectionBodySize);
    doc.setTextColor(0, 0, 130);
    const prefix = `${label}: `;
    doc.text(prefix, margin, y);
    const pw = doc.getTextWidth(prefix);
    const display = t.length > 85 ? `${t.slice(0, 82)}…` : t;
    doc.textWithLink(display, margin + pw, y, { url: href });
    doc.setTextColor(0, 0, 0);
    y += bump(sectionBodySize);
  };

  writeWeb("Web", invoice.issuerWebsiteUrl);

  y += 1;
  write("Cliente / Razón social", sectionLabelSize, true);
  write(invoice.recipientName || "—", sectionBodySize);
  write(`NIF/CIF: ${invoice.recipientTaxId}`, sectionBodySize);
  write(invoice.recipientFiscalAddress, sectionBodySize);
  writeWeb("Web", invoice.recipientWebsiteUrl);

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Concepto", margin, y);
  doc.text("Cant.", 110, y, { align: "right" });
  doc.text("Precio", 130, y, { align: "right" });
  doc.text("IVA", 148, y, { align: "right" });
  doc.text("IRPF", 164, y, { align: "right" });
  doc.text("Total", 196, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const line of invoice.lines) {
    if (line.lineType === "BLOCK_TITLE") {
      const h = drawBillingRichLinePdf(doc, margin, y, 90, line.description || "—", {
        fontSize: 10,
        lineHeightMm: 5.2,
        blockTitlePlain: true,
      });
      y += h + 1.2;
      continue;
    }
    if (line.lineType === "BLOCK_SUBTITLE") {
      const h = drawBillingRichLinePdf(doc, margin + 2, y, 88, line.description || "—", {
        fontSize: 9,
        lineHeightMm: 4.6,
        defaultBold: true,
      });
      y += h + 1;
      continue;
    }
    if (line.lineType === "CONCEPT") {
      const h = drawBillingRichLinePdf(doc, margin + 4, y, 86, line.description || "—", {
        fontSize: 8.5,
        lineHeightMm: 4.4,
        defaultBold: true,
      });
      y += h + 1;
      continue;
    }
    const numY = y;
    const descH = drawBillingRichLinePdf(doc, margin, y, 90, line.description || "—", { fontSize: 8.5, lineHeightMm: 4.6 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(String(line.quantity), 110, numY, { align: "right" });
    doc.text(money(line.unitPrice), 130, numY, { align: "right" });
    doc.text(`${money(line.vatAmount)} (${line.vatRate}%)`, 148, numY, { align: "right" });
    doc.text(`${money(line.irpfAmount)} (${line.irpfRate}%)`, 164, numY, { align: "right" });
    doc.text(money(line.lineTotal), 196, numY, { align: "right" });
    y += Math.max(descH, 4.8);
  }

  y += 4;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  writeRight(`Base imponible: ${money(invoice.taxableBaseTotal)} EUR`, pageW - margin, 10, true);
  writeRight(`IVA: ${money(invoice.vatTotal)} EUR`, pageW - margin, 10, true);
  writeRight(`IRPF: ${money(invoice.irpfTotal)} EUR`, pageW - margin, 10, true);
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

  if (invoice.issuerBankAccountIban || invoice.issuerBankAccountSwift || invoice.issuerBankName) {
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

  if (variant === "issued" && qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 160, 20, 34, 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("QR VeriFactu-ready", 177, 56, { align: "center" });
  } else if (variant === "proforma") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Sin código QR (se genera al emitir)", 160, 38, { maxWidth: 40 });
    doc.setTextColor(0, 0, 0);
  }

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
