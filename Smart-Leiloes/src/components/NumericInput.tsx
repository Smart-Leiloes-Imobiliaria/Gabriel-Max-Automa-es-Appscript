import * as React from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface NumericInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

const INVALID_MSG = "São permitidos apenas números neste campo.";

/**
 * Input que aceita SOMENTE dígitos numéricos.
 * - Bloqueia letras, símbolos e caracteres especiais.
 * - Exibe mensagem clara ao detectar valor inválido.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, onKeyDown, onPaste, ...rest }, ref) => {
    const [error, setError] = React.useState<string | null>(null);
    const lastToastRef = React.useRef(0);

    const flagError = () => {
      setError(INVALID_MSG);
      const now = Date.now();
      if (now - lastToastRef.current > 1500) {
        toast.error(INVALID_MSG);
        lastToastRef.current = now;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End", "Enter"];
      if (e.ctrlKey || e.metaKey || allowed.includes(e.key)) {
        onKeyDown?.(e);
        return;
      }
      if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
        e.preventDefault();
        flagError();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cleaned = raw.replace(/\D/g, "");
      if (cleaned !== raw) flagError();
      else setError(null);
      onChange(cleaned);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (/\D/.test(text)) flagError();
      onPaste?.(e);
    };

    return (
      <div className="w-full">
        <Input
          ref={ref}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          aria-invalid={!!error}
          {...rest}
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }
);
NumericInput.displayName = "NumericInput";
