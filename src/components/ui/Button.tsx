import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'quiet' | 'go' | 'ink';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-[3px] font-[620] t-cond transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out-quart active:translate-y-px disabled:opacity-45 disabled:active:translate-y-0';

const variants: Record<Variant, string> = {
  primary: 'bg-magenta text-magenta-ink hover:brightness-110 shadow-[0_1px_0_rgb(0_0_0/0.12)]',
  ink: 'bg-ink text-paper hover:bg-ink/90',
  secondary: 'border border-ink/80 text-ink hover:bg-paper-3',
  quiet: 'text-ink-2 hover:text-ink hover:bg-paper-3',
  go: 'bg-go text-paper hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.9375rem]',
  lg: 'h-14 px-6 text-base tracking-[0.01em]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest} />;
});
