#!/usr/bin/env node
/**
 * Lee el Excel de calendarios laborales (rejilla por meses, festivos en rojo)
 * y genera SQL INSERT o JSON para `work_calendar_holidays`.
 *
 * Requisitos: el libro debe tener hojas con el mismo diseño que
 * «CALENDARIOS LABORALES 2026.xlsx» (3 bloques de meses por fila, columnas B–H, K–Q, T–Z).
 *
 * Uso:
 *   node scripts/parse-work-calendar-xlsx.mjs --file "/ruta/CALENDARIOS LABORALES 2026.xlsx" --year 2026
 *   node scripts/parse-work-calendar-xlsx.mjs --file "./cal.xlsx" --year 2026 --json out.json
 *   node scripts/parse-work-calendar-xlsx.mjs --file "./cal.xlsx" --year 2026 --sql out.sql
 *
 * Reglas:
 * - Solo celdas con relleno RGB `FF0000` (festivo marcado en rojo en el Excel).
 * - Se ignoran filas de leyenda (p. ej. fila ≥ 45 donde suele repetirse «12» en rojo).
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const SHEET_TO_SCOPE = {
  'MONDRAGÓN 2026': 'ARRASATE_MONDRAGON',
  'MADRID 2026': 'MADRID',
  'BARCELONA 2026': 'BARCELONA',
};

/** Colores tratados como día festivo / no laborable en el Excel de referencia */
const DEFAULT_HOLIDAY_RGB = new Set(['FF0000']);

const LEGEND_ROW_MIN = 45;

function colGroup(col) {
  if (col >= 2 && col <= 8) return 0;
  if (col >= 11 && col <= 17) return 1;
  if (col >= 20 && col <= 26) return 2;
  return -1;
}

function rowToQuarter(row) {
  if (row >= 8 && row <= 13) return 0;
  if (row >= 17 && row <= 21) return 1;
  if (row >= 26 && row <= 31) return 2;
  if (row >= 35 && row <= 40) return 3;
  return -1;
}

function decodeAddr(addr) {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: +m[2] };
}

function addressToMonth(row, col) {
  const q = rowToQuarter(row);
  const g = colGroup(col);
  if (q < 0 || g < 0) return null;
  return q * 3 + g + 1;
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function cellRgb(cell) {
  const fg = cell?.s?.fgColor;
  if (!fg) return null;
  return fg.rgb || null;
}

function parseArgs(argv) {
  const out = { file: null, year: new Date().getFullYear(), json: null, sql: null, colors: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) {
      out.file = argv[++i];
    } else if (a === '--year' && argv[i + 1]) {
      out.year = parseInt(argv[++i], 10);
    } else if (a === '--json' && argv[i + 1]) {
      out.json = argv[++i];
    } else if (a === '--sql' && argv[i + 1]) {
      out.sql = argv[++i];
    } else if (a === '--colors' && argv[i + 1]) {
      out.colors = argv[++i].split(',').map((s) => s.trim().toUpperCase().replace(/^#/, ''));
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function extractSheet(ws, year, colorSet) {
  const rows = [];
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue;
    const cell = ws[addr];
    if (!cell || typeof cell.v !== 'number' || cell.v < 1 || cell.v > 31) continue;
    const pos = decodeAddr(addr);
    if (!pos) continue;
    if (pos.row >= LEGEND_ROW_MIN) continue;
    const rgb = cellRgb(cell);
    if (!rgb || !colorSet.has(rgb)) continue;
    const month = addressToMonth(pos.row, pos.col);
    if (!month) continue;
    const day = cell.v;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) continue;
    rows.push({
      addr,
      holiday_date: formatLocalDate(d),
      day,
      month,
    });
  }
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.holiday_date)) byDate.set(r.holiday_date, r);
  }
  return [...byDate.values()].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}

function escapeSqlString(s) {
  return s.replace(/'/g, "''");
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.file) {
    console.error(`Uso: node scripts/parse-work-calendar-xlsx.mjs --file <ruta.xlsx> [--year 2026] [--sql out.sql] [--json out.json] [--colors FF0000,8EB4E3]

Lee hojas ${Object.keys(SHEET_TO_SCOPE).join(', ')} y escribe festivos (celdas con color indicado).

Por defecto solo RGB FF0000 (rojo). La fila ${LEGEND_ROW_MIN}+ se ignora (leyenda).`);
    process.exit(args.help ? 0 : 1);
  }

  const year = args.year;
  const colorSet = args.colors ? new Set(args.colors) : DEFAULT_HOLIDAY_RGB;

  if (!fs.existsSync(args.file)) {
    console.error('No existe el archivo:', args.file);
    process.exit(1);
  }

  const wb = XLSX.readFile(path.resolve(args.file), { cellStyles: true });
  const allJson = [];

  for (const sheetName of wb.SheetNames) {
    const scope = SHEET_TO_SCOPE[sheetName];
    if (!scope) {
      console.warn('Omitiendo hoja sin mapeo de sede:', JSON.stringify(sheetName));
      continue;
    }
    const ws = wb.Sheets[sheetName];
    const holidays = extractSheet(ws, year, colorSet);
    console.error(`${sheetName} → ${scope}: ${holidays.length} festivos`);
    for (const h of holidays) {
      allJson.push({
        calendar_year: year,
        scope,
        holiday_date: h.holiday_date,
        label: '',
      });
    }
  }

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify(allJson, null, 2), 'utf8');
    console.error('JSON escrito:', args.json);
  }

  if (args.sql) {
    const lines = [
      `-- Generado por scripts/parse-work-calendar-xlsx.mjs (año ${year})`,
      `-- ON CONFLICT: (calendar_year, scope, holiday_date)`,
      '',
    ];
    for (const row of allJson) {
      const label = escapeSqlString(row.label ?? '');
      lines.push(
        `INSERT INTO public.work_calendar_holidays (calendar_year, scope, holiday_date, label) VALUES (${row.calendar_year}, '${row.scope}'::public.work_calendar_scope, '${row.holiday_date}'::date, '${label}') ON CONFLICT (calendar_year, scope, holiday_date) DO NOTHING;`,
      );
    }
    fs.writeFileSync(args.sql, lines.join('\n') + '\n', 'utf8');
    console.error('SQL escrito:', args.sql);
  }

  if (!args.json && !args.sql) {
    process.stdout.write(JSON.stringify(allJson, null, 2) + '\n');
  }
}

main();
