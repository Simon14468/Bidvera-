import { prisma } from "@/lib/db";
import type { BillingInvoice, BillingInvoiceStatus } from "@prisma/client";

export type CustomerFacingInvoice = {
  id: string;
  date: string;
  amountCents: number;
  currency: string;
  status: BillingInvoiceStatus;
  receiptUrl: string | null;
};

export function toCustomerFacingInvoice(
  row: Pick<
    BillingInvoice,
    | "id"
    | "companyId"
    | "createdAt"
    | "paidAt"
    | "amountCents"
    | "currency"
    | "status"
    | "hostedInvoiceUrl"
    | "pdfUrl"
  >,
): CustomerFacingInvoice {
  return {
    id: row.id,
    date: (row.paidAt ?? row.createdAt).toISOString(),
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    receiptUrl: row.hostedInvoiceUrl || row.pdfUrl || null,
  };
}

export async function listCustomerFacingInvoices(
  companyId: string,
): Promise<CustomerFacingInvoice[]> {
  const rows = await prisma.billingInvoice.findMany({
    where: { companyId },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      paidAt: true,
      amountCents: true,
      currency: true,
      status: true,
      hostedInvoiceUrl: true,
      pdfUrl: true,
    },
  });
  return rows
    .filter((row) => row.companyId === companyId)
    .map(toCustomerFacingInvoice);
}

function mapStripeInvoiceStatus(status: string | null | undefined): BillingInvoiceStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "open":
      return "OPEN";
    case "void":
      return "VOID";
    case "uncollectible":
      return "UNCOLLECTIBLE";
    case "draft":
      return "DRAFT";
    default:
      return "OPEN";
  }
}

/** Best-effort Stripe refresh for this company only. Never invents rows for other tenants. */
export async function refreshStripeInvoicesForCompany(companyId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    select: {
      id: true,
      companyId: true,
      provider: true,
      providerCustomerId: true,
    },
  });
  if (!sub || sub.companyId !== companyId) return;
  if (sub.provider !== "stripe" || !sub.providerCustomerId) return;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return;

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key);
    const listed = await stripe.invoices.list({
      customer: sub.providerCustomerId,
      limit: 24,
    });
    for (const invoice of listed.data) {
      if (!invoice.id) continue;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId !== sub.providerCustomerId) continue;
      await prisma.billingInvoice.upsert({
        where: {
          provider_providerInvoiceId: { provider: "STRIPE", providerInvoiceId: invoice.id },
        },
        create: {
          companyId,
          subscriptionId: sub.id,
          provider: "STRIPE",
          providerInvoiceId: invoice.id,
          number: invoice.number,
          amountCents: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency ?? "usd",
          status: mapStripeInvoiceStatus(invoice.status),
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000)
            : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
          paidAt: invoice.status === "paid" ? new Date() : null,
        },
        update: {
          amountCents: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency ?? "usd",
          status: mapStripeInvoiceStatus(invoice.status),
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          paidAt: invoice.status === "paid" ? new Date() : undefined,
        },
      });
    }
  } catch {
    // Keep stored invoices. Do not invent replacements.
  }
}
