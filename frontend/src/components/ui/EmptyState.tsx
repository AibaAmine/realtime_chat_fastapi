import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className ?? ""}`}
    >
      <Icon size={64} className="text-text-muted" strokeWidth={1.5} />
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description && (
        <p className="max-w-[320px] text-sm text-text-secondary">{description}</p>
      )}
      {action}
    </div>
  );
}
