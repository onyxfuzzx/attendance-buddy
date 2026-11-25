import { useEffect, useRef, type ReactNode } from "react";
import { X, Search, ChevronDown, Check, Inbox } from "lucide-react";
import { initials } from "./lib";
export function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string;
  index?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar color-${index % 6} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Empty({
  title = "Nothing here just yet",
  text = "Your records will appear here as your team gets started.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search anything…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button
          className="icon-button"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <span className="select-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
      <ChevronDown size={14} />
    </span>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const root = ref.current;
    root?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = root?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Check size={23} strokeWidth={3} />
        <i />
      </span>
      <span>
        attendance
        <span className="brand-second">
          buddy<span className="brand-dot">.</span>
        </span>
      </span>
    </div>
  );
}
