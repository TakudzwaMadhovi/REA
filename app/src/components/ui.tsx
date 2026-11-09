import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/* ---------- toasts ---------- */
export interface ToastAction { label: string; run: () => void }
interface ToastItem { id: number; title: string; body?: string; actions?: ToastAction[]; sticky?: boolean }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    if (!t.sticky) setTimeout(() => remove(id), t.actions?.length ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className="toast" key={t.id}>
            <div className="grow">
              <strong>{t.title}</strong>
              {t.body && <span className="small">{t.body}</span>}
            </div>
            {t.actions?.map((a) => (
              <button key={a.label} className="btn small" onClick={() => { a.run(); remove(t.id); }}>
                {a.label}
              </button>
            ))}
            <button className="icon-btn" style={{ color: 'inherit' }} aria-label="Dismiss" onClick={() => remove(t.id)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- focus trap shared by slide-over and dialog ---------- */
function useTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onClose = () => closeRef.current();
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('input,textarea,select,button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      el.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, []);
  return ref;
}

export function SlideOver({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useTrap(onClose);
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" data-tip="Close (Esc)" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useTrap(onClose);
  return createPortal(
    <>
      <div className="scrim top" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label} ref={ref}>{children}</div>
    </>,
    document.body
  );
}

/** Destructive confirmation that names the thing being deleted. */
export function useConfirm() {
  const [state, setState] = useState<{ name: string; what: string; run: () => void } | null>(null);
  const ask = (what: string, name: string, run: () => void) => setState({ what, name, run });
  const node = state && (
    <Dialog label={`Delete ${state.what}`} onClose={() => setState(null)}>
      <h2 style={{ fontSize: 20 }}>Delete “{state.name || 'Untitled'}”?</h2>
      <p className="muted" style={{ marginTop: 8 }}>This {state.what} will be removed from this device. You can’t undo this.</p>
      <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
        <button className="btn quiet" data-autofocus onClick={() => setState(null)}>Keep it</button>
        <button className="btn danger" onClick={() => { state.run(); setState(null); }}>Delete {state.what}</button>
      </div>
    </Dialog>
  );
  return [ask, node] as const;
}

export function Tick({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button className="tick" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle}>
      <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg></span>
    </button>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {action}
    </div>
  );
}
