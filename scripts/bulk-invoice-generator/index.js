/**
 * Genera un PDF por fila desde un Excel de facturas.
 * Uso: node index.js <ruta/al/archivo.xlsx> [--force]
 *
 * Instalación (una vez): cd scripts/bulk-invoice-generator && npm install
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import puppeteer from "puppeteer";
import {
  buildRowMap,
  buildVarsFromRow,
  fillTemplate,
  parseWorkbookBuffer,
  resolveDiskPath,
  sanitizeFilePart,
  validateRow,
} from "./lib/invoiceCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const OUTPUT_DIR = path.join(__dirname, "output");
const DEFAULT_LOGO_PATH = path.join(__dirname, "../../public/favicon.png");
const DEFAULT_LOGO_URL = fs.existsSync(DEFAULT_LOGO_PATH) ? pathToFileURL(DEFAULT_LOGO_PATH).href : "";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const excelPath = args.filter((a) => !a.startsWith("--"))[0];

  if (!excelPath) {
    console.error("Uso: node index.js <archivo.xlsx> [--force]");
    console.error("  --force  sobrescribe PDF si ya existe el mismo nombre base.");
    process.exit(1);
  }

  const absExcel = path.isAbsolute(excelPath) ? excelPath : path.resolve(process.cwd(), excelPath);
  if (!fs.existsSync(absExcel)) {
    console.error(`No se encuentra el archivo: ${absExcel}`);
    process.exit(1);
  }
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`No se encuentra la plantilla: ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const templateRaw = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const buffer = fs.readFileSync(absExcel);
  const { rows } = parseWorkbookBuffer(buffer);
  if (rows.length === 0) {
    console.error("No hay filas de datos (solo cabecera o vacío).");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let ok = 0;
  let skipped = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const m = buildRowMap(row);
      const check = validateRow(m);
      if (!check.ok) {
        console.warn(`Fila ${i + 2}: omitida (${check.issues.join(", ")})`);
        skipped += 1;
        continue;
      }

      const vars = buildVarsFromRow(m, {
        logoUrl: process.env.BULK_INVOICE_LOGO_URL || DEFAULT_LOGO_URL,
      });
      const html = fillTemplate(templateRaw, vars);
      await page.setContent(html, { waitUntil: "networkidle0" });

      const baseFileName = `factura_${sanitizeFilePart(check.num)}`;
      const outPath = resolveDiskPath(OUTPUT_DIR, baseFileName, force);
      await page.pdf({
        path: outPath,
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", right: "14mm", bottom: "18mm", left: "14mm" },
      });
      console.log(`OK → ${outPath}`);
      ok += 1;
    }
  } finally {
    await browser.close();
  }

  console.log(`\nResumen: ${ok} PDF generados, ${skipped} filas omitidas.`);
  if (skipped && ok === 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
