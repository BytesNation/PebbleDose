import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';

type Props = {
  children: ReactNode;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string } }) => void;
  className?: string;
  'aria-label'?: string;
};
export function Select({
  children,
  name,
  value,
  defaultValue,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: Props) {
  const options = Children.toArray(children)
    .filter(isValidElement<{ value?: string | number; children?: ReactNode }>)
    .map((child) => ({
      value: String(child.props.value ?? child.props.children ?? ''),
      label: child.props.children ?? child.props.value,
    }));
  const [local, setLocal] = useState(
    String(defaultValue ?? options[0]?.value ?? ''),
  );
  const selected = String(value ?? local);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const popup = list.current;
    const rect = trigger.current?.getBoundingClientRect();
    if (popup && rect) {
      const below = window.innerHeight - rect.bottom - 12;
      const height = Math.min(240, Math.max(below, rect.top - 12));
      Object.assign(popup.style, {
        position: 'fixed',
        margin: '0',
        width: `${rect.width}px`,
        left: `${rect.left}px`,
        top: below >= 180 ? `${rect.bottom + 6}px` : 'auto',
        bottom:
          below >= 180 ? 'auto' : `${window.innerHeight - rect.top + 6}px`,
        maxHeight: `${height}px`,
      });
      popup.showPopover();
    }
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (open)
      list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    setLocal(option.value);
    onChange?.({ target: { value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      className={`app-select ${className}`}
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => {
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.value === selected),
            ),
          );
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  options.length - 1,
                  i + (e.key === 'ArrowDown' ? 1 : -1),
                ),
              ),
            );
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            setActive(e.key === 'Home' ? 0 : options.length - 1);
          } else if ((e.key === 'Enter' || e.key === ' ') && open) {
            e.preventDefault();
            choose(active);
          } else if (e.key.length === 1 && e.key !== ' ') {
            const index = options.findIndex((o) =>
              String(o.label).toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (index >= 0) {
              setActive(index);
              setOpen(true);
            }
          }
        }}
      >
        <span>
          {options.find((o) => o.value === selected)?.label ??
            'Choose an option'}
        </span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          popover="manual"
          role="listbox"
          className="app-options"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => (
            <div
              id={`${id}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === selected}
              className={index === active ? 'highlighted' : ''}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === selected && <Check size={18} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
