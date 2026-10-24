import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';

interface Toast {
  id: number;
  text: string;
}

const useToasts = create<{ items: Toast[]; push: (t: string) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-2), { id, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 2800);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

/** Confirmação curta e neutra ("Registrado."). */
export const toast = (text: string) => useToasts.getState().push(text);

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[3px] bg-ink px-4 py-2.5 text-sm font-[560] text-paper shadow-[var(--shadow)]"
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
