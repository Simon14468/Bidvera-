import { z } from "zod";
import { CLIENT_REQUEST_ITEM_TYPES, CLIENT_REQUEST_LINK_SOURCES } from "../constants";

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export const itemInputSchema = z.object({
  type: z.enum(CLIENT_REQUEST_ITEM_TYPES),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const createRequestSchema = z.object({
  clientName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  deadline: z.string().trim().regex(dateOnlyRegex, "Deadline must be YYYY-MM-DD."),
  items: z.array(itemInputSchema).min(1).max(50),
});

export const updateRequestSchema = z.object({
  clientName: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  deadline: z
    .string()
    .trim()
    .regex(dateOnlyRegex, "Deadline must be YYYY-MM-DD.")
    .optional(),
});

export const addItemSchema = itemInputSchema;

export const completeInformationSchema = z.object({
  informationValue: z.string().trim().max(5000).optional().nullable(),
});

export const linkItemSchema = z
  .object({
    linkSource: z.enum(CLIENT_REQUEST_LINK_SOURCES),
    complianceDocumentId: z.string().trim().min(1).optional().nullable(),
    supplierEvidenceId: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.linkSource === "COMPLIANCE_DOCUMENT" && !data.complianceDocumentId) {
      ctx.addIssue({
        code: "custom",
        message: "Select a Document Compliance document.",
        path: ["complianceDocumentId"],
      });
    }
    if (data.linkSource === "SUPPLIER_EVIDENCE" && !data.supplierEvidenceId) {
      ctx.addIssue({
        code: "custom",
        message: "Select Supplier Qualification evidence.",
        path: ["supplierEvidenceId"],
      });
    }
  });

export const createShareSchema = z.object({
  itemIds: z.array(z.string().trim().min(1)).min(1).max(50),
  ttlDays: z.number().int().min(1).max(90).optional(),
});

export function parseDateOnlyDeadline(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
