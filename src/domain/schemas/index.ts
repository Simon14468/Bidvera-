import { z } from "zod";
import { ALLOWED_DOCUMENT_MIME_TYPES, UPLOAD_LIMITS } from "@/config/server";
import { isReservedSaEnterFingerprint } from "@/auth/super-admin-enter";

/** Public auth may send a fingerprint — never a forged Super Admin enter marker. */
const publicDeviceFingerprintSchema = z
  .string()
  .max(128)
  .optional()
  .refine((v) => !isReservedSaEnterFingerprint(v), {
    message: "Invalid device fingerprint.",
  });

/** Minimum length for new / changed / reset passwords. Login still accepts older hashes. */
export const PASSWORD_MIN_LENGTH = 12;

/** Cloudflare Turnstile token from the widget — verified server-side only. */
export const turnstileTokenSchema = z.string().trim().min(1).max(2048).optional();

export const createAccountSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
  acceptTerms: z
    .boolean()
    .refine((v) => v === true, { message: "You must accept the Terms and Privacy Policy." }),
  deviceFingerprint: publicDeviceFingerprintSchema,
  turnstileToken: turnstileTokenSchema,
});

/** Legacy signup shape — maps to create-account fields */
export const signupSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().max(255),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
    companyName: z.string().min(2).max(160).optional(),
    acceptTerms: z.boolean().optional(),
    deviceFingerprint: publicDeviceFingerprintSchema,
    turnstileToken: turnstileTokenSchema,
  })
  .transform((v) => ({
    email: v.email,
    password: v.password,
    acceptTerms: true as const,
    deviceFingerprint: v.deviceFingerprint,
    turnstileToken: v.turnstileToken,
  }));

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceFingerprint: publicDeviceFingerprintSchema,
  turnstileToken: turnstileTokenSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
  turnstileToken: turnstileTokenSchema,
});

export const updateAccountProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    /** Required when the email address is changing (step-up re-auth). */
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .superRefine((v, ctx) => {
    // Password presence for email change is enforced server-side against the
    // stored email — clients can omit it when only the name changes.
    if (v.currentPassword !== undefined && v.currentPassword.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your current password.",
        path: ["currentPassword"],
      });
    }
  });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
  turnstileToken: turnstileTokenSchema,
});

export const companyOnboardingSchema = z.object({
  companyName: z.string().min(2).max(160),
  industry: z.string().min(2).max(120),
  companySize: z.enum(["Solo", "Small", "Medium", "Enterprise"]),
  services: z
    .array(z.string().min(1).max(80))
    .min(1, "Add at least one service or capability.")
    .max(30),
  country: z.string().min(2).max(80),
  /** Optional — tender-fit context only */
  experienceLevel: z
    .enum(["new", "some", "experienced", "highly_experienced"])
    .optional()
    .nullable(),
  deviceFingerprint: publicDeviceFingerprintSchema,
  turnstileToken: turnstileTokenSchema,
});

export const selectPlanSchema = z.object({
  kind: z.enum(["trial", "free", "paid"]),
  planId: z.string().min(1).max(64).optional(),
  gateway: z.enum(["stripe", "paypal"]).optional(),
  interval: z.enum(["MONTH", "YEAR"]).optional(),
  turnstileToken: turnstileTokenSchema,
});

export const companyProfileSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  industry: z.string().max(120).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  companySize: z.string().max(80).optional().nullable(),
  experienceLevel: z.string().max(40).optional().nullable(),
  services: z.array(z.string().max(80)).max(50).default([]),
  certifications: z.array(z.string().max(80)).max(50).default([]),
  experienceYears: z.number().int().min(0).max(200).optional().nullable(),
  revenueRange: z.string().max(80).optional().nullable(),
  employeeRange: z.string().max(80).optional().nullable(),
  geographicCoverage: z.array(z.string().max(80)).max(50).default([]),
  contractSizeMin: z.number().int().min(0).optional().nullable(),
  contractSizeMax: z.number().int().min(0).optional().nullable(),
  customQualificationRules: z.array(z.string().max(500)).max(30).default([]),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const tenderFiltersSchema = z.object({
  query: z.string().optional(),
  decision: z.enum(["BID", "REVIEW", "NO_BID", "ALL"]).default("ALL"),
  risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL", "ALL"]).default("ALL"),
  deadline: z.enum(["ALL", "7D", "14D", "30D", "OVERDUE"]).default("ALL"),
  sort: z
    .enum(["deadline_asc", "deadline_desc", "fit_desc", "analyzed_desc", "title_asc"])
    .default("analyzed_desc"),
});

export type TenderFilters = z.infer<typeof tenderFiltersSchema>;

export const tenderUploadMetaSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(UPLOAD_LIMITS.maxFileBytes),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  title: z.string().min(2).max(300).optional(),
  idempotencyKey: z.string().max(64).optional(),
});

/** Multi-file Tender Package upload (1–N files; N from UPLOAD_LIMITS). */
export const tenderPackageUploadSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().positive().max(UPLOAD_LIMITS.maxFileBytes),
        mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
      }),
    )
    .min(1, "At least one file is required.")
    .max(
      UPLOAD_LIMITS.maxFilesPerPackage,
      `A Tender Package accepts a maximum of ${UPLOAD_LIMITS.maxFilesPerPackage} documents.`,
    ),
  title: z.string().min(2).max(300).optional(),
  idempotencyKey: z.string().max(64).optional(),
});

/** Structured AI extraction output */
export const extractedRequirementSchema = z.object({
  category: z.string(),
  description: z.string(),
  mandatory: z.boolean().default(true),
  value: z.string().nullable().optional(),
  sourcePage: z.number().int().nullable().optional(),
  sourceSection: z.string().nullable().optional(),
  evidenceText: z.string().nullable().optional(),
  verificationStatus: z.enum(["VERIFIED", "INFERRED", "UNKNOWN"]).default("UNKNOWN"),
});

export const extractionResultSchema = z.object({
  title: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  deadlineIso: z.string().nullable().optional(),
  deadlineTimezone: z.string().nullable().optional(),
  estimatedValue: z.number().int().nullable().optional(),
  guarantee: z.string().nullable().optional(),
  requirements: z.array(extractedRequirementSchema),
  missingDocuments: z
    .array(
      z.object({
        documentName: z.string(),
        reason: z.string(),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      }),
    )
    .default([]),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const aiReasoningResultSchema = z.object({
  suggestedDecision: z.enum(["BID", "REVIEW", "NO_BID"]),
  fitScore: z.number().int().min(0).max(100),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reasoning: z.string(),
  fitBreakdown: z
    .object({
      serviceMatch: z.number().int().min(0).max(100).nullable().optional(),
      industryMatch: z.number().int().min(0).max(100).nullable().optional(),
      experienceMatch: z.number().int().min(0).max(100).nullable().optional(),
      sizeFit: z.number().int().min(0).max(100).nullable().optional(),
      requirementsMatch: z.number().int().min(0).max(100).nullable().optional(),
      overallFit: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  risks: z.array(
    z.object({
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      category: z.string(),
      description: z.string(),
      sourcePage: z.number().int().nullable().optional(),
      mitigation: z.string().nullable().optional(),
    }),
  ),
  nextActions: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
      priority: z.number().int().default(1),
    }),
  ),
});

export type AiReasoningResult = z.infer<typeof aiReasoningResultSchema>;
