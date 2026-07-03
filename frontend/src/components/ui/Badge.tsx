interface BadgeProps {
  count: number;
  className?: string;
}

export function Badge({ count, className }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1.5 text-[11px] font-bold text-white ${className ?? ""}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
