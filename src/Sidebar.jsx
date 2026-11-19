import { useEffect, useState } from "react";
import "./Sidebar.css";

// Simple line icons (24x24). Falls back to the emoji from the menu item.
const ICONS = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  categories: "M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12l8.7-4.5M12 12v9",
  cart: "M3 4h2l2.4 11h10.2L20 8H6M9 20h.01M17 20h.01",
  orders:
    "M9 3h6v3H9zM7 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M8 12h8M8 16h5",
  profile: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
};

const STORAGE_KEY = "bb-sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 800px)";

export default function Sidebar({
  items,
  active,
  onSelect,
  cartCount = 0,
  userName = "",
  onLogout,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable - ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  }

  function select(id) {
    onSelect(id);
    setOpen(false);
  }

  const activeItem = items.find((i) => i.id === active) || items[0];
  const initial = (userName || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className={
        "bb-shell" + (collapsed ? " bb-collapsed" : "") + (open ? " bb-open" : "")
      }
    >
      <aside className="bb-sidebar" aria-label="প্রধান মেনু">
        <div className="bb-brand">
          <div className="bb-logo">🛒</div>
          <span className="bb-brand-name">BazarBondhu</span>
        </div>

        <nav className="bb-nav">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                className={"bb-item" + (isActive ? " bb-active" : "")}
                aria-current={isActive ? "page" : undefined}
                onClick={() => select(item.id)}
              >
                {ICONS[item.id] ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICONS[item.id]} />
                  </svg>
                ) : (
                  <span className="bb-emoji">{item.icon}</span>
                )}
                <span className="bb-label">{item.label}</span>
                {item.id === "cart" && cartCount > 0 && (
                  <span className="bb-badge">{cartCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="bb-user">
          <div className="bb-avatar">{initial}</div>
          <div className="bb-user-info">
            <b>{userName || "কাস্টমার"}</b>
            <button type="button" className="bb-logout" onClick={onLogout}>
              লগআউট
            </button>
          </div>
        </div>

        <button
          type="button"
          className="bb-collapse"
          onClick={toggle}
          aria-label="সাইডবার ছোট বা বড় করুন"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </aside>

      <div className="bb-overlay" onClick={() => setOpen(false)} />

      <div className="bb-main">
        <div className="bb-topbar">
          <button
            type="button"
            className="bb-menu-btn"
            onClick={toggle}
            aria-label="মেনু খুলুন"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="bb-topbar-title">{activeItem.label}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
