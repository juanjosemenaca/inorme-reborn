/**
 * Texto enriquecido en conceptos de factura (PDF).
 * Sintaxis: **negrita**, *cursiva*, __subrayado__, ***negrita y cursiva a la vez***
 */

export type BillingRichRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function sameRunStyle(a: BillingRichRun, b: BillingRichRun): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;
}

function mergeAdjacentRuns(runs: BillingRichRun[]): BillingRichRun[] {
  const out: BillingRichRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameRunStyle(last, r)) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

type Inherited = { bold?: boolean; italic?: boolean; underline?: boolean };

function parseInner(s: string, inh: Inherited): BillingRichRun[] {
  const out: BillingRichRun[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.slice(i, i + 3) === "***") {
      const end = s.indexOf("***", i + 3);
      if (end === -1) {
        out.push({ text: s.slice(i), ...inh });
        break;
      }
      out.push(...parseInner(s.slice(i + 3, end), { ...inh, bold: true, italic: true }));
      i = end + 3;
      continue;
    }
    if (s.slice(i, i + 2) === "**") {
      const end = s.indexOf("**", i + 2);
      if (end === -1) {
        out.push({ text: s.slice(i), ...inh });
        break;
      }
      out.push(...parseInner(s.slice(i + 2, end), { ...inh, bold: true }));
      i = end + 2;
      continue;
    }
    if (s.slice(i, i + 2) === "__") {
      const end = s.indexOf("__", i + 2);
      if (end === -1) {
        out.push({ text: s.slice(i), ...inh });
        break;
      }
      out.push(...parseInner(s.slice(i + 2, end), { ...inh, underline: true }));
      i = end + 2;
      continue;
    }
    if (s[i] === "*") {
      const end = s.indexOf("*", i + 1);
      if (end === -1) {
        out.push({ text: s.slice(i), ...inh });
        break;
      }
      out.push(...parseInner(s.slice(i + 1, end), { ...inh, italic: true }));
      i = end + 1;
      continue;
    }
    let j = i + 1;
    while (j < s.length) {
      const t = s.slice(j);
      if (t.startsWith("***") || t.startsWith("**") || t.startsWith("__") || s[j] === "*") break;
      j++;
    }
    if (j > i) out.push({ text: s.slice(i, j), ...inh });
    i = j;
  }
  return mergeAdjacentRuns(out);
}

export function parseBillingRichText(raw: string): BillingRichRun[] {
  const s = raw ?? "";
  if (!s.trim()) return [{ text: "—" }];
  const runs = parseInner(s, {});
  return runs.length ? runs : [{ text: s }];
}

export function billingLineHasRichMarkers(raw: string): boolean {
  const s = raw ?? "";
  return s.includes("**") || s.includes("__") || (s.includes("*") && /\*[^*]+\*/.test(s));
}

function flattenRunsToTokens(runs: BillingRichRun[]): BillingRichRun[] {
  const tokens: BillingRichRun[] = [];
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (p === "") continue;
      tokens.push({ text: p, bold: r.bold, italic: r.italic, underline: r.underline });
    }
  }
  return tokens;
}

function helveticaVariant(r: BillingRichRun): "normal" | "bold" | "italic" | "bolditalic" {
  const b = !!(r.bold ?? false);
  const i = !!(r.italic ?? false);
  if (b && i) return "bolditalic";
  if (b) return "bold";
  if (i) return "italic";
  return "normal";
}

export type DrawBillingRichOptions = {
  fontSize: number;
  lineHeightMm?: number;
  /** Sin marcadores: todo el texto en mayúsculas y negrita (título de bloque histórico). */
  blockTitlePlain?: boolean;
  /** Sin marcadores: una sola línea en negrita (concepto / subtítulo). */
  defaultBold?: boolean;
};

/**
 * Dibuja el concepto con formato. Devuelve altura total usada (mm) y restaura fuente normal.
 */
export function drawBillingRichLinePdf(
  doc: import("jspdf").jsPDF,
  xLeft: number,
  yStart: number,
  maxWidth: number,
  raw: string,
  options: DrawBillingRichOptions
): number {
  const fontSize = options.fontSize;
  const lineHeight = options.lineHeightMm ?? fontSize * 0.52;
  const hasM = billingLineHasRichMarkers(raw);
  let runs: BillingRichRun[];

  if (options.blockTitlePlain && !hasM && (raw ?? "").trim()) {
    runs = [{ text: (raw ?? "").toUpperCase(), bold: true }];
  } else if (options.defaultBold && !hasM && (raw ?? "").trim()) {
    runs = [{ text: raw ?? "", bold: true }];
  } else {
    runs = parseBillingRichText(raw);
  }

  const tokens = flattenRunsToTokens(runs);

  if (tokens.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    doc.text("—", xLeft, yStart);
    return lineHeight;
  }

  let cy = yStart;
  let cx = xLeft;
  const xMax = xLeft + maxWidth;

  const drawUnderlineSeg = (x: number, y: number, w: number) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.line(x, y + 0.35, x + w, y + 0.35);
  };

  for (const tok of tokens) {
    doc.setFont("helvetica", helveticaVariant(tok));
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);

    const w = doc.getTextWidth(tok.text);
    if (cx + w > xMax && cx > xLeft + 0.01) {
      cy += lineHeight;
      cx = xLeft;
    }

    if (cx === xLeft && w > maxWidth) {
      const sub = doc.splitTextToSize(tok.text, maxWidth) as string[];
      for (let si = 0; si < sub.length; si++) {
        const line = sub[si];
        doc.setFont("helvetica", helveticaVariant(tok));
        doc.text(line, xLeft, cy);
        const lw = doc.getTextWidth(line);
        if (tok.underline) drawUnderlineSeg(xLeft, cy, lw);
        if (si < sub.length - 1) {
          cy += lineHeight;
        } else {
          cx = xLeft + lw;
        }
      }
      continue;
    }

    doc.text(tok.text, cx, cy);
    if (tok.underline) drawUnderlineSeg(cx, cy, w);
    cx += w;
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return Math.max(lineHeight, cy - yStart + lineHeight * 0.35);
}
