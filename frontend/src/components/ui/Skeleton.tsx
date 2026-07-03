import type { CSSProperties } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

function Base({ className, style }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-bg-elevated ${className ?? ""}`} style={style} />;
}

// Text lines vary width (never uniform bars) per foundation spec.
const LINE_WIDTHS = ["60%", "85%", "75%", "95%"];

export function SkeletonText({ lines = 2, className }: SkeletonProps & { lines?: number }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Base key={i} className="h-3 rounded-sm" style={{ width: LINE_WIDTHS[i % LINE_WIDTHS.length] }} />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Base className="rounded-full" style={{ width: size, height: size }} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <SkeletonAvatar size={40} />
      <SkeletonText lines={2} className="flex-1" />
    </div>
  );
}
