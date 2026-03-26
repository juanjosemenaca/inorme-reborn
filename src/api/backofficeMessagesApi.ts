import { getProfileByAuthUserId } from "@/api/backofficeUsersApi";
import { requireSupabase } from "@/api/supabaseRequire";
import { getErrorMessage } from "@/lib/errorMessage";
import type { BackofficeMessageRow } from "@/types/database";
import type { BackofficeMessageRecord } from "@/types/backofficeMessages";

function throwErr(error: unknown): never {
  throw new Error(getErrorMessage(error));
}

function rowToDomain(row: BackofficeMessageRow): BackofficeMessageRecord {
  return {
    id: row.id,
    recipientBackofficeUserId: row.recipient_backoffice_user_id,
    category: row.category,
    title: row.title,
    body: row.body,
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export type CreateBackofficeMessageInput = {
  category?: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

export async function createBackofficeMessage(
  recipientBackofficeUserId: string,
  input: CreateBackofficeMessageInput
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("backoffice_messages").insert({
    recipient_backoffice_user_id: recipientBackofficeUserId,
    category: (input.category ?? "GENERAL").trim() || "GENERAL",
    title: input.title.trim(),
    body: input.body.trim(),
    payload: input.payload ?? {},
  });
  if (error) throwErr(error);
}

async function requireCurrentBackofficeProfileId(): Promise<string> {
  const sb = requireSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Sesion no valida.");
  const profile = await getProfileByAuthUserId(user.id);
  if (!profile) throw new Error("No se pudo resolver el perfil backoffice.");
  return profile.id;
}

export async function fetchMyBackofficeMessages(limit = 200): Promise<BackofficeMessageRecord[]> {
  const sb = requireSupabase();
  const profileId = await requireCurrentBackofficeProfileId();
  const { data, error } = await sb
    .from("backoffice_messages")
    .select("*")
    .eq("recipient_backoffice_user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, limit)));
  if (error) throwErr(error);
  return (data ?? []).map((r) => rowToDomain(r as BackofficeMessageRow));
}

export async function countMyUnreadBackofficeMessages(): Promise<number> {
  const sb = requireSupabase();
  const profileId = await requireCurrentBackofficeProfileId();
  const { count, error } = await sb
    .from("backoffice_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_backoffice_user_id", profileId)
    .is("read_at", null);
  if (error) throwErr(error);
  return count ?? 0;
}

export async function markBackofficeMessageAsRead(messageId: string): Promise<void> {
  const sb = requireSupabase();
  const profileId = await requireCurrentBackofficeProfileId();
  const { error } = await sb
    .from("backoffice_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_backoffice_user_id", profileId);
  if (error) throwErr(error);
}
