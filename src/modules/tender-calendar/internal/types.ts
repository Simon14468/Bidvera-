import type {
  CalendarDeadlineType,
  CalendarMilestoneStatus,
  CalendarReminderOffset,
  CalendarTenderStatus,
} from "@prisma/client";

export type CalendarTenderDto = {
  id: string;
  companyId: string;
  title: string;
  referenceNumber: string | null;
  buyerAuthority: string | null;
  country: string | null;
  category: string | null;
  description: string | null;
  status: CalendarTenderStatus;
  sourceUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deadlineCount?: number;
  nextDeadlineAt?: string | null;
};

export type CalendarDeadlineDto = {
  id: string;
  companyId: string;
  tenderId: string;
  type: CalendarDeadlineType;
  title: string;
  occursAt: string;
  dateOnly: boolean;
  timezone: string | null;
  source: string | null;
  notes: string | null;
  status: CalendarMilestoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventDto = {
  id: string;
  companyId: string;
  tenderId: string;
  type: CalendarDeadlineType;
  title: string;
  occursAt: string;
  dateOnly: boolean;
  timezone: string | null;
  source: string | null;
  notes: string | null;
  status: CalendarMilestoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReminderSettingsDto = {
  remind30d: boolean;
  remind14d: boolean;
  remind7d: boolean;
  remind3d: boolean;
  remind1d: boolean;
  remindSameDay: boolean;
};

export type CalendarDashboardDto = {
  upcoming: Array<CalendarDeadlineDto & { tenderTitle: string }>;
  past: Array<CalendarDeadlineDto & { tenderTitle: string }>;
  tenderCount: number;
};

export type ReminderPlan = {
  offset: CalendarReminderOffset;
  daysBefore: number;
  settingKey: keyof ReminderSettingsDto;
};
