import { revalidatePath, updateTag } from "next/cache";

/** Bust public plan surfaces after Super Admin plan/copy changes. */
export function revalidatePublicPlanSurfaces() {
  // Immediate expire — next /pricing /upgrade read waits for fresh catalog.
  updateTag("public-billing-plans");
  revalidatePath("/pricing");
  revalidatePath("/upgrade");
  revalidatePath("/billing");
  revalidatePath("/onboarding/plan");
  // Marketing layout may embed plan-derived CTAs
  revalidatePath("/");
}
