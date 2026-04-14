import type { BillingInvoiceRecord } from "@/types/billing";

function money(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function buildQrDataUrl(invoice: BillingInvoiceRecord): Promise<string> {
  const { toDataURL } = await import("qrcode");
  const payload =
    invoice.verifactuQrPayload ??
    {
      schema: "ES_VERIFACTU_PREP",
      issuerTaxId: invoice.issuerTaxId,
      invoiceNumber: invoice.invoiceNumber,
      fiscalYear: invoice.fiscalYear,
      issueDate: invoice.issueDate,
      amountTotal: invoice.grandTotal,
    };
  return toDataURL(JSON.stringify(payload), { margin: 1, width: 180 });
}

export async function generateBillingInvoicePdfBlob(invoice: BillingInvoiceRecord): Promise<Blob> {
  const mod = await import("jspdf");
  const JsPDF = mod.jsPDF ?? mod.default;
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const qrDataUrl = await buildQrDataUrl(invoice);

  const pageW = 210;
  const margin = 14;
  let y = margin;

  const write = (text: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size * 0.45 + 2.2;
  };

  const writeRight = (text: string, xRight: number, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, xRight, y, { align: "right" });
    y += size * 0.45 + 2.2;
  };

  write("FACTURA", 18, true);
  const numberLabel =
    invoice.invoiceNumber && invoice.fiscalYear
      ? `${invoice.seriesCode}-${invoice.fiscalYear}/${String(invoice.invoiceNumber).padStart(4, "0")}`
      : "BORRADOR";
  write(`Numero: ${numberLabel}`, 11, true);
  write(`Fecha emision: ${invoice.issueDate ?? "—"}`);
  write(`Vencimiento: ${invoice.dueDate ?? "—"}`);

  y += 2;
  write("Emisor", 11, true);
  write(invoice.issuerName);
  write(`NIF: ${invoice.issuerTaxId}`);
  write(invoice.issuerFiscalAddress);

  y += 1;
  write("Cliente / Razón social", 11, true);
  write(invoice.recipientName || "—");
  write(`NIF/CIF: ${invoice.recipientTaxId}`);
  write(invoice.recipientFiscalAddress);

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
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
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text((line.description || "—").toUpperCase(), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      y += 5.8;
      continue;
    }
    if (line.lineType === "BLOCK_SUBTITLE") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(line.description || "—", margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      y += 5.2;
      continue;
    }
    if (line.lineType === "CONCEPT") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(line.description || "—", margin + 4, y);
      doc.setFont("helvetica", "normal");
      y += 5.2;
      continue;
    }
    const lineH = 4.8;
    const label = doc.splitTextToSize(line.description || "—", 90)[0] as string;
    doc.text(label, margin, y);
    doc.text(String(line.quantity), 110, y, { align: "right" });
    doc.text(money(line.unitPrice), 130, y, { align: "right" });
    doc.text(`${money(line.vatAmount)} (${line.vatRate}%)`, 148, y, { align: "right" });
    doc.text(`${money(line.irpfAmount)} (${line.irpfRate}%)`, 164, y, { align: "right" });
    doc.text(money(line.lineTotal), 196, y, { align: "right" });
    y += lineH;
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
  if (invoice.recordHash) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Hash: ${invoice.recordHash}`, margin, y, { maxWidth: 130 });
    y += 5;
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

  doc.addImage(qrDataUrl, "PNG", 160, 20, 34, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("QR VeriFactu-ready", 177, 56, { align: "center" });

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
