import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightElement?: ReactNode;
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, rightElement, error, className, id, name, ...props }, ref) => {
    const inputId = id ?? name;
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            name={name}
            className={`h-10 w-full rounded-md border bg-bg-elevated px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-text-muted focus:border-[1.5px] focus:ring-2 disabled:border-border/40 disabled:bg-bg-app disabled:text-text-muted ${
              error
                ? "border-danger focus:border-danger focus:ring-danger/20"
                : "border-border focus:border-accent focus:ring-accent/20"
            } ${rightElement ? "pr-10" : ""} ${className ?? ""}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
