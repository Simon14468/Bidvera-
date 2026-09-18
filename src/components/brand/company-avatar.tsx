import { cn } from "@/lib/cn";
import Image from "next/image";

/**
 * Default company/profile mark.
 * Uses the transparent brand mark (not maskable icons — those bake in a black plate).
 * Always rendered gray; inverted on the default dark shell so it stays visible.
 * When `src` is a user upload, show as a photo (object-cover, no invert).
 */
export const COMPANY_AVATAR_SRC = "/bidvera-mark.png";

export function CompanyAvatar({
  size = 28,
  className,
  src,
  alt = "",
}: {
  size?: number;
  className?: string;
  /** User/company photo URL; omit for the default Bidvera mark. */
  src?: string | null;
  alt?: string;
}) {
  const photo = src?.trim() || null;
  const isCustom = Boolean(photo && photo !== COMPANY_AVATAR_SRC);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-transparent",
        isCustom && "border border-border bg-card",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={photo || COMPANY_AVATAR_SRC}
        alt={alt}
        width={size}
        height={size}
        className={
          isCustom
            ? "size-full object-cover"
            : "size-full object-contain p-[12%] brightness-0 invert opacity-60 [.light_&]:invert-0 [.light_&]:opacity-50"
        }
        aria-hidden={!alt}
      />
    </span>
  );
}
