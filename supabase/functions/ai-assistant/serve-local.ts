/** Harness local: escucha solo en 127.0.0.1. No se despliega; el entrypoint remoto sigue siendo index.ts. */
const orig = Deno.serve.bind(Deno);
const hostname = Deno.env.get("AI_LISTEN_HOST") || "127.0.0.1";
const port = Number(Deno.env.get("PORT") || "8790");
Deno.serve = ((arg: unknown, maybe?: unknown) => {
  if (typeof arg === "function") {
    return orig({ hostname, port }, arg as Deno.ServeHandler);
  }
  return orig({ hostname, port, ...(arg as object) }, maybe as Deno.ServeHandler);
}) as typeof Deno.serve;
await import("./index.ts");
