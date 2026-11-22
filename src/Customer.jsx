import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Sidebar from "./Sidebar";
import "./Customer.css";

const FAMILY_PACKAGES = [
  { id: "family-monthly", label: "মাসিক পরিবার", detail: "মাসের বাজার একসাথে" },
  { id: "weekly-family", label: "সাপ্তাহিক বাজার", detail: "সপ্তাহ ধরে পরিকল্পনা" },
  { id: "budget-smart", label: "বাজেট স্মার্ট", detail: "খরচে থাকুন নিয়ন্ত্রণে" },
];

const FAMILY_PACKAGE_MINIMUMS = {
  "weekly-family": 1000,
  "family-monthly": 2000,
};
const BUDGET_SMART_MINIMUM = 500;

const CATEGORY_GROUPS = [
  { id: "grains", name: "চাল, ডাল ও আটা", match: /চাল|ডাল|আটা|ময়দা|ময়দা|বেসন|সুজি|চিঁড়া|চিড়া/ },
  { id: "oils", name: "তেল ও ঘি", match: /তেল|ঘি/ },
  { id: "vegetables", name: "শাকসবজি", match: /আলু|পেঁয়াজ|পেঁয়াজ|আদা|রসুন|কাঁচামরিচ|টমেটো|ধনেপাতা|সবজি|শাক/ },
  { id: "fruits", name: "ফলমূল", match: /ফল|লেবু|আম|কলা|আপেল/ },
  { id: "protein", name: "মাছ, মাংস ও মুরগি", match: /মাছ|মাংস|মুরগি|গরু|খাসি/ },
  { id: "dairy", name: "দুধ, ডিম ও দুগ্ধজাত", match: /দুধ|ডিম|দই|পনির|মাখন/ },
  { id: "spices", name: "মসলা, লবণ ও চিনি", match: /মসলা|মরিচ গুঁড়া|হলুদ|জিরা|ধনে গুঁড়া|লবণ|চিনি|সোডা|ভিনেগার/ },
  { id: "snacks", name: "বিস্কুট ও স্ন্যাকস", match: /বিস্কুট|নুডলস|মুড়ি|মুড়ি|বাদাম|চিঁড়া|চিড়া/ },
  { id: "bakery", name: "নাশতা ও বেকারি", match: /পাউরুটি|সেমাই|মধু/ },
  { id: "personal-care", name: "পার্সোনাল কেয়ার", match: /সাবান|শ্যাম্পু|টুথপেস্ট|টুথব্রাশ|ফেসওয়াশ|ফেসওয়াশ|ময়েশ্চারাইজার|ময়েশ্চারাইজার|চিরুনি|রেজর|ন্যাপকিন|হ্যান্ডওয়াশ|হ্যান্ডওয়াশ/ },
  { id: "cleaning", name: "ঘর পরিষ্কার ও ডিটারজেন্ট", match: /ডিটারজেন্ট|ডিশওয়াশ|ডিশওয়াশ|ক্লিনার|ঝাড়ু|ঝাড়ু|স্ক্রাবার|মেঝে মোছার|মশার কয়েল|মশার কয়েল/ },
  { id: "household", name: "টিস্যু ও গৃহস্থালি", match: /টিস্যু|ময়লার ব্যাগ|ব্যাটারি|দিয়াশলাই|মোমবাতি/ },
  { id: "beverages", name: "চা, কফি ও পানীয়", match: /চা পাতা|কফি|পানীয়|পানীয়|জুস/ },
  { id: "baby-care", name: "বেবি কেয়ার", match: /বেবি|ডায়াপার|ডায়াপার/ },
  { id: "other", name: "অন্যান্য পণ্য", match: /.*/ },
];

function getProductCategory(productName = "") {
  const name = String(productName).trim().toLowerCase();
  return CATEGORY_GROUPS.find((category) => category.id !== "other" && category.match.test(name))?.id || "other";
}

function getFamilyPackageMinimum(packageId) {
  return FAMILY_PACKAGE_MINIMUMS[packageId] || 0;
}

const DEFAULT_FAMILY_PREFERENCES = {
  familyMembers: 4,
  monthlyBudget: 5000,
  packageId: "family-monthly",
};

function normalizeFamilyPreferences(value = {}) {
  const familyMembers = Number(value.familyMembers);
  const monthlyBudget = Number(value.monthlyBudget);
  const packageId = FAMILY_PACKAGES.some((item) => item.id === value.packageId)
    ? value.packageId
    : DEFAULT_FAMILY_PREFERENCES.packageId;

  return {
    familyMembers: Number.isInteger(familyMembers) && familyMembers >= 1 && familyMembers <= 30
      ? familyMembers
      : DEFAULT_FAMILY_PREFERENCES.familyMembers,
    monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget >= 0
      ? Math.min(monthlyBudget, 100000)
      : DEFAULT_FAMILY_PREFERENCES.monthlyBudget,
    packageId,
  };
}

function normalizeShoppingList(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item?.productId && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0)
    .map((item) => ({ productId: String(item.productId), quantity: Math.min(10000, Number(item.quantity)) }));
}

function getPackageCycleEnd(confirmedAt, packageId) {
  if (!confirmedAt) return null;
  const endDate = new Date(confirmedAt);
  if (Number.isNaN(endDate.getTime())) return null;

  if (packageId === "weekly-family") {
    endDate.setDate(endDate.getDate() + 7);
    return endDate;
  }

  const startDay = endDate.getDate();
  endDate.setDate(1);
  endDate.setMonth(endDate.getMonth() + 1);
  const lastDayOfNextMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  endDate.setDate(Math.min(startDay, lastDayOfNextMonth));
  return endDate;
}

function suggestBudgetFill(selectedProducts, budget, currentTotal) {
  const remaining = Number(budget) - Number(currentTotal);
  if (remaining < 0) return { error: "আপনার তালিকার খরচ বাজেট ছাড়িয়েছে। আগে পরিমাণ কমিয়ে নিন।" };
  const limit = Math.floor(remaining);
  if (limit === 0) return { additions: new Map(), total: Number(currentTotal) };

  const chunks = [];
  selectedProducts.forEach(({ product, item }, itemIndex) => {
    const stockLeft = Math.max(0, Math.floor(Number(product.stock) - Number(item.quantity)));
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || stockLeft === 0) return;
    let remainingStock = stockLeft;
    let batch = 1;
    while (remainingStock > 0) {
      const quantity = Math.min(batch, remainingStock);
      const cost = Math.ceil(unitPrice) * quantity;
      if (cost <= limit) chunks.push({ itemIndex, quantity, cost });
      remainingStock -= quantity;
      batch *= 2;
    }
  });

  const reachable = new Uint8Array(limit + 1);
  const previousAmount = new Int32Array(limit + 1);
  const previousChunk = new Int32Array(limit + 1);
  previousAmount.fill(-1);
  previousChunk.fill(-1);
  reachable[0] = 1;

  chunks.forEach((chunk, chunkIndex) => {
    for (let amount = limit; amount >= chunk.cost; amount -= 1) {
      if (!reachable[amount] && reachable[amount - chunk.cost]) {
        reachable[amount] = 1;
        previousAmount[amount] = amount - chunk.cost;
        previousChunk[amount] = chunkIndex;
      }
    }
  });

  let best = limit;
  while (best > 0 && !reachable[best]) best -= 1;
  const additions = new Map();
  let amount = best;
  while (amount > 0 && previousChunk[amount] >= 0) {
    const chunk = chunks[previousChunk[amount]];
    const productId = selectedProducts[chunk.itemIndex].product.id;
    additions.set(productId, (additions.get(productId) || 0) + chunk.quantity);
    amount = previousAmount[amount];
  }

  let total = selectedProducts.reduce((sum, { product, item }) => {
    return sum + Number(product.price) * (Number(item.quantity) + (additions.get(product.id) || 0));
  }, 0);
  let available = Number(budget) - total;
  selectedProducts
    .filter(({ product }) => Number(product.price) > 0)
    .slice()
    .sort((a, b) => Number(a.product.price) - Number(b.product.price))
    .forEach(({ product, item }) => {
      const room = Math.max(0, Math.floor(Number(product.stock) - Number(item.quantity) - (additions.get(product.id) || 0)));
      const extra = Math.min(room, Math.floor((available + 0.000001) / Number(product.price)));
      if (extra > 0) {
        additions.set(product.id, (additions.get(product.id) || 0) + extra);
        const cost = extra * Number(product.price);
        total += cost;
        available -= cost;
      }
    });

  return { additions, total };
}

function getCategoryVisual(categoryName = "") {
  const name = String(categoryName).toLowerCase();
  if (/চাল|rice|ডাল|lentil|আটা|flour/.test(name)) return { icon: "🌾", tone: "bb-category-grain" };
  if (/তেল|oil|ঘি|ghee/.test(name)) return { icon: "🫒", tone: "bb-category-oil" };
  if (/সবজি|vegetable|শাক|আলু|পেঁয়াজ/.test(name)) return { icon: "🥬", tone: "bb-category-vegetable" };
  if (/ফল|fruit|আম|কলা|আপেল/.test(name)) return { icon: "🍎", tone: "bb-category-fruit" };
  if (/মাছ|মাংস|মুরগি|fish|meat|chicken/.test(name)) return { icon: "🐟", tone: "bb-category-protein" };
  if (/দুধ|ডিম|দুগ্ধ|milk|egg|dairy/.test(name)) return { icon: "🥚", tone: "bb-category-dairy" };
  if (/মসলা|লবণ|চিনি|spice|salt|sugar/.test(name)) return { icon: "🧂", tone: "bb-category-spice" };
  if (/বিস্কুট|স্ন্যাক|snack|chips|noodle/.test(name)) return { icon: "🍪", tone: "bb-category-snack" };
  if (/নাশতা|বেকারি|bread|bakery|breakfast/.test(name)) return { icon: "🥐", tone: "bb-category-bakery" };
  if (/পার্সোনাল|কেয়ার|soap|shampoo|personal/.test(name)) return { icon: "🧴", tone: "bb-category-care" };
  if (/পরিষ্কার|ডিটারজেন্ট|clean|detergent/.test(name)) return { icon: "🧼", tone: "bb-category-clean" };
  if (/টিস্যু|গৃহস্থালি|tissue|household/.test(name)) return { icon: "🧻", tone: "bb-category-home" };
  if (/চা|কফি|পানীয়|tea|coffee|drink|beverage/.test(name)) return { icon: "☕", tone: "bb-category-drink" };
  if (/বেবি|baby|diaper/.test(name)) return { icon: "🍼", tone: "bb-category-baby" };
  return { icon: "🧺", tone: "bb-category-default" };
}

function Customer() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("সব");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartPackageId, setCartPackageId] = useState(null);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);

  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
const [deliveryAddress, setDeliveryAddress] = useState("");
const [paymentMethod, setPaymentMethod] = useState("cod");
const [transactionId, setTransactionId] = useState("");
const [placingOrder, setPlacingOrder] = useState(false);
const [myOrders, setMyOrders] = useState([]);
const [showMyOrders, setShowMyOrders] = useState(false);
const [cancelOrderId, setCancelOrderId] = useState(null);
const [cancelReason, setCancelReason] = useState("");
const [cancellingOrder, setCancellingOrder] = useState(false);
const [showProfile, setShowProfile] = useState(false);
const [activeMenu, setActiveMenu] = useState("home");
const [customerName, setCustomerName] = useState("");
const [customerPhone, setCustomerPhone] = useState("");
const [familyPreferences, setFamilyPreferences] = useState(DEFAULT_FAMILY_PREFERENCES);
const [familyPreferencesDraft, setFamilyPreferencesDraft] = useState(DEFAULT_FAMILY_PREFERENCES);
const [editingFamilyPreferences, setEditingFamilyPreferences] = useState(false);
const [savingFamilyPreferences, setSavingFamilyPreferences] = useState(false);
const [familyPreferencesMessage, setFamilyPreferencesMessage] = useState("");
const [monthlySpend, setMonthlySpend] = useState(0);
const [monthlyProductCount, setMonthlyProductCount] = useState(0);
const [deliveredOrdersCount, setDeliveredOrdersCount] = useState(0);
const [previousMonthSpend, setPreviousMonthSpend] = useState(0);
const [latestConfirmedAt, setLatestConfirmedAt] = useState(null);

const [showFamilyShopping, setShowFamilyShopping] = useState(false);
const [shoppingList, setShoppingList] = useState([]);
const [productSearch, setProductSearch] = useState("");
const [showProductPicker, setShowProductPicker] = useState(false);
const [savingShoppingList, setSavingShoppingList] = useState(false);
const [shoppingListMessage, setShoppingListMessage] = useState("");
const [smartBudgetDays, setSmartBudgetDays] = useState(7);

  useEffect(() => {
    if (cart.length === 0) setCartPackageId(null);
  }, [cart.length]);

  // Load products
  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) {
        console.log("Product loading error:", error.message);
        return;
      }

      setProducts(data || []);
    }

    loadProducts();
  }, []);

  // Load Service Charge and Delivery Fee
  useEffect(() => {
    async function loadAppSettings() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) {
        console.log("Settings loading error:", error.message);
        return;
      }

      setServiceCharge(Number(data.service_charge || 0));
      setDeliveryFee(Number(data.delivery_fee || 0));
    }

    loadAppSettings();
  }, []);

  // Check existing login session
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);
      }
    }

    checkSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
  async function loadProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const profileName = data?.full_name || user.user_metadata?.full_name || "";
    const profilePhone = data?.phone || user.user_metadata?.phone || "";
    setFullName(profileName);
    setPhone(profilePhone);
    setCustomerName(profileName);
    setCustomerPhone(profilePhone);

    setDeliveryAddress(data?.address || "");

    if (error) {
      console.log("Profile load error:", error.message);
    }
  }

  loadProfile();
}, [user]);

  useEffect(() => {
    if (!user) return;
    const preferences = normalizeFamilyPreferences(user.user_metadata?.family_preferences);
    setFamilyPreferences(preferences);
    setFamilyPreferencesDraft(preferences);
    setShoppingList(normalizeShoppingList(user.user_metadata?.family_preferences?.shoppingList));
  }, [user?.id, user?.user_metadata?.family_preferences]);

  useEffect(() => {
    if (!user) {
      setMonthlySpend(0);
      return;
    }
    loadMonthlySpend();
  }, [user?.id]);

  async function loadMonthlySpend() {
    if (!user) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const { data, error } = await supabase
      .from("orders")
      .select("total, order_status, created_at, order_items(quantity)")
      .eq("user_id", user.id)
      .gte("created_at", previousMonthStart.toISOString())
      .lt("created_at", nextMonthStart.toISOString());

    if (error) {
      console.warn("Monthly spend could not be loaded:", error.message);
      return;
    }

    const isNotCancelled = (order) => {
      const status = String(order.order_status || "").toLowerCase();
      return !["cancelled", "canceled", "বাতিল"].includes(status);
    };
    const currentOrders = (data || []).filter((order) => new Date(order.created_at) >= monthStart && isNotCancelled(order));
    const previousOrders = (data || []).filter((order) => new Date(order.created_at) >= previousMonthStart && new Date(order.created_at) < monthStart && isNotCancelled(order));
    const sumOrderTotals = (orders) => orders.reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0);
    setMonthlySpend(sumOrderTotals(currentOrders));
    setMonthlyProductCount(currentOrders.reduce((sum, order) => sum + (order.order_items || []).reduce((quantity, item) => quantity + Math.max(0, Number(item.quantity) || 0), 0), 0));
    setDeliveredOrdersCount(currentOrders.filter((order) => order.order_status === "delivered").length);
    setPreviousMonthSpend(sumOrderTotals(previousOrders));

    const { data: latestConfirmedOrder, error: confirmationError } = await supabase
      .from("orders")
      .select("confirmed_at")
      .eq("user_id", user.id)
      .not("confirmed_at", "is", null)
      .neq("order_status", "cancelled")
      .order("confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (confirmationError) {
      console.warn("Latest package confirmation could not be loaded:", confirmationError.message);
      return;
    }
    setLatestConfirmedAt(latestConfirmedOrder?.confirmed_at || null);
  }

  async function saveFamilyPreferences() {
    if (!user) return;

    const monthlyBudget = Number(familyPreferencesDraft.monthlyBudget);
    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
      setFamilyPreferencesMessage("মাসিক বাজেট ০ বা তার বেশি লিখুন।");
      return;
    }

    const preferences = normalizeFamilyPreferences({
      ...familyPreferencesDraft,
      monthlyBudget,
    });
    setSavingFamilyPreferences(true);
    setFamilyPreferencesMessage("");
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          family_preferences: {
            ...user.user_metadata?.family_preferences,
            ...preferences,
            shoppingList,
          },
        },
      });
      if (error) throw error;

      setFamilyPreferences(preferences);
      setFamilyPreferencesDraft(preferences);
      setEditingFamilyPreferences(false);
      setFamilyPreferencesMessage("পরিবারের পছন্দ সেভ হয়েছে।");
      if (data.user) setUser(data.user);
    } catch {
      setFamilyPreferencesMessage("সেটিংস সেভ হয়নি। আবার চেষ্টা করুন।");
    } finally {
      setSavingFamilyPreferences(false);
    }
  }

  async function saveShoppingList() {
    if (!user) return;
    setSavingShoppingList(true);
    setShoppingListMessage("");
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          family_preferences: {
            ...user.user_metadata?.family_preferences,
            ...familyPreferences,
            shoppingList,
          },
        },
      });
      if (error) throw error;
      setShoppingListMessage("আপনার বাজারের তালিকা সেভ হয়েছে।");
      if (data.user) setUser(data.user);
    } catch {
      setShoppingListMessage("তালিকা সেভ হয়নি। আবার চেষ্টা করুন।");
    } finally {
      setSavingShoppingList(false);
    }
  }

  function changeShoppingQuantity(product, change) {
    setShoppingList((current) => current
      .map((item) => item.productId !== product.id
        ? item
        : { ...item, quantity: Math.min(Number(product.stock), Math.max(0, Number(item.quantity) + change)) })
      .filter((item) => item.quantity > 0));
    setShoppingListMessage("");
  }

  function addProductToShoppingList(product) {
    const current = shoppingList.find((item) => item.productId === product.id);
    if (current) {
      setShoppingList((items) => items.filter((item) => item.productId !== product.id));
      setShoppingListMessage(`${product.name} তালিকা থেকে সরানো হয়েছে।`);
      return;
    }
    setShoppingList((items) => [...items, { productId: product.id, quantity: 1 }]);
    setShoppingListMessage(`${product.name} তালিকায় যোগ হয়েছে। পরিমাণ +/− দিয়ে বদলান।`);
  }

  function autoFillShoppingBudget(selectedProducts, currentTotal) {
    if (!selectedProducts.length) {
      setShoppingListMessage("বাজেট সাজাতে আগে তালিকায় কিছু পণ্য যোগ করুন।");
      return;
    }
    const result = suggestBudgetFill(selectedProducts, familyPreferences.monthlyBudget, currentTotal);
    if (result.error) {
      setShoppingListMessage(result.error);
      return;
    }
    const additions = result.additions;
    setShoppingList((items) => items.map((item) => ({
      ...item,
      quantity: item.quantity + (additions.get(item.productId) || 0),
    })));
    const filled = Math.round(result.total);
    setShoppingListMessage(filled > currentTotal
      ? `বাজেট অনুযায়ী পরিমাণ সাজানো হয়েছে — ${filled.toLocaleString("en-IN")} টাকার বাজার।`
      : "নির্বাচিত পণ্যের স্টক অনুযায়ী তালিকাটি বাজেটের সবচেয়ে কাছাকাছি আছে।");
  }

  function generateSmartBudgetSuggestion() {
    const budget = Number(familyPreferences.monthlyBudget) || 0;
    const members = Math.max(1, Number(familyPreferences.familyMembers) || 1);
    const days = Math.max(7, Number(smartBudgetDays) || 7);
    if (budget <= 0) {
      setShoppingListMessage("আগে আপনার বাজারের বাজেট নির্ধারণ করে পছন্দ সেভ করুন।");
      return;
    }

    const essentials = [
      { pattern: /^(মিনিকেট চাল|নাজিরশাইল চাল|আতপ চাল|চাল)$/i, weeklyPerPerson: 1.2 },
      { pattern: /^মসুর ডাল$/i, weeklyPerPerson: 0.16 },
      { pattern: /^সয়াবিন তেল$/i, weeklyPerPerson: 0.18 },
      { pattern: /^আলু$/i, weeklyPerPerson: 0.35 },
      { pattern: /^পেঁয়াজ$/i, weeklyPerPerson: 0.2 },
      { pattern: /^লবণ$/i, weeklyPerPerson: 0.04 },
      { pattern: /^ডিম$/i, weeklyPerPerson: 2 },
      { pattern: /^মৌসুমি সবজি$/i, weeklyPerPerson: 0.35 },
    ];

    const existing = new Map(shoppingList.map((item) => [item.productId, Math.max(0, Number(item.quantity) || 0)]));
    let existingTotal = shoppingList.reduce((sum, item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return sum + (product ? Number(product.price || 0) * Number(item.quantity || 0) : 0);
    }, 0);
    if (existingTotal > budget) {
      setShoppingListMessage("আপনার বর্তমান তালিকার খরচ বাজেট ছাড়িয়েছে। আগে কিছু পণ্যের পরিমাণ কমিয়ে নিন।");
      return;
    }

    const candidates = essentials.map(({ pattern, weeklyPerPerson }) => {
      const product = products.find((entry) =>
        entry.is_active !== false &&
        Number(entry.stock) > 0 &&
        pattern.test(String(entry.name || "").trim())
      );
      if (!product || existing.has(product.id)) return null;
      const unitPrice = Number(product.price) || 0;
      if (unitPrice <= 0) return null;
      const suggested = Math.min(
        Math.floor(Number(product.stock) || 0),
        Math.max(1, Math.ceil(weeklyPerPerson * members * days / 7))
      );
      return suggested > 0 ? { product, suggested, unitPrice } : null;
    }).filter(Boolean);

    const availableBudget = Math.max(0, budget - existingTotal);
    const plannedTotal = candidates.reduce((sum, item) => sum + item.suggested * item.unitPrice, 0);
    const scale = plannedTotal > availableBudget && plannedTotal > 0
      ? availableBudget / plannedTotal
      : 1;
    const additions = candidates.map((item) => ({
      ...item,
      quantity: Math.min(item.suggested, Math.floor(item.suggested * scale)),
    })).filter((item) => item.quantity > 0);

    let addedTotal = additions.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    // Keep the recommendation within budget even after rounding quantities.
    for (let index = additions.length - 1; addedTotal > availableBudget && index >= 0; index -= 1) {
      const item = additions[index];
      while (item.quantity > 0 && addedTotal > availableBudget) {
        item.quantity -= 1;
        addedTotal -= item.unitPrice;
      }
    }

    additions.filter((item) => item.quantity > 0).forEach(({ product, quantity }) => {
      existing.set(product.id, quantity);
    });
    const nextList = Array.from(existing, ([productId, quantity]) => ({ productId, quantity }));
    setShoppingList(nextList);
    const addedCount = additions.filter((item) => item.quantity > 0).length;
    setShoppingListMessage(addedCount
      ? `আপনার ${members} জনের ${days} দিনের জন্য বর্তমান দাম, স্টক ও বাজেট অনুযায়ী ${addedCount} ধরনের প্রয়োজনীয় পণ্য সাজানো হয়েছে। এটি প্রস্তাবিত তালিকা—নিজের প্রয়োজনমতো পণ্য ও পরিমাণ বদলে নিন।`
      : "আপনার বর্তমান তালিকা বজায় রাখা হয়েছে। অবশিষ্ট বাজেটে নতুন পণ্য যোগ করার মতো পর্যাপ্ত টাকা বা স্টক পাওয়া যায়নি।");
  }

  function addShoppingListToCart(selectedProducts) {
    if (!selectedProducts.length) return;
    setCart((current) => {
      const next = [...current];
      selectedProducts.forEach(({ product, item }) => {
        const index = next.findIndex((cartItem) => cartItem.id === product.id);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            quantity: Math.min(Number(product.stock), Number(next[index].quantity || 0) + Number(item.quantity)),
          };
        } else {
          next.push({ ...product, quantity: Number(item.quantity) });
        }
      });
      return next;
    });
    setCartPackageId(familyPreferences.packageId);
    setShoppingListMessage("নির্বাচিত পণ্যগুলো কার্টে যোগ হয়েছে।");
    handleMenuClick("cart");
  }

  function checkoutFamilyShoppingList(selectedProducts, subtotal) {
    const packageId = familyPreferences.packageId;
    const minimum = packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(packageId);
    const packageLabel = FAMILY_PACKAGES.find((item) => item.id === packageId)?.label || "এই প্যাকেজ";

    if (!selectedProducts.length) {
      setShoppingListMessage("Checkout করতে আগে বাজারের তালিকায় পণ্য যোগ করুন।");
      return;
    }
    if (subtotal < minimum) {
      setShoppingListMessage(packageLabel + " থেকে Checkout করতে পণ্যের মোট মূল্য কমপক্ষে ৳" + minimum.toLocaleString("en-IN") + " হতে হবে। আরও ৳" + (minimum - subtotal).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " টাকার পণ্য যোগ করুন।");
      return;
    }
    const unavailable = selectedProducts.find(({ product, item }) =>
      Number(product.stock) < Number(item.quantity) || Number(product.stock) <= 0
    );
    if (unavailable) {
      setShoppingListMessage(unavailable.product.name + " পণ্যের পর্যাপ্ত স্টক নেই। পরিমাণ কমিয়ে আবার চেষ্টা করুন।");
      return;
    }
    setCart((current) => {
      const next = [...current];
      selectedProducts.forEach(({ product, item }) => {
        const index = next.findIndex((cartItem) => cartItem.id === product.id);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            quantity: Math.min(Number(product.stock), Number(next[index].quantity || 0) + Number(item.quantity)),
          };
        } else {
          next.push({ ...product, quantity: Number(item.quantity) });
        }
      });
      return next;
    });
    setCartPackageId(packageId);
    setShoppingListMessage("");
    setShowCheckout(true);
  }

  // Login and Registration
  async function handleAuth(e) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("ইমেইল ও পাসওয়ার্ড দিন");
      return;
    }

    if (showRegister && (!fullName.trim() || !phone.trim())) {
      alert("আপনার নাম ও মোবাইল নম্বর দিন");
      return;
    }

    setAuthLoading(true);

    let result;

    if (showRegister) {
      result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim()
          }
        }
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
    }

    setAuthLoading(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    if (showRegister && !result.data.session) {
      alert(
        "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইলে পাঠানো লিংক দিয়ে যাচাই করে তারপর লগইন করুন।"
      );
      setShowRegister(false);
      return;
    }
const authUser = result.data.user;
const metadata = authUser.user_metadata || {};

const { data: oldProfile } = await supabase
  .from("profiles")
  .select("full_name, phone")
  .eq("id", authUser.id)
  .maybeSingle();

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({
    id: authUser.id,
    full_name: oldProfile?.full_name || metadata.full_name || fullName.trim(),
    phone: oldProfile?.phone || metadata.phone || phone.trim()
  }, {
    onConflict: "id"
  });

if (profileError) {
  alert("প্রোফাইল সেভ হয়নি: " + profileError.message);
  console.log(profileError);
}
    setUser(result.data.user);
    alert(showRegister ? "অ্যাকাউন্ট তৈরি হয়েছে!" : "লগইন সফল হয়েছে!");
  }
// Place Order
async function placeOrder() {
  if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
    alert("নাম, মোবাইল নম্বর ও ঠিকানা পূরণ করুন");
    return;
  }

  if (cart.length === 0) {
    alert("আপনার কার্ট খালি!");
    return;
  }
if (
    (paymentMethod === "bkash" || paymentMethod === "nagad") &&
    !transactionId.trim()
  ) {
    alert("দয়া করে Transaction ID লিখুন");
    return;  }

  const packageMinimum = getFamilyPackageMinimum(cartPackageId);
  const budgetSmartMinimum = cartPackageId === "budget-smart" ? BUDGET_SMART_MINIMUM : 0;
  if (budgetSmartMinimum > 0 && cartTotal < budgetSmartMinimum) {
    const remaining = budgetSmartMinimum - cartTotal;
    alert(`Budget Smart থেকে অর্ডার করতে পণ্যের মূল্য কমপক্ষে ৳${budgetSmartMinimum.toLocaleString("en-IN")} হতে হবে। ডেলিভারি ও সার্ভিস চার্জ বাদে আরও ৳${remaining.toLocaleString("en-IN", { maximumFractionDigits: 2 })} টাকার পণ্য যোগ করুন।`);
    return;
  }
  if (packageMinimum > 0 && cartTotal < packageMinimum) {
    const remaining = packageMinimum - cartTotal;
    const packageLabel = FAMILY_PACKAGES.find((item) => item.id === cartPackageId)?.label || "প্যাকেজ";
    alert(
      `${packageLabel} অর্ডার করতে পণ্যের মূল্য কমপক্ষে ৳${packageMinimum.toLocaleString("en-IN")} হতে হবে। ডেলিভারি ও সার্ভিস চার্জ বাদে আরও ৳${remaining.toLocaleString("en-IN", { maximumFractionDigits: 2 })} টাকার পণ্য যোগ করুন।`
    );
    return;
  }

  setPlacingOrder(true);

  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError) throw settingsError;

    const serviceCharge = Number(settings.service_charge || 0);
    const deliveryFee = Number(settings.delivery_fee || 0);
    // Check latest product stock before placing order
    for (const item of cart) {
      const { data: latestProduct, error: stockError } = await supabase
        .from("products")
        .select("id, stock")
        .eq("id", item.id)
        .single();

      if (stockError) throw stockError;

      const availableStock = Number(latestProduct.stock) || 0;
      const requestedQuantity = Number(item.quantity) || 1;

      if (availableStock < requestedQuantity) {
        alert(
          item.name + " এর পর্যাপ্ত স্টক নেই। বর্তমানে স্টক: " +
          availableStock + " টি"
        );
        return;
      }
    }

    const { error: orderError } = await supabase.rpc(
  "create_order_with_payment_atomic",
  {
    p_customer_name: customerName.trim(),
    p_phone: customerPhone.trim(),
    p_delivery_address: deliveryAddress.trim(),
    p_payment_method: paymentMethod,
    p_service_charge: serviceCharge,
    p_delivery_fee: deliveryFee,
    p_items: cart.map(item => ({
      product_id: item.id,
      product_name: item.name,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.price)
    })),
    p_transaction_id: transactionId.trim() || null,
     p_package_id: cartPackageId
  }
);

if (orderError) throw orderError;

    await loadMonthlySpend();

    alert("আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!");

    setCart([]);
    setCartPackageId(null);
    setShowCheckout(false);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setTransactionId("");
  } catch (error) {
    console.error("Order error:", error);
    alert("অর্ডার করা যায়নি: " + error.message);
  } finally {
    setPlacingOrder(false);
  }
}
// Load My Orders
async function loadMyOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    alert("অর্ডার লোড করা যায়নি: " + error.message);
    return;
  }

  setMyOrders(data || []);
}
// Open the in-app order cancellation dialog
function cancelOrder(orderId) {
  setCancelOrderId(orderId);
  setCancelReason("");
}

// Confirm order cancellation
async function confirmOrderCancellation() {
  if (!cancelOrderId || cancellingOrder) return;

  if (!cancelReason.trim()) {
    alert("দয়া করে বাতিলের কারণ লিখুন।");
    return;
  }

  setCancellingOrder(true);
  try {
    const { error } = await supabase.rpc(
      "cancel_order_atomic",
      {
        p_order_id: cancelOrderId,
        p_cancel_reason: cancelReason.trim()
      }
    );

    if (error) throw error;

    await loadMonthlySpend();
    await loadMyOrders();
    setCancelOrderId(null);
    setCancelReason("");
    alert("অর্ডার বাতিল হয়েছে এবং পণ্যের স্টক ফেরত এসেছে!");
  } catch (error) {
    alert("অর্ডার বাতিল করা যায়নি: " + (error?.message || "আবার চেষ্টা করুন।"));
  } finally {
    setCancellingOrder(false);
  }
}
// Bottom Navigation Menu
const menuItems = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "categories", label: "Categories", icon: "📦" },
  { id: "cart", label: "Cart", icon: "🛒" },
  { id: "orders", label: "My Orders", icon: "📋" },
  { id: "profile", label: "Profile", icon: "👤" }
];
// Bottom Navigation Actions
function handleMenuClick(menuId) {
  setActiveMenu(menuId);

  if (menuId === "home") {
    setShowMyOrders(false);
    setShowProfile(false);
    setShowCheckout(false);
  }

  if (menuId === "orders") {
    setShowProfile(false);
    setShowCheckout(false);
    setShowMyOrders(true);
    loadMyOrders();
  }

  if (menuId === "profile") {
    setShowMyOrders(false);
    setShowCheckout(false);
    setShowProfile(true);
  }

  if (menuId === "cart") {
    setShowMyOrders(false);
    setShowProfile(false);
    setShowCheckout(false);
  }

  if (menuId === "categories") {
    setShowMyOrders(false);
    setShowProfile(false);
    setShowCheckout(false);
  }

  // Home / Categories / Cart live on the same page: scroll to the right place
  const scrollTargets = {
    home: null,
    categories: "products-section",
    cart: "cart-section"
  };
  if (menuId in scrollTargets) {
    setTimeout(() => {
      const el = scrollTargets[menuId]
        ? document.getElementById(scrollTargets[menuId]) ||
          document.getElementById("products-section")
        : null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 60);
  }
}

// Sidebar layout wrapper for every logged-in screen
const cartCount = cart.reduce((n, item) => n + (item.quantity || 1), 0);
const activeNow = showProfile
  ? "profile"
  : showMyOrders
  ? "orders"
  : showCheckout
  ? "cart"
  : activeMenu === "categories" || activeMenu === "cart"
  ? activeMenu
  : "home";

const withSidebar = (content) => (
  <Sidebar
    items={menuItems}
    active={activeNow}
    onSelect={handleMenuClick}
    cartCount={cartCount}
    notificationCount={myOrders.filter((order) => order.order_status === "pending").length}
    userName={customerName || user?.email || ""}
    onLogout={handleLogout}
  >
    {content}
  </Sidebar>
);
  // Logout
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    setUser(null);
    setCart([]);
    alert("লগআউট সফল হয়েছে");
  }

  // Login / Registration Page
  if (!user) {
    return (
      <div style={{
        maxWidth: 400,
        margin: "50px auto",
        padding: 25,
        background: "white",
        borderRadius: 16,
        fontFamily: "Arial"
      }}>
        <div style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#f0faf4",
  padding: "15px",
  borderRadius: 15,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
}}>
  <div>
    <h1 style={{
      color: "#198754",
      margin: 0,
      fontSize: 27,
fontWeight: "bold"
    }}>
      🛒 BazarBondhu
    </h1>
    <small style={{ color: "#777" }}>
      আপনার বিশ্বস্ত অনলাইন বাজার
    </small>
  </div>

  <div style={{
    background: "#d1f2df",
    padding: 10,
    borderRadius: 12,
    fontSize: 24
  }}>
    👤
  </div>
</div>

        <h2 style={{
  color: "#198754",
  fontSize: 23,
  fontWeight: "bold",
  marginTop: 25,
  marginBottom: 20
}}>
          {showRegister
            ? "নতুন অ্যাকাউন্ট তৈরি করুন"
            : "লগইন করুন"}
        </h2>

        <form onSubmit={handleAuth}>
          {showRegister && (
            <input
              placeholder="আপনার নাম"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            placeholder="ইমেইল ঠিকানা"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          {showRegister && (
            <input
              type="tel"
              placeholder="মোবাইল নম্বর (01XXXXXXXXX)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          <input
            type="password"
            placeholder="পাসওয়ার্ড"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={authLoading}
            style={buttonStyle}
          >
            {authLoading
              ? "অপেক্ষা করুন..."
              : showRegister
                ? "রেজিস্ট্রেশন করুন"
                : "লগইন করুন"}
          </button>
        </form>

        <button
          onClick={() => setShowRegister(!showRegister)}
          style={{
            ...buttonStyle,
            background: "#555",
            marginTop: 10
          }}
        >
          {showRegister
            ? "আগে অ্যাকাউন্ট আছে? লগইন করুন"
            : "নতুন অ্যাকাউন্ট খুলুন"}
        </button>
      </div>
    );
  }

  // Customer Home Page
  if (showMyOrders) {
    return withSidebar(
      <div style={{
  maxWidth: 450,
  width: "calc(100% - 32px)",
  margin: "25px auto",
  padding: 22,
  boxSizing: "border-box",
  background: "white",
  borderRadius: 18,
  border: "1px solid #e2eee5",
  boxShadow: "0 8px 25px rgba(25,135,84,0.12)",
  fontFamily: "Arial"
}}>
        <h2 style={{
  color: "#198754",
  fontSize: 24,
  fontWeight: "bold",
  textAlign: "center",
  marginTop: 0,
  marginBottom: 20,
  paddingBottom: 15,
  borderBottom: "2px solid #e8f5ed"
}}>
  📦 আমার অর্ডার
</h2>

        <button
  onClick={loadMyOrders}
  style={{
    width: "100%",
    background: "#e8f5ed",
    color: "#198754",
    padding: "12px",
    border: "1px solid #cce8d5",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer",
    marginBottom: 10
  }}
>
  🔄 অর্ডার রিফ্রেশ করুন
</button>

        {myOrders.length === 0 ? (
          <p>এখনো কোনো অর্ডার পাওয়া যায়নি।</p>
        ) : (
          myOrders.map(order => (
            <div key={order.id} style={{
  background: "#ffffff",
  border: "1px solid #e2eee5",
  padding: 16,
  marginTop: 16,
  borderRadius: 14,
  boxShadow: "0 4px 14px rgba(25,135,84,0.08)"
}}>
              <p style={{
  color: "#198754",
  fontSize: 14,
  fontWeight: "bold",
  background: "#e8f5ed",
  padding: "9px 12px",
  borderRadius: 8,
  wordBreak: "break-all"
}}>
  🧾 অর্ডার ID: {order.id}
</p>
              <p style={{
  color: "#666",
  fontSize: 14,
  margin: "12px 0"
}}>
  📅 অর্ডারের তারিখ: {new Date(order.created_at).toLocaleString("bn-BD")}
</p>
              <p style={{
  display: "inline-block",
  background: "#e8f5ed",
  color: "#198754",
  padding: "8px 13px",
  borderRadius: 20,
  fontSize: 14,
  fontWeight: "bold",
  margin: "8px 0"
}}>
  📦 অর্ডার স্ট্যাটাস: {order.order_status}
</p>
              {order.cancel_reason && (
  <p style={{
    background: "#fff1f1",
    color: "#dc3545",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    border: "1px solid #f5cccc",
    marginTop: 10
  }}>
    ❌ বাতিলের কারণ: {order.cancel_reason}
  </p>
)}
              {order.order_status === "pending" && (
                <button
  onClick={() => cancelOrder(order.id)}
  style={{
    width: "100%",
    background: "#fff1f1",
    color: "#dc3545",
    padding: "12px",
    border: "1px solid #f1caca",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 12
  }}
>
  ✕ অর্ডার বাতিল করুন
</button>
              )}
              <div style={{
  background: order.payment_status === "paid" ? "#e8f5ed" : order.payment_status === "rejected" ? "#fff1f1" : "#fff8e8",
  color: order.payment_status === "paid" ? "#087f45" : order.payment_status === "rejected" ? "#b42318" : "#805b16",
  padding: "12px 13px",
  borderRadius: 10,
  fontSize: 14,
  marginTop: 12,
  border: `1px solid ${order.payment_status === "paid" ? "#cce8d5" : order.payment_status === "rejected" ? "#f2cccc" : "#f0dfb7"}`
}}>
  💳 পেমেন্ট স্ট্যাটাস: <strong>{order.payment_status === "paid" ? "পরিশোধিত ✓" : order.payment_status === "rejected" ? "পেমেন্ট গ্রহণ করা হয়নি" : order.payment_status === "refunded" ? "টাকা ফেরত দেওয়া হয়েছে" : "যাচাই অপেক্ষমাণ"}</strong>
  {order.payment_method === "cod" && order.payment_status === "pending" && <p style={{ margin: "6px 0 0", fontSize: 12 }}>পণ্য হাতে পেয়ে ডেলিভারির সময় নগদ টাকা দিন।</p>}
  {["bkash", "nagad"].includes(order.payment_method) && order.payment_status === "pending" && <p style={{ margin: "6px 0 0", fontSize: 12 }}>আপনার পেমেন্টের তথ্য Admin যাচাই করছেন। যাচাই শেষ হলে এখানে আপডেট দেখবেন।</p>}
  {order.payment_status === "rejected" && <p style={{ margin: "6px 0 0", fontSize: 12 }}>পেমেন্ট বা Transaction ID মেলেনি। অনুগ্রহ করে BazarBondhu কর্তৃপক্ষের সঙ্গে যোগাযোগ করুন।</p>}
</div>

              <h4 style={{
  color: "#198754",
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  marginBottom: 10,
  borderBottom: "1px solid #e2eee5",
  paddingBottom: 10
}}>
  🛒 অর্ডারের পণ্য
</h4>
              {order.order_items?.map(item => (
                <p key={item.id} style={{
  background: "#f4f8f4",
  color: "#333",
  padding: "12px",
  borderRadius: 9,
  fontSize: 14,
  margin: "8px 0",
  border: "1px solid #e8f0e9"
}}>
  🛍️ {item.product_name}
  <br />
  পরিমাণ: {item.quantity} টি × ৳{item.unit_price}
</p>
              ))}

              <h3 style={{
  background: "#e8f5ed",
  color: "#087f45",
  padding: "15px",
  borderRadius: 12,
  fontSize: 21,
  fontWeight: "bold",
  textAlign: "right",
  marginTop: 18,
  border: "1px solid #cce8d5"
}}>
  💰 মোট বিল: ৳{order.total}
</h3>
            </div>
          ))
        )}

        {cancelOrderId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              boxSizing: "border-box"
            }}
          >
            <div style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 18,
              padding: 20,
              boxSizing: "border-box",
              boxShadow: "0 12px 36px rgba(0,0,0,0.22)"
            }}>
              <h3 id="cancel-order-title" style={{ color: "#dc3545", margin: "0 0 10px", fontSize: 20 }}>
                অর্ডার বাতিল করবেন?
              </h3>
              <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, margin: "0 0 12px" }}>
                অর্ডার বাতিলের কারণ লিখুন। নিশ্চিত করলে অর্ডার বাতিলের অনুরোধ পাঠানো হবে।
              </p>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="বাতিলের কারণ লিখুন..."
                rows={4}
                disabled={cancellingOrder}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  resize: "vertical",
                  border: "1px solid #d8e2da",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 15,
                  fontFamily: "inherit",
                  outlineColor: "#198754"
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={() => {
                    setCancelOrderId(null);
                    setCancelReason("");
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    border: "1px solid #dce5df",
                    borderRadius: 10,
                    background: "#f3f5f4",
                    color: "#555",
                    fontWeight: "bold",
                    cursor: cancellingOrder ? "not-allowed" : "pointer"
                  }}
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={confirmOrderCancellation}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    border: "none",
                    borderRadius: 10,
                    background: cancellingOrder ? "#999" : "#dc3545",
                    color: "white",
                    fontWeight: "bold",
                    cursor: cancellingOrder ? "not-allowed" : "pointer"
                  }}
                >
                  {cancellingOrder ? "অপেক্ষা করুন..." : "হ্যাঁ, বাতিল করুন"}
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowMyOrders(false)}
          style={{
  width: "100%",
  background: "#f1f3f2",
  color: "#555",
  padding: "14px",
  border: "1px solid #dce5df",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 15
}}
        >
          ফিরে যান
        </button>
      </div>
    );
  }
  const cartTotal = cart.reduce(
  (total, item) =>
    total + Number(item.price || 0) * (item.quantity || 1),
  0
);
  if (showCheckout) {
  return withSidebar(
    <div style={{
      minHeight: "100vh",
      background: "#f4f8f4",
      padding: "20px 12px",
      boxSizing: "border-box",
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 450,
        width: "100%",
        margin: "10px auto",
        padding: 20,
        boxSizing: "border-box",
        background: "white",
        borderRadius: 20,
        border: "1px solid #e2eee5",
        boxShadow: "0 8px 25px rgba(25,135,84,0.10)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 58,
            height: 58,
            margin: "0 auto 12px",
            borderRadius: 18,
            background: "#e8f5ed",
            display: "flex",
            alignItems: "center",            justifyContent: "center",
            fontSize: 30
          }}>
            🛍️
          </div>

          <h2 style={{
            color: "#087f45",
            fontSize: 23,
            margin: 0
          }}>
            অর্ডার সম্পন্ন করুন
          </h2>

          <p style={{
            color: "#888",
            fontSize: 13,
            marginBottom: 0
          }}>
            আপনার তথ্য দিয়ে অর্ডার নিশ্চিত করুন
          </p>
        </div>

        <h3 style={{ color: "#176b40", fontSize: 16 }}>
          👤 কাস্টমারের তথ্য
        </h3>

        <input
          placeholder="আপনার সম্পূর্ণ নাম"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="মোবাইল নম্বর"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
          style={inputStyle}
        />

        <textarea
          placeholder="সম্পূর্ণ ডেলিভারি ঠিকানা"
          value={deliveryAddress}
          onChange={e => setDeliveryAddress(e.target.value)}
          style={{
            ...inputStyle,
            minHeight: 90,
            resize: "vertical"
          }}
        />

        <h3 style={{
          color: "#176b40",
          fontSize: 16,
          marginTop: 22
        }}>
          💳 পেমেন্ট পদ্ধতি
        </h3>

        <select
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value)}
          style={inputStyle}
        >
          <option value="cod">Cash on Delivery</option>
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
        </select>
        {(paymentMethod === "bkash" || paymentMethod === "nagad") && (
          <div style={{
            marginTop: 15,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #dcebe0",
            background: "linear-gradient(135deg, #f4faf5, #ffffff)",
            boxShadow: "0 4px 14px rgba(8,127,69,0.07)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10
            }}>
              <strong style={{ color: "#176b40", fontSize: 15 }}>
                {paymentMethod === "bkash" ? "বিকাশ Personal Account" : "নগদ Personal Account"}
              </strong>
              <span style={{
                background: paymentMethod === "bkash" ? "#fce8f1" : "#fff1e5",
                color: paymentMethod === "bkash" ? "#b3185b" : "#d65b16",
                borderRadius: 20,
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: "bold",
                whiteSpace: "nowrap"
              }}>
                {paymentMethod === "bkash" ? "বিকাশ" : "নগদ"}
              </span>
            </div>
            <p style={{ color: "#66756b", fontSize: 13, margin: "0 0 8px" }}>
              এই নম্বরে <strong>Send Money</strong> করুন
            </p>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 13px",
              borderRadius: 10,
              background: "#ffffff",
              border: "1px dashed #b8d7c2"
            }}>
              <strong style={{
                color: "#173d29",
                fontSize: 20,
                letterSpacing: 1,
                fontVariantNumeric: "tabular-nums"
              }}>
                01772845524
              </strong>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText("01772845524");
                    alert("পেমেন্ট নম্বর কপি হয়েছে।");
                  } catch {
                    alert("নম্বরটি কপি করা যায়নি। অনুগ্রহ করে হাতে লিখে নিন: 01772845524");
                  }
                }}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 12px",
                  background: "#e8f5ed",
                  color: "#087f45",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                নম্বর কপি
              </button>
            </div>
            <p style={{
              color: "#53675a",
              fontSize: 12,
              lineHeight: 1.6,
              margin: "10px 0 0"
            }}>
              পেমেন্টের পর নিচে Transaction ID (TrxID) লিখুন। অর্ডারের মোট বিল: <strong>৳{cartTotal + serviceCharge + deliveryFee}</strong>।
            </p>
          </div>
        )}
        {(paymentMethod === "bkash" || paymentMethod === "nagad") && (
          <div style={{ marginTop: 15 }}>
            <label style={{
              display: "block",
              marginBottom: 8,
              fontWeight: "bold",
              color: "#176b40"
            }}>
              Transaction ID (TrxID)
            </label>

            <input
              type="text"
              value={transactionId}
              onChange={e => setTransactionId(e.target.value)}
              placeholder="আপনার Transaction ID লিখুন"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{
          background: "#f4faf5",
          padding: 16,
          borderRadius: 14,
          border: "1px solid #dcebe0",
          marginTop: 22
        }}>
          <h3 style={{
            color: "#176b40",
            margin: "0 0 15px",
            fontSize: 17
          }}>
            🧾 অর্ডারের হিসাব
          </h3>
          {getFamilyPackageMinimum(cartPackageId) > 0 && (
            <p role="status" style={{
              color: cartTotal >= getFamilyPackageMinimum(cartPackageId) ? "#087f45" : "#9a5b00",
              background: cartTotal >= getFamilyPackageMinimum(cartPackageId) ? "#e8f5ed" : "#fff6e5",
              borderRadius: 10,
              padding: 11,
              fontSize: 13,
              lineHeight: 1.6,
              margin: "0 0 14px"
            }}>
              {FAMILY_PACKAGES.find((item) => item.id === cartPackageId)?.label} অর্ডারের ন্যূনতম পণ্যমূল্য ৳{getFamilyPackageMinimum(cartPackageId).toLocaleString("en-IN")}।
              {cartTotal >= getFamilyPackageMinimum(cartPackageId)
                ? " আপনার পণ্যমূল্য ন্যূনতম সীমা পূরণ করেছে।"
                : ` আরও ৳${(getFamilyPackageMinimum(cartPackageId) - cartTotal).toLocaleString("en-IN", { maximumFractionDigits: 2 })} টাকার পণ্য যোগ করুন।`}
              {" "}ডেলিভারি ও সার্ভিস চার্জ এই হিসাবের বাইরে।
            </p>
          )}

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            color: "#555"
          }}>
            <span>পণ্যের মূল্য</span>
            <strong>৳{cartTotal}</strong>
          </div>

          <div style={{
  display: "flex",
  justifyContent: "space-between",
  marginTop: 12,
  color: "#555"
}}>
  <span>সার্ভিস চার্জ</span>
  <strong>৳{serviceCharge}</strong>
</div>

<div style={{
  display: "flex",
  justifyContent: "space-between",
  marginTop: 12,
  color: "#555"
}}>
  <span>ডেলিভারি চার্জ</span>
  <strong>৳{deliveryFee}</strong>
</div>
<div style={{
  display: "flex",
  justifyContent: "space-between",
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid #dcebe0",
  color: "#087f45",
  fontSize: 17
}}>
  <strong>সর্বমোট বিল</strong>
  <strong>৳{cartTotal + serviceCharge + deliveryFee}</strong>
</div>

<p style={{
  color: "#888",
  fontSize: 12,
  marginBottom: 0
}}>
  অর্ডার নিশ্চিত করার সময় সঠিক চার্জ যোগ হবে।
</p>

          <p style={{
            color: "#888",
            fontSize: 12,
            marginBottom: 0
          }}>
            অতিরিক্ত চার্জ অ্যাডমিন প্যানেলের সেটিংস অনুযায়ী যোগ হবে।
          </p>
        </div>

        <button
          onClick={placeOrder}
          disabled={placingOrder}
          style={{
            width: "100%",
            background: placingOrder
              ? "#9acbb0"
              : "linear-gradient(135deg, #087f45, #20a464)",
            color: "white",
            padding: 16,
            border: "none",
            borderRadius: 13,
            fontSize: 16,
            fontWeight: "bold",
            cursor: placingOrder ? "not-allowed" : "pointer",
            marginTop: 20,
            boxShadow: "0 5px 14px rgba(25,135,84,0.20)"
          }}
        >
          {placingOrder
            ? "⏳ অর্ডার হচ্ছে..."
            : "✓ অর্ডার নিশ্চিত করুন"}
        </button>

        <button
          onClick={() => setShowCheckout(false)}
          style={{
            width: "100%",
            background: "#f1f3f2",
            color: "#555",
            padding: 14,
            border: "1px solid #dce5df",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: "bold",
            cursor: "pointer",
            marginTop: 12
          }}
        >
          ← ফিরে যান
        </button>
      </div>
    </div>
  );
}
if (showProfile) {
  return withSidebar(
    <div style={{
      minHeight: "100vh",
      background: "#f4f8f4",
      padding: 20,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 450,
        margin: "25px auto",
        padding: 22,
        background: "white",
        borderRadius: 18,
        border: "1px solid #e2eee5",
        boxShadow: "0 8px 25px rgba(25,135,84,0.12)"
      }}>
        <h2 style={{
          color: "#198754",
          textAlign: "center"
        }}>
          👤 আমার প্রোফাইল
        </h2>

        <p>👤 নাম: {fullName || "নাম দেওয়া হয়নি"}</p>
        <p>📱 মোবাইল: {phone || "নম্বর দেওয়া হয়নি"}</p>
        <p>📧 ইমেইল: {user?.email}</p>
        <p>🏠 ডেলিভারি ঠিকানা: {deliveryAddress || "ঠিকানা দেওয়া হয়নি"}</p>

        <textarea
          value={deliveryAddress}
          onChange={e => setDeliveryAddress(e.target.value)}
          placeholder="আপনার ডেলিভারি ঠিকানা লিখুন"
          style={{
            width: "100%",
            padding: 12,
            boxSizing: "border-box",
            color: "#222",
            borderRadius: 10,
            border: "1px solid #cce8d5",
            background: "#fbfefc",
            fontSize: 15,
            minHeight: 85,
            marginTop: 8
          }}
        />

        <button
          onClick={async () => {
  if (!user) {
    alert("আগে লগইন করুন");
    return;
  }

  const { error } = await supabase
    .from("profiles")
.update({
  full_name: fullName,
  phone: phone,
  address: deliveryAddress
})
.eq("id", user.id);

  if (error) {
    alert("সেভ হয়নি: " + error.message);
  } else {
    alert("প্রোফাইল সফলভাবে সেভ হয়েছে!");
    setShowProfile(false);
  }
}}
          style={buttonStyle}
        >
          ✓ প্রোফাইল সেভ করুন
        </button>

        <button
          onClick={() => setShowProfile(false)}
          style={buttonStyle}
        >
          ← ফিরে যান
        </button>

        <button
          onClick={handleLogout}
          style={{
            ...buttonStyle,
            background: "#dc3545"
          }}
        >
          লগআউট
        </button>
      </div>
    </div>
  );
}
  const filteredProducts = products.filter(product => {
  const matchSearch = (product.name || "")
    .toLowerCase()
    .includes(search.toLowerCase());

  const matchCategory =
    selectedCategory === "সব" ||
    getProductCategory(product.name) === selectedCategory;

  return matchSearch && matchCategory;
});
function updateQuantity(productId, change) {
  setCart(prevCart =>
    prevCart
      .map(item => {
        if (item.id !== productId) return item;

        const currentQuantity = Number(item.quantity) || 1;
        const stock = Number(item.stock) || 0;

        if (change > 0 && currentQuantity >= stock) {
          alert("দুঃখিত! এই পণ্যের পর্যাপ্ত স্টক নেই।");
          return item;
        }

        return {
          ...item,
          quantity: currentQuantity + change
        };
      })
      .filter(item => item.quantity > 0)
  );
}
  
  
const selectedShoppingProducts = shoppingList
  .map((item) => ({ item, product: products.find((product) => product.id === item.productId) }))
  .filter(({ product }) => Boolean(product));
const shoppingListTotal = selectedShoppingProducts.reduce(
  (sum, { product, item }) => sum + Number(product.price || 0) * Number(item.quantity || 0),
  0,
);
const shoppingBudgetRemaining = Number(familyPreferences.monthlyBudget) - shoppingListTotal;
const shoppingBudgetProgress = familyPreferences.monthlyBudget > 0
  ? Math.min(100, Math.round((shoppingListTotal / familyPreferences.monthlyBudget) * 100))
  : 0;
const monthlySpendComparison = previousMonthSpend > 0
  ? Math.round(((monthlySpend - previousMonthSpend) / previousMonthSpend) * 100)
  : null;
const monthlySpendComparisonLabel = monthlySpendComparison === null
  ? monthlySpend > 0 ? "নতুন" : "তথ্য নেই"
  : `${monthlySpendComparison > 0 ? "+" : ""}${monthlySpendComparison.toLocaleString("bn-BD")}%`;
const monthlySpendProgress = familyPreferences.monthlyBudget > 0
  ? Math.min(100, Math.round((monthlySpend / familyPreferences.monthlyBudget) * 100))
  : monthlySpend > 0 ? 100 : 0;
const isWeeklyPackage = familyPreferences.packageId === "weekly-family";
const packagePeriodLabel = isWeeklyPackage ? "সাপ্তাহিক" : "মাসিক";
const packageCycleEndDate = getPackageCycleEnd(latestConfirmedAt, familyPreferences.packageId);
const daysUntilCycleEnds = packageCycleEndDate
  ? Math.max(0, Math.ceil((new Date(packageCycleEndDate.getFullYear(), packageCycleEndDate.getMonth(), packageCycleEndDate.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000))
  : null;
const nextMonthName = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  .toLocaleDateString("bn-BD", { month: "long" });
const nextPackagePeriodName = isWeeklyPackage ? "পরের সপ্তাহের" : `${nextMonthName} মাসের`;
const productPickerItems = products.filter((product) => {
  const matchesSearch = !productSearch.trim() || String(product.name || "")
    .toLocaleLowerCase()
    .includes(productSearch.trim().toLocaleLowerCase());
  return product.is_active !== false && Number(product.stock) > 0 && matchesSearch;
});

  return withSidebar(
    <div className="bb-storefront-content">

      <section className="bb-campaign-banner" aria-labelledby="bb-campaign-title">
        <div className="bb-campaign-copy">
          <span className="bb-campaign-kicker">🏠 Family Monthly Package</span>
          <h2 id="bb-campaign-title">
            আপনার পরিবারের মাসিক বাজার এখন <em>আরও সহজ!</em>
          </h2>
          <p>একবার লিস্ট দিন, প্রতি মাসে বাজার পৌঁছে যাবে আপনার পরিবারের দরজায়।</p>
          <button
            type="button"
            onClick={() => document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            🛍️ বাজার শুরু করুন <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className="bb-family-card" aria-labelledby="bb-family-title">
        <div className="bb-family-card-heading">
          <span className="bb-family-icon" aria-hidden="true">⌂</span>
          <div className="bb-family-heading-copy">
            <h2 id="bb-family-title">আমাদের পরিবার প্যাকেজ</h2>
            <span>{FAMILY_PACKAGES.find((item) => item.id === familyPreferences.packageId)?.label}</span>
          </div>
          {!editingFamilyPreferences && (
            <button
              type="button"
              className="bb-my-market-button"
              aria-expanded={showFamilyShopping}
              aria-controls="bb-family-shopping"
              onClick={() => setShowFamilyShopping((visible) => !visible)}
            >
              <span aria-hidden="true">🛒</span>
              {showFamilyShopping ? "বাজার বন্ধ করুন" : "আমার বাজার"}
            </button>
          )}
        </div>

        {!editingFamilyPreferences ? (
          <>
          <div className="bb-family-summary">
            <div><span>পরিবারের সদস্য</span><strong>{familyPreferences.familyMembers} জন</strong></div>
            <i aria-hidden="true" />
            <div><span>{packagePeriodLabel} বাজেট</span><strong>৳{familyPreferences.monthlyBudget.toLocaleString("en-IN")}</strong></div>
            <p>আপনার {packagePeriodLabel} বাজারের পরিকল্পনা এখানে রাখুন।</p>
          </div>
          <div className="bb-family-actions">
            <button
              type="button"
              className="bb-family-edit-button"
              onClick={() => {
                setFamilyPreferencesDraft(familyPreferences);
                setFamilyPreferencesMessage("");
                setEditingFamilyPreferences(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" /></svg>
              প্যাকেজ ও বাজেট পরিবর্তন
            </button>
          </div>
          </>
        ) : (
          <div className="bb-family-editor">
            <div className="bb-family-fields">
              <label className="bb-family-field">
                <span>পরিবারের সদস্য</span>
                <span className="bb-stepper">
                  <button type="button" aria-label="সদস্য সংখ্যা কমান" onClick={() => setFamilyPreferencesDraft((value) => ({ ...value, familyMembers: Math.max(1, value.familyMembers - 1) }))}>−</button>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    inputMode="numeric"
                    value={familyPreferencesDraft.familyMembers}
                    onChange={(event) => setFamilyPreferencesDraft((value) => ({ ...value, familyMembers: Math.min(30, Math.max(1, Number(event.target.value) || 1)) }))}
                  />
                  <button type="button" aria-label="সদস্য সংখ্যা বাড়ান" onClick={() => setFamilyPreferencesDraft((value) => ({ ...value, familyMembers: Math.min(30, value.familyMembers + 1) }))}>+</button>
                </span>
              </label>
              <label className="bb-family-field">
                <span>{packagePeriodLabel} বাজেট</span>
                <span className="bb-budget-input">
                  <b>৳</b>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    inputMode="decimal"
                    value={familyPreferencesDraft.monthlyBudget}
                    onChange={(event) => setFamilyPreferencesDraft((value) => ({ ...value, monthlyBudget: event.target.value }))}
                    placeholder="৫,০০০"
                  />
                </span>
              </label>
            </div>
            <fieldset className="bb-package-options">
              <legend>আপনার বাজারের প্যাকেজ বেছে নিন</legend>
              <div className="bb-package-grid">
                {FAMILY_PACKAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={familyPreferencesDraft.packageId === item.id}
                    className={familyPreferencesDraft.packageId === item.id ? "bb-package-option is-selected" : "bb-package-option"}
                    onClick={() => setFamilyPreferencesDraft((value) => ({ ...value, packageId: item.id }))}
                  >
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="bb-family-editor-footer">
              <span role="status" aria-live="polite">{familyPreferencesMessage}</span>
              <div>
                <button type="button" className="bb-family-cancel" onClick={() => { setFamilyPreferencesDraft(familyPreferences); setFamilyPreferencesMessage(""); setEditingFamilyPreferences(false); }}>বাতিল</button>
                <button type="button" className="bb-family-save" disabled={savingFamilyPreferences} onClick={saveFamilyPreferences}>
                  {savingFamilyPreferences ? "সেভ হচ্ছে…" : "পছন্দ সেভ করুন"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showFamilyShopping && !editingFamilyPreferences && (
        <div className="bb-shopping-planner" id="bb-family-shopping">
          <div className="bb-planner-heading">
            <div>
              <h3>আপনার {packagePeriodLabel} বাজারের তালিকা</h3>
              <p>সহজে পণ্য যোগ বা বাদ দিন, পরিমাণ ঠিক করুন—মোট খরচ নিজে থেকেই হিসাব হবে।</p>
            </div>
            <button
              type="button"
              className="bb-add-product-toggle"
              aria-expanded={showProductPicker}
              onClick={() => { setShowProductPicker((visible) => !visible); setShoppingListMessage(""); }}
            >
              <span aria-hidden="true">{showProductPicker ? "−" : "+"}</span>
              {showProductPicker ? "পণ্য বাছাই বন্ধ" : `পণ্য বাছুন${shoppingList.length ? ` · ${shoppingList.length}টি যোগ` : ""}`}
            </button>
          </div>

          {familyPreferences.packageId === "budget-smart" && (
            <div style={{ background: "#f0f8f2", border: "1px solid #d7eadb", borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <strong style={{ display: "block", color: "#245b37", marginBottom: 6 }}>✨ আপনার বাজেটে স্মার্ট বাজার সাজান</strong>
              <p style={{ color: "#52665a", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
                পরিবারের সদস্য, সময়, পণ্যের বর্তমান দাম ও স্টক বিবেচনা করে প্রয়োজনীয় পণ্যের একটি প্রাথমিক তালিকা তৈরি হবে। আপনি পরে সব পণ্য ও পরিমাণ বদলাতে পারবেন।
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {[7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSmartBudgetDays(days)}
                    aria-pressed={smartBudgetDays === days}
                    style={{ border: smartBudgetDays === days ? "1px solid #287a45" : "1px solid #d5ded7", borderRadius: 20, padding: "7px 12px", background: smartBudgetDays === days ? "#287a45" : "#fff", color: smartBudgetDays === days ? "#fff" : "#365342", fontWeight: 600 }}
                  >
                    {days === 7 ? "৭ দিন" : days === 15 ? "১৫ দিন" : "৩০ দিন"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={generateSmartBudgetSuggestion}
                style={{ width: "100%", border: 0, borderRadius: 10, padding: "11px 14px", background: "#287a45", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                ✨ আমার বাজেটে বাজার সাজিয়ে দিন
              </button>
            </div>
          )}

          <div className="bb-budget-overview">
            <div><span>তালিকার মোট</span><strong>৳{shoppingListTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
            <div><span>{packagePeriodLabel} বাজেট</span><strong>৳{familyPreferences.monthlyBudget.toLocaleString("en-IN")}</strong></div>
            <div className={shoppingBudgetRemaining < 0 ? "bb-budget-left is-over" : "bb-budget-left"}>
              <span>{shoppingBudgetRemaining < 0 ? "বাজেটের বেশি" : "বাকি আছে"}</span>
              <strong>৳{Math.abs(shoppingBudgetRemaining).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
            </div>
          </div>
          <div className="bb-budget-progress" role="progressbar" aria-label={`${packagePeriodLabel} বাজেটের ব্যবহার`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={shoppingBudgetProgress}>
            <span className={shoppingBudgetRemaining < 0 ? "is-over" : ""} style={{ width: `${shoppingBudgetProgress}%` }} />
          </div>
          <div className="bb-budget-caption">
            <span>{shoppingBudgetProgress}% বাজেট ব্যবহার</span>
            <span>সদস্য: {familyPreferences.familyMembers} জন</span>
          </div>
          {getFamilyPackageMinimum(familyPreferences.packageId) > 0 && (
            <p style={{ color: "#52665a", fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
              {FAMILY_PACKAGES.find((item) => item.id === familyPreferences.packageId)?.label} অর্ডারের ন্যূনতম পণ্যমূল্য ৳{getFamilyPackageMinimum(familyPreferences.packageId).toLocaleString("en-IN")}। ডেলিভারি ও সার্ভিস চার্জ এই হিসাবের বাইরে।
            </p>
          )}

          {selectedShoppingProducts.length > 0 ? (
            <div className="bb-shopping-items">
              {selectedShoppingProducts.map(({ product, item }) => (
                <article className="bb-shopping-item" key={product.id}>
                  <div className="bb-shopping-item-name">
                    <strong>{product.name}</strong>
                    <span>৳{Number(product.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} / {product.unit || "টি"}</span>
                  </div>
                  <div className="bb-shopping-quantity" aria-label={`${product.name} এর পরিমাণ`}>
                    <button type="button" aria-label={`${product.name} এক কমান`} onClick={() => changeShoppingQuantity(product, -1)}>−</button>
                    <strong><span>{item.quantity}</span><small>{product.unit || "টি"}</small></strong>
                    <button type="button" aria-label={`${product.name} এক বাড়ান`} disabled={Number(item.quantity) >= Number(product.stock)} onClick={() => changeShoppingQuantity(product, 1)}>+</button>
                  </div>
                  <strong className="bb-shopping-subtotal">৳{(Number(product.price || 0) * Number(item.quantity)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                  <button type="button" className="bb-remove-shopping-item" aria-label={`${product.name} তালিকা থেকে সরান`} onClick={() => setShoppingList((items) => items.filter((entry) => entry.productId !== product.id))}>×</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="bb-shopping-empty">
              <span aria-hidden="true">🧺</span>
              <div><strong>আপনার বাজারের তালিকা এখনো খালি</strong><p>পণ্য যোগ করে দাম ও মোট খরচ একসাথে দেখুন।</p></div>
            </div>
          )}

          {showProductPicker && (            <div className="bb-product-picker">
              <label className="bb-product-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="পণ্যের নাম লিখে খুঁজুন"
                  aria-label="পণ্য খুঁজুন"
                />
              </label>
              {productPickerItems.length > 0 ? (
                <div className="bb-product-picker-grid">
                  {productPickerItems.map((product) => {
                    const alreadyAdded = shoppingList.some((item) => item.productId === product.id);
                    return (
                      <article className="bb-picker-product" key={product.id}>
                        <div>
                          <strong>{product.name}</strong>
                          <span>৳{Number(product.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} / {product.unit || "টি"}</span>
                        </div>
                        <button type="button" className={alreadyAdded ? "is-selected" : ""} onClick={() => addProductToShoppingList(product)}>
                          {alreadyAdded ? "✓ যোগ হয়েছে · বাদ দিন" : "+ তালিকায় যোগ"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="bb-no-products">মিল থাকা স্টকে পণ্য পাওয়া যায়নি।</p>
              )}
            </div>
          )}

          <div className="bb-planner-actions">
            <button
              type="button"
              className="bb-fill-budget-button"
              disabled={!selectedShoppingProducts.length}
              onClick={() => autoFillShoppingBudget(selectedShoppingProducts, shoppingListTotal)}
            >
              ✨ বাজেট অনুযায়ী পরিমাণ সাজান
            </button>
            <button type="button" className="bb-save-list-button" disabled={savingShoppingList} onClick={saveShoppingList}>
              {savingShoppingList ? "সেভ হচ্ছে…" : "তালিকা সেভ করুন"}
            </button>
            {familyPreferences.packageId === "budget-smart" && (
              <button type="button" className="bb-cart-list-button" disabled={!selectedShoppingProducts.length} onClick={() => addShoppingListToCart(selectedShoppingProducts)}>
                🛒 কার্টে যোগ করুন
              </button>
            )}
            <button
              type="button"
              className="bb-cart-list-button"
              disabled={!selectedShoppingProducts.length || shoppingListTotal < (familyPreferences.packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(familyPreferences.packageId))}
              onClick={() => checkoutFamilyShoppingList(selectedShoppingProducts, shoppingListTotal)}
              style={{ background: "#176b40", color: "#fff", borderColor: "#176b40" }}
            >
              ✓ সকল পণ্য নিয়ে Checkout করুন
            </button>
          </div>
          <p style={{
            color: shoppingListTotal >= (familyPreferences.packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(familyPreferences.packageId)) ? "#287a45" : "#8a5a12",
            fontSize: 12,
            margin: "8px 0 0",
            lineHeight: 1.6
          }}>
            {shoppingListTotal >= (familyPreferences.packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(familyPreferences.packageId))
              ? "ন্যূনতম বাজারের শর্ত পূরণ হয়েছে। এখন সরাসরি Checkout করতে পারবেন।"
              : (FAMILY_PACKAGES.find((item) => item.id === familyPreferences.packageId)?.label || "এই প্যাকেজ") + " Checkout-এর জন্য পণ্যের মোট মূল্য কমপক্ষে ৳" + (familyPreferences.packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(familyPreferences.packageId)).toLocaleString("en-IN") + " হতে হবে। আরও ৳" + ((familyPreferences.packageId === "budget-smart" ? BUDGET_SMART_MINIMUM : getFamilyPackageMinimum(familyPreferences.packageId)) - shoppingListTotal).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " টাকার পণ্য যোগ করুন।"}
          </p>
          <p className="bb-planner-message" role="status" aria-live="polite">{shoppingListMessage}</p>
        </div>
        )}
      </section>

      <section className="bb-monthly-insight" aria-label="মাসিক বাজারের অগ্রগতি ও রিমাইন্ডার">
        <div className="bb-monthly-progress-panel">
          <div
            className="bb-monthly-progress-ring"
            role="progressbar"
            aria-label="মাসিক বাজেট ব্যবহারের অগ্রগতি"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={monthlySpendProgress}
            style={{ "--bb-monthly-progress": `${monthlySpendProgress}%` }}
          >
            <div className="bb-monthly-progress-inner">
              <span aria-hidden="true">🛒</span>
              <strong>{monthlySpendProgress}%</strong>
            </div>
          </div>
          <strong className="bb-monthly-progress-label">
            {monthlySpendProgress >= 75 ? "বাজার প্রায় শেষ!" : monthlySpendProgress > 0 ? "বাজার চলছে" : "বাজার শুরু করুন"}
          </strong>
          <span className="bb-monthly-spend-caption">
            ৳{monthlySpend.toLocaleString("bn-BD", { maximumFractionDigits: 0 })} / ৳{Number(familyPreferences.monthlyBudget).toLocaleString("bn-BD")}
          </span>
        </div>

        <div className="bb-monthly-estimate-panel">
          <span className="bb-monthly-panel-kicker"><span aria-hidden="true">◷</span> আনুমানিক শেষ সময়</span>
          {packageCycleEndDate ? (
            <>
              <strong className="bb-monthly-estimate-date">
                {packageCycleEndDate.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" })}
              </strong>
              <span className="bb-monthly-estimate-countdown">
                {daysUntilCycleEnds === 0 ? "প্যাকেজের মেয়াদ শেষ" : `আর প্রায় ${daysUntilCycleEnds.toLocaleString("bn-BD")} দিন বাকি`}
              </span>
            </>
          ) : (
            <p className="bb-monthly-estimate-empty">অর্ডার কনফার্ম হলে {isWeeklyPackage ? "৭ দিনের" : "এক মাসের"} হিসাব শুরু হবে</p>
          )}
        </div>

        <div className="bb-monthly-reminder-panel">
          <span className="bb-monthly-reminder-kicker"><span aria-hidden="true">🔔</span> স্মার্ট রিমাইন্ডার</span>
          <p>
            {monthlySpendProgress >= 75
              ? `আপনার ${isWeeklyPackage ? "সাপ্তাহিক" : "মাসিক"} বাজার শেষ পর্যায়ে। ${nextPackagePeriodName} তালিকাটি কি দেখে নেবেন?`
              : `আগে থেকেই ${nextPackagePeriodName} বাজারের তালিকা গুছিয়ে রাখুন।`}
          </p>
          <button type="button" onClick={() => setShowFamilyShopping(true)}>
            এখনই তালিকা দেখুন <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className="bb-monthly-report-card" aria-labelledby="bb-monthly-report-title">
        <div className="bb-monthly-report-heading">
          <span aria-hidden="true">▮</span>
          <h2 id="bb-monthly-report-title">এই মাসের বাজারের হিসাব</h2>
        </div>
        <div className="bb-monthly-report-grid">
          <div className="bb-monthly-report-stat">
            <span className="bb-report-icon" aria-hidden="true">🛒</span>
            <div><span>মোট খরচ</span><strong>৳ {monthlySpend.toLocaleString("bn-BD", { maximumFractionDigits: 0 })}</strong></div>
          </div>
          <div className="bb-monthly-report-stat">
            <span className="bb-report-icon" aria-hidden="true">📦</span>
            <div><span>মোট পণ্য</span><strong>{monthlyProductCount.toLocaleString("bn-BD")} টি</strong></div>
          </div>
          <div className="bb-monthly-report-stat">
            <span className="bb-report-icon bb-report-check" aria-hidden="true">✓</span>
            <div><span>ডেলিভারি সম্পন্ন</span><strong>{deliveredOrdersCount.toLocaleString("bn-BD")} টি অর্ডার</strong></div>
          </div>
          <div className={`bb-monthly-report-stat ${monthlySpendComparison !== null && monthlySpendComparison < 0 ? "is-down" : "is-up"}`}>
            <span className="bb-report-icon" aria-hidden="true">↗</span>
            <div><span>গত মাসের তুলনায়</span><strong>{monthlySpendComparisonLabel}</strong></div>
          </div>
        </div>
      </section>

      <div className="bb-store-search">
        <span className="bb-store-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          placeholder="আপনার প্রয়োজনীয় পণ্য খুঁজুন..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="পণ্য খুঁজুন"
        />
        {search && (
          <button type="button" className="bb-store-search-clear" onClick={() => setSearch("")} aria-label="সার্চ মুছুন">
            ×
          </button>
        )}
      </div>

      <section className="bb-category-section" aria-labelledby="bb-category-title">
        <div className="bb-category-heading">
          <div>
            <span className="bb-category-eyebrow">SHOP BY CATEGORY</span>
            <h2 id="bb-category-title">ক্যাটাগরি অনুযায়ী বাজার করুন</h2>
            <p>আপনার প্রয়োজনীয় পণ্যটি সহজেই খুঁজে নিন</p>
          </div>
          <span className="bb-category-heading-icon" aria-hidden="true">🧺</span>
        </div>

        <div className="bb-category-grid">
          <button
            type="button"
            className={`bb-category-card bb-category-all ${selectedCategory === "সব" ? "is-active" : ""}`}
            onClick={() => setSelectedCategory("সব")}
            aria-pressed={selectedCategory === "সব"}
          >
            <span className="bb-category-icon" aria-hidden="true">🛍️</span>
            <span className="bb-category-card-copy">
              <strong>সব পণ্য</strong>
              <small>{products.length.toLocaleString("bn-BD")} টি পণ্য</small>
            </span>
            <span className="bb-category-arrow" aria-hidden="true">↗</span>
          </button>

          {CATEGORY_GROUPS
            .map((category) => ({
              ...category,
              productCount: products.filter((product) => getProductCategory(product.name) === category.id).length,
            }))
            .filter((category) => category.productCount > 0)
            .map((category) => {
              const categoryVisual = getCategoryVisual(category.name);
              const isSelected = selectedCategory === category.id;

              return (
                <button
                  type="button"
                  key={category.id}
                  className={`bb-category-card ${categoryVisual.tone} ${isSelected ? "is-active" : ""}`}
                  onClick={() => setSelectedCategory(category.id)}
                  aria-pressed={isSelected}
                >
                  <span className="bb-category-icon" aria-hidden="true">{categoryVisual.icon}</span>
                  <span className="bb-category-card-copy">
                    <strong>{category.name}</strong>
                    <small>{category.productCount.toLocaleString("bn-BD")} টি পণ্য</small>
                  </span>
                  <span className="bb-category-arrow" aria-hidden="true">↗</span>
                </button>
              );
            })}
        </div>
      </section>
     <h2 id="products-section" style={{
  color: "#198754",
  fontSize: 22,
  marginTop: 25,
  marginBottom: 15,
  fontWeight: "bold"
}}>
  🛒 আমাদের পণ্যসমূহ
</h2>

      {cart.length > 0 && (
  <div style={{
    background: "white",
    padding: 18,
    marginTop: 22,
    borderRadius: 20,
    border: "1px solid #dcebe0",
    boxShadow: "0 6px 22px rgba(8,127,69,0.09)"
  }}>
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottom: "1px solid #e8f1ea"
    }}>
      <div>
        <h3 style={{
          color: "#087f45",
          fontSize: 21,
          margin: 0
        }}>
          🛒 আপনার কার্ট
        </h3>
        <small style={{ color: "#888" }}>
          {cart.length} ধরনের পণ্য
        </small>
      </div>

      <div style={{
        background: "#e8f5ed",
        color: "#087f45",
        padding: "9px 13px",
        borderRadius: 12,
        fontWeight: "bold"
      }}>
        {cart.reduce((sum, item) => sum + (item.quantity || 1), 0)} টি
      </div>
    </div>

    {cart.map((item, index) => (
      <div
        key={index}
        style={{
          background: "#fbfdfb",
          border: "1px solid #edf2ee",
          borderRadius: 14,
          padding: 13,
          marginBottom: 12
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start"
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{
              color: "#263d30",
              fontSize: 15
            }}>
              {item.name}
            </strong>

            <p style={{
              color: "#888",
              fontSize: 13,
              margin: "7px 0"
            }}>
              ৳{item.price} × {item.quantity || 1} টি
            </p>

            <strong style={{
              color: "#087f45",
              fontSize: 17
            }}>
              ৳{Number(item.price) * (item.quantity || 1)}
            </strong>
          </div>

          <button
            onClick={() => {
              setCart(cart.filter((_, i) => i !== index));
            }}
            style={{
              background: "#fff0f0",
              color: "#dc3545",
              border: "none",
              borderRadius: 9,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            ✕ মুছুন
          </button>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 13,
          paddingTop: 11,
          borderTop: "1px solid #edf2ee"
        }}>
          <span style={{ color: "#777", fontSize: 13 }}>
            পরিমাণ নির্বাচন
          </span>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 13
          }}>
            <button
              onClick={() => updateQuantity(item.id, -1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid #cce8d5",
                background: "#e8f5ed",
                color: "#087f45",
                fontSize: 21,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              −
            </button>

            <strong style={{ fontSize: 16 }}>
              {item.quantity || 1}
            </strong>

            <button
              onClick={() => updateQuantity(item.id, 1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "none",
                background: "#087f45",
                color: "white",
                fontSize: 21,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    ))}

    <div style={{
      background: "#e8f5ed",
      padding: 17,
      borderRadius: 14,
      marginTop: 18
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <strong style={{ color: "#38634a", fontSize: 15 }}>
          সর্বমোট বিল
        </strong>

        <strong style={{
          color: "#087f45",
          fontSize: 24
        }}>
          ৳{cartTotal}
        </strong>
      </div>
    </div>

    <button
      onClick={() => setShowCheckout(true)}
      style={{
        width: "100%",
        background: "linear-gradient(135deg, #087f45, #20a464)",
        color: "white",
        padding: 16,
        border: "none",
        borderRadius: 13,
        fontSize: 16,
        fontWeight: "bold",
        cursor: "pointer",
        marginTop: 16,
        boxShadow: "0 5px 14px rgba(25,135,84,0.20)"
      }}
    >
      অর্ডার করতে এগিয়ে যান →
    </button>
  </div>
)}

      <div style={{
  background: "#f4f8f4",
  padding: 5,
  borderRadius: 16,
  marginTop: 15
}}>
  {products.length === 0 ? (
    <p style={{ textAlign: "center", color: "#777", padding: 20 }}>
      এখনো কোনো পণ্য যোগ করা হয়নি।
    </p>
  ) : filteredProducts.length === 0 ? (
    <p style={{ textAlign: "center", color: "#777", padding: 20 }}>
      কোনো পণ্য পাওয়া যায়নি।
    </p>
  ) : (
    <div style={{
      display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
gap: 12
    }}>
      {filteredProducts.map(product => (
        <div
          key={product.id}
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #e5eee7",
            boxShadow: "0 4px 13px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0
          }}
        >
          <div style={{
            width: "100%",
            aspectRatio: "4 / 3",
            background: "#edf5ef",
            overflow: "hidden"
          }}>
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                style={{
                  width: "100%",
height: "100%",
objectFit: "contain",
padding: 6,
boxSizing: "border-box"
                }}
              />
            ) : (
              <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 45
              }}>
                🛒
              </div>
            )}
          </div>

          <div style={{
            padding: 10,
            display: "flex",
            flexDirection: "column",
            flex: 1
          }}>
            <h3 style={{
              color: "#263d30",
              fontSize: 15,
              fontWeight: "bold",
              margin: "0 0 8px",
              lineHeight: 1.5,
              minHeight: 42
            }}>
              {product.name}
            </h3>

            <p style={{
              color: "#999",
              fontSize: 12,
              textDecoration: "line-through",
              margin: "0 0 5px"
            }}>
              বাজারদর: ৳{product.market_price || product.price}
            </p>

            <h2 style={{
              color: "#087f45",
              fontSize: 18,
              fontWeight: "bold",
              margin: "0 0 9px"
            }}>
              ৳{product.price}
            </h2>

            <div style={{
              color: product.stock > 0 ? "#087f45" : "#dc3545",
              background: product.stock > 0 ? "#e8f5ed" : "#fdecec",
              padding: "6px 9px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 10
            }}>
              {product.stock > 0
                ? `স্টক: ${product.stock} টি`
                : "স্টক শেষ"}
            </div>

            <button
              disabled={!(Number(product.stock) > 0)}
              onClick={() => {
  const currentStock = Number(product.stock) || 0;
  const existing = cart.find(item => item.id === product.id);
  const currentQuantity = existing?.quantity || 0;

  if (currentQuantity >= currentStock) {
    alert("দুঃখিত! এই পণ্যের পর্যাপ্ত স্টক নেই।");
    return;
  }

  setCart(prevCart => {
    const existingItem = prevCart.find(item => item.id === product.id);

    if (existingItem) {
      return prevCart.map(item =>
        item.id === product.id
          ? { ...item, quantity: (item.quantity || 1) + 1 }
          : item
      );
    }

    return [...prevCart, { ...product, quantity: 1 }];
  });

  alert(product.name + " কার্টে যোগ হয়েছে!");
}}
              style={{
                width: "100%",
                background: Number(product.stock) > 0
                  ? "linear-gradient(135deg, #087f45, #20a464)"
                  : "#aaa",
                color: "white",
                padding: "12px 5px",
minHeight: 44,
border: "none",
borderRadius: 10,
fontSize: 14,
fontWeight: "bold",
                cursor: Number(product.stock) > 0 ? "pointer" : "not-allowed",
                marginTop: "auto"
              }}
            >
              🛒 কার্টে যোগ করুন
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

      <footer className="bb-site-footer" aria-label="BazarBondhu footer">
        <div className="bb-footer-main">
          <section className="bb-footer-brand">
            <a className="bb-footer-logo" href="/" aria-label="BazarBondhu হোম">
              <span className="bb-footer-logo-icon" aria-hidden="true">🛒</span>
              <span>Bazar<span>Bondhu</span></span>
            </a>
            <p>আপনার পরিবারের প্রতিদিনের বাজার হোক আরও সহজ, সাশ্রয়ী ও নির্ভরযোগ্য। প্রয়োজনীয় বাজার পৌঁছে দিতে BazarBondhu আছে আপনার পাশে।</p>
            <a className="bb-footer-shop-link" href="#products-section">বাজার শুরু করুন <span aria-hidden="true">→</span></a>
          </section>

          <section className="bb-footer-contact" aria-labelledby="bb-footer-contact-title">
            <span className="bb-footer-eyebrow">আমরা আছি আপনার পাশে</span>
            <h2 id="bb-footer-contact-title">কোনো সাহায্য প্রয়োজন?</h2>
            <p>অর্ডার বা বাজার সংক্রান্ত যেকোনো প্রয়োজনে আমাদের হেল্পলাইনে যোগাযোগ করুন।</p>
            <a className="bb-footer-phone" href="tel:01820344437">
              <span className="bb-footer-phone-icon" aria-hidden="true">☎</span>
              <span><small>হেল্পলাইন নম্বর</small><strong>01820344437</strong></span>
              <span className="bb-footer-call-label">কল করুন ↗</span>
            </a>
            <a
              className="bb-footer-whatsapp"
              href="https://wa.me/8801820344437"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp-এ BazarBondhu-কে মেসেজ করুন"
            >
              <span className="bb-footer-whatsapp-icon" aria-hidden="true">◉</span>
              <span><small>WhatsApp-এ যোগাযোগ</small><strong>WhatsApp-এ মেসেজ করুন</strong></span>
              <span className="bb-footer-whatsapp-label">চ্যাট করুন ↗</span>
            </a>
          </section>
        </div>
        <div className="bb-footer-bottom">
          <span>© {new Date().getFullYear()} BazarBondhu. সর্বস্বত্ব সংরক্ষিত।</span>
          <span className="bb-footer-tagline">আপনার বাজার, আমাদের দায়িত্ব <span aria-hidden="true">♥</span></span>
        </div>
      </footer>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 14,
  marginTop: 14,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid #d5e5da",
  background: "#fbfefc",
  color: "#222",
  fontSize: 15,
  outline: "none"
};

const buttonStyle = {
  width: "100%",
  background: "#198754",
  color: "white",
  padding: "14px 15px",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: "bold",
  marginTop: 15,
  boxShadow: "0 4px 10px rgba(25,135,84,0.2)"
};

export default Customer;
