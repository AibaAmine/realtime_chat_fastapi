import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalSize = "sm" | "md";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[400px]",
};

interface ModalProps {
  title: string;
  titleContent?: ReactNode;
  onClose: () => void;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, titleContent, onClose, size = "md", children, footer }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeClasses[size]} rounded-xl border border-border bg-bg-raised p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {titleContent ?? <h2 className="text-lg font-semibold text-text-primary">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
