import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type SwipeAction = 'done' | 'later';

/** Pure rule, unit-tested: right past 40% of the row = done, left past 40% = later. */
export function swipeAction(dx: number, width: number, threshold = 0.4): SwipeAction | null {
  if (width <= 0) return null;
  if (dx >= width * threshold) return 'done';
  if (dx <= -width * threshold) return 'later';
  return null;
}

/**
 * A list row you can swipe on a touch screen: right to finish, left to move to tomorrow.
 * The row's own buttons stay as the accessible way to do the same things.
 */
export function SwipeRow({ children, onDone, onLater, laterLabel = 'Tomorrow' }: {
  children: ReactNode; onDone: () => void; onLater?: () => void; laterLabel?: string;
}) {
  const wrap = useRef<HTMLLIElement>(null);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const [settling, setSettling] = useState(false);

  const width = () => wrap.current?.offsetWidth ?? 0;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button,a,input')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (s.horizontal === null && Math.hypot(mx, my) > 10) {
      s.horizontal = Math.abs(mx) > Math.abs(my);
      if (s.horizontal) try { wrap.current?.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    if (!s.horizontal) return;
    dxRef.current = onLater ? mx : Math.max(0, mx);
    setDx(dxRef.current);
  };
  const end = () => {
    const s = start.current;
    start.current = null;
    if (!s?.horizontal) return;
    const act = swipeAction(dxRef.current, width());
    dxRef.current = 0;
    if (!act) { setDx(0); return; }
    const finish = () => { setDx(0); setSettling(false); (act === 'done' ? onDone : onLater)?.(); };
    if (reduced()) return finish();
    setSettling(true);
    setDx(act === 'done' ? width() : -width());
    setTimeout(finish, 200);
  };

  const act = swipeAction(dx, width());
  return (
    <li ref={wrap} className="swipe" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end}>
      {dx !== 0 && (
        <div className={`under ${dx > 0 ? 'done' : 'later'}`} aria-hidden="true">
          {dx > 0
            ? <span className={act === 'done' ? 'armed' : ''}><Icon name="check" /> Done</span>
            : <span className={act === 'later' ? 'armed' : ''}>{laterLabel}</span>}
        </div>
      )}
      <div style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current && !settling ? 'none' : 'transform 200ms var(--ease)' }}>
        {children}
      </div>
    </li>
  );
}
