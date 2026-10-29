import { jsPDF } from "jspdf";
import type { AiReport } from "@/types/ai";

/**
 * Exporta un `AiReport` a PDF (A4 vertical, texto estructurado).
 * Pensado como primera versión; Excel/Word pueden partir del mismo objeto.
 */
export function buildAiReportPdf(report: AiReport, meta?: { generatedAtLabel?: string }): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = 210;
  const pageH = 297;
  const margin = 16;
  const maxW = pageW - margin * 2;
  const maxY = pageH - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > maxY) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (value: string, size: number, style: "normal" | "bold" | "italic" = "normal", gap = 1.5) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(stripMarkdown(value), maxW) as string[];
    const lineH = size * 0.42;
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }
    y += gap;
  };

  text(report.title, 18, "bold", 2);
  if (report.period) text(`Período: ${report.period}`, 10, "italic", 1);
  if (meta?.generatedAtLabel) text(meta.generatedAtLabel, 9, "normal", 3);
  text(report.summary, 11, "normal", 4);

  if (report.kpis.length) {
    text("Indicadores clave", 13, "bold", 2);
    for (const k of report.kpis) {
      text(`• ${k.label}: ${k.value}${k.variation ? `  (${k.variation})` : ""}`, 10.5, "normal", 0.8);
    }
    y += 3;
  }

  for (const s of report.sections) {
    text(s.title, 13, "bold", 2);
    text(s.content, 10.5, "normal", 4);
  }

  for (const t of report.tables ?? []) {
    text(t.title, 13, "bold", 2);
    drawTable(doc, t.columns, t.rows, margin, maxW, () => y, (v) => (y = v), ensure);
    y += 4;
  }

  return doc;
}

export function downloadAiReportPdf(report: AiReport): void {
  const generatedAtLabel = `Generado el ${new Date().toLocaleString("es-ES")}`;
  const doc = buildAiReportPdf(report, { generatedAtLabel });
  const safe = report.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  doc.save(`informe-${safe || "inorme"}.pdf`);
}

/** Quita marcas Markdown básicas para texto plano del PDF. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

function drawTable(
  doc: jsPDF,
  columns: string[],
  rows: string[][],
  x: number,
  width: number,
  getY: () => number,
  setY: (v: number) => void,
  ensure: (h: number) => void
) {
  const colW = width / Math.max(1, columns.length);
  const rowH = 6;
  const fontSize = 8.5;
  doc.setFontSize(fontSize);

  const drawRow = (cells: string[], bold: boolean) => {
    ensure(rowH);
    let y = getY();
    doc.setFont("helvetica", bold ? "bold" : "normal");
    if (bold) {
      doc.setFillColor(235, 235, 235);
      doc.rect(x, y - rowH + 1.5, width, rowH, "F");
    }
    cells.forEach((cell, i) => {
      const cx = x + i * colW + 1.5;
      const txt = (doc.splitTextToSize(String(cell ?? ""), colW - 3) as string[])[0] ?? "";
      doc.text(txt, cx, y);
    });
    y += rowH;
    setY(y);
  };

  setY(getY() + rowH - 2);
  drawRow(columns, true);
  for (const r of rows) drawRow(r, false);
}
