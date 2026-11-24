import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./FamilyAssistant.css";

const PACKAGE_OPTIONS = [
  { id: "family-monthly", label: "মাসিক পরিবার", minimum: 2000 },
  { id: "weekly-family", label: "সাপ্তাহিক বাজার", minimum: 1000 },
  { id: "budget-smart", label: "বাজেট স্মার্ট", minimum: 500 },
];

const money = (value) => Number(value || 0).toLocaleString("bn-BD", {
  maximumFractionDigits: 0,
});

export default function FamilyAssistantDashboard({ user, products = [] }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [monthlySpend, setMonthlySpend] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [familyName, setFamilyName] = useState("আমাদের পরিবার");
  const [inviteCode, setInviteCode] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("5000");
  const [packageDraft, setPackageDraft] = useState("family-monthly");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [preferenceProductId, setPreferenceProductId] = useState("");
  const [preferenceBrand, setPreferenceBrand] = useState("");
  const [preferenceVariant, setPreferenceVariant] = useState("");
  const [stockThreshold, setStockThreshold] = useState(5);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [transactionId, setTransactionId] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);

  const isOwner = membership?.role === "owner";
  const productById = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return products.filter((product) => product.is_active !== false && Number(product.stock) > 0)
      .filter((product) => !query || [product.name, product.brand, product.variant]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(query))
      .slice(0, 80);
  }, [products, productSearch]);
  const selectedProduct = productById.get(String(preferenceProductId));
  const preferenceVariants = selectedProduct
    ? products.filter((product) => product.is_active !== false && product.name === selectedProduct.name)
    : [];
  const brandOptions = [...new Set(preferenceVariants.map((product) => product.brand).filter(Boolean))];
  const variantOptions = preferenceVariants
    .filter((product) => !preferenceBrand || product.brand === preferenceBrand)
    .map((product) => product.variant || product.unit)
    .filter(Boolean);
  const plannedTotal = items.reduce((sum, item) => {
    const product = productById.get(String(item.product_id));
    return sum + (product ? Number(product.price || 0) * Number(item.quantity || 0) : 0);
  }, 0);
  const lowStockItems = preferences.filter((preference) => {
    if (!preference.reminder_enabled) return false;
    const product = productById.get(String(preference.product_id));
    return product && Number(product.stock) <= Number(preference.stock_threshold);
  }).map((preference) => ({ ...preference, product: productById.get(String(preference.product_id)) }));

  async function loadFamily() {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: memberData, error: memberError } = await supabase
        .from("family_members")
        .select("id, family_id, role, display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!memberData) {
        setMembership(null);
        setFamily(null);
        setMembers([]);
        setItems([]);
        setPreferences([]);
        setMonthlySpend(0);
        setOrderCount(0);
        return;
      }
      setMembership(memberData);
      const [familyResult, membersResult, itemsResult, preferencesResult, budgetResult, profileResult] = await Promise.all([
        supabase.from("family_groups").select("*").eq("id", memberData.family_id).single(),
        supabase.from("family_members").select("id, user_id, role, display_name, joined_at").eq("family_id", memberData.family_id).order("joined_at"),
        supabase.from("family_shopping_items").select("*").eq("family_id", memberData.family_id).order("created_at"),
        supabase.from("family_product_preferences").select("*").eq("family_id", memberData.family_id),
        supabase.rpc("get_family_budget_summary", { p_family_id: memberData.family_id }),
        supabase.from("profiles").select("full_name, phone, address").eq("id", user.id).maybeSingle(),
      ]);
      if (familyResult.error) throw familyResult.error;
      if (membersResult.error) throw membersResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (preferencesResult.error) throw preferencesResult.error;
      if (budgetResult.error) throw budgetResult.error;
      setFamily(familyResult.data);
      setMembers(membersResult.data || []);
      setItems(itemsResult.data || []);
      setPreferences(preferencesResult.data || []);
      setBudgetDraft(String(familyResult.data.monthly_budget ?? 5000));
      setPackageDraft(familyResult.data.package_id || "family-monthly");
      const summary = Array.isArray(budgetResult.data) ? budgetResult.data[0] : budgetResult.data;
      setMonthlySpend(Number(summary?.monthly_spend || 0));
      setOrderCount(Number(summary?.order_count || 0));
      if (memberData.role === "owner" && profileResult.data) {
        setCustomerName(profileResult.data.full_name || user.user_metadata?.full_name || "");
        setPhone(profileResult.data.phone || user.user_metadata?.phone || "");
        setAddress(profileResult.data.address || "");
      }
    } catch (loadError) {
      console.error("Family Assistant load error:", loadError);
      setError(loadError.message || "পরিবারের তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }

  async function refreshItems() {
    if (!family?.id) return;
    const { data, error: itemsError } = await supabase
      .from("family_shopping_items").select("*").eq("family_id", family.id).order("created_at");
    if (itemsError) {
      setError(itemsError.message);
      return;
    }
    setItems(data || []);
  }

  useEffect(() => {
    void loadFamily();
  }, [user?.id]);

  useEffect(() => {
    if (!family?.id) return undefined;
    const channel = supabase.channel("family-shopping-" + family.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "family_shopping_items",
        filter: "family_id=eq." + family.id,
      }, () => { void refreshItems(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [family?.id]);

  useEffect(() => {
    const saved = preferences.find((item) => String(item.product_id) === String(preferenceProductId));
    if (saved) {
      setPreferenceBrand(saved.preferred_brand || "");
      setPreferenceVariant(saved.preferred_variant || "");
      setStockThreshold(Number(saved.stock_threshold ?? 5));
      setReminderEnabled(Boolean(saved.reminder_enabled));
    } else {
      const product = productById.get(String(preferenceProductId));
      setPreferenceBrand(product?.brand || "");
      setPreferenceVariant(product?.variant || "");
      setStockThreshold(5);
      setReminderEnabled(true);
    }
  }, [preferenceProductId, preferences, productById]);

  async function createFamily(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: createError } = await supabase.rpc("create_family_group", {
      p_name: familyName,
      p_monthly_budget: Number(budgetDraft) || 0,
      p_package_id: packageDraft,
    });
    setBusy(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    setMessage("আপনার Family Group তৈরি হয়েছে। এখন ইনভাইট কোড দিয়ে পরিবারের সদস্যদের যুক্ত করুন।");
    await loadFamily();
  }

  async function joinFamily(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: joinError } = await supabase.rpc("join_family_group", {
      p_invite_code: inviteCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (joinError) {
      setError(joinError.message);
      return;
    }
    setMessage("আপনি পরিবারের Shared Shopping-এ যুক্ত হয়েছেন।");
    await loadFamily();
  }

  async function addProduct() {
    if (!family?.id || !selectedProductId) {
      setError("আগে একটি পণ্য বেছে নিন।");
      return;
    }
    setBusy(true);
    setError("");
    const { error: addError } = await supabase.rpc("family_add_shopping_item", {
      p_family_id: family.id,
      p_product_id: selectedProductId,
      p_quantity: Number(quantity) || 1,
    });
    setBusy(false);
    if (addError) {
      setError(addError.message);
      return;
    }
    setMessage("পণ্যটি পরিবারের বাজারের তালিকায় যোগ হয়েছে।");
    setQuantity(1);
    await refreshItems();
  }

  async function updateQuantity(item, nextQuantity) {
    if (nextQuantity < 1) return removeItem(item.id);
    const { error: updateError } = await supabase.from("family_shopping_items")
      .update({ quantity: nextQuantity, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("family_id", family.id);
    if (updateError) setError(updateError.message);
    else await refreshItems();
  }

  async function removeItem(itemId) {
    const { error: removeError } = await supabase.from("family_shopping_items")
      .delete().eq("id", itemId).eq("family_id", family.id);
    if (removeError) setError(removeError.message);
    else await refreshItems();
  }

  async function saveBudget() {
    const budget = Number(budgetDraft);
    if (!Number.isFinite(budget) || budget < 0 || budget > 10000000) {
      setError("০ থেকে ১ কোটি টাকার মধ্যে সঠিক বাজেট লিখুন।");
      return;
    }
    setBusy(true);
    const { data, error: saveError } = await supabase.from("family_groups")
      .update({ monthly_budget: budget, package_id: packageDraft, updated_at: new Date().toISOString() })
      .eq("id", family.id).select("*").single();
    setBusy(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setFamily(data);
    setMessage("পরিবারের বাজেট ও প্যাকেজ সেভ হয়েছে।");
  }

  async function savePreference() {
    if (!preferenceProductId) {
      setError("পছন্দের পণ্যটি নির্বাচন করুন।");
      return;
    }
    setBusy(true);
    const { error: preferenceError } = await supabase.from("family_product_preferences").upsert({
      family_id: family.id,
      product_id: preferenceProductId,
      preferred_brand: preferenceBrand || null,
      preferred_variant: preferenceVariant || null,
      stock_threshold: Number(stockThreshold) || 0,
      reminder_enabled: reminderEnabled,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "family_id,product_id" });
    setBusy(false);
    if (preferenceError) {
      setError(preferenceError.message);
      return;
    }
    setMessage("পরিবারের পছন্দ ও স্টক রিমাইন্ডার সেভ হয়েছে।");
    const { data } = await supabase.from("family_product_preferences").select("*").eq("family_id", family.id);
    setPreferences(data || []);
  }

  async function reorderPreviousMarket() {
    if (!isOwner) return;
    if (items.length && !window.confirm("আগের বাজারের পণ্যগুলো বর্তমান তালিকায় যোগ হবে। চালিয়ে যাবেন?")) return;
    setBusy(true);
    setError("");
    const { data: orders, error: ordersError } = await supabase.from("orders")
      .select("id, created_at, order_status, payment_status, order_items(product_id, quantity)")
      .eq("user_id", user.id).eq("package_id", family.package_id)
      .not("confirmed_at", "is", null).order("confirmed_at", { ascending: false }).limit(20);
    if (ordersError) {
      setBusy(false);
      setError(ordersError.message);
      return;
    }
    const previousOrder = (orders || []).find((order) =>
      !["cancelled", "canceled", "বাতিল"].includes(String(order.order_status || "").toLowerCase())
      && !["rejected", "refunded"].includes(String(order.payment_status || "").toLowerCase())
      && (order.order_items || []).some((item) => item.product_id)
    );
    if (!previousOrder) {
      setBusy(false);
      setMessage("আপনার আগের কোনো কনফার্ম হওয়া প্যাকেজ অর্ডার পাওয়া যায়নি।");
      return;
    }
    let added = 0;
    for (const item of previousOrder.order_items || []) {
      if (!item.product_id || !productById.has(String(item.product_id))) continue;
      const { error: addError } = await supabase.rpc("family_add_shopping_item", {
        p_family_id: family.id,
        p_product_id: item.product_id,
        p_quantity: Math.max(1, Math.ceil(Number(item.quantity) || 1)),
      });
      if (!addError) added += 1;
    }
    setBusy(false);
    await refreshItems();
    setMessage(added ? `আগের বাজার থেকে ${added.toLocaleString("bn-BD")} ধরনের পণ্য পরিবারের তালিকায় যোগ হয়েছে।` : "আগের বাজারের পণ্য বর্তমানে পাওয়া যাচ্ছে না।");
  }

  async function removeMember(memberId) {
    if (!isOwner || !window.confirm("এই সদস্যকে পরিবার থেকে সরিয়ে দেবেন?")) return;
    const { error: removeError } = await supabase.from("family_members").delete().eq("id", memberId).eq("family_id", family.id);
    if (removeError) setError(removeError.message);
    else {
      setMessage("সদস্যকে পরিবার থেকে সরানো হয়েছে।");
      await loadFamily();
    }
  }

  async function leaveFamily() {
    if (isOwner) return;
    if (!window.confirm("পরিবার থেকে বের হয়ে যাবেন? পরে আবার ইনভাইট কোড দিয়ে যোগ দিতে পারবেন।")) return;
    const { error: leaveError } = await supabase.from("family_members").delete().eq("user_id", user.id).eq("family_id", family.id);
    if (leaveError) setError(leaveError.message);
    else await loadFamily();
  }

  async function placeFamilyOrder(event) {
    event.preventDefault();
    if (!isOwner) {
      setError("শুধু Family Owner অর্ডার করতে পারবেন।");
      return;
    }
    const orderItems = items.filter((item) => item.product_id).map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
    }));
    if (!orderItems.length) {
      setError("অর্ডার করার মতো পণ্য তালিকায় নেই।");
      return;
    }
    if (paymentMethod !== "cod" && !transactionId.trim()) {
      setError("পেমেন্ট করার পর Transaction ID লিখুন।");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: orderError } = await supabase.rpc("create_family_order_atomic", {
      p_family_id: family.id,
      p_customer_name: customerName.trim(),
      p_phone: phone.trim(),
      p_delivery_address: address.trim(),
      p_payment_method: paymentMethod,
      p_transaction_id: transactionId.trim() || null,
      p_items: orderItems,
    });
    setBusy(false);
    if (orderError) {
      setError(orderError.message);
      return;
    }
    await supabase.from("family_shopping_items").delete().eq("family_id", family.id);
    setShowOrderForm(false);
    setTransactionId("");
    setMessage("পরিবারের অর্ডার সফলভাবে গ্রহণ করা হয়েছে। অর্ডার নম্বর: " + String(data).slice(0, 8).toUpperCase());
    await loadFamily();
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(family.invite_code);
      setMessage("ইনভাইট কোড কপি হয়েছে। পরিবারের সদস্যদের পাঠিয়ে দিন।");
    } catch {
      setMessage("ইনভাইট কোড: " + family.invite_code);
    }
  }

  if (!user) {
    return <section className="bb-fa-dashboard"><div className="bb-fa-empty-state"><span>🔐</span><h2>Family Assistant ব্যবহার করতে লগইন করুন</h2><p>লগইন করার পর পরিবার তৈরি বা ইনভাইট কোড দিয়ে যোগ দিতে পারবেন।</p></div></section>;
  }

  if (loading) {
    return <section className="bb-fa-dashboard"><div className="bb-fa-loading">পরিবারের তথ্য লোড হচ্ছে…</div></section>;
  }

  if (!family) {
    return (
      <section className="bb-fa-dashboard">
        <header className="bb-fa-heading">
          <div><span className="bb-fa-kicker">BAZARBONDHU · SMART FAMILY</span><h1>Family Assistant</h1><p>পরিবারের সবাই মিলে বাজারের তালিকা তৈরি করুন। চূড়ান্ত অর্ডার করবেন একজন Owner।</p></div>
          <span className="bb-fa-status"><i /> Family Shared Shopping</span>
        </header>
        <div className="bb-fa-onboard-grid">
          <form className="bb-fa-panel" onSubmit={createFamily}>
            <span className="bb-fa-panel-icon">👨‍👩‍👧‍👦</span><h2>নতুন Family Group তৈরি করুন</h2>
            <p>আপনি গ্রুপের Owner হবেন। ইনভাইট কোড দিয়ে পরিবারের অন্য সদস্যদের যুক্ত করতে পারবেন।</p>
            <label>পরিবারের নাম<input value={familyName} onChange={(event) => setFamilyName(event.target.value)} maxLength={60} required /></label>
            <label>মাসিক বাজেট (৳)<input type="number" min="0" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} required /></label>
            <label>বাজারের প্যাকেজ<select value={packageDraft} onChange={(event) => setPackageDraft(event.target.value)}>{PACKAGE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <button className="bb-fa-primary" disabled={busy}>{busy ? "তৈরি হচ্ছে…" : "পরিবার তৈরি করুন"}</button>
          </form>
          <form className="bb-fa-panel" onSubmit={joinFamily}>
            <span className="bb-fa-panel-icon">🔗</span><h2>ইনভাইট কোড দিয়ে যোগ দিন</h2>
            <p>পরিবারের Owner-এর কাছ থেকে পাওয়া ৮ অক্ষরের কোড লিখুন।</p>
            <label>ইনভাইট কোড<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} placeholder="যেমন A1B2C3D4" required /></label>
            <button className="bb-fa-secondary" disabled={busy}>{busy ? "যোগ হচ্ছে…" : "পরিবারে যোগ দিন"}</button>
          </form>
        </div>
        {error && <p className="bb-fa-alert is-error" role="alert">{error}</p>}
        {message && <p className="bb-fa-alert" role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="bb-fa-dashboard">
      <header className="bb-fa-heading">
        <div><span className="bb-fa-kicker">BAZARBONDHU · SMART FAMILY</span><h1>Family Assistant</h1><p>পরিবারের সবাই মিলে বাজার সাজান, বাজেট দেখুন, আর Owner চূড়ান্ত অর্ডার করবেন।</p></div>
        <span className={isOwner ? "bb-fa-role is-owner" : "bb-fa-role"}>{isOwner ? "★ FAMILY OWNER" : "● FAMILY MEMBER"}</span>
      </header>

      <div className="bb-fa-hero">
        <div><span className="bb-fa-hero-label">আপনাদের পরিবারের বাজার কেন্দ্র</span><h2>{family.name}</h2><p>সদস্যরা তালিকায় পণ্য যোগ করতে পারবেন। অর্ডার কনফার্ম করার ক্ষমতা শুধু Owner-এর।</p></div>
        <div className="bb-fa-invite"><small>FAMILY INVITE CODE</small><strong>{family.invite_code}</strong><button type="button" onClick={copyInviteCode}>কোড কপি করুন</button></div>
      </div>

      <div className="bb-fa-stat-grid">
        <article><small>মাসিক বাজেট</small><strong>৳{money(family.monthly_budget)}</strong><span>{PACKAGE_OPTIONS.find((item) => item.id === family.package_id)?.label}</span></article>
        <article><small>এই মাসে বাজার</small><strong>৳{money(monthlySpend)}</strong><span>{orderCount.toLocaleString("bn-BD")}টি অর্ডার</span></article>
        <article><small>তালিকার সম্ভাব্য খরচ</small><strong>৳{money(plannedTotal)}</strong><span>{items.length.toLocaleString("bn-BD")}টি আইটেম</span></article>
        <article><small>পরিবারের সদস্য</small><strong>{members.length.toLocaleString("bn-BD")} জন</strong><span>{isOwner ? "আপনি Owner" : "Owner-এর অধীনে সদস্য"}</span></article>
      </div>

      <div className="bb-fa-section-title"><div><span>SHARED SHOPPING</span><h2>পরিবারের সবার বাজারের তালিকা</h2></div><span className="bb-fa-live">● Live Sync</span></div>
      <div className="bb-fa-panel">
        <p className="bb-fa-helper">যে কেউ পণ্য যোগ বা পরিমাণ পরিবর্তন করলে পরিবারের অন্য সদস্যদের স্ক্রিনেও তালিকা আপডেট হবে।</p>
        <div className="bb-fa-add-row">
          <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="পণ্য, ব্র্যান্ড বা সাইজ খুঁজুন…" aria-label="পণ্য খুঁজুন" />
          <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} aria-label="পণ্য নির্বাচন করুন">
            <option value="">পণ্য বেছে নিন</option>
            {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.name}{product.brand ? " · " + product.brand : ""}{product.variant ? " · " + product.variant : ""} — ৳{money(product.price)}</option>)}
          </select>
          <input type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} aria-label="পরিমাণ" />
          <button type="button" className="bb-fa-primary" onClick={addProduct} disabled={busy || !selectedProductId}>+ তালিকায় যোগ</button>
        </div>
        {items.length ? (
          <div className="bb-fa-shared-list">
            {items.map((item) => {
              const product = productById.get(String(item.product_id));
              return <article key={item.id} className="bb-fa-shared-item">
                <div className="bb-fa-item-image">{product?.image_url ? <img src={product.image_url} alt="" /> : "🛒"}</div>
                <div className="bb-fa-item-copy"><strong>{product?.name || item.custom_name || "পণ্য"}</strong><small>{[product?.brand, product?.variant].filter(Boolean).join(" · ") || "পরিবারের বাজার"}</small><span>৳{money(product?.price)} / {product?.unit || "টি"}</span></div>
                <div className="bb-fa-qty"><button type="button" aria-label="এক কমান" onClick={() => updateQuantity(item, Number(item.quantity) - 1)}>−</button><b>{Number(item.quantity).toLocaleString("bn-BD")}</b><button type="button" aria-label="এক বাড়ান" onClick={() => updateQuantity(item, Number(item.quantity) + 1)}>+</button></div>
                <strong className="bb-fa-line-total">৳{money((product?.price || 0) * item.quantity)}</strong>
                <button type="button" className="bb-fa-remove" onClick={() => removeItem(item.id)} aria-label="তালিকা থেকে সরান">×</button>
              </article>;
            })}
          </div>
        ) : <div className="bb-fa-empty-list">🧺<strong>এখনো কোনো পণ্য যোগ হয়নি</strong><span>উপরের সার্চ থেকে পরিবারের প্রয়োজনীয় পণ্য যোগ করুন।</span></div>}
        <div className="bb-fa-list-footer"><span>সম্ভাব্য পণ্যমূল্য</span><strong>৳{money(plannedTotal)}</strong></div>
        {isOwner ? <button type="button" className="bb-fa-order-button" onClick={() => setShowOrderForm((value) => !value)} disabled={!items.some((item) => item.product_id)}>✓ পরিবারের অর্ডার করুন</button>
          : <div className="bb-fa-owner-notice">🔒 শুধু Family Owner চূড়ান্ত অর্ডার করতে পারবেন। তালিকা প্রস্তুত হলে Owner-কে জানিয়ে দিন।</div>}
        {showOrderForm && isOwner && (
          <form className="bb-fa-order-form" onSubmit={placeFamilyOrder}>
            <h3>Owner-এর অর্ডার নিশ্চিতকরণ</h3>
            <p>এই অর্ডারটি পরিবারের Owner-এর অ্যাকাউন্ট থেকে তৈরি হবে।</p>
            <div className="bb-fa-form-grid">
              <label>নাম<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
              <label>মোবাইল<input value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
              <label className="full">ডেলিভারি ঠিকানা<textarea value={address} onChange={(event) => setAddress(event.target.value)} required rows={2} /></label>
              <label>পেমেন্ট<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cod">Cash on Delivery</option><option value="bkash">বিকাশ</option><option value="nagad">নগদ</option></select></label>
              {paymentMethod !== "cod" && <label>Transaction ID<input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} required /></label>}
            </div>
            <div className="bb-fa-order-actions"><button type="button" className="bb-fa-secondary" onClick={() => setShowOrderForm(false)}>বাতিল</button><button className="bb-fa-primary" disabled={busy}>{busy ? "অর্ডার হচ্ছে…" : "অর্ডার কনফার্ম করুন"}</button></div>
          </form>
        )}
      </div>

      <div className="bb-fa-two-column">
        <section className="bb-fa-panel">
          <div className="bb-fa-panel-heading"><div><span>FAMILY BUDGET</span><h2>পরিবারের বাজেট নিয়ন্ত্রণ</h2></div><span>৳</span></div>
          <div className="bb-fa-budget-values"><div><small>খরচ হয়েছে</small><strong>৳{money(monthlySpend)}</strong></div><div><small>বাকি বাজেট</small><strong>৳{money(Number(family.monthly_budget) - monthlySpend)}</strong></div></div>
          <div className="bb-fa-progress"><span style={{ width: `${family.monthly_budget > 0 ? Math.min(100, monthlySpend / family.monthly_budget * 100) : 0}%` }} /></div>
          {isOwner ? <div className="bb-fa-budget-edit"><label>মাসিক বাজেট<input type="number" min="0" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} /></label><label>প্যাকেজ<select value={packageDraft} onChange={(event) => setPackageDraft(event.target.value)}>{PACKAGE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className="bb-fa-secondary" onClick={saveBudget} disabled={busy}>বাজেট সেভ করুন</button></div>
            : <p className="bb-fa-helper">বাজেট পরিবর্তন করার দায়িত্ব Family Owner-এর।</p>}
        </section>

        <section className="bb-fa-panel">
          <div className="bb-fa-panel-heading"><div><span>MONTHLY REORDER</span><h2>আগের বাজার আবার আনুন</h2></div><span>↻</span></div>
          <p className="bb-fa-helper">Owner-এর সর্বশেষ কনফার্ম হওয়া প্যাকেজ অর্ডার থেকে পণ্যগুলো Shared List-এ যোগ হবে।</p>
          <button type="button" className="bb-fa-secondary" onClick={reorderPreviousMarket} disabled={!isOwner || busy}>{busy ? "তালিকা আনা হচ্ছে…" : "↻ আগের বাজার যোগ করুন"}</button>
          {!isOwner && <small className="bb-fa-muted">এই কাজটি শুধু Owner করতে পারবেন।</small>}
        </section>
      </div>

      <div className="bb-fa-two-column">
        <section className="bb-fa-panel">
          <div className="bb-fa-panel-heading"><div><span>FAMILY PREFERENCES</span><h2>পরিবারের পছন্দের ব্র্যান্ড ও সাইজ</h2></div><span>♡</span></div>
          <label className="bb-fa-field">পণ্য নির্বাচন<select value={preferenceProductId} onChange={(event) => setPreferenceProductId(event.target.value)}><option value="">পণ্য বেছে নিন</option>{products.filter((product) => product.is_active !== false).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.brand || "ব্র্যান্ড নেই"} · {product.variant || product.unit}</option>)}</select></label>
          {preferenceProductId && <>
            <label className="bb-fa-field">পছন্দের ব্র্যান্ড<select value={preferenceBrand} onChange={(event) => setPreferenceBrand(event.target.value)}><option value="">নির্দিষ্ট নয়</option>{brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
            <label className="bb-fa-field">পছন্দের সাইজ / ভ্যারিয়েন্ট<select value={preferenceVariant} onChange={(event) => setPreferenceVariant(event.target.value)}><option value="">নির্দিষ্ট নয়</option>{[...new Set(variantOptions)].map((variant) => <option key={variant} value={variant}>{variant}</option>)}</select></label>
            <div className="bb-fa-reminder-settings"><label>রিমাইন্ডারের স্টক সীমা<input type="number" min="0" value={stockThreshold} onChange={(event) => setStockThreshold(Math.max(0, Number(event.target.value) || 0))} /></label><label className="bb-fa-switch"><input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} /> স্টক রিমাইন্ডার চালু</label></div>
            <button type="button" className="bb-fa-secondary" onClick={savePreference} disabled={busy}>পছন্দ সেভ করুন</button>
          </>}
        </section>

        <section className="bb-fa-panel">
          <div className="bb-fa-panel-heading"><div><span>HOUSEHOLD STOCK REMINDER</span><h2>স্টক শেষ হওয়ার আগেই সতর্কতা</h2></div><span>🔔</span></div>
          {lowStockItems.length ? <div className="bb-fa-alert-list">{lowStockItems.map((item) => <div key={item.product_id}><span>⚠️</span><div><strong>{item.product.name}</strong><small>বর্তমান স্টক {Number(item.product.stock).toLocaleString("bn-BD")} · রিমাইন্ডার সীমা {Number(item.stock_threshold).toLocaleString("bn-BD")}</small></div></div>)}</div>
            : <div className="bb-fa-empty-list compact">✓<strong>এই মুহূর্তে কম স্টকের সতর্কতা নেই</strong><span>পছন্দের পণ্যে রিমাইন্ডার চালু রাখুন।</span></div>}
          <small className="bb-fa-muted">এটি অ্যাপের ভেতরের স্টক সতর্কতা; ফোনে Push Notification পাঠানো এখনো যুক্ত হয়নি।</small>
        </section>
      </div>

      <section className="bb-fa-panel">
        <div className="bb-fa-panel-heading"><div><span>FAMILY MEMBERS</span><h2>পরিবারের সদস্য ও দায়িত্ব</h2></div><span>👨‍👩‍👧‍👦</span></div>
        <div className="bb-fa-member-list">{members.map((member) => <div key={member.id}><span className="bb-fa-avatar">{member.role === "owner" ? "👑" : "👤"}</span><div><strong>{member.display_name || (member.user_id === user.id ? "আপনি" : "পরিবারের সদস্য")}</strong><small>{member.role === "owner" ? "Family Owner · অর্ডার করতে পারবেন" : "Family Member · তালিকায় পণ্য যোগ করতে পারবেন"}</small></div>{isOwner && member.role !== "owner" && <button type="button" onClick={() => removeMember(member.id)}>সদস্য সরান</button>}</div>)}</div>
        {!isOwner && <button type="button" className="bb-fa-text-button" onClick={leaveFamily}>পরিবার থেকে বের হয়ে যান</button>}
      </section>

      {error && <p className="bb-fa-alert is-error" role="alert">{error}</p>}
      {message && <p className="bb-fa-alert" role="status">{message}</p>}
    </section>
  );
}
