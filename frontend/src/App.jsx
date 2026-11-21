import { useCallback, useEffect, useMemo, useState } from "react";
import { restaurantContent } from "./restaurantContent.js";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Archive,
  BadgeCheck,
  Bell,
  BellRing,
  Check,
  ChefHat,
  ChevronDown,
  Clock3,
  Coffee,
  CreditCard,
  Flame,
  Leaf,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  Utensils,
  Wallet,
  X,
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const ORDER_IDS_KEY = "tt-order-ids";
const FINAL_ORDER_STATUSES = new Set(["all_done", "served", "delivered", "cancelled"]);
const orderStatusLabel = (status) => ({
  all_done: "ALL DONE",
  prepared: "Food prepared",
  ready: "Ready to serve",
  unavailable: "Not available",
}[status] || String(status || "pending").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()));
const readTrackedOrderIds = () => {
  try {
    const ids = JSON.parse(sessionStorage.getItem(ORDER_IDS_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch { return []; }
};
const UPI_ID = import.meta.env.VITE_UPI_ID;
const UPI_NAME = import.meta.env.VITE_UPI_NAME;
const money = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(amount || 0),
  );
const img = (source, width = 720) =>
  /^https?:\/\//i.test(source) ? source : `https://images.unsplash.com/${source}?auto=format&fit=crop&w=${width}&q=82`;
const fallbackMenu = [
  {
    id: 1,
    name: "Burrata & heirloom tomato",
    description: "Creamy burrata, ripe tomato, basil oil, toasted sourdough.",
    price: 385,
    category: "Small plates",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1512621776951-a57141f2eefd"),
  },
  {
    id: 2,
    name: "Truffle parmesan fries",
    description: "Crisp shoestring fries, shaved parmesan, truffle aioli.",
    price: 245,
    category: "Small plates",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1573080496219-bb080dd4f877"),
  },
  {
    id: 3,
    name: "Wild mushroom toast",
    description: "Sourdough, whipped ricotta, thyme, wild mushrooms.",
    price: 325,
    category: "Small plates",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1525351484163-7529414344d8"),
  },
  {
    id: 4,
    name: "Sunday roast chicken",
    description: "Herb roasted chicken, lemon jus, buttered greens.",
    price: 565,
    category: "From the kitchen",
    is_veg: false,
    is_available: true,
    image_url: img("photo-1532550907401-a500c9a57435"),
  },
  {
    id: 5,
    name: "Creamy tomato rigatoni",
    description: "Slow-cooked tomato, cream, basil, aged parmesan.",
    price: 425,
    category: "From the kitchen",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1473093295043-cdd812d0e601"),
  },
  {
    id: 6,
    name: "Crispy tofu grain bowl",
    description: "Ginger sesame tofu, brown rice, crunchy greens.",
    price: 395,
    category: "From the kitchen",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1511690743698-d9d85f2fbf38"),
  },
  {
    id: 7,
    name: "Pistachio tiramisu",
    description: "Espresso-soaked layers, mascarpone, toasted pistachio.",
    price: 275,
    category: "Something sweet",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1571877227200-a0d98ea607e9"),
  },
  {
    id: 8,
    name: "Basque cheesecake",
    description: "Caramelised top, soft centre, seasonal berry compote.",
    price: 295,
    category: "Something sweet",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1533134242443-d4fd215305ad"),
  },
  {
    id: 9,
    name: "House iced latte",
    description: "Double espresso, oat or dairy milk, a little sweetness.",
    price: 195,
    category: "Coffee & drinks",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1461023058943-07fcbe16d735"),
  },
  {
    id: 10,
    name: "Citrus garden spritz",
    description: "Orange, rosemary, sparkling water, served over ice.",
    price: 185,
    category: "Coffee & drinks",
    is_veg: true,
    is_available: true,
    image_url: img("photo-1513558161293-cdaf765edfd7"),
  },
];

function IconButton({ children, onClick, className = "", ...props }) {
  return (
    <button className={`icon-button ${className}`} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
function Brand({ small = false, name = restaurantContent.restaurantName }) {
  return (
    <a className={`brand ${small ? "brand-small" : ""}`} href="#top">
      <span className="brand-mark">
        {restaurantContent.logoUrl ? <img src={restaurantContent.logoUrl} alt={restaurantContent.logoAlt || `${name} logo`} /> : <Utensils size={18} />}
      </span>
      <span>
        {name}
        <small>{restaurantContent.brandTagline}</small>
      </span>
    </a>
  );
}

export default function App() {
  const [mode, setMode] = useState(
    location.pathname.startsWith("/kitchen") ? "kitchen" : location.pathname.startsWith("/admin") ? "admin" : "customer",
  );
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("tt-token"));
  const [menu, setMenu] = useState(fallbackMenu);
  const [settings, setSettings] = useState({
    restaurant_name: restaurantContent.restaurantName,
    tax_rate: 5,
    table_count: 24,
    upi_id: UPI_ID,
    upi_name: UPI_NAME,
  });
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(location.pathname.startsWith("/admin"));
  const [loginRole, setLoginRole] = useState("admin");
  const [adminTab, setAdminTab] = useState("Orders");
  const [orders, setOrders] = useState([]);
  const [waiterAlerts, setWaiterAlerts] = useState([]);
  const [toast, setToast] = useState("");
  const [incoming, setIncoming] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [table, setTable] = useState(
    new URLSearchParams(location.search).get("table") || "",
  );
  const [occupiedTables, setOccupiedTables] = useState([]);
  const [payment, setPayment] = useState("counter");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({ name: "", phone: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(() => readTrackedOrderIds().length > 0);
  const [trackedOrderIds, setTrackedOrderIds] = useState(readTrackedOrderIds);
  const [activeOrders, setActiveOrders] = useState([]);
  const [trackingIssue, setTrackingIssue] = useState("");
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [recoveryDetails, setRecoveryDetails] = useState({ name: "", phone: "" });
  const [orderLookup, setOrderLookup] = useState(null);
  const [recoveredOrders, setRecoveredOrders] = useState([]);
  const [recoveringOrders, setRecoveringOrders] = useState(false);
  const [reviewingOrderId, setReviewingOrderId] = useState("");
  const isAdmin = user?.role === "admin";
  const isDashboardUser = isAdmin || user?.role === "staff";

  useEffect(() => {
    localStorage.removeItem("tt-last-order");
    localStorage.removeItem("tt-order-token");
    localStorage.removeItem("tt-user");
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      credentials: "include",
      cache: options.cache || "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Error(data.error || "Something went wrong");
      error.status = response.status;
      throw error;
    }
    return data;
  }, [token]);
  const searchOrders = useCallback((query) => request(`/api/admin/orders?search=${encodeURIComponent(query)}`), [request]);
  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => {
    document.title = `${settings.restaurant_name} — TableTap`;
  }, [settings.restaurant_name]);
  useEffect(() => {
    if (!confirmationOpen || !confirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [confirmationOpen, confirmation]);
  useEffect(() => {
    if (mode === "kitchen" || (mode === "admin" && isDashboardUser)) return;
    let alive = true;
    const refreshMenu = () => request("/api/public/menu")
        .then((data) => {
          if (!alive) return;
          if (data.menu?.length) setMenu(data.menu);
          if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
          setOccupiedTables(data.occupied_tables || []);
        })
        .catch(() => {});
    refreshMenu();
    const poll = window.setInterval(refreshMenu, 5000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [mode, isDashboardUser]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    request("/api/auth/me")
      .then((data) => {
        if (!active) return;
        setUser(data.user);
        if (data.user.role !== "admin") localStorage.removeItem("tt-token");
      }).catch((error) => {
        if (!active) return;
        // Only a 401 means the token is invalid. Network and server errors are
        // temporary and should not sign a restaurant owner out.
        if (error.status === 401) {
          localStorage.removeItem("tt-token");
          setToken(null);
          setUser(null);
          setAuthOpen(true);
        }
      });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (!isDashboardUser || mode !== "admin" || !token) return;
    let alive = true;
    let previousOrderIds = null;
    const loadWaiterAlerts = () => request("/api/admin/waiter-alerts")
      .then((data) => { if (alive) setWaiterAlerts(data.alerts || []); })
      .catch(() => {});
    const load = () =>
      request("/api/admin/orders")
        .then((data) => {
          if (!alive) return;
          const latestOrders = data.orders || [];
          if (previousOrderIds) {
            const newOrder = latestOrders.find((order) => !previousOrderIds.has(String(order.id)));
            if (newOrder) {
              setIncoming(newOrder);
              if ("Notification" in window && Notification.permission === "granted") {
                const notice = new Notification("New order · Table " + newOrder.table_number, {
                  body: newOrder.customer_name + " · " + (newOrder.items?.length || 0) + " items · " + money(newOrder.total),
                  tag: String(newOrder.id),
                });
                notice.onclick = () => window.focus();
              }
            }
          }
          previousOrderIds = new Set(latestOrders.map((order) => String(order.id)));
          setOrders(latestOrders);
          setIncoming((current) => current ? latestOrders.find((order) => order.id === current.id) || current : null);
        })
        .catch((e) => { if (alive) notify(e.message); });
    load();
    loadWaiterAlerts();
    request("/api/admin/menu")
      .then((data) => {
        if (alive) setMenu(data.menu || []);
      })
      .catch((e) => notify(e.message));
    request("/api/public/menu").then((data) => {
      if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
    });
    const poll = window.setInterval(() => { load(); loadWaiterAlerts(); }, 2000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [isDashboardUser, mode, token]);
  const categories = useMemo(
    () => [
      "All",
      ...new Set(menu.map((item) => item.category).filter(Boolean)),
    ],
    [menu],
  );
  const filtered = menu.filter(
    (item) =>
      (activeCategory === "All" || item.category === activeCategory) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const cartItems = menu
    .filter((item) => cart[item.id])
    .map((item) => ({ ...item, quantity: cart[item.id] }));
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const tax = (subtotal * Number(settings.tax_rate || 0)) / 100;
  const add = (id, delta = 1) =>
    setCart((value) => {
      const count = (value[id] || 0) + delta;
      const next = { ...value };
      if (count <= 0) delete next[id];
      else next[id] = count;
      return next;
    });
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("tt-token");
    setMode(location.pathname.startsWith("/kitchen") ? "kitchen" : "customer");
    setOrders([]);
  };
  const login = async (credentials, role) => {
    if ((role === "admin" || role === "staff") && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    const data = await request(
      `/api/auth/${role === "admin" ? "admin" : role === "staff" ? "staff" : role === "kitchen" ? "kitchen" : "customer"}/login`,
      { method: "POST", body: JSON.stringify(credentials) },
    );
    if (role === "staff") {
      localStorage.removeItem("tt-token");
    } else {
      localStorage.setItem("tt-token", data.token);
    }
    setToken(data.token);
    setUser(data.user);
    setAuthOpen(false);
    setMode(role === "kitchen" ? "kitchen" : role === "admin" || role === "staff" ? "admin" : "customer");
    notify(`Welcome, ${data.user.name}`);
  };
  const ensureRazorpayLoaded = () => new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing?.dataset.loaded === 'true') return resolve();
    if (existing?.dataset.failed === 'true') existing.remove();
    const activeScript = document.querySelector('script[data-razorpay-checkout]');
    if (activeScript) {
      activeScript.addEventListener('load', resolve, { once: true });
      activeScript.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => {
      script.dataset.failed = 'true';
      reject(new Error('Razorpay Checkout could not load. Check your connection and retry.'));
    };
    document.body.appendChild(script);
  });

  const openRazorpayCheckout = async (provider, order) => {
    await ensureRazorpayLoaded();
    const checkout = new window.Razorpay({
      key: provider.key_id,
      amount: provider.amount,
      currency: provider.currency,
      name: settings.restaurant_name,
      description: `Table ${order.table_number} · Order ${order.id.slice(0, 8).toUpperCase()}`,
      order_id: provider.order_id,
      prefill: {
        name: order.customer_name,
        contact: order.customer_phone|| undefined,
        
      },
      notes: { tabletap_order_id: order.id },
      theme: { color: '#263f3b' },
      handler: async (result) => {
        setPaymentNotice('Payment received by Razorpay. Confirming your order…');
        try {
          const verified = await request('/api/payments/razorpay/verify', {
            method: 'POST',
            body: JSON.stringify({
              order_id: order.id,
              razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
            }),
          });
          setConfirmation(verified.order);
          setConfirmationOpen(true);
          setPaymentNotice(verified.payment_confirmed
            ? 'Payment confirmed automatically by Razorpay.'
            : 'Razorpay is finalizing the payment. This order view will update automatically.');
        } catch (error) {
          setPaymentNotice('We are checking payment status with Razorpay. Keep this order view open; it will update automatically.');
          if (error.status === 404) {
            setTrackingIssue("Your order is saved, but its live connection could not be restored. Confirm with your checkout name and phone in My orders.");
            setConfirmationOpen(false);
            setRecoveryDetails({ name: customerDetails.name, phone: customerDetails.phone });
            notify("Payment returned, but order status needs reconnecting");
          } else notify(error.message);
        }
      },
      modal: {
        ondismiss: () => setPaymentNotice('Payment was not completed. Your order is saved; you can retry payment here.'),
      },
    });
    checkout.on('payment.failed', () => {
      setPaymentNotice('Payment was not completed. You can retry; if money was deducted, keep this order open while Razorpay confirms it.');
    });
    checkout.open();
  };

  const retryOnlinePayment = async () => {
    if (!confirmation?.id || confirmation.payment_status === 'paid') return;
    try {
      const data = await request('/api/payments/razorpay/session', {
        method: 'POST',
        body: JSON.stringify({ order_id: confirmation.id }),
      });
      await openRazorpayCheckout(data.razorpay, confirmation);
    } catch (error) {
      setPaymentNotice(error.message);
      notify(error.message);
    }
  };

  const createOrder = async () => {
    if (!table) {
      notify('Choose your table number first');
      return;
    }
    const phone = customerDetails.phone.trim();
    if (!customerDetails.name.trim() || !phone) {
      notify('Enter your name and phone number');
      return;
    }
    if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
      notify('Enter a valid phone number');
      return;
    }
    if (occupiedTables.includes(Number(table))) {
      notify(`Table ${table} is already occupied. Choose another table.`);
      setTable("");
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_number: Number(table),
          payment_method: payment,
          customer: { ...customerDetails, phone },
          items: cartItems.map(({ id, quantity }) => ({ menu_item_id: id, quantity })),
        }),
      });
      setCart({});
      setCartOpen(false);
      setCheckout(false);
      setConfirmation(data.order);
      setConfirmationOpen(true);
      setTrackingIssue("");
      setPaymentNotice('');
      const nextIds = [data.order.id, ...trackedOrderIds.filter((id) => id !== data.order.id)];
      sessionStorage.setItem(ORDER_IDS_KEY, JSON.stringify(nextIds));
      setTrackedOrderIds(nextIds);
      if (payment === 'online') await openRazorpayCheckout(data.razorpay, data.order);
    } catch (error) {
      if (error.message.includes("already occupied")) {
        setTable("");
        request("/api/public/menu").then((data) => setOccupiedTables(data.occupied_tables || []));
      }
      notify(error.message);
    } finally {
      setLoading(false);
    }
  };

  const recoverOrders = async (event) => {
    event.preventDefault();
    const details = {
      name: recoveryDetails.name.trim(),
      phone: recoveryDetails.phone.trim(),
    };
    setRecoveringOrders(true);
    try {
      const data = await request("/api/orders/recover", {
        method: "POST",
        body: JSON.stringify(details),
      });
      setOrderLookup(details);
      setRecoveredOrders(data.orders || []);
    } catch (error) {
      notify(error.message);
    } finally {
      setRecoveringOrders(false);
    }
  };

  const callWaiter = async (order) => {
    if (!order?.id || order.waiter_alert_open) return;
    try {
      await request(`/api/orders/${order.id}/waiter-alert`, { method: "POST", body: JSON.stringify({}) });
      setConfirmation((current) => current?.id === order.id ? { ...current, waiter_alert_open: true } : current);
      setActiveOrders((current) => current.map((item) => item.id === order.id ? { ...item, waiter_alert_open: true } : item));
      notify(`Waiter called for table ${order.table_number}`);
    } catch (error) { notify(error.message); }
  };

  const submitReview = async (orderId, rating) => {
    setReviewingOrderId(orderId);
    try {
      const data = await request(`/api/orders/${orderId}/review`, {
        method: "POST",
        body: JSON.stringify({ ...recoveryDetails, rating }),
      });
      setRecoveredOrders((current) => current.map((order) => order.id === orderId ? { ...order, rating: data.rating } : order));
      notify("Thanks for rating your meal");
    } catch (error) { notify(error.message); }
    finally { setReviewingOrderId(""); }
  };

  const sendToKitchen = async (orderId) => {
    try {
      const data = await request(`/api/admin/orders/${orderId}/send-to-kitchen`, { method: "POST", body: JSON.stringify({}) });
      setOrders((current) => current.map((order) => order.id === orderId ? data.order : order));
      setIncoming((current) => current?.id === orderId ? data.order : current);
      notify("Order sent to kitchen display");
    } catch (error) { notify(error.message); }
  };

  const createManualOrder = async (details) => {
    const data = await request("/api/admin/orders/manual", { method: "POST", body: JSON.stringify(details) });
    setOrders((current) => [data.order, ...current.filter((order) => order.id !== data.order.id)]);
    notify(`Order for table ${data.order.table_number} sent to the kitchen`);
    return data.order;
  };

  const acknowledgeWaiterAlert = async (alertId) => {
    try {
      await request(`/api/admin/waiter-alerts/${alertId}/acknowledge`, { method: "PATCH", body: JSON.stringify({}) });
      setWaiterAlerts((current) => current.filter((alert) => String(alert.id) !== String(alertId)));
      notify("Waiter alert acknowledged");
    } catch (error) { notify(error.message); }
  };

  useEffect(() => {
    sessionStorage.setItem(ORDER_IDS_KEY, JSON.stringify(trackedOrderIds));
    if (!trackedOrderIds.length) {
      setConfirmation(null);
      setActiveOrders([]);
      return;
    }
    let active = true;
    const refresh = async () => {
      const results = await Promise.all(trackedOrderIds.map(async (id) => {
        try { return { id, order: (await request(`/api/orders/${id}/status`)).order }; }
        catch (error) { return { id, order: null, status: error.status }; }
      }));
      if (!active) return;
      const liveOrders = results.map((result) => result.order).filter((order) => order && !FINAL_ORDER_STATUSES.has(order.status));
      setActiveOrders(liveOrders);
      const failedChecks = results.some((result) => !result.order);
      const missingIds = results.filter((result) => result.status === 404).map((result) => result.id);
      const sessionMissing = missingIds.length > 0;
      if (sessionMissing) setTrackedOrderIds((ids) => ids.filter((id) => !missingIds.includes(id)));
      setTrackingIssue(failedChecks ? sessionMissing
        ? "This order could not reconnect in this browser. Use My orders with your checkout name and phone to find it."
        : "Order updates are temporarily unavailable. Your order will keep reconnecting in this browser session."
        : "");
      const finishedIds = results.map((result) => result.order).filter((order) => order && FINAL_ORDER_STATUSES.has(order.status)).map((order) => order.id);
      if (finishedIds.length) setTrackedOrderIds((ids) => ids.filter((id) => !finishedIds.includes(id)));
      const currentOrder = liveOrders.find((order) => order.id === confirmation?.id) || liveOrders[0] || null;
      const currentOrderWasLost = confirmation?.id && missingIds.includes(confirmation.id);
      setConfirmation(currentOrder || (failedChecks && !currentOrderWasLost ? confirmation : null));
      if (!currentOrder && (finishedIds.length || currentOrderWasLost)) setConfirmationOpen(false);
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [trackedOrderIds, confirmation?.id]);

  const dismissTrackedOrders = () => {
    sessionStorage.removeItem(ORDER_IDS_KEY);
    setTrackedOrderIds([]);
    setActiveOrders([]);
    setConfirmation(null);
    setTrackingIssue("");
    setConfirmationOpen(false);
  };

  const openRecoveredOrder = (order) => {
    const nextIds = [order.id, ...trackedOrderIds.filter((id) => id !== order.id)];
    sessionStorage.setItem(ORDER_IDS_KEY, JSON.stringify(nextIds));
    setTrackedOrderIds(nextIds);
    setConfirmation(order);
    setTrackingIssue("");
    setMyOrdersOpen(false);
    setConfirmationOpen(true);
  };

  const printBill = (order) => {
    if (!order || order.payment_status !== "paid") return;
    const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
    const rows = (order.items || []).map((item) => `<tr><td>${Number(item.quantity)} × ${safe(item.name)}</td><td>${money(item.line_total)}</td></tr>`).join("");
    const bill = window.open("", "_blank", "width=720,height=800");
    if (!bill) { notify("Allow pop-ups to print your bill."); return; }
    bill.opener = null;
    bill.document.write(`<!doctype html><html><head><title>Bill ${order.id.slice(0,8)}</title><style>body{font:16px Arial,sans-serif;max-width:640px;margin:50px auto;color:#172744}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:12px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}.total{font-size:20px;font-weight:bold}.muted{color:#64748b}</style></head><body><h1>${safe(settings.restaurant_name)}</h1><p class="muted">Order bill · Table ${Number(order.table_number)}</p><p>Order ID: ${safe(order.id)}</p><p>Customer: ${safe(order.customer_name)}</p><p>${safe(order.customer_email || order.customer_phone || "")}</p><p>${new Date(order.created_at).toLocaleString()}</p><table>${rows}<tr><td>Tax (${order.tax_rate}%)</td><td>${money(order.tax_amount)}</td></tr><tr class="total"><td>Total · PAID</td><td>${money(order.total)}</td></tr></table><p class="muted">Thank you for dining with ${safe(settings.restaurant_name)}.</p><script>window.onload=()=>window.print()</script></body></html>`);
    bill.document.close();
  };
  const updateOrder = async (id, changes) => {
    try {
      const { order } = await request(`/api/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setOrders((current) =>
        current.map((item) => (item.id === id ? order : item)),
      );
      setIncoming((current) => (current?.id === id ? null : current));
      notify("Order updated");
    } catch (e) {
      notify(e.message);
    }
  };
  const updateMenu = async (item) => {
    try {
      const data = await request(`/api/admin/menu/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(item),
      });
      setMenu((current) =>
        current.map((entry) => (entry.id === item.id ? data.item : entry)),
      );
    } catch (e) {
      notify(e.message);
    }
  };
  const createMenuItem = async (item) => {
    const data = await request("/api/admin/menu", {
      method: "POST",
      body: JSON.stringify(item),
    });
    setMenu((current) => [...current, data.item]);
    notify("Menu item added");
  };
  const updateSettings = async (changes) => {
    try {
      const data = await request("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setSettings((s) => ({ ...s, ...data.settings }));
      notify("Restaurant settings saved");
    } catch (e) {
      notify(e.message);
    }
  };

  if (mode === "kitchen" && user?.role === "kitchen") return <KitchenDisplay user={user} logout={logout} request={request} menu={menu} setMenu={setMenu} notify={notify} />;
  if (mode === "kitchen") return <KitchenLogin restaurantName={settings.restaurant_name} onLogin={(credentials) => login(credentials, "kitchen")} onBack={() => { history.pushState({}, "", "/"); setMode("customer"); }} />;
  if (mode === "admin" && isDashboardUser)
    return (
      <AdminApp
        {...{
          user,
          logout,
          orders,
          adminTab,
          setAdminTab,
          updateOrder,
          menu,
          updateMenu,
          createMenuItem,
          settings,
          updateSettings,
          notify,
          incoming,
          setIncoming,
          printBill,
           searchOrders,
          waiterAlerts,
          acknowledgeWaiterAlert,
          sendToKitchen,
          createManualOrder,
          createStaff: async (staff) => {
            const result = await request("/api/admin/staff", { method: "POST", body: JSON.stringify(staff) });
            notify(`Staff account created for ${result.user.name}`);
          },
        }}
      />
    );
  return (
    <div className="customer-app" id="top">
      <header className="topbar">
        <Brand name={settings.restaurant_name} />
        <nav className="nav-links">
          <a href="#menu">Menu</a>
          <a href="#story">Our kitchen</a>
          <a href="#visit">Visit</a>
        </nav>
        <div className="top-actions">
          <span className="open-pill">
            <i /> {restaurantContent.openingHours}
          </span>
          <button
            className="icon-button order-login-trigger"
            aria-label={`My orders${trackedOrderIds.length ? `, ${trackedOrderIds.length} active order updates` : ""}`}
            title="My orders"
            onClick={() => setMyOrdersOpen(true)}
          >
            <ShoppingBag size={19} />
            {trackedOrderIds.length > 0 && <span className="bag-order-badge" aria-hidden="true">{trackedOrderIds.length}</span>}
          </button>
        </div>
      </header>
      <main>
        <section className="hero-wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} /> {restaurantContent.heroEyebrow}
            </div>
            <h1>
              {restaurantContent.heroTitle} <em>{restaurantContent.heroTitleAccent}</em>
            </h1>
            <p>
              {restaurantContent.heroDescription}
            </p>
            <div className="hero-table-select">
              <label htmlFor="hero-table">START WITH YOUR TABLE</label>
              <select
                id="hero-table"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              >
                <option value="">Choose a table number</option>
                {Array.from(
                  { length: Number(settings.table_count) || 24 },
                  (_, i) => (
                    <option key={i + 1} value={i + 1} disabled={occupiedTables.includes(i + 1)}>
                      Table {i + 1}{occupiedTables.includes(i + 1) ? " · Occupied" : " · Available"}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="hero-buttons">
              <a className="button button-dark" href="#menu">
                Explore the menu <ArrowDown size={16} />
              </a>
              <span>
                <span className="avatars">J&nbsp; M&nbsp; A</span> A local
                favourite, made fresh daily
              </span>
            </div>
            <div className="hero-notes">
              <span>
                <Leaf size={15} /> Seasonal ingredients
              </span>
              <span>
                <Coffee size={15} /> Made with care
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src={img(restaurantContent.heroPhoto, 1400)}
              alt="A warm restaurant table set for dinner"
            />
            <div className="hero-caption">
              <span className="caption-icon">
                <Flame size={16} />
              </span>
              <span>
                <b>Good things are cooking</b>
                <small>Fresh from our kitchen today</small>
              </span>
              <ArrowRight size={17} />
            </div>
            <div className="photo-tag">
              A LITTLE CORNER OF COMFORT <span>✳</span>
            </div>
          </div>
          <div className="hero-index">
            01 <i /> 04
          </div>
        </section>
        <section className="order-strip">
          <div>
            <span className="strip-icon">
              <QrCode size={19} />
            </span>
            <span>
              <b>At your own pace</b>
              <small>Order whenever you’re ready</small>
            </span>
          </div>
          <div>
            <span className="strip-icon">
              <Utensils size={19} />
            </span>
            <span>
              <b>Made to order</b>
              <small>Fresh food, straight to your table</small>
            </span>
          </div>
          <div>
            <span className="strip-icon">
              <Wallet size={19} />
            </span>
            <span>
              <b>Pay your way</b>
              <small>UPI online or at the counter</small>
            </span>
          </div>
          <span className="strip-spark">✳</span>
        </section>
        <section className="menu-section" id="menu">
          <div className="section-kicker">THE GOOD STUFF</div>
          <div className="menu-heading">
            <div>
              <h2>
                A menu worth
                <br />
                <em>staying for.</em>
              </h2>
            </div>
            <p>
              Made from scratch, with ingredients we love.
              <br />
              Let your appetite lead the way.
            </p>
          </div>
          <div className="menu-tools">
            <div className="category-tabs">
              {categories.map((category) => (
                <button
                  key={category}
                  className={category === activeCategory ? "active" : ""}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <input
              className="menu-search"
              placeholder="Find something delicious..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="menu-grid">
            {filtered.map((item) => (
              <article className="dish-card" key={item.id}>
                <div className="dish-photo">
                  <img
                    src={item.image_url || img("photo-1547592180-85f173990554")}
                    alt={item.name}
                  />
                  <span className="dish-category">{item.category}</span>
                  <span className={`veg-mark ${item.is_veg ? "" : "nonveg"}`} />
                </div>
                <div className="dish-info">
                  <div>
                    <h3>{item.name}</h3>
                    <span>{money(item.price)}</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="dish-order-control">
                    {cart[item.id] ? (
                      <div className="quantity-control">
                        <button onClick={() => add(item.id, -1)} aria-label={`Remove one ${item.name}`}>
                          <Minus size={15} />
                        </button>
                        <b>{cart[item.id]}</b>
                        <button onClick={() => add(item.id)} aria-label={`Add one ${item.name}`}>
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button className="add-dish" onClick={() => add(item.id)} aria-label={`Add ${item.name}`}>
                        Order Now <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-menu">
              No dishes found. Try another search.
            </div>
          )}
          <div className="menu-bottom">
            <span>Good food takes time. We make it worth the wait.</span>
            <span>ALL PRICES IN INR · TAX CALCULATED AT CHECKOUT</span>
          </div>
        </section>
        <section className="story-section" id="story">
          <div className="story-image">
            <img
              src={img(restaurantContent.storyPhoto, 1100)}
              alt={restaurantContent.storyPhotoAlt}
            />
            <div className="story-stamp">
              <span>MADE WITH</span>
              <b>♥</b>
              <span>INTENTION</span>
            </div>
          </div>
          <div className="story-copy">
            <div className="section-kicker">A TABLE FOR EVERYONE</div>
            <h2>
              Good food.
              <br />
              <em>Easy does it.</em>
            </h2>
            <p>
              {restaurantContent.storyDescription}
            </p>
            <a className="text-link" href="#visit">
              A little more about us <ArrowRight size={17} />
            </a>
            <div className="quote-mark">“</div>
            <blockquote>
              Our kind of place is the one where you always order one more thing
              for the table.
            </blockquote>
            <small>— THE GREEN TABLE WAY</small>
          </div>
        </section>
        <section className="visit-section" id="visit">
          <div className="visit-info">
            <div className="section-kicker">COME AS YOU ARE</div>
            <h2>
              Your table
              <br />
              <em>is waiting.</em>
            </h2>
            <p>
              {restaurantContent.visitDescription}
            </p>
            <div className="visit-details">
              <span>
                <Clock3 size={17} /> {restaurantContent.openingHours}
              </span>
              <span>
                <Smartphone size={17} /> {restaurantContent.phone}
              </span>
              <span>
                <Leaf size={17} /> {restaurantContent.address}
              </span>
            </div>
            <button
              className="button button-light"
              onClick={() => {
                document
                  .getElementById("menu")
                  .scrollIntoView({ behavior: "smooth" });
              }}
            >
              Find your favourite <ArrowRight size={16} />
            </button>
          </div>
          <div className="visit-photo">
            <img
              src={img(restaurantContent.visitPhoto, 1100)}
              alt={restaurantContent.visitPhotoAlt}
            />
            <div>
              {restaurantContent.visitStamp}
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-intro">
              <div className="section-kicker">{restaurantContent.brandTagline}</div>
              <h2>{restaurantContent.footerHeadline}</h2>
              <p>{restaurantContent.footerMessage}</p>
              <button className="footer-reserve" onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}>
                {restaurantContent.footerReservationLabel} <ArrowRight size={16} />
              </button>
            </div>
            <div className="footer-contact">
              <div><MapPin size={19} /><span><b>{restaurantContent.footerAddressLabel}</b><small>{restaurantContent.address}</small></span></div>
              <div><Smartphone size={19} /><span><b>{restaurantContent.footerPhoneLabel}</b><small>{restaurantContent.phone}</small></span></div>
            </div>
          </div>
          <div className="footer-bottom">
            <Brand small name={settings.restaurant_name} />
            <div className="footer-social-links">
              <a href={restaurantContent.footerInstagramUrl} aria-label={restaurantContent.footerInstagramLabel}>{restaurantContent.footerInstagramLabel}</a>
              <a href={restaurantContent.footerFacebookUrl} aria-label={restaurantContent.footerFacebookLabel}>{restaurantContent.footerFacebookLabel}</a>
              <a href={restaurantContent.footerTwitterUrl} aria-label={restaurantContent.footerTwitterLabel}>{restaurantContent.footerTwitterLabel}</a>
            </div>
            <span>{restaurantContent.footerCopyrightLabel.replace("{year}", String(new Date().getFullYear())).replace("{restaurantName}", settings.restaurant_name)} · {restaurantContent.footerCreditLabel}</span>
            <div className="footer-login-links">
              <button className="admin-link footer-admin-link" onClick={() => { setLoginRole("admin"); setMode("admin"); setAuthOpen(true); history.pushState({}, "", "/admin"); }}>{restaurantContent.footerAdminLabel} <ArrowRight size={14} /></button>
              <button className="admin-link footer-admin-link" onClick={() => { setLoginRole("staff"); setMode("admin"); setAuthOpen(true); history.pushState({}, "", "/admin"); }}>{restaurantContent.footerStaffLabel} <ArrowRight size={14} /></button>
              <button className="admin-link footer-admin-link" onClick={() => { setMode("kitchen"); history.pushState({}, "", "/kitchen"); }}>{restaurantContent.footerKitchenLabel} <ChefHat size={14} /></button>
            </div>
          </div>
        </div>
      </footer>
      {cartItems.length > 0 && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <span>
            <ShoppingBag size={18} />
            {cartItems.reduce((n, i) => n + i.quantity, 0)} items
          </span>
          <b>
            View your order · {money(subtotal + tax)} <ArrowRight size={17} />
          </b>
        </button>
      )}
      {cartOpen && (
        <div
          className="overlay"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setCartOpen(false)
          }
        >
          <aside className="side-drawer">
            <div className="drawer-header">
              <div>
                <div className="section-kicker">YOUR TABLE, YOUR ORDER</div>
                <h2>{checkout ? "Almost there." : "Your order."}</h2>
              </div>
              <IconButton onClick={() => setCartOpen(false)}>
                <X />
              </IconButton>
            </div>
            {!checkout ? (
              <>
                <div className="table-select">
                  <label>YOUR TABLE</label>
                  <select
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                  >
                    <option value="">Choose table number</option>
                    {Array.from(
                      { length: Number(settings.table_count) || 24 },
                      (_, i) => (
                        <option key={i + 1} value={i + 1} disabled={occupiedTables.includes(i + 1)}>
                          Table {i + 1}{occupiedTables.includes(i + 1) ? " · Occupied" : " · Available"}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="drawer-items">
                  {cartItems.length ? (
                    cartItems.map((item) => (
                      <div className="drawer-item" key={item.id}>
                        <img src={item.image_url} alt="" />
                        <div>
                          <b>{item.name}</b>
                          <small>{money(item.price)} each</small>
                          <div className="mini-quantity">
                            <button onClick={() => add(item.id, -1)}>
                              <Minus size={13} />
                            </button>
                            {item.quantity}
                            <button onClick={() => add(item.id)}>
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <strong>{money(item.price * item.quantity)}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="drawer-empty">
                      <ShoppingBag size={28} />
                      <b>Your table is waiting.</b>
                      <span>Add a few favourites from our menu.</span>
                      <button onClick={() => setCartOpen(false)}>
                        Back to menu <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {cartItems.length > 0 && (
                  <div className="drawer-bottom">
                    <div className="bill-line">
                      <span>Subtotal</span>
                      <b>{money(subtotal)}</b>
                    </div>
                    <div className="bill-line">
                      <span>Tax ({settings.tax_rate}%)</span>
                      <b>{money(tax)}</b>
                    </div>
                    <div className="bill-line total">
                      <span>Total</span>
                      <b>{money(subtotal + tax)}</b>
                    </div>
                    <button
                      className="button button-dark full"
                      onClick={() => setCheckout(true)}
                    >
                      Continue to checkout{" "}
                      <ArrowRight size={16} />
                    </button>
                    <small className="drawer-note">
                      Your order is sent to our kitchen after the restaurant
                      confirms it.
                    </small>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  className="back-to-cart"
                  onClick={() => setCheckout(false)}
                >
                  <ArrowLeft size={15} /> Your items · {money(subtotal + tax)}
                </button>
                <div className="guest-checkout-form">
                  <div className="section-kicker">YOUR ORDER DETAILS</div>
                  <label>Full name<input autoComplete="name" required maxLength={120} value={customerDetails.name} onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })} placeholder="Name for your order" /></label>
                  <label>Phone number<input type="tel" required autoComplete="tel" value={customerDetails.phone} onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
                  <small>Your phone number is required for payment and order updates.</small>
                </div>
                <div className="payment-options">
                  <label>HOW WOULD YOU LIKE TO PAY?</label>
                  <button
                    className={payment === "counter" ? "selected" : ""}
                    onClick={() => setPayment("counter")}
                  >
                    <span className="pay-icon">
                      <Wallet />
                    </span>
                    <span>
                      <b>At the counter</b>
                      <small>Pay by cash, card or UPI when ready</small>
                    </span>
                    {payment === "counter" && <BadgeCheck size={19} />}
                  </button>
                  <button
                    className={payment === "online" ? "selected" : ""}
                    onClick={() => setPayment("online")}
                  >
                    <span className="pay-icon"><CreditCard /></span>
                    <span>
                      <b>UPI app or card</b>
                      <small>Secure payment through Razorpay Checkout</small>
                    </span>
                    {payment === "online" && <BadgeCheck size={19} />}
                  </button>
                </div>

                <div className="drawer-bottom">
                  <div className="bill-line total">
                    <span>Total to pay</span>
                    <b>{money(subtotal + tax)}</b>
                  </div>
                  <button
                    className="button button-dark full"
                    disabled={loading}
                    onClick={createOrder}
                  >
                    {loading ? "Starting checkout…" : payment === "online" ? "Continue to Razorpay" : "Place counter order"}{" "}
                    <ArrowRight size={16} />
                  </button>
                  <small className="drawer-note">
                    Your order number and private tracking link appear after placement.
                  </small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
      {authOpen && (
        <AuthModal
          onClose={() => { setAuthOpen(false); setMode("customer"); if (location.pathname.startsWith("/admin")) history.pushState({}, "", "/"); }}
          initialRole={mode === "admin" ? loginRole : "customer"}
          restaurantName={settings.restaurant_name}
          onLogin={login}
          onSwitchAdmin={() => {
            setMode("admin");
              setAuthOpen(true);
            history.pushState({}, "", "/admin");
          }}
        />
      )}
      {myOrdersOpen && (
        <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && setMyOrdersOpen(false)}>
          <section className="success-modal order-lookup-modal" role="dialog" aria-modal="true" aria-labelledby="order-lookup-title">
            <button className="modal-close" onClick={() => setMyOrdersOpen(false)} aria-label="Close my orders"><X size={18} /></button>
            <div className="section-kicker">ORDER LOOKUP</div>
            <h2 id="order-lookup-title">Find your <em>table order.</em></h2>
            <p>Enter the name and phone number used at checkout to see your past orders.</p>
            <section className="bag-active-orders" aria-live="polite">
              <h3>Live order updates <span>{trackedOrderIds.length}</span></h3>
              {trackedOrderIds.length ? activeOrders.length ? activeOrders.map((order) => <div className="bag-active-order" key={order.id}>
                <span><b>Order #{order.id.slice(0, 8).toUpperCase()}</b><small>Table {order.table_number} · Payment {order.payment_status}</small></span>
                <strong>{order.status === "all_done" ? "ALL DONE" : order.status}</strong>
                <button className="button button-outline" onClick={() => { setConfirmation(order); setMyOrdersOpen(false); setConfirmationOpen(true); }}>View live status</button>
              </div>) : trackingIssue ? <div className="tracking-reconnect" role="status"><p>{trackingIssue}</p>{confirmation && <button className="button button-outline" onClick={() => { setMyOrdersOpen(false); setConfirmationOpen(true); }}>Show last known order</button>}<button className="text-link" onClick={dismissTrackedOrders}>Dismiss tracking</button></div> : <p>Checking your order status…</p> : <p>No active orders in this browser session.</p>}
            </section>
            <form className="order-lookup-form" onSubmit={recoverOrders}>
              <label>Name<input autoComplete="name" required maxLength={120} value={recoveryDetails.name} onChange={(event) => setRecoveryDetails((value) => ({ ...value, name: event.target.value }))} /></label>
              <label>Phone number<input autoComplete="tel" inputMode="tel" required value={recoveryDetails.phone} onChange={(event) => setRecoveryDetails((value) => ({ ...value, phone: event.target.value }))} /></label>
              <button className="button button-dark full" disabled={recoveringOrders}>{recoveringOrders ? "Finding orders…" : "Find my orders"} <ArrowRight size={16} /></button>
            </form>
            {orderLookup && <div className="recovered-orders" aria-live="polite">
              <h3>Past orders <span>{recoveredOrders.length}</span></h3>
              {recoveredOrders.length ? recoveredOrders.map((order) => (
                <div className="recovered-order" key={order.id}>
                  <span><b>Order #{order.id.slice(0, 8).toUpperCase()}</b><small>Table {order.table_number} · {new Date(order.created_at).toLocaleString()}</small><small>{order.items?.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</small></span>
                  <strong>{order.status === "all_done" ? "ALL DONE" : order.status}</strong>
                  <b>{money(order.total)}</b>
                  <div className="history-order-actions">
                    {!FINAL_ORDER_STATUSES.has(order.status) && <button className="button button-outline view-live-order" onClick={() => openRecoveredOrder(order)}>View live updates <ArrowRight size={15} /></button>}
                    {order.payment_status === "paid" && <button className="button button-outline bill-download" onClick={() => printBill(order)}><ReceiptText size={15} /> Download / print bill</button>}
                    {order.rating ? <span className="review-thanks" aria-label={`Rated ${order.rating} out of 5`}>{Array.from({ length: order.rating }, (_, index) => <Star size={15} key={index} fill="currentColor" />)} <small>Your rating</small></span> : ["served", "all_done"].includes(order.status) && <div className="order-review" aria-label="Rate this meal">
                      <small>Rate this meal</small>
                      <div>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} disabled={reviewingOrderId === order.id} aria-label={`${rating} star${rating === 1 ? "" : "s"}`} onClick={() => submitReview(order.id, rating)}><Star size={20} /></button>)}</div>
                    </div>}
                  </div>
                </div>
              )) : <p>No orders found for those details.</p>}
            </div>}
          </section>
        </div>
      )}
      {confirmation && confirmationOpen && (
        <div className="overlay order-status-overlay">
          <div className="success-modal order-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="customer-order-title">
            <button className="modal-close" onClick={() => setConfirmationOpen(false)} aria-label="Close order status"><X size={18} /></button>
            <div className="success-check"><Check size={30} /></div>
            <div className="section-kicker">ORDER #{confirmation.id.slice(0, 8).toUpperCase()}</div>
            <h2 id="customer-order-title">Thanks, <em>{confirmation.customer_name.split(" ")[0]}.</em></h2>
            <p>Table {confirmation.table_number} · {new Date(confirmation.created_at).toLocaleString()}</p>
            <div className="tracking-panel"><span>LIVE ORDER STATUS</span><b className={`status status-${confirmation.status}`}>{orderStatusLabel(confirmation.status)}</b><small>{confirmation.status === "pending" ? "The restaurant will confirm your order shortly." : confirmation.status === "preparing" ? "The kitchen is preparing your order." : confirmation.status === "prepared" ? "Your food has been prepared." : confirmation.status === "unavailable" ? "The kitchen marked an item unavailable. Please speak with a staff member." : confirmation.status === "ready" ? "Your order is ready to serve." : confirmation.status === "served" ? "Enjoy your meal." : confirmation.status === "all_done" ? `Table ${confirmation.table_number} is free for the next customer.` : confirmation.status === "cancelled" ? "This order was cancelled. Contact the restaurant if you need help." : "Your order is being handled by the restaurant."}</small>{confirmation.prep_minutes && confirmation.prep_started_at && <PrepCountdown minutes={confirmation.prep_minutes} startedAt={confirmation.prep_started_at} status={confirmation.status} />}</div>
            {trackingIssue && <p className="tracking-issue" role="status">{trackingIssue}</p>}
            <div className="success-total">
              <span>{confirmation.payment_status === "paid" ? "PAYMENT CONFIRMED" : confirmation.payment_method === "counter" ? "PAY AT COUNTER" : "RAZORPAY PAYMENT"}</span>
              <b>{money(confirmation.total)}</b>
            </div>
            <div className={`payment-confirmation ${confirmation.payment_status === "paid" ? "is-paid" : "is-pending"}`} role="status">
              <b>{confirmation.payment_status === "paid" ? `Paid${confirmation.payment_method && confirmation.payment_method !== "counter" ? ` · ${confirmation.payment_method}` : ""}` : confirmation.payment_method === "counter" ? "Payment due at the counter" : "Waiting for Razorpay payment confirmation"}</b>
              <small>{confirmation.payment_status === "paid" ? "Your payment was verified. The restaurant dashboard has been updated." : confirmation.payment_method === "counter" ? "Pay by cash, card or UPI at the restaurant counter." : paymentNotice || "Complete the payment in Razorpay. This order view refreshes automatically."}</small>
            </div>
            {confirmation.payment_status === "paid" && <button className="button button-outline full" onClick={() => printBill(confirmation)}><ReceiptText size={16} /> Download / print bill</button>}
            {confirmation.payment_method !== "counter" && confirmation.payment_status !== "paid" && confirmation.status !== "cancelled" && <button className="button button-dark full" onClick={retryOnlinePayment}><CreditCard size={16} /> Retry Razorpay payment</button>}
            {confirmation.status !== "cancelled" && confirmation.status !== "all_done" && <button className="button button-outline full waiter-call-button" disabled={confirmation.waiter_alert_open} onClick={() => callWaiter(confirmation)}><BellRing size={17} /> {confirmation.waiter_alert_open ? "Waiter notified" : "Call a waiter"}</button>}
            <small className="drawer-note">Your order and payment status refresh automatically. Keep this order view to see updates.</small>
            <button className="text-link lookup-another-order" onClick={() => { setConfirmationOpen(false); setMyOrdersOpen(true); }}>Find past orders</button>
            <button className="button button-dark full" onClick={dismissTrackedOrders}>Dismiss / start a new order <ArrowRight size={16} /></button>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <BadgeCheck size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PrepCountdown({ minutes, startedAt, status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (status === "ready") return <small className="prep-countdown"><Timer size={14} /> Kitchen marked this order ready.</small>;
  const remaining = Math.max(0, Math.ceil((new Date(startedAt).getTime() + Number(minutes) * 60000 - now) / 1000));
  const display = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return <small className="prep-countdown"><Timer size={14} /> {remaining ? `Kitchen estimate · ${display} remaining` : "Kitchen timer ended · your order is being finished"}</small>;
}

function ManualOrderModal({ menu, tableCount, taxRate, onClose, onSubmit }) {
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [table, setTable] = useState("1");
  const [quantities, setQuantities] = useState({});
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = menu.filter((item) => item.is_available !== false).filter((item) => quantities[item.id]).map((item) => ({ ...item, quantity: quantities[item.id] }));
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const tax = subtotal * Number(taxRate || 0) / 100;
  const changeQuantity = (id, amount) => setQuantities((current) => {
    const next = { ...current };
    const quantity = (next[id] || 0) + amount;
    if (quantity < 1) delete next[id]; else next[id] = Math.min(quantity, 99);
    return next;
  });
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSubmit({
        table_number: Number(table),
        customer,
        payment_status: paymentStatus,
        items: items.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
      });
      onClose();
    } catch (reason) { setError(reason.message || "Could not create this order."); }
    finally { setBusy(false); }
  };
  return <div className="overlay manual-order-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="success-modal manual-order-modal" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close staff order form"><X size={18} /></button>
      <div className="section-kicker">STAFF CHECKOUT</div>
      <h2 id="manual-order-title">Take a <em>table order.</em></h2>
      <p>Add items for a new table or for a customer already seated.</p>
      <form onSubmit={submit}>
        <div className="manual-order-fields">
          <label>Customer name<input required maxLength={120} autoComplete="name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Phone number<input required inputMode="tel" autoComplete="tel" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label>Table number<select value={table} onChange={(event) => setTable(event.target.value)}>{Array.from({ length: Number(tableCount) || 24 }, (_, index) => <option value={index + 1} key={index + 1}>Table {index + 1}</option>)}</select></label>
          <label>Counter payment<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="pending">Payment due</option><option value="paid">Collected at counter</option></select></label>
        </div>
        <p className="manual-order-hint">Occupied tables are allowed for additional orders. This order is sent to the kitchen when you submit.</p>
        <div className="manual-order-menu" aria-label="Choose order items">{menu.filter((item) => item.is_available !== false).map((item) => <div className="manual-order-item" key={item.id}>
          <span><b>{item.name}</b><small>{money(item.price)}</small></span>
          <div><button type="button" className="icon-button" aria-label={`Remove one ${item.name}`} disabled={!quantities[item.id]} onClick={() => changeQuantity(item.id, -1)}><Minus size={16} /></button><b>{quantities[item.id] || 0}</b><button type="button" className="icon-button" aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.id, 1)}><Plus size={16} /></button></div>
        </div>)}</div>
        <div className="manual-order-total"><span>{items.length} item types · {Number(taxRate || 0)}% tax</span><b>{money(subtotal + tax)}</b></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-dark full" disabled={busy || !items.length}>{busy ? "Sending order…" : "Send order to kitchen"} <ArrowRight size={16} /></button>
      </form>
    </section>
  </div>;
}

function KitchenLogin({ restaurantName, onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await onLogin({ email, password }); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <main className="kitchen-login-screen">
    <div className="kitchen-login-card">
      <Brand name={restaurantName} />
      <div className="kitchen-login-icon"><ChefHat size={28} /></div>
      <div className="section-kicker">KITCHEN DISPLAY</div>
      <h1>Ready when<br /><em>the tickets are.</em></h1>
      <p>Sign in to receive table orders and update the kitchen queue in real time.</p>
      <form onSubmit={submit}>
        <label>Kitchen email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kitchen@restaurant.com" /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Kitchen password" /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-dark full" disabled={busy}>{busy ? "Signing in…" : "Open kitchen display"} <ArrowRight size={17} /></button>
      </form>
      <button className="text-link kitchen-back-link" onClick={onBack}><ArrowLeft size={15} /> Back to restaurant</button>
    </div>
  </main>;
}

function KitchenDisplay({ user, logout, request, menu, setMenu, notify }) {
  const [orders, setOrders] = useState([]);
  const [archiveOrders, setArchiveOrders] = useState([]);
  const [tab, setTab] = useState("Tickets");
  const [timers, setTimers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [ticketData, archiveData, menuData] = await Promise.all([
          request("/api/kitchen/orders"),
          request("/api/kitchen/orders?archive=true"),
          request("/api/admin/menu"),
        ]);
        if (!active) return;
        setOrders(ticketData.orders || []);
        setArchiveOrders(archiveData.orders || []);
        setMenu(menuData.menu || []);
        setError("");
      } catch (reason) { if (active) setError(reason.message); }
      finally { if (active) setLoading(false); }
    };
    refresh();
    const poll = window.setInterval(refresh, 2000);
    return () => { active = false; window.clearInterval(poll); };
  }, [request]);
  const updateStatus = async (order, status) => {
    try {
      const prep_minutes = Number(timers[order.id] || order.prep_minutes || 10);
      const data = await request(`/api/kitchen/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(status === "preparing" ? { prep_minutes } : {}) }),
      });
      if (["prepared", "ready"].includes(status)) {
        setOrders((current) => current.filter((ticket) => ticket.id !== order.id));
        setArchiveOrders((current) => [data.order, ...current.filter((ticket) => ticket.id !== order.id)]);
      } else {
        setOrders((current) => current.map((ticket) => ticket.id === order.id ? data.order : ticket));
      }
      notify(`Table ${order.table_number} · ${orderStatusLabel(status)}`);
    } catch (reason) { setError(reason.message); }
  };
  const updateMenu = async (item) => {
    const data = await request(`/api/admin/menu/${item.id}`, { method: "PATCH", body: JSON.stringify(item) });
    setMenu((current) => current.map((entry) => entry.id === item.id ? data.item : entry));
  };
  const createMenuItem = async (item) => {
    const data = await request("/api/admin/menu", { method: "POST", body: JSON.stringify(item) });
    setMenu((current) => [...current, data.item]);
  };
  return <main className="kitchen-display">
    <header className="kitchen-topbar">
      <Brand name={"KITCHEN · " + user.name} />
      <div className="kitchen-top-actions"><span><i /> LIVE QUEUE · 2 SEC</span><button className="button button-outline" onClick={logout}><LogOut size={16} /> Sign out</button></div>
    </header>
    <nav className="kitchen-tabs" aria-label="Kitchen display sections">
      {[["Tickets", ReceiptText], ["Archive", Archive], ["Menu", MenuIcon]].map(([label, Icon]) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={18} /> {label}</button>)}
    </nav>
    <section className="kitchen-content">
      {tab === "Tickets" ? <>
        <div className="kitchen-heading"><div><div className="section-kicker">ORDER QUEUE</div><h1>On the pass.</h1><p>Orders appear here when restaurant staff send them to the kitchen.</p></div><div className="kitchen-ticket-count">{orders.length}<small>active tickets</small></div></div>
        {error && <div className="form-error" role="status">{error} · Reconnecting automatically.</div>}
        {loading ? <div className="kitchen-empty"><Clock3 size={24} /><b>Connecting to the order queue…</b></div> : orders.length ? <div className="kitchen-ticket-grid">{orders.map((order) => <article className={`kitchen-ticket status-border-${order.status}`} key={order.id}>
          <div className="kitchen-ticket-head"><span>TABLE <b>{order.table_number}</b></span><time>{new Date(order.kitchen_sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <div className="kitchen-ticket-id">#{order.id.slice(0, 8).toUpperCase()} · {order.customer_name}</div>
          <div className="kitchen-ticket-items">{order.items?.map((item) => <div key={item.id}><b>{item.quantity}×</b><span>{item.name}</span></div>)}</div>
          {order.prep_minutes && order.prep_started_at && <PrepCountdown minutes={order.prep_minutes} startedAt={order.prep_started_at} status={order.status} />}
          <div className="kitchen-ticket-status"><span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span></div>
          <label className="kitchen-timer-select">Preparation timer<select value={timers[order.id] || order.prep_minutes || 10} onChange={(event) => setTimers((current) => ({ ...current, [order.id]: event.target.value }))}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="20">20 minutes</option></select></label>
          <div className="kitchen-ticket-actions">
            <button className="button button-dark" onClick={() => updateStatus(order, "preparing")}><Flame size={17} /> Preparing</button>
            <button className="button button-outline" onClick={() => updateStatus(order, "prepared")}><Check size={17} /> Food prepared</button>
            <button className="button button-outline" onClick={() => updateStatus(order, "ready")}><Bell size={17} /> Ready to serve</button>
            <button className="kitchen-unavailable" onClick={() => updateStatus(order, "unavailable")}>Not available</button>
          </div>
        </article>)}</div> : <div className="kitchen-empty"><ChefHat size={28} /><b>All caught up.</b><span>New tickets sent by the restaurant will appear here.</span></div>}
      </> : tab === "Archive" ? <>
        <div className="kitchen-heading"><div><div className="section-kicker">COMPLETED KITCHEN TICKETS</div><h1>Order archive.</h1><p>Prepared orders move here automatically, with completed tickets kept for reference.</p></div><div className="kitchen-ticket-count">{archiveOrders.length}<small>archived tickets</small></div></div>
        {error && <div className="form-error" role="status">{error} · Reconnecting automatically.</div>}
        {loading ? <div className="kitchen-empty"><Clock3 size={24} /><b>Loading kitchen archive…</b></div> : archiveOrders.length ? <div className="kitchen-ticket-grid">{archiveOrders.map((order) => <article className={`kitchen-ticket kitchen-archive-ticket status-border-${order.status}`} key={order.id}>
          <div className="kitchen-ticket-head"><span>TABLE <b>{order.table_number}</b></span><time>{new Date(order.updated_at || order.kitchen_sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
          <div className="kitchen-ticket-id">#{order.id.slice(0, 8).toUpperCase()} · {order.customer_name}</div>
          <div className="kitchen-ticket-items">{order.items?.map((item) => <div key={item.id}><b>{item.quantity}×</b><span>{item.name}</span></div>)}</div>
          <div className="kitchen-ticket-status"><span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span></div>
          {order.status === "prepared" && <button className="button button-dark full" onClick={() => updateStatus(order, "ready")}><Bell size={16} /> Mark ready to serve</button>}
        </article>)}</div> : <div className="kitchen-empty"><Archive size={28} /><b>No archived tickets yet.</b><span>Tickets move here when food is prepared.</span></div>}
      </> : <MenuManager menu={menu} updateMenu={updateMenu} createMenuItem={createMenuItem} />}
    </section>
  </main>;
}

function FloorMap({ orders, tableCount, onChoose }) {
  const activeByTable = new Map();
  orders.filter((order) => !["all_done", "cancelled"].includes(order.status)).forEach((order) => {
    if (!activeByTable.has(Number(order.table_number))) activeByTable.set(Number(order.table_number), order);
  });
  const count = Math.max(1, Number(tableCount) || 24);
  return <section className="floor-map-panel">
    <div className="panel-heading"><div><div className="section-kicker">LIVE FLOOR</div><h2>Table map</h2></div><span><i className="floor-legend-occupied" /> Occupied <i className="floor-legend-free" /> Free</span></div>
    <div className="floor-map-grid">{Array.from({ length: count }, (_, index) => {
      const tableNumber = index + 1;
      const order = activeByTable.get(tableNumber);
      return <button key={tableNumber} className={`floor-table ${order ? "occupied" : "free"}`} disabled={!order} onClick={() => onChoose(order)} aria-label={`Table ${tableNumber}, ${order ? `occupied, ${orderStatusLabel(order.status)}` : "free"}`}>
        <span>{tableNumber}</span><small>{order ? orderStatusLabel(order.status) : "Free"}</small>
      </button>;
    })}</div>
  </section>;
}

function AuthModal({ onClose, onLogin, initialRole = "admin", restaurantName = "The Green Table" }) {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [role, setRole] = useState(initialRole === "staff" ? "staff" : "admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await onLogin({ email: form.identifier, password: form.password }, role); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="overlay auth-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="auth-card">
      <button className="modal-close" onClick={onClose} aria-label="Close restaurant sign in"><X size={18} /></button>
      <Brand name={restaurantName} />
      <div className="auth-intro"><div className="section-kicker">RESTAURANT PORTAL</div><h2>Your restaurant, in control.</h2><p>Sign in to review orders, update service, and manage the menu.</p></div>
      <div className="auth-role-switch" aria-label="Choose sign-in role">
        <button type="button" className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")}>Admin</button>
        <button type="button" className={role === "staff" ? "active" : ""} onClick={() => setRole("staff")}>Staff</button>
      </div>
      <form onSubmit={submit}>
        <label>{role === "admin" ? "Admin email" : "Staff email"}<input required type="email" autoComplete="username" placeholder={role === "admin" ? "owner@restaurant.com" : "staff@restaurant.com"} value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></label>
        <label>Password<input type="password" required autoComplete="current-password" placeholder="Your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-dark full" disabled={busy}>{busy ? "Signing in…" : `Sign in as ${role}`} <ArrowRight size={16} /></button>
      </form>
      <div className="auth-safe"><ShieldCheck size={15} /> Private restaurant access</div>
      <div className="auth-hint">Staff accounts are created by an administrator in dashboard settings.</div>
    </div>
  </div>;
}

function AdminApp({
  user,
  logout,
  orders,
  adminTab,
  setAdminTab,
  updateOrder,
  menu,
  updateMenu,
  createMenuItem,
  settings,
  updateSettings,
  notify,
  incoming,
  setIncoming,
  printBill,
  searchOrders,
  createStaff,
  waiterAlerts,
  acknowledgeWaiterAlert,
  sendToKitchen,
  createManualOrder,
}) {
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(null);
  const [orderFilter, setOrderFilter] = useState("All");
  const [orderSearch, setOrderSearch] = useState("");
  const [searchedOrders, setSearchedOrders] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const tabs = ["Orders", "Menu", "Settings"];
  const stats = isAdmin ? [
    {
      label: "Orders today",
      value: orders.filter(
        (o) =>
          new Date(o.created_at).toDateString() === new Date().toDateString(),
      ).length,
      icon: ReceiptText,
    },
    {
      label: "Awaiting confirmation",
      value: orders.filter((o) => o.status === "pending").length,
      icon: Clock3,
    },
    {
      label: "Paid today",
      value: money(
        orders
          .filter(
            (o) =>
              o.payment_status === "paid" &&
              new Date(o.created_at).toDateString() ===
                new Date().toDateString(),
          )
          .reduce((s, o) => s + Number(o.total), 0),
      ),
      icon: CreditCard,
    },
  ] : [];
  const searchTerm = orderSearch.trim().toLowerCase();
  useEffect(() => {
    if (!searchTerm) {
      setSearchedOrders(null);
      setSearchLoading(false);
      return;
    }
    let active = true;
    const refresh = () => searchOrders(orderSearch.trim())
      .then((data) => { if (active) setSearchedOrders(data.orders || []); })
      .catch((error) => { if (active) notify(error.message); })
      .finally(() => { if (active) setSearchLoading(false); });
    setSearchLoading(true);
    const debounce = window.setTimeout(refresh, 250);
    const poll = window.setInterval(refresh, 2000);
    return () => { active = false; window.clearTimeout(debounce); window.clearInterval(poll); };
  }, [searchTerm, orderSearch, searchOrders, notify]);
  const sourceOrders = searchTerm ? searchedOrders || [] : orders;
  const visibleOrders = sourceOrders.filter((order) => {
    const statusMatches = orderFilter === "All"
      || (orderFilter === "Needs attention" ? order.status === "pending" : order.status === orderFilter.toLowerCase().replaceAll(" ", "_"));
    return statusMatches;
  });
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Brand name={settings.restaurant_name} />
        <div className="admin-live">
          <i /> LIVE RESTAURANT
        </div>
        <nav className="admin-nav">
          {tabs.map((tab, i) => (
            <button
              className={adminTab === tab ? "active" : ""}
              onClick={() => setAdminTab(tab)}
              key={tab}
            >
              {[<ReceiptText />, <MenuIcon />, <ShieldCheck />][i]}
              {tab}
              <ArrowRight size={14} />
              {isAdmin && tab === "Orders" &&
                orders.filter((o) => o.status === "pending").length > 0 && (
                  <b>{orders.filter((o) => o.status === "pending").length}</b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="admin-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <span>
            <b>{user.name}</b>
            <small>{isAdmin ? "Restaurant admin" : "Restaurant staff"}</small>
          </span>
          <button onClick={logout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="section-kicker">
              {settings.restaurant_name.toUpperCase()} · ADMIN
            </span>
            <h1>
              {adminTab === "Orders"
                ? "Your service, at a glance."
                : adminTab === "Menu"
                  ? "A menu made yours."
                  : "The details behind the table."}
            </h1>
          </div>
          <div className="admin-user">
            <div className="live-chip">
              <i /> Live updates on
            </div>
            <span className="admin-avatar small">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            {user.name}
            <button onClick={logout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        {adminTab === "Orders" ? (
          <>
            {!isAdmin && <FloorMap orders={orders} tableCount={settings.table_count} onChoose={(order) => setOrderSearch(order ? order.id.slice(0, 8) : "")} />}
            {isAdmin && <section className="stats-grid">
              {stats.map(({ label, value, icon: Icon }) => (
                <div className="stat-card" key={label}>
                  <span className="stat-icon">
                    <Icon size={19} />
                  </span>
                  <small>{label}</small>
                  <b>{value}</b>
                </div>
              ))}
            </section>}
            <section className="orders-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">SERVICE BOARD</div>
                  <h2>
                    {isAdmin ? "Today’s orders" : "Restaurant orders"} {isAdmin && <span>{searchTerm ? searchedOrders?.length ?? "…" : orders.length}</span>}
                  </h2>
                </div>
                {!isAdmin && <button className="button button-dark manual-order-trigger" onClick={() => setManualOrderOpen(true)}><Plus size={17} /> Take table order</button>}
              </div>
              <div className="order-tools">
                <label className="order-search">
                  <Search size={17} aria-hidden="true" />
                  <input type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search name, phone, or order ID" aria-label="Search customer orders by name, phone number, or order ID" />
                </label>
                <select aria-label="Filter orders by status" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
                  <option value="All">All statuses</option>
                  <option value="Needs attention">Needs attention</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Prepared">Food prepared</option>
                  <option value="Ready">Ready</option>
                  <option value="Unavailable">Not available</option>
                  <option value="Served">Served</option>
                  <option value="All done">ALL DONE</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              {searchLoading && searchTerm && searchedOrders === null ? (
                <div className="admin-empty"><span><Search size={22} /></span><b>Searching orders…</b><small>Checking customer name, phone number and order ID.</small></div>
              ) : visibleOrders.length === 0 ? (
                <div className="admin-empty">
                  <span>
                    <Bell size={24} />
                  </span>
                  <b>{searchTerm || orderFilter !== "All" ? "No matching orders." : "It’s a calm moment."}</b>
                  <small>{searchTerm || orderFilter !== "All" ? "Try a different name, phone number, order ID or status." : "New table orders appear here within a couple of seconds."}</small>
                </div>
              ) : (
                <div className="orders-list">
                  {visibleOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        updateOrder={updateOrder}
                        printBill={printBill}
                        sendToKitchen={sendToKitchen}
                      />
                    ))}
                </div>
              )}
            </section>
          </>
        ) : adminTab === "Menu" ? (
          <MenuManager
            menu={menu}
            updateMenu={updateMenu}
            createMenuItem={createMenuItem}
          />
        ) : (
          <SettingsManager
            settings={settings}
            updateSettings={updateSettings}
            notify={notify}
            isAdmin={isAdmin}
            createStaff={createStaff}
          />
        )}
        <footer className="admin-footer">
          <span>
            <i /> Orders and waiter alerts refresh every two seconds
          </span>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              history.pushState({}, "", "/");
              location.reload();
            }}
          >
            ← Back to customer menu
          </a>
        </footer>
      </main>
      {incoming && (
        <div className="overlay alert-overlay">
          <div className="new-order-modal">
            <button className="modal-close" onClick={() => setIncoming(null)}>
              <X size={18} />
            </button>
            <div className="new-order-icon">
              <Bell size={23} />
            </div>
            <div className="section-kicker">A NEW TABLE ORDER IS IN</div>
            <h2>
              Table {incoming.table_number}
              <br />
              <em>{incoming.payment_method === "online" && incoming.payment_status !== "paid" ? "is awaiting payment." : "is ready for you."}</em>
            </h2>
            <div className="incoming-summary">
              {incoming.items?.map((i) => (
                <span key={i.id}>
                  {i.quantity} × {i.name}
                </span>
              ))}
              <div>
                <span>{incoming.customer_name}</span>
                <b>{money(incoming.total)}</b>
              </div>
              <small>
                {incoming.payment_method === "counter"
                  ? incoming.payment_status === "paid" ? "Counter payment · verified" : "Pay at counter · payment due"
                  : incoming.payment_status === "paid" ? `Razorpay · ${incoming.payment_method} payment verified automatically` : "Razorpay · waiting for online payment"}
              </small>
            </div>
            <div className="alert-actions">
              <button
                className="button button-outline full"
                onClick={() => setIncoming(null)}
              >
                Review later
              </button>
              <button
                className="button button-dark full"
                disabled={incoming.payment_method !== "counter" && incoming.payment_status !== "paid"}
                onClick={() => {
                  updateOrder(incoming.id, { status: "confirmed" });
                  setIncoming(null);
                }}
              >
                {incoming.payment_method !== "counter" && incoming.payment_status !== "paid" ? "Waiting for payment" : "Confirm order"} <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      {waiterAlerts[0] && <div className="overlay waiter-alert-overlay">
        <section className="new-order-modal waiter-alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="waiter-alert-title">
          <div className="new-order-icon"><BellRing size={25} /></div>
          <div className="section-kicker">WAITER REQUEST</div>
          <h2 id="waiter-alert-title">Table {waiterAlerts[0].table_number}<br /><em>needs a hand.</em></h2>
          <p>{waiterAlerts[0].customer_name} called for service · {new Date(waiterAlerts[0].created_at).toLocaleTimeString()}</p>
          <button className="button button-dark full" onClick={() => acknowledgeWaiterAlert(waiterAlerts[0].id)}>Acknowledge alert <Check size={16} /></button>
        </section>
      </div>}
      {manualOrderOpen && <ManualOrderModal menu={menu} tableCount={settings.table_count} taxRate={settings.tax_rate} onClose={() => setManualOrderOpen(false)} onSubmit={createManualOrder} />}
    </div>
  );
}

function OrderCard({ order, updateOrder, printBill, sendToKitchen }) {
  const [open, setOpen] = useState(false);
  const time = new Date(order.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article
      className={`order-card ${order.status === "pending" ? "needs-attention" : ""}`}
    >
      <div className="order-top">
        <span className="order-table">
          TABLE <b>{order.table_number}</b>
        </span>
        <span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span>
        <span className="order-time">
          <Clock3 size={14} />
          {time}
        </span>
      </div>
      <div className="order-customer">
        <b>{order.customer_name}</b>
        <span>
          {order.customer_email ||
            order.customer_phone ||
            "No contact provided"}
        </span>
        <strong>{money(order.total)}</strong>
      </div>
      <button className="order-expand" onClick={() => setOpen(!open)}>
        {open ? "Hide" : "View"} {order.items?.length || 0} items{" "}
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="order-items">
          {order.items?.map((item) => (
            <div key={item.id}>
              <span>
                {item.quantity} × {item.name}
              </span>
              <b>{money(item.price * item.quantity)}</b>
            </div>
          ))}
          <div><span>Tax ({order.tax_rate}%)</span><b>{money(order.tax_amount)}</b></div>
          <div className="payment-row">
            <span>
              {order.payment_method === "counter"
                ? "Counter payment"
                : `Razorpay · ${order.payment_method}`}
            </span>
            <b className={`payment-status payment-${order.payment_status}`}>
              {order.payment_status === "paid"
                ? "Payment confirmed"
                : "Payment pending"}
            </b>
          </div>
        </div>
      )}
      {order.payment_status === "paid" && <button className="button button-outline bill-download" onClick={() => printBill(order)}><ReceiptText size={15} /> Print / save bill as PDF</button>}
      <div className="order-controls">
        <label>
          Order status
          <select
            value={order.status}
            onChange={(e) => updateOrder(order.id, { status: e.target.value })}
          >
            {[
              "pending",
              ...(order.status === "cancelled" || (order.razorpay_order_id && order.payment_status !== "paid") ? [] : ["confirmed", "preparing", "prepared", "ready", "unavailable", "served", "all_done"]),
              "cancelled",
            ].map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment
          <select
            value={order.payment_status}
            disabled={order.payment_method !== "counter" || Boolean(order.razorpay_order_id)}
            onChange={(e) => updateOrder(order.id, { payment_status: e.target.value })}
          >
            <option value="pending">Pending</option>
            {order.payment_status === "paid" && <option value="paid">Paid · Razorpay verified</option>}
            {order.payment_method === "counter" && <option value="paid">Paid at counter</option>}
            {!order.razorpay_order_id && <option value="failed">Failed</option>}
          </select>
          {order.payment_method !== "counter" && order.payment_status !== "paid" && <small>Online payments update automatically after provider confirmation.</small>}
        </label>
      </div>
      {order.status !== "cancelled" && order.status !== "all_done" && <button className={`button ${order.kitchen_sent_at ? "button-outline" : "button-dark"} kitchen-send-button`} disabled={Boolean(order.kitchen_sent_at) || Boolean(order.razorpay_order_id && order.payment_status !== "paid")} onClick={() => sendToKitchen(order.id)}>{order.kitchen_sent_at ? <><Check size={15} /> Sent to kitchen</> : order.razorpay_order_id && order.payment_status !== "paid" ? "Waiting for payment" : <><Send size={15} /> SEND TO KITCHEN</>}</button>}
    </article>
  );
}

function MenuManager({ menu, updateMenu, createMenuItem }) {
  const [drafts, setDrafts] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "From the kitchen",
    is_veg: true,
    image_url: "",
  });
  const savePrice = async (item) => {
    const value = drafts[item.id];
    if (value === undefined || Number(value) === Number(item.price)) return;
    await updateMenu({ ...item, price: Number(value) });
    setDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  };
  const addItem = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createMenuItem({ ...form, price: Number(form.price) });
      setForm({
        name: "",
        description: "",
        price: "",
        category: "From the kitchen",
        is_veg: true,
        image_url: "",
      });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="manager-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">YOUR KITCHEN, YOUR CALL</div>
          <h2>
            Menu items <span>{menu.length}</span>
          </h2>
        </div>
        <button
          className="button button-dark add-menu-button"
          onClick={() => setShowForm((value) => !value)}
        >
          <Plus size={15} />
          {showForm ? "Close" : "Add a dish"}
        </button>
      </div>
      {showForm && (
        <form className="add-menu-form" onSubmit={addItem}>
          <label>
            Dish name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Price (₹)
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label>
            Category
            <input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label>
            Image URL
            <input
              value={form.image_url}
              placeholder="https://… (optional)"
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </label>
          <label className="add-description">
            Description
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="add-veg">
            <input
              type="checkbox"
              checked={form.is_veg}
              onChange={(e) => setForm({ ...form, is_veg: e.target.checked })}
            />{" "}
            Vegetarian
          </label>
          <button disabled={busy} className="button button-dark">
            {busy ? "Adding…" : "Save dish"} <Check size={15} />
          </button>
        </form>
      )}
      <div className="manage-list">
        {menu.map((item) => (
          <article className="manage-item" key={item.id}>
            <img src={item.image_url} alt="" />
            <div className="manage-details">
              <b>{item.name}</b>
              <span>
                {item.category} ·{" "}
                {item.is_veg ? "Vegetarian" : "Non-vegetarian"}
              </span>
            </div>
            <label className="price-edit">
              ₹
              <input
                type="number"
                min="0"
                value={drafts[item.id] ?? item.price}
                onChange={(e) =>
                  setDrafts((current) => ({
                    ...current,
                    [item.id]: e.target.value,
                  }))
                }
                onBlur={() => savePrice(item)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            <label className="available-toggle">
              <input
                type="checkbox"
                checked={item.is_available}
                onChange={(e) =>
                  updateMenu({ ...item, is_available: e.target.checked })
                }
              />
              <span>{item.is_available ? "Available" : "Sold out"}</span>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsManager({ settings, updateSettings, isAdmin, createStaff }) {
  const [form, setForm] = useState(settings);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "" });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMessage, setStaffMessage] = useState("");
  useEffect(() => setForm(settings), [settings]);
  return (
    <section className="manager-panel settings-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">MAKE IT YOURS</div>
          <h2>Restaurant settings</h2>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings(form);
        }}
      >
        <label>
          Restaurant name
          <input
            value={form.restaurant_name || ""}
            onChange={(e) =>
              setForm({ ...form, restaurant_name: e.target.value })
            }
          />
        </label>
        <label>
          GST / tax rate (%)
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.tax_rate || 0}
            onChange={(e) =>
              setForm({ ...form, tax_rate: Number(e.target.value) })
            }
          />
          <small>Applied to the order subtotal at checkout.</small>
        </label>
        <label>
          Number of tables
          <input
            type="number"
            min="1"
            max="200"
            value={form.table_count || 24}
            onChange={(e) =>
              setForm({ ...form, table_count: Number(e.target.value) })
            }
          />
          <small>Customers can choose Table 1 up to this number.</small>
        </label>
        <label>
          UPI ID
          <input
            value={form.upi_id || ""}
            placeholder="restaurant@bank"
            onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
          />
          <small>
            This is for UPI collected at the counter. Online UPI and cards use Razorpay.
          </small>
        </label>
        <label>
          UPI display name
          <input
            value={form.upi_name || ""}
            onChange={(e) => setForm({ ...form, upi_name: e.target.value })}
          />
        </label>
        <div className="settings-note">
          <ShieldCheck size={17} />
          <span>
            Razorpay verifies online UPI and card payments automatically. Enable the payment methods and auto-capture in your Razorpay Dashboard.
          </span>
        </div>
        <button className="button button-dark">
          Save restaurant settings <Check size={16} />
        </button>
      </form>
      {isAdmin && <section className="staff-manager">
        <div className="panel-heading"><div><div className="section-kicker">TEAM ACCESS</div><h2>Add staff login</h2></div></div>
        <p>Staff can manage orders, menu, settings, and counter payments. They cannot view daily totals or confirm online payments.</p>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setStaffBusy(true);
          setStaffMessage("");
          try {
            await createStaff(staffForm);
            setStaffForm({ name: "", email: "", password: "" });
            setStaffMessage("Staff login created.");
          } catch (error) { setStaffMessage(error.message); }
          finally { setStaffBusy(false); }
        }}>
          <label>Staff name<input required maxLength={120} value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} /></label>
          <label>Staff email<input required type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
          <label>Temporary password<input required type="password" minLength={12} value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /><small>Use at least 12 characters.</small></label>
          {staffMessage && <small className="staff-message" role="status">{staffMessage}</small>}
          <button className="button button-dark" disabled={staffBusy}>{staffBusy ? "Creating…" : "Create staff login"} <ArrowRight size={16} /></button>
        </form>
      </section>}
    </section>
  );
}
