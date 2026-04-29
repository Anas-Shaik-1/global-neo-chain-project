import { useRef, type ChangeEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Segmented 6-digit input for TOTP / one-time codes.
 *
 * - Auto-advances focus on input, backspace goes back
 * - Paste a 6-digit code → fills all boxes
 * - This file uses raw <input> elements intentionally — same exception as
 *   file pickers — because we own the keyboard handling primitive.
 */
export function TotpInput({ value, onChange, className, autoFocus }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  function focusAt(i: number) {
    inputs.current[Math.max(0, Math.min(5, i))]?.focus();
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const next = digits
      .map((d, j) => (j === i ? ch : d.trim()))
      .join("")
      .slice(0, 6);
    onChange(next);
    if (ch) focusAt(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i]?.trim() && i > 0) {
      focusAt(i - 1);
    } else if (e.key === "ArrowLeft") {
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      focusAt(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
      focusAt(Math.min(5, text.length));
    }
  }

  return (
    <div className={cn("flex gap-2 sm:gap-3", className)}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          value={d.trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-12 w-10 rounded-md border border-input bg-background text-center font-mono text-lg font-semibold text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring sm:h-14 sm:w-12"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
