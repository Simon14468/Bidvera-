import Link from "next/link";
import { Alert } from "@/components/ui/alert";

type FeatureUpgradeNoticeProps = {
  featureName: string;
  description?: string;
};

/** Shown when a plan-gated feature is unavailable — no sensitive internals. */
export function FeatureUpgradeNotice({
  featureName,
  description,
}: FeatureUpgradeNoticeProps) {
  return (
    <Alert variant="warning" title={`${featureName} not included`}>
      <p className="text-sm">
        {description ??
          `${featureName} is not included in your current plan. Upgrade to unlock this capability.`}
      </p>
      <Link
        href="/upgrade"
        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
      >
        View upgrade options →
      </Link>
    </Alert>
  );
}
