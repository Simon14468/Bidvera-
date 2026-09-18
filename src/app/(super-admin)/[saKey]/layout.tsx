import { assertSaKey } from "@/lib/super-admin-guard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: "Control",
};

export default async function SaKeyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ saKey: string }>;
}) {
  const { saKey } = await params;
  assertSaKey(saKey);
  return children;
}
