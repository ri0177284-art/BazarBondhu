import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { supabase } from "./supabase";
import Customer from "./Customer";

function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [active, setActive] = useState("Dashboard");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesChartData, setSalesChartData] = useState([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [serviceCharge, setServiceCharge] = useState(0);
const [deliveryFee, setDeliveryFee] = useState(0);
const [orderItems, setOrderItems] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [stock, setStock] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check login and admin permission
  async function checkAdmin(currentSession) {
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
    loadProducts();
    loadOrders();
    loadCustomers();
    loadSettings();
  }
  // Load customers
async function loadCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*");

  if (error) {
    alert("Settings Error: " + error.message);("Customers loading error:", error.message);
    alert("কাস্টমার লোড করা যায়নি: " + error.message);
    return;
  }

  setCustomers((data || []).filter(
    customer => customer.role !== "admin"
  ));
}
// Load App Settings
async function loadSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("Settings loading error:", error.message);
    return;
  }

  setServiceCharge(data.service_charge || 0);
console.log("Settings Data:", data);
setDeliveryFee(data.delivery_fee || 0);
}
async function saveSettings() {
  const { error } = await supabase
    .from("app_settings")
    .update({
  service_charge: Number(serviceCharge),
  delivery_fee: Number(deliveryFee),
  updated_at: new Date().toISOString()
})
    .eq("id", 1);

  if (error) {
    alert("সেটিংস সেভ হয়নি: " + error.message);
    return;
  }

  alert("সেটিংস সফলভাবে সেভ হয়েছে!");
}
  // Update Order Status
async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", orderId);

  if (error) {
    alert("স্ট্যাটাস পরিবর্তন করা যায়নি: " + error.message);
    return;
  }

  alert("অর্ডার স্ট্যাটাস সফলভাবে পরিবর্তন হয়েছে!");
  loadOrders();
}
// Update Payment Status
async function updatePaymentStatus(orderId, newStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: newStatus })
    .eq("id", orderId);

  if (error) {
    alert("পেমেন্ট স্ট্যাটাস পরিবর্তন করা যায়নি: " + error.message);
    return;
  }

  alert("পেমেন্ট স্ট্যাটাস সফলভাবে পরিবর্তন হয়েছে!");
  loadOrders();
}
// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", orderId);

  if (error) {
    alert("স্ট্যাটাস পরিবর্তন করা যায়নি: " + error.message);
    return;
  }

  alert("অর্ডার স্ট্যাটাস সফলভাবে পরিবর্তন হয়েছে!");
  loadOrders();
}

  // Listen to authentication changes
  useEffect(() => {
    let mounted = true;

    async function startAuth() {
      const { data } = await supabase.auth.getSession();

      if (mounted) {
        setSession(data.session);
        await checkAdmin(data.session);
      }
    }

    startAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        if (!newSession) {
          setIsAdmin(false);
          setChecking(false);
        } else {
          setChecking(true);
          setTimeout(() => {
            if (mounted) checkAdmin(newSession);
          }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
// Listen for New Orders
useEffect(() => {
  if (!isAdmin) return;

  const channel = supabase
    .channel("admin-new-orders")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders"
      },
      () => {
        setNewOrderCount(count => count + 1);
        loadOrders();
        alert("🔔 BazarBondhu-তে নতুন অর্ডার এসেছে!");
      }
    )
    .subscribe((status) => {
  console.log("Realtime status:", status);
});

  return () => {
    supabase.removeChannel(channel);
  };
}, [isAdmin]);
  // Login
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setLoginError(error.message);
    }
  }

  // Logout
  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }

  // Load products
  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      console.error(error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
  }
  // Load orders
async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Orders loading error:", error.message);
    alert("অর্ডার লোড করা যায়নি: " + error.message);
    return;
  }

  setOrders(data || []);
  console.log("অর্ডারের আসল তথ্য:", (data || []).map(order => ({
  status: order.order_status,
  date: order.created_at,
  total: order.total
})));
  // Load order items
const { data: items, error: itemsError } = await supabase
  .from("order_items")
  .select("*");

if (itemsError) {
  console.error("Order items loading error:", itemsError.message);
  return;
}

setOrderItems(items || []);
const last7Days = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (6 - i));

  const dayOrders = (data || []).filter(order =>
    order.order_status === "delivered" &&
    new Date(order.created_at).toDateString() === date.toDateString()
  );

  return {
    day: date.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }),
    sales: dayOrders.reduce(
      (total, order) => total + Number(order.total || 0),
      0
    )
  };
});

console.log("গত ৭ দিনের বিক্রির ডেটা:", last7Days);
setSalesChartData(last7Days);
}

  // Add or Update Product
async function addProduct(e) {
  e.preventDefault();

  if (!name.trim() || price === "" || marketPrice === "" || stock === "") {
    alert("সব তথ্য পূরণ করো");
    return;
  }

  if (Number(price) < 0 || Number(marketPrice) < 0 || Number(stock) < 0) {
    alert("দাম ও Stock শূন্যের কম হতে পারবে না");
    return;
  }

  setSaving(true);

  const productData = {
    name: name.trim(),
    price: Number(price),
    market_price: Number(marketPrice),
    stock: Number(stock)
  };

  let error;

  if (editingId) {
    const result = await supabase
      .from("products")
      .update(productData)
      .eq("id", editingId);

    error = result.error;
  } else {
    const result = await supabase
      .from("products")
      .insert([productData]);

    error = result.error;
  }

  if (error) {
    alert("পণ্য Save হয়নি: " + error.message);
  } else {
    alert(editingId ? "পণ্য Update হয়েছে!" : "পণ্য যোগ হয়েছে!");

    setEditingId(null);
    setName("");
    setPrice("");
    setMarketPrice("");
    setStock("");

    await loadProducts();
  }

  setSaving(false);
}
// Edit Product
async function editProduct(product) {
  setEditingId(product.id);
  setName(product.name);
  setPrice(String(product.price));
  setMarketPrice(String(product.market_price));
  setStock(String(product.stock));
}
  // Delete product
  async function deleteProduct(id) {
    if (!window.confirm("পণ্যটি মুছে ফেলতে চাও?")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Delete Error: " + error.message);
    } else {
      alert("পণ্য মুছে ফেলা হয়েছে");
      await loadProducts();
    }
  }

  const menu = [
    "Dashboard",
    "Products",
    "Market Prices",
    "Orders",
    "Customers",
    "Settings"
  ];

// Customer App
if (window.location.pathname.includes("customer")) {
  return <Customer />;
}

  if (checking) {
    return <h2 style={{ padding: 30 }}>Checking Admin Access...</h2>;
  }

  if (!session) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f6fa",
        fontFamily: "Arial"
      }}>
        <form onSubmit={handleLogin} style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          width: 320
        }}>
          <h2>🛒 BazarBondhu</h2>
          <h3>Admin Login</h3>

          <p>Email</p>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Admin Email"
            style={{ width: "95%", padding: 10 }}
          />

          <p>Password</p>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: "95%", padding: 10 }}
          />

          {loginError && (
            <p style={{ color: "red" }}>{loginError}</p>
          )}

          <br /><br />

          <button type="submit" style={{
            width: "100%",
            padding: 12,
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6
          }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 30 }}>
        <h2>Admin Access Denied</h2>
        <p>এই Account-এর Admin Permission নেই।</p>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      fontFamily: "Arial",
      background: "#f4f6fa"
    }}>
      <aside style={{
        width: 230,
        background: "#172554",
        color: "white",
        padding: 20
      }}>
        <h2>🛒 BazarBondhu</h2>
        <hr />

        {menu.map(item => (
          <p
            key={item}
            onClick={() => {
  setActive(item);
  if (item === "Orders") {
    setNewOrderCount(0);
  }
}}
            style={{
              padding: 12,
              cursor: "pointer",
              borderRadius: 7,
              background: active === item ? "#2563eb" : "transparent"
            }}
          >
            {item === "Orders"
  ? `📦 Orders ${newOrderCount > 0 ? `(${newOrderCount} নতুন)` : ""}`
  : item}
          </p>
        ))}

        <hr />
        <button onClick={handleLogout}>Logout</button>
      </aside>

      <main style={{ flex: 1, padding: 30 }}>
        <h1>{active}</h1>

        {active === "Dashboard" && (
  <div>
    <h2>Welcome to BazarBondhu Admin Panel!</h2>
    <div style={{
  background: "#eff6ff",
  padding: 15,
  borderRadius: 10,
  marginTop: 15,
  marginBottom: 15
}}>
  <h3>📅 আজকের অর্ডার ও বিক্রি</h3>
  <div style={{
  background: "white",
  padding: 15,
  borderRadius: 10,
  marginTop: 10
}}>
  <h3>আজকের মোট অর্ডার</h3>
  <h2>
    {orders.filter(order =>
      new Date(order.created_at).toDateString() === new Date().toDateString()
    ).length}
  </h2>
</div>
<div style={{
  background: "white",
  padding: 15,
  borderRadius: 10,
  marginTop: 10
}}>
  <h3>💰 আজকের মোট বিক্রি</h3>
  <h2>
    ৳{orders
      .filter(order =>
        order.order_status === "delivered" &&
        new Date(order.created_at).toDateString() === new Date().toDateString()
      )
      .reduce((total, order) => total + Number(order.total || 0), 0)}
  </h2>
</div>
</div>
<div style={{
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginTop: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
}}>
  <h3>📊 গত ৭ দিনের বিক্রির হিসাব</h3>

  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={salesChartData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="day" />
      <YAxis />
      <Tooltip formatter={(value) => `৳${value}`} />
      <Bar dataKey="sales" fill="#2563eb" name="বিক্রি" />
    </BarChart>
  </ResponsiveContainer>
</div>

    <div style={{
      display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
gap: 20,
marginTop: 25
    }}>

      <div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #2563eb"
}}>
  <div style={{fontSize: 30}}>🛒</div>
        <h3>মোট পণ্য</h3>
        <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#2563eb"
}}>
  {products.length}
</h2>
      </div>

      <div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #16a34a"
}}>
  <div style={{fontSize: 30}}>📦</div>
        <h3>মোট অর্ডার</h3>
        <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#16a34a"
}}>
  {orders.length}
</h2>
      </div>

      <div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #9333ea"
}}>
  <div style={{fontSize: 30}}>👥</div>
        <h3>মোট কাস্টমার</h3>
        <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#9333ea"
}}>
  {customers.length}
</h2>
      </div>
      <div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #f59e0b"
}}>
  <div style={{fontSize: 30}}>⏳</div>
  <h3>Pending অর্ডার</h3>
  <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#f59e0b"
}}>
  {orders.filter(order => order.order_status === "pending").length}
</h2>
</div>

<div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #0d9488"
}}>
  <div style={{fontSize: 30}}>✅</div>
  <h3>সম্পন্ন অর্ডার</h3>
  <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#0d9488"
}}>
  {orders.filter(order => order.order_status === "delivered").length}
</h2>
</div>

      <div style={{
  background: "white",
  padding: 22,
  borderRadius: 14,
  minWidth: 150,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  borderLeft: "5px solid #dc2626"
}}>
  <div style={{fontSize: 30}}>💰</div>
        <h3>মোট বিক্রি</h3>
        <h2 style={{
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0",
  color: "#dc2626"
}}>
  ৳{orders
    .filter(order => order.order_status === "delivered")
    .reduce((total, order) => total + Number(order.total || 0), 0)}
</h2>
      </div>

    </div>
  </div>
)}

        {active === "Products" && (
          <div>
            <h2>Add New Product</h2>

            <form onSubmit={addProduct} style={{
              background: "white",
              padding: 20,
              borderRadius: 10,
              maxWidth: 450
            }}>
              <p>Product Name</p>
              <input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="যেমন: চাল"
                style={{ padding: 10, width: "90%" }}
              />

              <p>Price (৳)</p>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="পণ্যের দাম"
                style={{ padding: 10, width: "90%" }}
              />
              <p>Market Price (৳)</p>
<input
  required
  type="number"
  min="0"
  step="0.01"
  value={marketPrice}
  onChange={e => setMarketPrice(e.target.value)}
  placeholder="বাজারদর লিখুন"
  style={{ padding: 10, width: "90%" }}
/>

              <p>Stock</p>
              <input
                required
                type="number"
                min="0"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="স্টকের পরিমাণ"
                style={{ padding: 10, width: "90%" }}
              />

              <br /><br />
              <button disabled={saving} type="submit">
  {saving
    ? "Saving..."
    : editingId
      ? "Update Product"
      : "+ Add Product"}
</button>

{editingId && (
  <button
    type="button"
    onClick={() => {
      setEditingId(null);
      setName("");
      setPrice("");
      setMarketPrice("");
      setStock("");
    }}
  >
    Cancel
  </button>
)}
            </form>

            <h2>Product List</h2>

            <button onClick={loadProducts} disabled={loading}>
              Refresh Products
            </button>

            {loading ? (
              <p>Loading...</p>
            ) : products.length === 0 ? (
              <p>এখনো কোনো পণ্য যোগ করা হয়নি।</p>
            ) : products.map(p => (
              <div key={p.id} style={{
                background: "white",
                padding: 12,
                marginTop: 10,
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span>
                  {p.name} — ৳{p.price} — Stock: {p.stock}
                </span>
                <button
  onClick={() => editProduct(p)}
  style={{
    background: "#198754",
    color: "white",
    padding: "8px 14px",
    border: "none",
    borderRadius: 5,
    marginRight: 8,
    cursor: "pointer"
  }}
>
  Edit
</button>

<button onClick={() => deleteProduct(p.id)}>
  Delete
</button>
              </div>
            ))}
          </div>
        )}

        {active === "Market Prices" && (
  <div>
    <h2>Market Prices</h2>
    <p>এখানে পণ্যের বাজারদর ও বিক্রয়মূল্য দেখা যাবে।</p>

    <button onClick={loadProducts}>
      Refresh Prices
    </button>

    {products.map(product => (
      <div key={product.id} style={{
        background: "white",
        padding: 15,
        marginTop: 10,
        borderRadius: 10
      }}>
        <h3>{product.name}</h3>
        <p>বাজারদর: ৳{product.market_price} / {product.unit}</p>
        <p>BazarBondhu মূল্য: ৳{product.price} / {product.unit}</p>
      </div>
    ))}
  </div>
)}
{active === "Orders" && (
  <div>
    <h2>অর্ডার ম্যানেজমেন্ট</h2>

    <button onClick={loadOrders}>
      Refresh Orders
    </button>

    {orders.length === 0 ? (
      <p>এখনো কোনো অর্ডার পাওয়া যায়নি।</p>
    ) : (
      orders.map(order => (
        <div key={order.id} style={{
          background: "white",
          padding: 15,
          marginTop: 10,
          borderRadius: 10
        }}>
          <p>অর্ডার ID: {order.id}</p>
<p>অর্ডারের তারিখ: {new Date(order.created_at).toLocaleString("bn-BD")}</p>
          <h3>{order.customer_name}</h3>
          <p>ফোন: {order.phone}</p>
          <p>ঠিকানা: {order.delivery_address}</p>
          <h4>অর্ডারের পণ্য:</h4>

{orderItems
  .filter(item => item["orders id"] === order.id)
  .map(item => (
    <div key={item.id}>
      <p>পণ্যের নাম: {item["product name"]}</p>
      <p>পরিমাণ: {item.quantity}</p>
      <p>ইউনিট মূল্য: ৳{item["unit price"]}</p>
      <p>লাইন টোটাল: ৳{item["line total"]}</p>
    </div>
  ))}
  <p>সার্ভিস চার্জ: ৳{order.service_charge}</p>
<p>ডেলিভারি ফি: ৳{order.delivery_fee}</p>
          <p>মোট বিল: ৳{order.total}</p>
          <p>অর্ডার স্ট্যাটাস:</p>
          {order.cancel_reason && (
  <p style={{ color: "#dc3545" }}>
    বাতিলের কারণ: {order.cancel_reason}
  </p>
)}

<select
  value={order.order_status || "pending"}
  onChange={(e) =>
    updateOrderStatus(order.id, e.target.value)
  }
>
  <option value="pending">Pending</option>
<option value="confirmed">Confirmed</option>
<option value="processing">Processing</option>
<option value="delivered">Delivered</option>
<option value="cancelled">Cancelled</option>
</select>
          <p>পেমেন্ট: {order.payment_method}</p>
          <p>পেমেন্ট স্ট্যাটাস: {order.payment_status}</p>
          <select
  value={order.payment_status || "pending"}
  onChange={(e) =>
    updatePaymentStatus(order.id, e.target.value)
  }
>
  <option value="pending">Pending</option>
  <option value="paid">Paid</option>
  <option value="refunded">Refunded</option>
</select>
        </div>
      ))
    )}
  </div>
)}
{active === "Customers" && (
  <div>
    <h2>কাস্টমার তালিকা</h2>
    {customers.length === 0 ? (
      <p>এখনো কোনো কাস্টমার পাওয়া যায়নি।</p>
    ) : (
      customers.map(customer => (
        <div key={customer.id}>
          <h3>{customer["full name"]}</h3>
          <p>ফোন: {customer.phone}</p>
        </div>
      ))
    )}
  </div>
)}
{active === "Settings" && (
  <div>
    <h2>সেটিংস</h2>
    <p>BazarBondhu অ্যাপের সেটিংস এখানে নিয়ন্ত্রণ করতে পারবেন।</p>
    <div style={{ marginTop: 20 }}>
  <label>সার্ভিস চার্জ (৳)</label>
  <input
    type="number"
    value={serviceCharge}
    onChange={e => setServiceCharge(e.target.value)}
    style={{ display: "block", padding: 10, margin: "10px 0" }}
  />

  <label>ডেলিভারি ফি (৳)</label>
  <input
    type="number"
    value={deliveryFee}
    onChange={e => setDeliveryFee(e.target.value)}
    style={{ display: "block", padding: 10, margin: "10px 0" }}
  />
</div>
<button
  onClick={saveSettings}
  style={{
    background: "#2563eb",
    color: "white",
    padding: "12px 25px",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 15
  }}
>
  💾 সেটিংস সেভ করুন
</button>
  </div>
)}
      </main>
    </div>
  );
}

export default App;