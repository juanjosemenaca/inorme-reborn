import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&";
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "Server not configured" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData.user) return json(401, { error: "Unauthorized" });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: caller, error: callerErr } = await admin
    .from("backoffice_users")
    .select("id, role, active")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (callerErr || !caller || caller.role !== "ADMIN" || caller.active !== true) {
    return json(403, { error: "Forbidden" });
  }

  let userId = "";
  try {
    const body = await req.json();
    userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!userId) return json(400, { error: "userId required" });
  if (userId === caller.id) {
    return json(400, { error: "Cannot reset own password this way" });
  }

  const { data: target, error: targetErr } = await admin
    .from("backoffice_users")
    .select("id, auth_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (targetErr || !target?.auth_user_id) {
    return json(404, { error: "User not found" });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: pwErr } = await admin.auth.admin.updateUserById(target.auth_user_id, {
    password: temporaryPassword,
  });
  if (pwErr) return json(500, { error: pwErr.message });

  const { error: flagErr } = await admin
    .from("backoffice_users")
    .update({ must_change_password: true, password_changed_at: null })
    .eq("id", target.id);
  if (flagErr) return json(500, { error: flagErr.message });

  return json(200, { temporaryPassword });
});
