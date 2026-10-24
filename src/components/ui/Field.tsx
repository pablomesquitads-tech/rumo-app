import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-[3px] border border-rule-2 bg-paper px-3.5 text-[1rem] text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus:border-ink focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--magenta)_22%,transparent)]';

interface WrapProps {
  label: ReactNode;
  hint?: ReactNode;
  id: string;
  children: ReactNode;
  className?: string;
}

function Wrap({ label, hint, id, children, className }: WrapProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="t-label">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-ink-3">{hint}</p>}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  wrapClassName?: string;
  /** Texto em itálico de plano (se-então). */
  plan?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, className, wrapClassName, plan, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrap label={label} hint={hint} id={fid} className={wrapClassName}>
      <input ref={ref} id={fid} className={cn(control, 'h-12', plan && 't-plan', className)} {...rest} />
    </Wrap>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  wrapClassName?: string;
  plan?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, className, wrapClassName, plan, id, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrap label={label} hint={hint} id={fid} className={wrapClassName}>
      <textarea ref={ref} id={fid} rows={rows} className={cn(control, 'resize-none py-3 leading-relaxed', plan && 't-plan', className)} {...rest} />
    </Wrap>
  );
});

/** Campo "Se ___, então ___" que monta a frase do plano. */
export function IfThenField({
  value,
  onChange,
  ifPlaceholder = 'forem 14h e eu estiver na biblioteca',
  thenPlaceholder = 'abro o PDF da lista 3',
  label = 'Plano se-então',
}: {
  value: string;
  onChange: (v: string) => void;
  ifPlaceholder?: string;
  thenPlaceholder?: string;
  label?: string;
}) {
  const id = useId();
  const [a, b] = splitIfThen(value);
  const set = (x: string, y: string) => onChange(x || y ? `Se ${x.trim()}, então ${y.trim()}` : '');
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="t-label mb-1.5">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-[3px] border border-rule-2 bg-paper pl-3.5 focus-within:border-ink">
          <span className="t-label shrink-0 text-ink" aria-hidden>
            Se
          </span>
          <input
            id={`${id}-if`}
            aria-label="Se (quando e onde)"
            className="t-plan h-12 w-full bg-transparent pr-3 text-ink placeholder:text-ink-3 focus:outline-none"
            placeholder={ifPlaceholder}
            value={a}
            onChange={(e) => set(e.target.value, b)}
          />
        </div>
        <div className="flex items-center gap-2 rounded-[3px] border border-rule-2 bg-paper pl-3.5 focus-within:border-ink">
          <span className="t-label shrink-0 text-ink" aria-hidden>
            então
          </span>
          <input
            id={`${id}-then`}
            aria-label="Então (a ação)"
            className="t-plan h-12 w-full bg-transparent pr-3 text-ink placeholder:text-ink-3 focus:outline-none"
            placeholder={thenPlaceholder}
            value={b}
            onChange={(e) => set(a, e.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function splitIfThen(v: string): [string, string] {
  const m = /^Se\s+(.*?),\s*então\s+(.*)$/i.exec(v ?? '');
  if (m) return [m[1], m[2]];
  return [v ?? '', ''];
}
