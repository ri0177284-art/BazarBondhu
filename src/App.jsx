import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const Customer = lazy(() => import("./Customer"));
const DashboardChart = lazy(() => import("./DashboardChart"));

const navigation = [
  { id: "Dashboard", label: "ড্যাশবোর্ড", icon: "⌂" },
  { id: "Products", label: "পণ্য", icon: "▦" },
  { id: "Market Prices", label: "বাজারদর", icon: "৳" },
  { id: "Orders", label: "অর্ডার", icon: "▤" },
  { id: "Customers", label: "গ্রাহক", icon: "♙" },
  { id: "Rewards", label: "Rewards", icon: "🎁" },
  { id: "Settings", label: "সেটিংস", icon: "⚙" },
];

const money = (amount) =>
  `৳${new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(Number(amount) || 0)}`;

function App() {
  const currentPath = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  const isAdminRoute = currentPath === "/admin" || currentPath.startsWith("/admin/");
  const isCustomerRoute = !isAdminRoute;
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [active, setActive] = useState("Dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [rewardCustomers, setRewardCustomers] = useState([]);
  const [salesChartData, setSalesChartData] = useState([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [stock, setStock] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [customQuotePrices, setCustomQuotePrices] = useState({});
  const [customerQuery, setCustomerQuery] = useState("");
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("name");
    setLoading(false);
    if (error) {
      notify(`পণ্য লোড করা যায়নি: ${error.message}`, "error");
      return;
    }
    setProducts(data || []);
  }, [notify]);

  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      notify(`গ্রাহক লোড করা যায়নি: ${error.message}`, "error");
      return;
    }
    setCustomers((data || []).filter((customer) => customer.role !== "admin"));
  }, [notify]);

  const loadRewardCustomers = useCallback(async () => {
    const { data, error } = await supabase.rpc("rewards_admin_overview");
    if (error) {
      notify(`Rewards তথ্য লোড করা যায়নি: ${error.message}`, "error");
      return;
    }
    setRewardCustomers(data || []);
  }, [notify]);

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) {
      notify(`সেটিংস লোড করা যায়নি: ${error.message}`, "error");
      return;
    }
    setServiceCharge(Number(data.service_charge) || 0);
    setDeliveryFee(Number(data.delivery_fee) || 0);
  }, [notify]);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      notify(`অর্ডার লোড করা যায়নি: ${error.message}`, "error");
      return;
    }
    const loadedOrders = data || [];
    setOrders(loadedOrders);

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, product_name, quantity, unit_price, line_total");
    if (itemsError) {
      notify(`অর্ডারের পণ্য লোড করা যায়নি: ${itemsError.message}`, "error");
      return;
    }
    setOrderItems(items || []);

    setSalesChartData(
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const delivered = loadedOrders.filter(
          (order) =>
            order.order_status === "delivered" &&
            new Date(order.created_at).toDateString() === date.toDateString(),
        );
        return {
          day: date.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }),
          sales: delivered.reduce((total, order) => total + (Number(order.total) || 0), 0),
        };
      }),
    );
  }, [notify]);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([loadProducts(), loadOrders(), loadCustomers(), loadSettings(), loadRewardCustomers()]);
  }, [loadCustomers, loadOrders, loadProducts, loadSettings, loadRewardCustomers]);

  const checkAdmin = useCallback(
    async (currentSession) => {
      if (!currentSession) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentSession.user.id)
        .single();
      if (error || data?.role !== "admin") {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      setChecking(false);
      await refreshAdminData();
    },
    [refreshAdminData],
  );

  useEffect(() => {
    if (isCustomerRoute) return undefined;
    let mounted = true;
    const start = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      await checkAdmin(data.session);
    };
    void start();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setIsAdmin(false);
        setChecking(false);
      } else {
        setChecking(true);
        window.setTimeout(() => {
          if (mounted) void checkAdmin(nextSession);
        }, 0);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin, isCustomerRoute]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        setNewOrderCount((count) => count + 1);
        void loadOrders();
        notify("নতুন অর্ডার এসেছে", "info");
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, loadOrders, notify]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setLoginError(error.message);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) notify(`লগআউট করা যায়নি: ${error.message}`, "error");
    setSession(null);
    setIsAdmin(false);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const charge = Number(serviceCharge);
    const delivery = Number(deliveryFee);
    if (!Number.isFinite(charge) || !Number.isFinite(delivery) || charge < 0 || delivery < 0) {
      notify("চার্জ ও ডেলিভারি ফি শূন্য বা তার বেশি দিন", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ service_charge: charge, delivery_fee: delivery, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      notify(`সেটিংস সেভ হয়নি: ${error.message}`, "error");
      return;
    }
    notify("সেটিংস সেভ হয়েছে");
  }

  async function updateOrder(orderId, patch) {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder) return;

    if (patch.payment_status === "paid" && ["bkash", "nagad"].includes(currentOrder.payment_method) && !currentOrder.transaction_id?.trim()) {
      notify("Transaction ID না থাকায় পেমেন্ট অনুমোদন করা যাচ্ছে না।", "error");
      return;
    }

    if (patch.payment_status === "paid" && !window.confirm("আপনি কি নিশ্চিত যে টাকা আপনার বিকাশ/নগদ অ্যাকাউন্টে এসেছে এবং Transaction ID মিলেছে?")) return;
    if (patch.payment_status === "rejected" && !window.confirm("এই পেমেন্টটি Reject করতে চান? টাকা না আসা বা Transaction ID না মেলার পরেই Reject করুন।")) return;

    const update = { ...patch };
    if (patch.order_status === "confirmed" && (currentOrder.order_status !== "confirmed" || !currentOrder.confirmed_at)) {
      update.confirmed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(update).eq("id", orderId);
    if (error) {
      notify(`অর্ডার আপডেট হয়নি: ${error.message}`, "error");
      return;
    }
    notify(patch.payment_status === "paid" ? "পেমেন্ট যাচাই করে অনুমোদন করা হয়েছে" : patch.payment_status === "rejected" ? "পেমেন্ট Reject করা হয়েছে" : "অর্ডার আপডেট হয়েছে");
    await loadOrders();
  }

  async function quoteCustomPackageOrder(orderId, customItems) {
    const prices = customItems.map((item) => ({
      item_id: item.id,
      unit_price: Number(customQuotePrices[item.id] ?? item.unit_price),
    }));
    if (prices.some((item) => !Number.isFinite(item.unit_price) || item.unit_price <= 0)) {
      notify("নিজের লেখা প্রতিটি পণ্যের সঠিক দাম লিখুন।", "error");
      return;
    }
    if (!window.confirm("পণ্যের দাম ও প্রাপ্যতা যাচাই করেছেন? এই মূল্য কাস্টমারের কাছে পাঠাবেন?")) return;
    const { error } = await supabase.rpc("admin_quote_custom_package_order", {
      p_order_id: orderId,
      p_custom_prices: prices,
    });
    if (error) {
      notify(`মূল্য পাঠানো যায়নি: ${error.message}`, "error");
      return;
    }
    notify("চূড়ান্ত মূল্য কাস্টমারের কাছে পাঠানো হয়েছে।");
    await loadOrders();
  }

  async function addProduct(event) {
    event.preventDefault();
    const productPrice = Number(price);
    const wholesale = Number(marketPrice);
    const quantity = Number(stock);
    if (!name.trim() || ![productPrice, wholesale, quantity].every(Number.isFinite)) {
      notify("পণ্যের সব তথ্য সঠিকভাবে পূরণ করুন", "error");
      return;
    }
    if (productPrice < 0 || wholesale < 0 || quantity < 0) {
      notify("দাম ও স্টক শূন্যের কম হতে পারবে না", "error");
      return;
    }
    setSaving(true);
    const product = { name: name.trim(), price: productPrice, market_price: wholesale, stock: quantity };
    const result = editingId
      ? await supabase.from("products").update(product).eq("id", editingId)
      : await supabase.from("products").insert([product]);
    setSaving(false);
    if (result.error) {
      notify(`পণ্য সেভ হয়নি: ${result.error.message}`, "error");
      return;
    }
    resetProductForm();
    notify(editingId ? "পণ্য আপডেট হয়েছে" : "নতুন পণ্য যোগ হয়েছে");
    await loadProducts();
  }

  function resetProductForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setMarketPrice("");
    setStock("");
  }

  function editProduct(product) {
    setEditingId(product.id);
    setName(product.name || "");
    setPrice(String(product.price ?? ""));
    setMarketPrice(String(product.market_price ?? ""));
    setStock(String(product.stock ?? ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id) {
    if (!window.confirm("এই পণ্যটি মুছে ফেলতে চান?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      notify(`পণ্য মুছতে সমস্যা হয়েছে: ${error.message}`, "error");
      return;
    }
    notify("পণ্য মুছে ফেলা হয়েছে");
    await loadProducts();
  }

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase();
    return products.filter((product) => !query || product.name?.toLocaleLowerCase().includes(query));
  }, [products, productQuery]);

  const filteredOrders = useMemo(() => {
    const query = orderQuery.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderStatusFilter === "all" || order.order_status === orderStatusFilter;
      const searchable = [order.id, order.customer_name, order.phone, order.delivery_address]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [orders, orderQuery, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase();
    return customers.filter((customer) =>
      !query || [customer.full_name, customer.phone, customer.email].filter(Boolean).join(" ").toLocaleLowerCase().includes(query),
    );
  }, [customers, customerQuery]);

  const deliveredOrders = orders.filter((order) => order.order_status === "delivered");
  const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString());
  const todaySales = deliveredOrders
    .filter((order) => new Date(order.created_at).toDateString() === new Date().toDateString())
    .reduce((total, order) => total + (Number(order.total) || 0), 0);
  const totalSales = deliveredOrders.reduce((total, order) => total + (Number(order.total) || 0), 0);
  const lowStockProducts = products.filter((product) => Number(product.stock) > 0 && Number(product.stock) <= 5);

  if (isCustomerRoute) return <Suspense fallback={<div className="bb-customer-loading-screen" role="status" aria-live="polite"><div className="bb-customer-loading-card"><span className="bb-customer-loading-mark" aria-hidden="true">🛒</span><span className="bb-spinner" /><div><strong>BazarBondhu</strong><p>আপনার বাজারের তথ্য প্রস্তুত হচ্ছে…</p></div></div></div>}><Customer /></Suspense>;

  if (checking) {
    return <div className="bb-loading-screen"><span className="bb-spinner" />অ্যাডমিন অ্যাক্সেস যাচাই হচ্ছে…</div>;
  }

  if (!session) {
    return (
      <main className="bb-login-page">
        <form className="bb-login-card" onSubmit={handleLogin}>
          <div className="bb-login-mark" aria-hidden="true">🛒</div>
          <p className="bb-eyebrow">BAZARBONDHU ADMIN</p>
          <h1>স্বাগতম</h1>
          <p className="bb-muted">আপনার দোকানের কাজ পরিচালনা করতে লগইন করুন।</p>
          <label className="bb-field">ইমেইল
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
          </label>
          <label className="bb-field">পাসওয়ার্ড
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="আপনার পাসওয়ার্ড" />
          </label>
          {loginError && <p className="bb-form-error" role="alert">{loginError}</p>}
          <button className="bb-button bb-button-primary bb-full" type="submit">লগইন করুন</button>
        </form>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="bb-login-page">
        <section className="bb-login-card" role="alert">
          <div className="bb-login-mark bb-denied-mark">!</div>
          <h1>অ্যাক্সেস নেই</h1>
          <p className="bb-muted">এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।</p>
          <button className="bb-button bb-button-secondary bb-full" onClick={handleLogout}>লগআউট</button>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="#dashboard" onClick={(event) => { event.preventDefault(); setActive("Dashboard"); }}>
          <span className="admin-brand-icon">🛒</span>
          <span><strong>BazarBondhu</strong><small>SHOP MANAGEMENT</small></span>
        </a>
        <p className="admin-nav-caption">WORKSPACE</p>
        <nav className="admin-nav" aria-label="অ্যাডমিন মেনু">
          {navigation.map((item) => (
            <button
              className={`admin-nav-item${active === item.id ? " is-active" : ""}`}
              key={item.id}
              onClick={() => { setActive(item.id); if (item.id === "Orders") setNewOrderCount(0); if (item.id === "Rewards") void loadRewardCustomers(); }}
              aria-current={active === item.id ? "page" : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "Orders" && newOrderCount > 0 && <span className="admin-nav-count">{newOrderCount}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-avatar">{(session.user.email || "A").slice(0, 1).toUpperCase()}</div>
          <div className="admin-account"><strong>অ্যাডমিন</strong><small title={session.user.email}>{session.user.email}</small></div>
          <button className="admin-logout" onClick={handleLogout} aria-label="লগআউট" title="লগআউট">↗</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><p className="bb-eyebrow">SHOP MANAGEMENT</p><h1>{navigation.find((item) => item.id === active)?.label}</h1></div>
          <div className="admin-topbar-actions">
            <span className="admin-live"><i /> অনলাইন</span>
            <button className="bb-button bb-button-secondary" onClick={() => void refreshAdminData()} disabled={loading}>↻ <span>রিফ্রেশ</span></button>
          </div>
        </header>

        {active === "Dashboard" && (
          <section className="admin-content">
            <div className="welcome-panel">
              <div><p className="bb-eyebrow">আজকের সারসংক্ষেপ</p><h2>আপনার দোকানের খবর এক নজরে</h2><p>আজকের অর্ডার ও বিক্রির অবস্থা দেখুন।</p></div>
              <span className="welcome-illustration" aria-hidden="true">🧺</span>
            </div>
            <div className="stats-grid">
              <article className="stat-card"><span className="stat-icon stat-green">▤</span><p>আজকের অর্ডার</p><strong>{todayOrders.length}</strong><small>সব স্ট্যাটাস মিলিয়ে</small></article>
              <article className="stat-card"><span className="stat-icon stat-blue">৳</span><p>আজকের বিক্রি</p><strong>{money(todaySales)}</strong><small>ডেলিভারি সম্পন্ন অর্ডার</small></article>
              <article className="stat-card"><span className="stat-icon stat-amber">◷</span><p>অপেক্ষমাণ অর্ডার</p><strong>{orders.filter((order) => order.order_status === "pending").length}</strong><small>অ্যাকশন প্রয়োজন</small></article>
              <article className="stat-card"><span className="stat-icon stat-violet">▦</span><p>মোট পণ্য</p><strong>{products.length}</strong><small>{lowStockProducts.length}টি পণ্যের স্টক কম</small></article>
            </div>
            <div className="dashboard-grid">
              <section className="panel sales-panel"><div className="panel-heading"><div><h2>বিক্রির প্রবণতা</h2><p>গত ৭ দিনের সম্পন্ন অর্ডার</p></div><span className="panel-period">৭ দিন</span></div>
                <div className="chart-wrap"><Suspense fallback={<div className="chart-fallback">চার্ট লোড হচ্ছে…</div>}><DashboardChart data={salesChartData} money={money} /></Suspense></div>
              </section>
              <section className="panel attention-panel"><div className="panel-heading"><div><h2>দৃষ্টি দিন</h2><p>যে কাজগুলো আগে করা দরকার</p></div><span className="attention-dot" /></div>
                <button className="attention-row" onClick={() => setActive("Orders")}><span className="attention-icon stat-amber">◷</span><span><strong>অপেক্ষমাণ অর্ডার</strong><small>কনফার্ম করার অপেক্ষায়</small></span><b>{orders.filter((order) => order.order_status === "pending").length}</b></button>
                <button className="attention-row" onClick={() => setActive("Products")}><span className="attention-icon stat-red">!</span><span><strong>কম স্টক</strong><small>৫ বা তার কম ইউনিট</small></span><b>{lowStockProducts.length}</b></button>
                <div className="attention-total"><span>মোট সম্পন্ন বিক্রি</span><strong>{money(totalSales)}</strong></div>
              </section>
            </div>
            <section className="panel recent-panel"><div className="panel-heading"><div><h2>সাম্প্রতিক অর্ডার</h2><p>সর্বশেষ আসা অর্ডারগুলো</p></div><button className="text-button" onClick={() => setActive("Orders")}>সব অর্ডার দেখুন →</button></div>
              {orders.length === 0 ? <div className="empty-state"><span>▤</span><strong>এখনো অর্ডার আসেনি</strong><p>নতুন অর্ডার এলে এখানে দেখা যাবে।</p></div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>অর্ডার</th><th>গ্রাহক</th><th>তারিখ</th><th>মোট</th><th>স্ট্যাটাস</th></tr></thead><tbody>{orders.slice(0, 5).map((order) => <tr key={order.id}><td className="order-id">#{String(order.id).slice(-6)}</td><td>{order.customer_name || "—"}</td><td>{new Date(order.created_at).toLocaleDateString("bn-BD")}</td><td>{money(order.total)}</td><td><span className={`status-pill status-${order.order_status || "pending"}`}>{order.order_status || "pending"}</span></td></tr>)}</tbody></table></div>}
            </section>
          </section>
        )}

        {active === "Products" && (
          <section className="admin-content">
            <div className="page-intro"><div><h2>পণ্য ব্যবস্থাপনা</h2><p>পণ্যের দাম ও স্টক এক জায়গা থেকে আপডেট করুন।</p></div><span className="page-total">{products.length}টি পণ্য</span></div>
            <div className="product-layout">
              <form className="panel product-form" onSubmit={addProduct}><div className="panel-heading"><div><h2>{editingId ? "পণ্য আপডেট" : "নতুন পণ্য"}</h2><p>পণ্যের তথ্য লিখুন</p></div><span className="form-plus">＋</span></div>
                <label className="bb-field">পণ্যের নাম<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="যেমন: মিনিকেট চাল" /></label>
                <div className="form-two-col"><label className="bb-field">বিক্রয় মূল্য<input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="৳ ০" /></label><label className="bb-field">বাজারদর<input required type="number" min="0" step="0.01" value={marketPrice} onChange={(event) => setMarketPrice(event.target.value)} placeholder="৳ ০" /></label></div>
                <label className="bb-field">স্টক (ইউনিট)<input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} placeholder="০" /></label>
                <div className="form-actions"><button className="bb-button bb-button-primary" type="submit" disabled={saving}>{saving ? "সেভ হচ্ছে…" : editingId ? "পরিবর্তন সেভ" : "পণ্য যোগ করুন"}</button>{editingId && <button className="bb-button bb-button-secondary" type="button" onClick={resetProductForm}>বাতিল</button>}</div>
              </form>
              <section className="panel product-list-panel"><div className="panel-heading"><div><h2>পণ্যের তালিকা</h2><p>নাম লিখে পণ্য খুঁজুন</p></div></div><label className="search-box"><span>⌕</span><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="পণ্যের নাম খুঁজুন" /></label>
                {loading ? <div className="empty-state"><span className="bb-spinner" />পণ্য লোড হচ্ছে…</div> : filteredProducts.length === 0 ? <div className="empty-state"><span>▦</span><strong>{productQuery ? "পণ্য মেলেনি" : "এখনো পণ্য যোগ করা হয়নি"}</strong><p>{productQuery ? "অন্য নামে খুঁজে দেখুন।" : "বাম পাশের ফর্ম থেকে প্রথম পণ্যটি যোগ করুন।"}</p></div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>পণ্য</th><th>বিক্রয় মূল্য</th><th>বাজারদর</th><th>স্টক</th><th>অ্যাকশন</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{money(product.price)}</td><td>{money(product.market_price)}</td><td><span className={`stock-pill${Number(product.stock) <= 5 ? " is-low" : ""}`}>{product.stock} {product.unit || "টি"}</span></td><td className="row-actions"><button className="small-action" onClick={() => editProduct(product)}>এডিট</button><button className="small-action is-danger" onClick={() => void deleteProduct(product.id)}>মুছুন</button></td></tr>)}</tbody></table></div>}
              </section>
            </div>
          </section>
        )}

        {active === "Market Prices" && (
          <section className="admin-content"><div className="page-intro"><div><h2>বাজারদর</h2><p>বর্তমান বাজারদর ও আপনার বিক্রয়মূল্য তুলনা করুন।</p></div><span className="page-total">{filteredProducts.length}টি পণ্য</span></div><label className="search-box search-box-wide"><span>⌕</span><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="পণ্যের নাম খুঁজুন" /></label>
            {filteredProducts.length === 0 ? <div className="panel empty-state"><strong>দেখানোর মতো পণ্য নেই</strong><p>পণ্য যোগ করলে বাজারদর এখানে দেখা যাবে।</p></div> : <div className="market-grid">{filteredProducts.map((product) => <article className="panel market-card" key={product.id}><span className="market-icon">৳</span><h3>{product.name}</h3><p>একক: {product.unit || "টি"}</p><div className="market-prices"><div><small>বাজারদর</small><strong>{money(product.market_price)}</strong></div><div><small>আপনার দাম</small><strong>{money(product.price)}</strong></div></div></article>)}</div>}
          </section>
        )}

        {active === "Orders" && (
          <section className="admin-content"><div className="page-intro"><div><h2>অর্ডার ব্যবস্থাপনা</h2><p>অর্ডার খুঁজুন এবং ডেলিভারির অগ্রগতি আপডেট করুন।</p></div><span className="page-total">{filteredOrders.length}টি অর্ডার</span></div>
            <div className="filter-toolbar"><label className="search-box"><span>⌕</span><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="নাম, ফোন বা অর্ডার আইডি" /></label><select aria-label="অর্ডার স্ট্যাটাস ফিল্টার" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">সব স্ট্যাটাস</option><option value="pending">অপেক্ষমাণ</option><option value="confirmed">কনফার্মড</option><option value="processing">প্রসেসিং</option><option value="delivered">ডেলিভারি সম্পন্ন</option><option value="cancelled">বাতিল</option></select></div>
            {filteredOrders.length === 0 ? <div className="panel empty-state"><span>▤</span><strong>{orderQuery || orderStatusFilter !== "all" ? "কোনো অর্ডার মেলেনি" : "এখনো অর্ডার আসেনি"}</strong><p>ফিল্টার বদলে আবার দেখুন।</p></div> : <div className="orders-list">{filteredOrders.map((order) => {
              const itemsForOrder = orderItems.filter((item) => item.order_id === order.id);
              return <article className="panel order-card" key={order.id}><div className="order-card-top"><div><span className="order-id">অর্ডার #{String(order.id).slice(-6)}</span><p>{new Date(order.created_at).toLocaleString("bn-BD")}</p></div><strong className="order-total">{money(order.total)}</strong></div><div className="order-customer"><div className="customer-avatar">{(order.customer_name || "?").slice(0, 1)}</div><div><strong>{order.customer_name || "—"}</strong><p>{order.phone || "ফোন দেওয়া হয়নি"}</p><p>{order.delivery_address || "ঠিকানা দেওয়া হয়নি"}</p></div></div>
                <div className="order-items">{itemsForOrder.map((item) => <div className="order-line" key={item.id}><span>{item.product_name || "পণ্য"} × {item.quantity}{item.product_id == null && <small style={{ display: "block", color: "#9a6700" }}>কাস্টম পণ্য</small>}</span><span>{item.product_id == null && order.custom_items_status === "pending" ? "দাম নির্ধারণ বাকি" : money(item.line_total ?? Number(item.unit_price) * Number(item.quantity))}</span></div>)}<div className="order-line order-fee"><span>সার্ভিস + ডেলিভারি</span><span>{money(Number(order.service_charge || 0) + Number(order.delivery_fee || 0))}</span></div></div>
                {order.custom_items_status === "pending" && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: "1px solid #ead9ad", background: "#fffaf0" }}>
                    <strong style={{ color: "#76551a" }}>কাস্টম পণ্যের দাম ও প্রাপ্যতা নিশ্চিত করুন</strong>
                    <p style={{ margin: "6px 0 10px", color: "#76551a", fontSize: 12 }}>প্রতিটি পণ্যের একক দাম লিখুন। যাচাই শেষে কোট পাঠালে কাস্টমার সম্মতি দিতে পারবেন।</p>
                    {itemsForOrder.filter((item) => item.product_id == null).map((item) => (
                      <label key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8, fontSize: 13 }}>
                        <span>{item.product_name} × {item.quantity}</span>
                        <input type="number" min="0.01" step="0.01" placeholder="একক দাম ৳" value={customQuotePrices[item.id] ?? ""} onChange={(event) => setCustomQuotePrices((current) => ({ ...current, [item.id]: event.target.value }))} style={{ width: 115, padding: 8, border: "1px solid #d8c99f", borderRadius: 8 }} />
                      </label>
                    ))}
                    <button type="button" onClick={() => void quoteCustomPackageOrder(order.id, itemsForOrder.filter((item) => item.product_id == null))} style={{ width: "100%", marginTop: 12, padding: 11, border: 0, borderRadius: 9, background: "#087F45", color: "#fff", fontWeight: 700, cursor: "pointer" }}>দাম নিশ্চিত করে কাস্টমারকে পাঠান</button>
                  </div>
                )}
                {order.custom_items_status === "quoted" && <p style={{ marginTop: 10, color: "#087F45", fontWeight: 700 }}>চূড়ান্ত মূল্য পাঠানো হয়েছে — কাস্টমারের সম্মতির অপেক্ষায়।</p>}
                {order.cancel_reason && <p className="cancel-reason">বাতিলের কারণ: {order.cancel_reason}</p>}
                <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #dcebe0", background: "#f7fbf8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ color: "#176b40" }}>পেমেন্ট যাচাই</strong>
                    <span style={{ fontSize: 13, fontWeight: 700, color: order.payment_status === "paid" ? "#087f45" : order.payment_status === "rejected" ? "#c0392b" : "#9a6700" }}>
                      {order.payment_status === "paid" ? "পরিশোধিত ✓" : order.payment_status === "rejected" ? "Reject করা হয়েছে" : order.payment_status === "refunded" ? "টাকা ফেরত" : "যাচাই অপেক্ষমাণ"}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 4px", fontSize: 13, color: "#52645a" }}>
                    মাধ্যম: <strong>{order.payment_method === "bkash" ? "বিকাশ Personal" : order.payment_method === "nagad" ? "নগদ Personal" : "Cash on Delivery"}</strong>
                  </p>
                  {["bkash", "nagad"].includes(order.payment_method) && (
                    <div style={{ marginTop: 8, padding: 10, background: "#fff", border: "1px dashed #bfd8c6", borderRadius: 8 }}>
                      <span style={{ display: "block", fontSize: 12, color: "#66756b" }}>কাস্টমারের দেওয়া Transaction ID</span>
                      <strong style={{ display: "block", marginTop: 4, fontSize: 16, color: "#173d29", wordBreak: "break-all" }}>{order.transaction_id || "Transaction ID দেওয়া হয়নি"}</strong>
                    </div>
                  )}
                  <label style={{ display: "block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "#34483a" }}>পেমেন্ট স্ট্যাটাস
                    <select style={{ display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #cbd8cf", borderRadius: 8, background: "#fff" }} value={order.payment_status || "pending"} onChange={(event) => void updateOrder(order.id, { payment_status: event.target.value })}>
                      <option value="pending">যাচাই অপেক্ষমাণ</option>
                      <option value="paid">টাকা পেয়েছি — Approve</option>
                      <option value="rejected">টাকা পাইনি / TrxID ভুল — Reject</option>
                      <option value="refunded">টাকা ফেরত</option>
                    </select>
                  </label>
                  {["bkash", "nagad"].includes(order.payment_method) && order.payment_status === "pending" && (
                    <p style={{ margin: "9px 0 0", fontSize: 12, lineHeight: 1.5, color: "#805b16" }}>ব্যাংক/মোবাইল ফাইন্যান্সিয়াল সার্ভিস অ্যাপে টাকা ও Transaction ID মিলিয়ে তারপর Approve করুন। শুধু TrxID থাকলেই পেমেন্ট নিশ্চিত হয় না।</p>
                  )}
                </div>
                <div className="order-controls"><label>অর্ডার স্ট্যাটাস<select disabled={["pending", "quoted"].includes(order.custom_items_status)} title={["pending", "quoted"].includes(order.custom_items_status) ? "কাস্টমার চূড়ান্ত মূল্য অনুমোদন না করা পর্যন্ত অপেক্ষা করুন" : undefined} value={order.order_status || "pending"} onChange={(event) => void updateOrder(order.id, { order_status: event.target.value })}><option value="pending">অপেক্ষমাণ</option><option value="confirmed">কনফার্মড</option><option value="processing">প্রসেসিং</option><option value="delivered">ডেলিভারি সম্পন্ন</option><option value="cancelled">বাতিল</option></select></label></div></article>;
            })}</div>}
          </section>
        )}

        {active === "Customers" && (
          <section className="admin-content"><div className="page-intro"><div><h2>গ্রাহক তালিকা</h2><p>নিবন্ধিত গ্রাহকের যোগাযোগের তথ্য দেখুন।</p></div><span className="page-total">{filteredCustomers.length} জন</span></div><label className="search-box search-box-wide"><span>⌕</span><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন" /></label>
            {filteredCustomers.length === 0 ? <div className="panel empty-state"><span>♙</span><strong>{customerQuery ? "গ্রাহক মেলেনি" : "এখনো কোনো গ্রাহক নেই"}</strong><p>নতুন গ্রাহক নিবন্ধন করলে এখানে দেখা যাবে।</p></div> : <div className="panel customer-table-panel"><div className="table-scroll"><table className="admin-table"><thead><tr><th>গ্রাহক</th><th>ফোন</th><th>ইমেইল</th><th>ঠিকানা</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span className="customer-avatar">{(customer.full_name || "?").slice(0, 1)}</span><strong>{customer.full_name || "নাম নেই"}</strong></div></td><td>{customer.phone || "—"}</td><td>{customer.email || "—"}</td><td>{customer.address || "—"}</td></tr>)}</tbody></table></div></div>}
          </section>
        )}

        {active === "Rewards" && (
          <section className="admin-content">
            <div className="page-intro"><div><h2>BazarBondhu Rewards</h2><p>গ্রাহকের পয়েন্ট ব্যালেন্স, অর্জন ও প্রথম অর্ডারের বোনাস দেখুন।</p></div><span className="page-total">{rewardCustomers.length} জন</span></div>
            <div className="stats-grid">
              <article className="stat-card"><span className="stat-icon stat-green">🎁</span><div><small>মোট অবশিষ্ট পয়েন্ট</small><strong>{rewardCustomers.reduce((sum, customer) => sum + Number(customer.points_balance || 0), 0).toLocaleString("bn-BD")}</strong></div></article>
              <article className="stat-card"><span className="stat-icon stat-blue">♙</span><div><small>Reward ব্যালেন্স আছে</small><strong>{rewardCustomers.filter((customer) => Number(customer.points_balance || 0) > 0).length.toLocaleString("bn-BD")} জন</strong></div></article>
            </div>
            <div className="panel customer-table-panel"><div className="panel-heading"><div><h2>গ্রাহকদের Reward হিসাব</h2><p>১০ পয়েন্ট = ৳১ · প্রথম সফল অর্ডারে একবার ৫০ বোনাস</p></div><button className="bb-button bb-button-secondary" onClick={() => void loadRewardCustomers()}>↻ রিফ্রেশ</button></div>
              {rewardCustomers.length === 0 ? <div className="empty-state"><span>🎁</span><strong>এখনো Reward হিসাব নেই</strong><p>গ্রাহকের অর্ডার Delivered হলে Reward এখানে দেখা যাবে।</p></div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>গ্রাহক</th><th>ফোন</th><th>বর্তমান পয়েন্ট</th><th>মোট অর্জিত</th><th>ব্যবহৃত</th><th>প্রথম বোনাস</th></tr></thead><tbody>{rewardCustomers.map((customer) => <tr key={customer.user_id}><td><strong>{customer.full_name || "নাম নেই"}</strong></td><td>{customer.phone || "—"}</td><td><strong>{Number(customer.points_balance || 0).toLocaleString("bn-BD")}</strong></td><td>{Number(customer.lifetime_earned || 0).toLocaleString("bn-BD")}</td><td>{Number(customer.lifetime_redeemed || 0).toLocaleString("bn-BD")}</td><td>{customer.first_order_bonus_awarded ? "দেওয়া হয়েছে" : "এখনো নয়"}</td></tr>)}</tbody></table></div>}
            </div>
          </section>
        )}

        {active === "Settings" && (
          <section className="admin-content"><div className="page-intro"><div><h2>দোকানের সেটিংস</h2><p>চেকআউটে ব্যবহৃত চার্জগুলো নির্ধারণ করুন।</p></div></div><form className="panel settings-form" onSubmit={saveSettings}><div className="panel-heading"><div><h2>অর্ডার চার্জ</h2><p>পরিবর্তনগুলো নতুন অর্ডারে প্রযোজ্য হবে।</p></div><span className="form-plus">⚙</span></div><div className="settings-fields"><label className="bb-field">সার্ভিস চার্জ<input type="number" min="0" step="0.01" value={serviceCharge} onChange={(event) => setServiceCharge(event.target.value)} /><small>প্রতি অর্ডারে যোগ হবে</small></label><label className="bb-field">ডেলিভারি ফি<input type="number" min="0" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} /><small>প্রতি অর্ডারে যোগ হবে</small></label></div><button className="bb-button bb-button-primary" type="submit" disabled={saving}>{saving ? "সেভ হচ্ছে…" : "সেটিংস সেভ করুন"}</button></form></section>
        )}
      </main>
      {toast && <div className={`bb-toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}><span>{toast.type === "error" ? "!" : toast.type === "info" ? "●" : "✓"}</span>{toast.message}<button onClick={() => setToast(null)} aria-label="নোটিফিকেশন বন্ধ করুন">×</button></div>}
    </div>
  );
}

export default App;

