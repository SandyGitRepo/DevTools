import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePrefs } from '../../state/prefs';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type Status = { kind: 'success' | 'info' | 'warn'; text: string } | null;

/** Short animated status line (UI-4: typewriter-style reveal under 300 ms). */
export default function StatusLine({ status }: { status: Status }) {
  const osReduce = useReducedMotion();
  const { reduceMotion } = usePrefs();
  const instant = osReduce || reduceMotion;
  const Icon = status?.kind === 'success' ? CheckCircle2 : status?.kind === 'warn' ? AlertTriangle : Info;
  const color = status?.kind === 'success' ? 'text-success' : status?.kind === 'warn' ? 'text-warn' : 'text-cyan';
  return (
    <div aria-live="polite" className="min-h-[1.5rem]">
      <AnimatePresence mode="wait">
        {status && (
          <motion.p
            key={status.text}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: instant ? 0 : 0.25, ease: 'linear' }}
            className={`flex items-center gap-1.5 text-sm ${color}`}
          >
            <Icon size={15} aria-hidden="true" /> {status.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
