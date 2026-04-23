import { cn } from "@/lib/utils";

type LogomarkProps = {
  size?: number;
  className?: string;
};

const INTER_STACK = "var(--font-inter), system-ui, sans-serif";

export function Logomark({ size = 24, className }: LogomarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center text-emerald-600",
        className,
      )}
      style={{
        fontFamily: INTER_STACK,
        fontWeight: 500,
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        lineHeight: 1,
        textRendering: "geometricPrecision",
        letterSpacing: 0,
      }}
    >
      g
    </span>
  );
}

type Size = "sm" | "md" | "lg" | "xl";

const TEXT_PX: Record<Size, number> = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 48,
};

const MARK: Record<Size, number> = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 48,
};

type WordmarkProps = {
  size?: Size;
  withMark?: boolean;
  className?: string;
};

export function Wordmark({ size = "md", withMark = false, className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline tracking-tight leading-none text-emerald-600",
        className,
      )}
      style={{
        fontFamily: INTER_STACK,
        fontWeight: 500,
        fontSize: `${TEXT_PX[size]}px`,
        gap: withMark ? "8px" : 0,
      }}
    >
      {withMark && <Logomark size={MARK[size]} className="shrink-0" />}
      <span>gyasss</span>
    </span>
  );
}
