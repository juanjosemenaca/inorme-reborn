import { z } from "npm:zod@3.23.8";
import { hasModule } from "../permissions.ts";
import { entitiesForTopic, resolveCatalogTopic } from "./catalogData.ts";
import { ToolError, type AiTool } from "./types.ts";

const CatalogArgs = z.object({
  topic: z.string().trim().max(40).optional(),
});

export const getDataCatalog: AiTool = {
  definition: {
    type: "function",
    function: {
      name: "get_data_catalog",
      description:
        "Explica qué datos guarda Inorme (campos de factura, cliente, proyecto o gastos). Úsala cuando pregunten qué campos hay, qué se almacena, el modelo de datos o cómo está montada una factura. No es SQL: catálogo de negocio. topic: invoice, client, project, expense o all.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "invoice (factura), client, project, expense o all. Por defecto all según permisos.",
          },
        },
        required: [],
      },
    },
  },
  async run(ctx, raw) {
    const args = CatalogArgs.parse(raw ?? {});
    const topic = resolveCatalogTopic(args.topic);
    const entities = entitiesForTopic(topic).filter((e) => hasModule(ctx.principal, e.module));
    if (entities.length === 0) {
      throw new ToolError(
        "forbidden_topic",
        topic === "all"
          ? "No hay áreas de datos disponibles para este usuario."
          : "Este usuario no tiene acceso a esa área. No detallo esos campos."
      );
    }
    return {
      topic,
      note: "Catálogo de negocio. No hay SQL libre. No se listan secretos, hashes ni IBAN.",
      entities,
    };
  },
};

export const catalogTools: AiTool[] = [getDataCatalog];
