import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/site-chrome";

export default function MarketingSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <main className="min-w-0 flex-1">{children}</main>
      <MarketingFooter />
    </>
  );
}
