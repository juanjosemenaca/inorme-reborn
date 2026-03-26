export interface BackofficeMessageRecord {
  id: string;
  recipientBackofficeUserId: string;
  category: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
