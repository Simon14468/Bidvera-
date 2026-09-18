import { z } from "zod";
import { DEADLINE_TYPES, TENDER_STATUSES } from "../constants";

const deadlineType = z.enum(DEADLINE_TYPES);
const tenderStatus = z.enum(TENDER_STATUSES);

export const tenderCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  referenceNumber: z.string().trim().max(120).nullable().optional(),
  buyerAuthority: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  status: tenderStatus.optional(),
  sourceUrl: z
    .union([z.string().trim().url().max(500), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  notes: z.string().trim().max(10_000).nullable().optional(),
});

export const tenderUpdateSchema = tenderCreateSchema.partial().extend({
  title: z.string().trim().min(1).max(300).optional(),
});

export const milestoneInputSchema = z.object({
  type: deadlineType.default("SUBMISSION"),
  title: z.string().trim().min(1).max(300),
  date: z.string().trim().optional().nullable(),
  dateTime: z.string().trim().optional().nullable(),
  dateOnly: z.boolean().optional(),
  timezone: z.string().trim().max(64).nullable().optional(),
  source: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const reminderSettingsSchema = z.object({
  remind30d: z.boolean().optional(),
  remind14d: z.boolean().optional(),
  remind7d: z.boolean().optional(),
  remind3d: z.boolean().optional(),
  remind1d: z.boolean().optional(),
  remindSameDay: z.boolean().optional(),
});

export type TenderCreateInput = z.input<typeof tenderCreateSchema>;
export type MilestoneInput = z.input<typeof milestoneInputSchema>;
export type ReminderSettingsInput = z.input<typeof reminderSettingsSchema>;
