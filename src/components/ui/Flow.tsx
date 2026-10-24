import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/**
 * Fluxo de uma decisão por tela. O pai controla `step`.
 * O progresso é desenhado como a barra de escala da carta.
 */
export function Flow({
  step,
  total,
  title,
  onBack,
  onClose,
  children,
  footer,
  className,
}: {
  step: number;
  total: number;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex min-h-full w-full max-w-[40rem] flex-col', className)}>
      <div className="flex items-center gap-3 pb-6">
        {onBack && step > 0 ? (
          <Button variant="quiet" size="sm" onClick={onBack} aria-label="Voltar" className="-ml-2 px-2">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
              <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </Button>
        ) : (
          <span className="w-0" />
        )}
        <FlowProgress step={step} total={total} className="flex-1" />
        <span className="t-label t-num shrink-0">
          {step + 1}/{total}
        </span>
        {onClose && (
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Fechar" className="-mr-2 px-2">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </Button>
        )}
      </div>
      {title && <p className="t-label pb-2">{title}</p>}
      <div className="relative flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -12, filter: 'blur(2px)' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      {footer && <div className="sticky bottom-0 -mx-1 mt-8 bg-paper/95 px-1 pb-2 pt-3 backdrop-blur-[2px]">{footer}</div>}
    </div>
  );
}

export function FlowProgress({ step, total, className }: { step: number; total: number; className?: string }) {
  return (
    <div className={cn('flex h-1.5 gap-[3px]', className)} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="relative flex-1 overflow-hidden bg-rule">
          <motion.span
            className="absolute inset-0 origin-left bg-ink"
            initial={false}
            animate={{ scaleX: i <= step ? 1 : 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </span>
      ))}
    </div>
  );
}

/** Pergunta grande de uma tela de fluxo. */
export function FlowQuestion({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <h1 className="t-display text-[clamp(1.75rem,5vw,2.5rem)] text-ink">{children}</h1>
      {sub && <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-2">{sub}</p>}
    </div>
  );
}
