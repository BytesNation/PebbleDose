import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Home, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export function ContextMenu() {
  const navigate = useNavigate();
  const menu = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  useEffect(() => {
    const open = (event: MouseEvent) => {
      event.preventDefault();
      setPoint({
        x: Math.min(event.clientX, window.innerWidth - 240),
        y: Math.min(event.clientY, window.innerHeight - 250),
        text: window.getSelection()?.toString() ?? '',
      });
    };
    document.addEventListener('contextmenu', open);
    return () => document.removeEventListener('contextmenu', open);
  }, []);
  useEffect(() => {
    if (!point) return;
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.showPopover();
    menu.current?.querySelector('button')?.focus();
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setPoint(null);
    };
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      previous?.focus();
    };
  }, [point]);
  if (!point) return null;
  const run = (action: () => void) => {
    setPoint(null);
    action();
  };
  return (
    <div
      ref={menu}
      popover="manual"
      className="app-context-menu"
      role="menu"
      aria-label="App menu"
      style={{ left: Math.max(8, point.x), top: Math.max(8, point.y) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault();
          setPoint(null);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const buttons = Array.from(
            e.currentTarget.querySelectorAll('button'),
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (index + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      <button role="menuitem" onClick={() => run(() => navigate(-1))}>
        <ArrowLeft size={18} />
        Back
      </button>
      <button role="menuitem" onClick={() => run(() => navigate('/kiosk'))}>
        <Home size={18} />
        Family home
      </button>
      <button
        role="menuitem"
        onClick={() => run(() => window.location.reload())}
      >
        <RotateCw size={18} />
        Refresh page
      </button>
      {point.text && (
        <button
          role="menuitem"
          onClick={() => {
            void navigator.clipboard
              .writeText(point.text)
              .then(() => setPoint(null))
              .catch(() => setPoint(null));
          }}
        >
          <Copy size={18} />
          Copy selected text
        </button>
      )}
    </div>
  );
}
