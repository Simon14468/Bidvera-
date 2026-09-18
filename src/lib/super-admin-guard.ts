import { isSuperAdminPathSegment } from "@/config/super-admin";
import { notFound } from "next/navigation";

export function assertSaKey(saKey: string) {
  if (!isSuperAdminPathSegment(saKey)) notFound();
}
