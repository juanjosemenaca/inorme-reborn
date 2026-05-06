/**
 * Logica compartida: Excel -> datos de plantilla (CLI y API).
 */
import fs from "fs";
import path from "path";
import xlsx from "xlsx";

export function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildRowMap(row) {
  const map = {};
  for (const [k, v] of Object.entries(row)) {
    map[normalizeHeader(k)] = v;
  }
  return map;
}

export function getCell(map, ...aliases) {
  const aliasKeys = aliases.map((a) => normalizeHeader(a));
  for (const a of aliases) {
    const key = normalizeHeader(a);
    if (Object.prototype.hasOwnProperty.call(map, key) && map[key] !== undefined && map[key] !== null) {
      const s = String(map[key]).trim();
      if (s !== "") return s;
    }
  }
  // Fallback por coincidencia parcial de tokens de cabecera.
  const mapKeys = Object.keys(map);
  for (const key of mapKeys) {
    const keyTokens = new Set(key.split(" ").filter(Boolean));
    const matchesAlias = aliasKeys.some((alias) => {
      const aliasTokens = alias.split(" ").filter(Boolean);
      if (!aliasTokens.length) return false;
      return aliasTokens.every((t) => keyTokens.has(t));
    });
    if (!matchesAlias) continue;
    const raw = map[key];
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (s !== "") return s;
  }

  return "";
}

export function formatDisplayValue(raw) {
  if (raw === "" || raw === undefined || raw === null) return "";
  return String(raw).trim();
}

export function formatMoneyDisplay(raw) {
  if (raw === "" || raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  // Soporta 1.234,56 / 1,234.56 / 1234,56 / 1234.56
  const normalized = s
    .replace(/\s/g, "")
    .replace(/[€$]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return formatDisplayValue(raw);
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function sanitizeFilePart(s) {
  const t = String(s ?? "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .trim();
  return t || "sin-numero";
}

function escapeHtmlForTemplate(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fillTemplate(html, vars) {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    const safe = escapeHtmlForTemplate(String(value));
    // Callback obligatorio: si `safe` contiene "$123" o "$&", .replace lo interpreta mal.
    out = out.replace(re, () => safe);
  }
  return out;
}

export function validateRow(m) {
  const issues = [];
  const num = getCell(
    m,
    "numero factura",
    "numero de factura",
    "numero",
    "num",
    "n factura",
    "nro factura",
    "no factura",
    "factura",
  );
  const nombre = getCell(
    m,
    "nombre alumno",
    "alumno",
    "nombre",
    "nombre y apellidos",
    "nombre completo",
  );
  // El resto de campos se permiten vacios y se renderizan en blanco en el PDF.
  if (!num) issues.push("falta «numero factura»");
  return { ok: issues.length === 0, issues, num, nombre };
}

export function buildVarsFromRow(m, opts = {}) {
  const logoFromRow = getCell(m, "logo", "logo url", "url logo", "logo factura");
  const logoUrl = logoFromRow || String(opts.logoUrl ?? "").trim();
  return {
    FECHA_FACTURA: formatDisplayValue(getCell(m, "fecha factura", "fecha", "fecha emision", "fecha de factura")),
    NUMERO_FACTURA: formatDisplayValue(
      getCell(m, "numero factura", "numero de factura", "numero", "num", "n factura", "nro factura", "no factura", "factura"),
    ),
    NOMBRE_ALUMNO: formatDisplayValue(
      getCell(m, "nombre alumno", "alumno", "nombre", "nombre y apellidos", "nombre completo"),
    ),
    DNI_ALUMNO: formatDisplayValue(getCell(m, "dni alumno", "dni", "dni nif", "dni id", "id alumno", "nif")),
    METODO_PAGO: formatDisplayValue(getCell(m, "metodo de pago", "método de pago", "metodo", "método", "pago")),
    TIPO_CUOTA: formatDisplayValue(getCell(m, "tipo de cuota", "tipo cuota", "tipo")),
    CONCEPTO: formatDisplayValue(getCell(m, "concepto")),
    CAJERO: formatDisplayValue(getCell(m, "cajero")),
    BASE_IMPONIBLE: formatMoneyDisplay(getCell(m, "base imponible", "base")),
    IMPUESTO: formatMoneyDisplay(getCell(m, "impuesto")),
    DESCUENTO: formatMoneyDisplay(getCell(m, "descuento")),
    TOTAL_IMPORTE: formatMoneyDisplay(getCell(m, "total importe", "importe total", "importe", "total")),
    LOGO_URL: formatDisplayValue(logoUrl),
  };
}

/**
 * @param {Buffer} buffer
 * @returns {{ rows: Record<string, unknown>[], sheetName: string, headers: string[] }}
 */
export function parseWorkbookBuffer(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("El Excel no tiene hojas.");
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { rows: [], sheetName, headers: [] };
  }

  // Busca una fila de cabeceras razonable, permitiendo filas de titulo arriba.
  let headerRowIndex = matrix.findIndex((rawRow) => {
    const row = Array.isArray(rawRow) ? rawRow.map((c) => String(c ?? "").trim()) : [];
    const nonEmpty = row.filter(Boolean);
    if (nonEmpty.length < 2) return false;
    const normalized = nonEmpty.map(normalizeHeader).join(" ");
    const looksInvoice = normalized.includes("factura");
    const looksStudent = normalized.includes("alumno") || normalized.includes("nombre");
    return looksInvoice || looksStudent;
  });
  if (headerRowIndex < 0) {
    headerRowIndex = matrix.findIndex((rawRow) => {
      const row = Array.isArray(rawRow) ? rawRow.map((c) => String(c ?? "").trim()) : [];
      return row.filter(Boolean).length >= 2;
    });
  }
  if (headerRowIndex < 0) {
    return { rows: [], sheetName, headers: [] };
  }

  const rawHeaders = (matrix[headerRowIndex] ?? []).map((c) => String(c ?? "").trim());
  const seen = new Map();
  const headers = rawHeaders.map((h, idx) => {
    const base = normalizeHeader(h) || `col_${idx + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}_${n + 1}`;
  });

  const rows = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r += 1) {
    const row = Array.isArray(matrix[r]) ? matrix[r] : [];
    const obj = {};
    let hasData = false;
    for (let c = 0; c < headers.length; c += 1) {
      const value = row[c] ?? "";
      const s = String(value ?? "").trim();
      obj[headers[c]] = s;
      if (s !== "") hasData = true;
    }
    if (hasData) rows.push(obj);
  }

  return { rows, sheetName, headers };
}

export function resolveDiskPath(baseDir, baseName, force) {
  const base = path.join(baseDir, baseName);
  let candidate = `${base}.pdf`;
  if (force || !fs.existsSync(candidate)) return candidate;
  let n = 1;
  while (fs.existsSync(`${base}_${n}.pdf`)) n += 1;
  return `${base}_${n}.pdf`;
}

/**
 * @param {Set<string>} used
 * @param {string} baseName sin extension, p.ej. factura_F-001
 */
export function uniqueZipEntryName(used, baseName) {
  let name = `${baseName}.pdf`;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 1;
  while (used.has(`${baseName}_${n}.pdf`)) n += 1;
  const final = `${baseName}_${n}.pdf`;
  used.add(final);
  return final;
}
