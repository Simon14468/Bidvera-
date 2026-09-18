import type { ClientRequestStatus } from "@prisma/client";

export function calcProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Derive request status from items + deadline.
 * CANCELLED is sticky until explicitly cleared (caller passes cancelled=true).
 */
export function deriveRequestStatus(input: {
  cancelled: boolean;
  totalItems: number;
  completedItems: number;
  deadline: Date;
  deadlineDateOnly: boolean;
  now?: Date;
}): ClientRequestStatus {
  if (input.cancelled) return "CANCELLED";
  if (input.totalItems > 0 && input.completedItems >= input.totalItems) {
    return "COMPLETED";
  }

  const now = input.now ?? new Date();
  const overdue = isDeadlinePassed(input.deadline, input.deadlineDateOnly, now);
  if (overdue) return "OVERDUE";
  if (input.completedItems > 0) return "IN_PROGRESS";
  return "PENDING";
}

export function isDeadlinePassed(
  deadline: Date,
  dateOnly: boolean,
  now: Date = new Date(),
): boolean {
  if (dateOnly) {
    const todayYmd = now.toISOString().slice(0, 10);
    const deadlineYmd = deadline.toISOString().slice(0, 10);
    return deadlineYmd < todayYmd;
  }
  return deadline.getTime() < now.getTime();
}
