export interface BackofficeMessageRecord {
  id: string;
  senderBackofficeUserId: string | null;
  recipientBackofficeUserId: string;
  threadId: string;
  threadTitle: string | null;
  category: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
