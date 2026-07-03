import { Paperclip, Send } from "lucide-react";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

interface ComposerProps {
  roomLabel: string;
  onSend: (content: string) => void;
  onTypingChange: (isTyping: boolean) => void;
}

const MAX_LINES = 5;
const LINE_HEIGHT_PX = 20;

export function Composer({ roomLabel, onSend, onTypingChange }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTypingRef = useRef(false);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_HEIGHT_PX * MAX_LINES)}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    resize(e.target);

    const hasText = e.target.value.trim().length > 0;
    if (hasText && !isTypingRef.current) {
      isTypingRef.current = true;
      onTypingChange(true);
    } else if (!hasText && isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange(false);
    }
  }

  function send() {
    const content = value.trim();
    if (!content) return;
    onSend(content);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChange(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex min-h-[56px] items-end gap-2 border-t border-border bg-bg-elevated px-4 py-3">
      <button
        type="button"
        disabled
        aria-label="Attach file (coming soon)"
        title="Attachments are not supported yet — no upload endpoint exists on the backend"
        className="mb-1 shrink-0 cursor-not-allowed text-text-muted/50"
      >
        <Paperclip size={20} />
      </button>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`Message ${roomLabel}`}
        rows={1}
        className="max-h-[100px] flex-1 resize-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
      />

      <button
        type="button"
        onClick={send}
        disabled={!value.trim()}
        aria-label="Send message"
        className={`mb-1 shrink-0 transition-colors ${
          value.trim() ? "text-accent hover:text-accent-hover" : "text-text-muted"
        }`}
      >
        <Send size={20} />
      </button>
    </div>
  );
}
