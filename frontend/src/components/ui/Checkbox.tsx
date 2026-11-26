import { useId, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export function Checkbox({
  className,
  label,
  description,
  checked,
  id,
  disabled,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'inline-flex items-start gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative flex items-center justify-center mt-0.5">
        <input
          id={checkboxId}
          type="checkbox"
          data-nav-item="true"
          checked={checked}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'h-4 w-4 rounded border flex items-center justify-center transition-colors duration-state-change',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-active peer-focus-visible:outline-offset-2',
            checked
              ? 'bg-accent-active border-accent-active text-on-accent-active'
              : 'bg-surface border-outline text-transparent hover:border-accent-active/60',
          )}
        >
          <Check className="h-3 w-3 stroke-[3]" />
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-label-md text-on-surface leading-tight">{label}</span>}
          {description && <span className="text-body-sm text-muted mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
}
