import { Check } from "lucide-react";

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  className?: string;
}

export function Checkbox({ checked, onChange, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border transition-colors ${
        checked ? "border-transparent bg-accent" : "border-border bg-transparent"
      } ${className ?? ""}`}
    >
      {checked && <Check size={14} className="text-white" strokeWidth={3} />}
    </button>
  );
}
