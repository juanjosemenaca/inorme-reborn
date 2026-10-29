export type CatalogModule = "FACTURACION" | "GASTOS" | "ADMIN_CLIENTS" | "ADMIN_PROJECTS";

export type CatalogTopic = "invoice" | "client" | "project" | "expense";

export type CatalogField = {
  name: string;
  meaning: string;
  values?: string;
};

export type CatalogEntity = {
  topic: CatalogTopic;
  module: CatalogModule;
  title: string;
  summary: string;
  groups: { title: string; fields: CatalogField[] }[];
};

export const CATALOG_ENTITIES: CatalogEntity[] = [
  {
    topic: "invoice",
    module: "FACTURACION",
    title: "Factura",
    summary:
      "Cada factura guarda cabecera, líneas, cobros y un snapshot fiscal del emisor y del cliente en el momento de emitir. Los borradores se pueden editar; al emitir, los datos fiscales quedan inmutables (anulación o rectificativa, no borrado).",
    groups: [
      {
        title: "Identificación",
        fields: [
          { name: "Emisor", meaning: "Empresa que factura (INORME u otro emisor activo)." },
          { name: "Serie", meaning: "Serie de numeración (p. ej. A)." },
          { name: "Ejercicio", meaning: "Año fiscal. Se fija al emitir." },
          { name: "Número", meaning: "Número correlativo dentro de la serie y el año. Vacío en borrador; se asigna al emitir." },
          { name: "Estado", meaning: "Ciclo de la factura.", values: "DRAFT (borrador), ISSUED (emitida), PAID (pagada), CANCELLED (anulada)" },
          { name: "Tipo", meaning: "Factura normal o rectificativa.", values: "NORMAL, RECTIFICATIVE" },
          { name: "Rectifica a", meaning: "Si es rectificativa, la factura original a la que corrige." },
        ],
      },
      {
        title: "Fechas y comentario",
        fields: [
          { name: "Fecha de factura", meaning: "Fecha de emisión que aparece en el documento." },
          { name: "Fecha de vencimiento", meaning: "Hasta cuándo se espera el cobro. Si está pendiente y ya pasó, se considera vencida." },
          { name: "Comentario / notas", meaning: "Texto libre interno (a menudo referencia de pedido o albarán)." },
        ],
      },
      {
        title: "Cliente (destinatario)",
        fields: [
          { name: "Cliente", meaning: "Ficha de cliente vinculada." },
          { name: "Razón social, CIF y dirección fiscal", meaning: "Copia (snapshot) en la factura para que no cambie si luego se edita el cliente." },
          { name: "Web y destinatario de factura", meaning: "Opcionales, para el PDF." },
        ],
      },
      {
        title: "Emisor (snapshot)",
        fields: [
          { name: "Nombre, CIF y dirección fiscal del emisor", meaning: "Copia en la factura al emitir." },
          { name: "IBAN, SWIFT y banco", meaning: "Datos de cobro del emisor en el PDF. El asistente no recita IBAN completos." },
          { name: "Logo, web, email y teléfono", meaning: "Contacto y marca que salen en el documento." },
        ],
      },
      {
        title: "Importes",
        fields: [
          { name: "Base imponible", meaning: "Suma de bases de las líneas facturables." },
          { name: "IVA", meaning: "Suma del IVA de las líneas." },
          { name: "IRPF", meaning: "Retención, si aplica." },
          { name: "Total", meaning: "Importe con IVA (grand total)." },
          { name: "Cobrado", meaning: "Suma de los recibos de cobro registrados." },
          { name: "Estado de cobro", meaning: "PENDING, PARTIAL o PAID según lo cobrado frente al total." },
        ],
      },
      {
        title: "Líneas",
        fields: [
          { name: "Tipo de línea", meaning: "BILLABLE (entra en el importe), CONCEPT (texto), BLOCK_TITLE / BLOCK_SUBTITLE (apartados)." },
          { name: "Descripción", meaning: "Concepto que ve el cliente." },
          { name: "Cantidad y precio unitario", meaning: "Solo relevantes en líneas BILLABLE." },
          { name: "% facturable", meaning: "Porcentaje de la cantidad que entra en el importe (p. ej. horas). 100 = íntegro." },
          { name: "IVA % e IRPF %", meaning: "Tipos de la línea (IVA 21, 10 o 4)." },
          { name: "Base, IVA, IRPF e importe de línea", meaning: "Calculados al guardar. Las no BILLABLE van a cero." },
        ],
      },
      {
        title: "Cobros",
        fields: [
          { name: "Fecha del cobro", meaning: "Cuándo se registró el ingreso." },
          { name: "Importe", meaning: "Cantidad cobrada en ese recibo." },
          { name: "Método", meaning: "P. ej. transferencia." },
          { name: "Referencia y notas", meaning: "Opcionales (concepto bancario, etc.)." },
        ],
      },
      {
        title: "Integridad (no se enseña al cliente)",
        fields: [
          { name: "Huella de registro", meaning: "Hash de integridad de la factura emitida (Verifactu). No se listan valores." },
          { name: "Huella anterior", meaning: "Encadenado con la factura previa de la serie." },
          { name: "QR Verifactu", meaning: "Payload para el código QR legal. El asistente no lo vuelca." },
        ],
      },
    ],
  },
  {
    topic: "client",
    module: "ADMIN_CLIENTS",
    title: "Cliente",
    summary: "Ficha comercial: quién contrata, datos fiscales y contactos. Las facturas copian razón social, CIF y dirección al emitir.",
    groups: [
      {
        title: "Ficha",
        fields: [
          { name: "Nombre comercial y razón social", meaning: "Cómo se muestra y cómo factura." },
          { name: "CIF", meaning: "Identificación fiscal." },
          { name: "Dirección postal y fiscal", meaning: "Operativa vs fiscal." },
          { name: "Tipo", meaning: "Cliente final o intermediario.", values: "FINAL, INTERMEDIARIO" },
          { name: "Cliente final vinculado", meaning: "Si es intermediario, el cliente final opcional." },
          { name: "Teléfono, email y web", meaning: "Contacto de empresa." },
          { name: "Destinatario de facturación", meaning: "A quién va dirigida la factura en el PDF." },
          { name: "Activo", meaning: "Si se puede usar en proyectos y facturas nuevas." },
          { name: "Notas", meaning: "Uso interno." },
        ],
      },
      {
        title: "Personas de contacto",
        fields: [
          { name: "Nombre, email y móvil", meaning: "Interlocutor." },
          { name: "Cargo y descripción", meaning: "Rol en la empresa del cliente." },
          { name: "Propósito", meaning: "GENERAL (habitual) o INVOICE (destinatario de factura)." },
        ],
      },
    ],
  },
  {
    topic: "project",
    module: "ADMIN_PROJECTS",
    title: "Proyecto",
    summary: "Encargo vinculado a un cliente. No hay estado explícito ni facturación/coste por proyecto: el estado se deduce de las fechas de inicio y fin.",
    groups: [
      {
        title: "Datos",
        fields: [
          { name: "Código", meaning: "Identificador (p. ej. PRJ-000123)." },
          { name: "Título y descripción", meaning: "Nombre del encargo." },
          { name: "Cliente contratante", meaning: "Quién encarga el trabajo." },
          { name: "Cliente final", meaning: "Opcional si el contratante es intermediario." },
          { name: "Fechas de inicio y fin", meaning: "De ellas se deriva si está activo, próximo a acabar, etc." },
          { name: "Responsable", meaning: "Trabajador de Inorme responsable." },
          { name: "Equipo", meaning: "Miembros con rol (consultor, programador, etc.)." },
          { name: "Documentos", meaning: "Ficheros asociados al proyecto." },
        ],
      },
    ],
  },
  {
    topic: "expense",
    module: "GASTOS",
    title: "Gastos de trabajador",
    summary: "Hojas de gastos por período, con líneas y categorías. El ADMIN ve todas; un trabajador solo las suyas.",
    groups: [
      {
        title: "Hoja",
        fields: [
          { name: "Trabajador", meaning: "Ficha de company worker." },
          { name: "Período", meaning: "Fecha inicio y fin de la hoja." },
          { name: "Estado", meaning: "DRAFT, SUBMITTED, APPROVED, REJECTED." },
        ],
      },
      {
        title: "Líneas / categorías",
        fields: [
          { name: "Fecha del gasto", meaning: "Día del ticket." },
          { name: "Billetes, taxis/parking, km/combustible, peajes, dietas, hotel, material, otros", meaning: "Importes por categoría en cada línea." },
        ],
      },
    ],
  },
];

const TOPIC_ALIASES: Record<string, CatalogTopic | "all"> = {
  invoice: "invoice",
  factura: "invoice",
  facturas: "invoice",
  facturacion: "invoice",
  billing: "invoice",
  client: "client",
  cliente: "client",
  clientes: "client",
  project: "project",
  proyecto: "project",
  proyectos: "project",
  expense: "expense",
  gasto: "expense",
  gastos: "expense",
  all: "all",
  todo: "all",
  todos: "all",
  modelo: "all",
  campos: "all",
};

export function resolveCatalogTopic(raw: string | undefined): CatalogTopic | "all" {
  const k = (raw ?? "all")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return TOPIC_ALIASES[k] ?? "all";
}

export function entitiesForTopic(topic: CatalogTopic | "all"): CatalogEntity[] {
  if (topic === "all") return CATALOG_ENTITIES;
  return CATALOG_ENTITIES.filter((e) => e.topic === topic);
}
