import type { BackofficeMessageRecord } from "@/types/backofficeMessages";

export function timeClockCorrectionStatus(
  payload: Record<string, unknown> | undefined
): "PENDING" | "APPROVED" | "REJECTED" {
  const raw = payload?.requestStatus;
  if (raw === "APPROVED" || raw === "REJECTED") return raw;
  return "PENDING";
}

export function isTimeClockCorrectionForRecipient(
  message: Pick<BackofficeMessageRecord, "category" | "recipientBackofficeUserId">,
  recipientUserId: string
): boolean {
  return message.category === "TIME_CLOCK_CORRECTION" && message.recipientBackofficeUserId === recipientUserId;
}

export function isPendingTimeClockCorrection(
  message: Pick<BackofficeMessageRecord, "category" | "recipientBackofficeUserId" | "payload">,
  recipientUserId: string
): boolean {
  return (
    isTimeClockCorrectionForRecipient(message, recipientUserId) &&
    timeClockCorrectionStatus(message.payload) === "PENDING"
  );
}

export function pendingTimeClockCorrectionCount(
  messages: readonly Pick<
    BackofficeMessageRecord,
    "category" | "recipientBackofficeUserId" | "payload"
  >[],
  recipientUserId: string
): number {
  if (!recipientUserId) return 0;
  return messages.filter((m) => isPendingTimeClockCorrection(m, recipientUserId)).length;
}
