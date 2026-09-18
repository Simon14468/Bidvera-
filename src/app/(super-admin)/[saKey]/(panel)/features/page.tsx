import { listFeatures } from "@/services/entitlements";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { FeatureToggleRow } from "@/components/super-admin/feature-toggle";
import {
  TENDER_ANALYSIS_FEATURE_KEY,
  TENDER_ANALYSIS_MODULE_ID,
} from "@/modules/tender-analysis";
import {
  DOCUMENT_COMPLIANCE_FEATURE_KEY,
  DOCUMENT_COMPLIANCE_MODULE_ID,
} from "@/modules/document-compliance";
import {
  SUPPLIER_QUALIFICATION_FEATURE_KEY,
  SUPPLIER_QUALIFICATION_MODULE_ID,
} from "@/modules/supplier-qualification";
import {
  TENDER_CALENDAR_FEATURE_KEY,
  TENDER_CALENDAR_MODULE_ID,
  TENDER_CALENDAR_MODULE_NAME,
} from "@/modules/tender-calendar";

export const dynamic = "force-dynamic";

const MODULE_BADGE: Record<string, string> = {
  [TENDER_ANALYSIS_FEATURE_KEY]: TENDER_ANALYSIS_MODULE_ID,
  [DOCUMENT_COMPLIANCE_FEATURE_KEY]: DOCUMENT_COMPLIANCE_MODULE_ID,
  [SUPPLIER_QUALIFICATION_FEATURE_KEY]: SUPPLIER_QUALIFICATION_MODULE_ID,
  [TENDER_CALENDAR_FEATURE_KEY]: TENDER_CALENDAR_MODULE_ID,
};

export default async function SaFeaturesPage() {
  await requireSuperAdmin();
  const features = await listFeatures();
  const ordered = [...features].sort((a, b) => {
    const aMod = a.key in MODULE_BADGE;
    const bMod = b.key in MODULE_BADGE;
    if (aMod && !bMod) return -1;
    if (!aMod && bMod) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Feature management</h1>
        <p className="mt-1 text-sm text-slate-400">
          Global toggles. Plan and company overrides are available from company detail /
          plan feature keys.
        </p>
        <p className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Module master switches (including{" "}
          <span className="font-semibold text-white">{TENDER_CALENDAR_MODULE_NAME}</span>
          {" / "}
          <code className="text-slate-400">{TENDER_CALENDAR_FEATURE_KEY}</code>
          ). When OFF, normal users lose routes, navigation, and APIs. Super Admin may
          still test via Enter company while a module is disabled.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Feature</th>
              <th className="w-40 px-4 py-3 font-medium">Global</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((f) => (
              <FeatureToggleRow
                key={f.id}
                featureKey={f.key}
                name={f.name}
                enabledGlobal={f.enabledGlobal}
                moduleBadge={MODULE_BADGE[f.key] ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
