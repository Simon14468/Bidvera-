import { AuthMarketingHeader } from "@/components/marketing/auth-marketing-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function MarketingAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthMarketingHeader />
      <main className="min-w-0 flex-1">{children}</main>
    </>
  );
}
