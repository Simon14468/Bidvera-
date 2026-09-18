import { revalidatePath } from "next/cache";

/** Bust public plan surfaces after Super Admin plan/copy changes. */
export function revalidatePublicPlanSurfaces() {
  revalidatePath("/pricing");
  revalidatePath("/upgrade");
  revalidatePath("/billing");
  revalidatePath("/onboarding/plan");
  // Marketing layout may embed plan-derived CTAs
  revalidatePath("/");
}
