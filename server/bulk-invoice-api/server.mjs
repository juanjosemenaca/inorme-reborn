/**
 * API: POST /api/bulk-invoices/generate (multipart file)
 * Requiere: Authorization: Bearer <access_token Supabase>, usuario ADMIN en backoffice_users.
 * Env: SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_URL o VITE_SUPABASE_URL). Se carga `.env` de la raíz del repo automáticamente.
 */
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath, pathToFileURL } from "url";
import os from "os";
import { finished } from "node:stream/promises";
import dotenv from "dotenv";

import Fastify from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import archiver from "archiver";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

import {
  buildRowMap,
  buildVarsFromRow,
  fillTemplate,
  parseWorkbookBuffer,
  sanitizeFilePart,
  uniqueZipEntryName,
  validateRow,
} from "../../scripts/bulk-invoice-generator/lib/invoiceCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const REPO_ROOT = path.join(__dirname, "../..");
const TEMPLATE_PATH = path.join(REPO_ROOT, "scripts/bulk-invoice-generator/template.html");
const DEFAULT_LOGO_PATH = path.join(REPO_ROOT, "public/favicon.png");
const DEFAULT_LOGO_URL = fs.existsSync(DEFAULT_LOGO_PATH) ? pathToFileURL(DEFAULT_LOGO_PATH).href : "";

const MAX_FILE_MB = Number(process.env.BULK_INVOICE_MAX_MB || "50");

async function verifyAdminToken(token) {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_SERVICE_ROLE_KEY o URL de Supabase. Añádelas al .env de la raíz del repo y reinicia el API (también puedes usar VITE_SUPABASE_URL como URL).",
    );
  }
  const supabase = createClient(url, key);
  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData?.user) return null;
  const user = userData.user;
  const { data: row, error: qerr } = await supabase
    .from("backoffice_users")
    .select("role, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (qerr || !row?.active) return null;
  if (String(row.role ?? "").toUpperCase() !== "ADMIN") return null;
  return user;
}

function toDataUrl(buffer, mimeType) {
  const safeMime = typeof mimeType === "string" && mimeType.trim() ? mimeType.trim() : "image/png";
  return `data:${safeMime};base64,${buffer.toString("base64")}`;
}

async function buildZipOfPdfs(rows, templateRaw, log, logoUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(120_000);
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

  const tmpDir = os.tmpdir();
  const zipPath = path.join(tmpDir, `facturas-${randomUUID()}.zip`);
  const output = fs.createWriteStream(zipPath);

  const archive = archiver("zip", { zlib: { level: 6 } });
  let archiveErr;
  archive.on("error", (err) => {
    archiveErr = err;
  });
  archive.pipe(output);

  const usedNames = new Set();
  let generated = 0;
  let skipped = 0;
  const skippedReasons = [];

  try {
    for (let i = 0; i < rows.length; i += 1) {
      if (archiveErr) throw archiveErr;
      try {
        const m = buildRowMap(rows[i]);
        const check = validateRow(m);
        if (!check.ok) {
          skipped += 1;
          if (skippedReasons.length < 5) {
            skippedReasons.push(`Fila ${i + 2}: ${check.issues.join(", ")}`);
          }
          continue;
        }
        const vars = buildVarsFromRow(m, { logoUrl });
        const html = fillTemplate(templateRaw, vars);
        // "load" evita timeouts de networkidle con HTML offline (sin red).
        await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
        const pdfRaw = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "16mm", right: "14mm", bottom: "18mm", left: "14mm" },
        });
        const pdfBuf = Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
        const base = `factura_${sanitizeFilePart(check.num)}`;
        const entryName = uniqueZipEntryName(usedNames, base);
        archive.append(pdfBuf, { name: entryName });
        generated += 1;
        if (generated % 200 === 0) {
          log.info({ generated, skipped, total: rows.length }, "bulk-invoice progress");
        }
      } catch (rowErr) {
        const inner = rowErr instanceof Error ? rowErr.message : String(rowErr);
        throw new Error(
          `Fila de datos ${i + 1} del Excel (la fila 1 son cabeceras): ${inner}`,
        );
      }
    }
    await archive.finalize();
    if (archiveErr) throw archiveErr;
  } finally {
    await browser.close().catch(() => {});
  }

  await finished(output);
  return { zipPath, generated, skipped, skippedReasons };
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error("No se encuentra la plantilla:", TEMPLATE_PATH);
    process.exit(1);
  }
  console.log("Plantilla:", TEMPLATE_PATH);

  const app = Fastify({
    logger: true,
    bodyLimit: (MAX_FILE_MB + 5) * 1024 * 1024,
  });

  const origins = process.env.BULK_INVOICE_CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: origins?.length ? origins : true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/api/bulk-invoices/generate", async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Falta token de autorización." });
    }
    const token = auth.slice("Bearer ".length).trim();
    let adminUser;
    try {
      adminUser = await verifyAdminToken(token);
    } catch (e) {
      request.log.error(e);
      const msg = e instanceof Error ? e.message : "Configuración del servidor incompleta.";
      return reply.code(500).send({ error: msg });
    }
    if (!adminUser) {
      return reply.code(403).send({ error: "Solo administradores activos pueden generar facturas." });
    }

    let excelBuffer;
    let logoDataUrl = "";
    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "field") {
          continue;
        }
        if (part.type !== "file") continue;
        if (part.fieldname === "file" && !excelBuffer) {
          excelBuffer = await part.toBuffer();
          continue;
        }
        if (part.fieldname === "logo") {
          if (!part.mimetype?.startsWith("image/")) {
            return reply.code(400).send({ error: "El logo debe ser una imagen (PNG/JPG/SVG/WEBP)." });
          }
          const logoBuf = await part.toBuffer();
          if (!logoBuf.length) {
            return reply.code(400).send({ error: "La imagen del logo está vacía." });
          }
          logoDataUrl = toDataUrl(logoBuf, part.mimetype);
          continue;
        }
        await part.toBuffer();
      }
    } catch (e) {
      return reply.code(400).send({ error: "Archivo demasiado grande o inválido." });
    }
    if (!excelBuffer) {
      return reply.code(400).send({ error: "Sube un archivo Excel (.xlsx) en el campo «file»." });
    }

    const buffer = excelBuffer;
    let rows;
    let headers;
    try {
      ({ rows, headers } = parseWorkbookBuffer(buffer));
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "Excel inválido." });
    }
    if (!rows.length) {
      return reply.code(400).send({ error: "El Excel no tiene filas de datos." });
    }

    const templateRaw = await fsp.readFile(TEMPLATE_PATH, "utf8");
    let zipPath;
    let generated;
    let skipped;
    let skippedReasons;
    try {
      const finalLogoUrl =
        logoDataUrl || process.env.BULK_INVOICE_LOGO_URL || DEFAULT_LOGO_URL;
      ({ zipPath, generated, skipped, skippedReasons } = await buildZipOfPdfs(rows, templateRaw, request.log, finalLogoUrl));
    } catch (e) {
      request.log.error(e);
      const rowMsg = e instanceof Error ? e.message : "Error al generar PDFs.";
      return reply.code(500).send({
        error: rowMsg.startsWith("Fila de datos") ? rowMsg : `Error al generar PDFs: ${rowMsg}`,
      });
    }

    if (generated === 0) {
      await fsp.unlink(zipPath).catch(() => {});
      const headersHint =
        Array.isArray(headers) && headers.length > 0
          ? ` Cabeceras detectadas: ${headers.join(", ")}.`
          : "";
      const hint = Array.isArray(skippedReasons) && skippedReasons.length > 0 ? ` Ejemplos: ${skippedReasons.join(" | ")}` : "";
      return reply.code(400).send({
        error: `Ninguna fila válida (comprueba número de factura).${headersHint}${hint}`,
        skipped,
      });
    }

    const stream = fs.createReadStream(zipPath);
    stream.on("close", () => {
      fsp.unlink(zipPath).catch(() => {});
    });

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", 'attachment; filename="facturas.zip"');
    reply.header("X-Bulk-Invoice-Generated", String(generated));
    reply.header("X-Bulk-Invoice-Skipped", String(skipped));
    return reply.send(stream);
  });

  const port = Number(process.env.BULK_INVOICE_API_PORT || "3847");
  const host = process.env.BULK_INVOICE_API_HOST || "0.0.0.0";
  await app.listen({ port, host });
  console.log(`Bulk invoice API http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
