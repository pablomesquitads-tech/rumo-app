import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/** Cabeçalho de tela: título expandido à esquerda, metadado tabular à direita, régua abaixo. */
export function ScreenHeader({
  title,
  meta,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3 border-b border-ink pb-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="t-display text-[clamp(2rem,4.4vw,3.25rem)] text-ink">{title}</h1>
        {meta && <div className="t-label t-num pb-1.5 text-ink-2">{meta}</div>}
      </div>
      {description && <p className="max-w-[44rem] text-[1.0625rem] leading-relaxed text-ink-2">{description}</p>}
      {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
    </header>
  );
}

/** Seção com rótulo e régua fina. Sem caixa: a régua separa. */
export function Section({
  label,
  aside,
  children,
  className,
  id,
}: {
  label: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('flex flex-col gap-4 pt-8', className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="t-label text-ink">{label}</h2>
        {aside && <div className="text-sm text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Entrada de tela: um único movimento, a partir de um estado já visível. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0.001, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn('mx-auto w-full max-w-[72rem] px-4 pb-32 pt-6 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10', className)}
    >
      {children}
    </motion.div>
  );
}

/** Estado vazio: uma frase, uma ação. */
export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-rule-2 px-5 py-7">
      <p className="t-title text-lg text-ink">{title}</p>
      {children && <p className="max-w-[36rem] text-ink-2">{children}</p>}
      {action}
    </div>
  );
}

/** Leitura numérica: valor tabular grande + rótulo. Use em linhas, não em cards. */
export function Reading({ label, value, unit, note }: { label: ReactNode; value: ReactNode; unit?: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="t-label">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="t-num t-title text-[1.75rem] text-ink">{value}</span>
        {unit && <span className="text-sm text-ink-2">{unit}</span>}
      </span>
      {note && <span className="text-sm text-ink-3">{note}</span>}
    </div>
  );
}
