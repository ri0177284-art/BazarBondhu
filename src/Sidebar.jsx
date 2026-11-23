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
  notificationCount = 0,
  userName = "",
  onLogout,
  onSearchClick,
  searchOpen = false,
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
          <div className="bb-topbar-brand" aria-label="BazarBondhu">
            <span className="bb-topbar-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 8H6M9 20h.01M17 20h.01M8 8l1 4h7l1-4" /></svg>
            </span>
            <span className="bb-topbar-copy">
              <b>BazarBondhu</b>
              <small>আপনার বিশ্বস্ত অনলাইন বাজার</small>
            </span>
          </div>
          <div className="bb-topbar-actions">
            <button
              type="button"
              className="bb-action-btn bb-rewards-btn"
              onClick={() => select("rewards")}
              aria-label="Rewards পয়েন্ট দেখুন"
              title="Rewards"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7ZM12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7Z" /></svg>
            </button>
            <button
              type="button"
              className="bb-action-btn bb-notification-btn"
              onClick={() => select("orders")}
              aria-label={notificationCount > 0 ? `অর্ডার নোটিফিকেশন, ${notificationCount}টি অপেক্ষমাণ অর্ডার` : "অর্ডার নোটিফিকেশন"}
              title="অর্ডার নোটিফিকেশন"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              {notificationCount > 0 && <span className="bb-notification-count">{notificationCount > 9 ? "9+" : notificationCount}</span>}
            </button>
            <button
              type="button"
              className="bb-profile-btn"
              onClick={() => select("profile")}
              aria-label={`${userName || "কাস্টমার"} প্রোফাইল`}
              title="প্রোফাইল"
            >
              <span className="bb-avatar">{initial}</span>
            </button>
          </div>
        </div>
        {children}
      </div>

      <nav className="bb-bottom-nav" aria-label="মোবাইল নেভিগেশন">
        <button type="button" className="bb-bottom-nav-item" onClick={() => select("home")} aria-label="হোম">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /></svg>
          <span>HOME</span>
        </button>
        <button type="button" className="bb-bottom-nav-item" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="মেনু খুলুন">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          <span>MENU</span>
        </button>
        <button type="button" className="bb-bottom-nav-item" onClick={() => select("cart")} aria-label={cartCount > 0 ? `কার্ট, ${cartCount}টি পণ্য` : "কার্ট"}>
          <span className="bb-bottom-nav-icon-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h10.2L20 8H6M9 20h.01M17 20h.01" /></svg>
            {cartCount > 0 && <span className="bb-bottom-nav-badge">{cartCount > 99 ? "99+" : cartCount}</span>}
          </span>
          <span>CART</span>
        </button>
        <button type="button" className={"bb-bottom-nav-item" + (searchOpen ? " is-active" : "")} onClick={onSearchClick} aria-pressed={searchOpen} aria-label="সার্চ খুলুন">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <span>SEARCH</span>
        </button>
        <button type="button" className="bb-bottom-nav-item" onClick={() => select("profile")} aria-label="অ্যাকাউন্ট">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="4" /><path d="M4 21c.5-4.2 3.5-6.5 8-6.5s7.5 2.3 8 6.5" /></svg>
          <span>ACCOUNT</span>
        </button>
      </nav>
    </div>
  );
}

