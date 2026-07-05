import { X } from "lucide-react";

interface ChipProps {
  label: string;
  onRemove: () => void;
}

export function Chip({ label, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg-elevated py-1 pl-3 pr-1.5 text-sm text-text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
      >
        <X size={12} />
      </button>
    </span>
  );
}
