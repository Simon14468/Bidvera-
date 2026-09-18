import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";

/** Full official lockup (from public/Bidvera AI logo orgenall.png). */
export const BRAND_LOGO_SRC = "/brand-logo.png";
/** Square mark only — new filename busts Next/Image + browser cache. */
export const BRAND_MARK_SRC = "/brand-mark.png";

/** Cache-bust token if you rewrite files in place later. */
export const BRAND_ASSET_VERSION = "20260915c";

type BrandLogoProps = {
  href?: string;
  className?: string;
  /** Logo height in px (width scales with aspect ratio). */
  height?: number;
  priority?: boolean;
  /** Unused — wordmark is in the asset. Kept for API compatibility. */
  withWordmark?: boolean;
  /** White logo in dark theme (app shell). Keep off on light marketing surfaces. */
  inverseOnDark?: boolean;
};

/** Native aspect of Bidvera lockup (transparent export from official orgenall). */
const LOGO_ASPECT = 1840 / 441;

export function BrandLogo({
  href = "/",
  className,
  height = 36,
  priority = true,
  inverseOnDark = false,
}: BrandLogoProps) {
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex shrink-0 items-center outline-offset-4",
        className,
      )}
      aria-label="Bidvera AI"
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="Bidvera AI"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={cn(
          "object-contain",
          inverseOnDark &&
            "brightness-0 invert light:brightness-100 light:invert-0",
        )}
      />
    </Link>
  );
}
