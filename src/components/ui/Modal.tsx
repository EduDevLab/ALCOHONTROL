import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  width?: number;
  disableClose?: boolean;
  children: ReactNode;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  width = 440,
  disableClose = false,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open || disableClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, disableClose, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          onClick={() => {
            if (!disableClose) onClose();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 6, 8, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 70,
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="surface-card"
            style={{ width: '100%', maxWidth: width, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                {eyebrow && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'var(--accent-gold)',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    {eyebrow}
                  </div>
                )}
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h2>
                {subtitle && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
                )}
              </div>

              <button
                type="button"
                className="btn-circle"
                style={{ width: 32, height: 32, flexShrink: 0 }}
                disabled={disableClose}
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={14} />
              </button>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
