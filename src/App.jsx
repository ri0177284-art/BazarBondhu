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
  { id: "Settings", label: "সেটিংস", icon: "⚙" },
];

const money = (amount) =>
  `৳${new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(Number(amount) || 0)}`;

function App() {
  const isCustomerRoute = window.location.pathname.toLowerCase().includes("customer");
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
      .select("*");
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
    await Promise.all([loadProducts(), loadOrders(), loadCustomers(), loadSettings()]);
  }, [loadCustomers, loadOrders, loadProducts, loadSettings]);

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
    const update = { ...patch };
    if (patch.order_status === "confirmed" && (currentOrder?.order_status !== "confirmed" || !currentOrder?.confirmed_at)) {
      update.confirmed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(update).eq("id", orderId);
    if (error) {
      notify(`অর্ডার আপডেট হয়নি: ${error.message}`, "error");
      return;
    }
    notify("অর্ডার আপডেট হয়েছে");
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

  if (isCustomerRoute) return <Suspense fallback={<div className="bb-loading-screen"><span className="bb-spinner" />অ্যাপ লোড হচ্ছে…</div>}><Customer /></Suspense>;

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
              onClick={() => { setActive(item.id); if (item.id === "Orders") setNewOrderCount(0); }}
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
              const itemsForOrder = orderItems.filter((item) => (item["orders id"] ?? item.order_id) === order.id);
              return <article className="panel order-card" key={order.id}><div className="order-card-top"><div><span className="order-id">অর্ডার #{String(order.id).slice(-6)}</span><p>{new Date(order.created_at).toLocaleString("bn-BD")}</p></div><strong className="order-total">{money(order.total)}</strong></div><div className="order-customer"><div className="customer-avatar">{(order.customer_name || "?").slice(0, 1)}</div><div><strong>{order.customer_name || "—"}</strong><p>{order.phone || "ফোন দেওয়া হয়নি"}</p><p>{order.delivery_address || "ঠিকানা দেওয়া হয়নি"}</p></div></div>
                <div className="order-items">{itemsForOrder.map((item) => <div className="order-line" key={item.id}><span>{item["product name"] ?? item.product_name ?? "পণ্য"} × {item.quantity}</span><span>{money(item["line total"] ?? item.line_total ?? Number(item["unit price"] ?? item.unit_price) * Number(item.quantity))}</span></div>)}<div className="order-line order-fee"><span>সার্ভিস + ডেলিভারি</span><span>{money(Number(order.service_charge || 0) + Number(order.delivery_fee || 0))}</span></div></div>
                {order.cancel_reason && <p className="cancel-reason">বাতিলের কারণ: {order.cancel_reason}</p>}
                <div className="order-controls"><label>অর্ডার স্ট্যাটাস<select value={order.order_status || "pending"} onChange={(event) => void updateOrder(order.id, { order_status: event.target.value })}><option value="pending">অপেক্ষমাণ</option><option value="confirmed">কনফার্মড</option><option value="processing">প্রসেসিং</option><option value="delivered">ডেলিভারি সম্পন্ন</option><option value="cancelled">বাতিল</option></select></label><label>পেমেন্ট · {order.payment_method || "—"}<select value={order.payment_status || "pending"} onChange={(event) => void updateOrder(order.id, { payment_status: event.target.value })}><option value="pending">বাকি</option><option value="paid">পরিশোধিত</option><option value="refunded">ফেরত</option></select></label></div></article>;
            })}</div>}
          </section>
        )}

        {active === "Customers" && (
          <section className="admin-content"><div className="page-intro"><div><h2>গ্রাহক তালিকা</h2><p>নিবন্ধিত গ্রাহকের যোগাযোগের তথ্য দেখুন।</p></div><span className="page-total">{filteredCustomers.length} জন</span></div><label className="search-box search-box-wide"><span>⌕</span><input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন" /></label>
            {filteredCustomers.length === 0 ? <div className="panel empty-state"><span>♙</span><strong>{customerQuery ? "গ্রাহক মেলেনি" : "এখনো কোনো গ্রাহক নেই"}</strong><p>নতুন গ্রাহক নিবন্ধন করলে এখানে দেখা যাবে।</p></div> : <div className="panel customer-table-panel"><div className="table-scroll"><table className="admin-table"><thead><tr><th>গ্রাহক</th><th>ফোন</th><th>ইমেইল</th><th>ঠিকানা</th></tr></thead><tbody>{filteredCustomers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><span className="customer-avatar">{(customer.full_name || "?").slice(0, 1)}</span><strong>{customer.full_name || "নাম নেই"}</strong></div></td><td>{customer.phone || "—"}</td><td>{customer.email || "—"}</td><td>{customer.address || "—"}</td></tr>)}</tbody></table></div></div>}
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

