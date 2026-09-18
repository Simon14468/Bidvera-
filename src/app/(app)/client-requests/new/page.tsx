export const dynamic = "force-dynamic";

import { requireClientRequestsModule } from "@/modules/client-requests";
import Link from "next/link";
import { CreateClientRequestForm } from "../create-form";

export default async function NewClientRequestPage() {
  await requireClientRequestsModule();
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Client Requests
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Create request</h1>
        <p className="mt-1 text-sm text-muted">
          Capture what a client asked for. You can link existing Bidvera documents
          after creation.
        </p>
        <Link
          href="/client-requests"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          ← Back to requests
        </Link>
      </div>
      <CreateClientRequestForm />
    </div>
  );
}
