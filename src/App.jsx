// v2 - updated
/* eslint-disable react-hooks/set-state-in-effect */
import { supabase } from "./lib/supabase";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getProducts, getOrders, getSettings, updateSettings, getCoupons, addCoupon, deleteCoupon, getFaqs, addFaq, deleteFaq, addProduct as apiAddProduct, updateProduct as apiUpdateProduct, deleteProduct as apiDeleteProduct, placeOrder as apiPlaceOrder, updateOrderStatus as apiUpdateOrderStatus } from "./lib/api";
import { DESIGN_TOKENS, STORE_BRAND } from "./designTokens";




function getCountdownTarget() {
  const now = new Date();
  const target = new Date();
  target.setDate(now.getDate() + 2);
  target.setHours(23, 59, 59, 999);
  return target.toISOString();
}

const DEFAULT_SETTINGS = {
  storeName: STORE_BRAND.name,
  heroTitle: "Pakistan's #1 Trending Gadgets & Lifestyle Store",
  heroSubtitle:
    "Premium products, fast delivery across Pakistan, and cash on delivery available. Trusted by 1,000+ happy customers.",
  announcement: "Pakistan bhar delivery deals  •  Cash on Delivery available  •  Limited time offers",
  supportEmail: "um2739638@gmail.com",
  whatsappNumber: "923008631809",
  shippingFee: 0,
  freeShippingThreshold: 0,
  saleEndsAt: getCountdownTarget(),
};
const STORE_NAME = STORE_BRAND.name;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
}
function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}
function cleanProductName(name = "") {
  const raw = String(name || "");
  const lower = raw.toLowerCase();
  if (lower.includes("m16") && lower.includes("earbud")) return "M16 Mini Bluetooth Earbuds";
  if (lower.includes("electric handheld vegetable cutter")) return "Electric Vegetable Chopper";
  if (lower.includes("automatic toothpaste dispenser")) return "Automatic Toothpaste Dispenser";
  if (lower.includes("self-adhesive") && lower.includes("wall hooks")) return "Transparent Wall Hooks - Pack of 10";
  if (lower.includes("3d crystal") && lower.includes("moon")) return "3D Crystal Moon Lamp";
  if (lower.includes("silicone baking mat")) return "Silicone Baking Mat";
  return raw
    .replace(/\b(high quality|crystal clear sound anywhere|compact stylish|wireless headset|multifunctional|compact|durable|easy to use|premium quality|best quality|for men|for women|with measurements|heat resistant|non stick|random color)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,&|()-])/g, "$1")
    .replace(/([|(])\s+/g, "$1")
    .trim();
}
function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "product";
}
function shortProductId(product = {}) {
  const raw = String(product.id ?? product.product_id ?? product.sku ?? "");
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-8);
}
function productSlug(product = {}) {
  const base = slugify(cleanProductName(product.name) || product.name || "product");
  const suffix = shortProductId(product);
  return suffix ? `${base}-${suffix}` : base;
}
function productPath(product = {}) {
  return `/product/${productSlug(product)}`;
}
function findProductBySlug(products = [], slug = "") {
  const normalizedSlug = String(slug || "");
  return products.find(product => productSlug(product) === normalizedSlug)
    || products.find(product => shortProductId(product) && normalizedSlug.endsWith(shortProductId(product)))
    || products.find(product => slugify(cleanProductName(product.name)) === normalizedSlug)
    || null;
}
const PAGE_PATHS = {
  home: "/",
  shop: "/shop",
  wishlist: "/wishlist",
  cart: "/cart",
  checkout: "/checkout",
  confirmation: "/confirmation",
  about: "/about",
  contact: "/contact",
  "shipping-policy": "/shipping-policy",
  returns: "/returns",
  "privacy-policy": "/privacy-policy",
  terms: "/terms",
  faq: "/faq",
  "track-order": "/track-order",
  admin: "/admin",
};
function pagePath(pageName, options = {}) {
  const base = PAGE_PATHS[pageName] || "/";
  if (pageName === "shop" && options.category && options.category !== "All") {
    return `${base}?category=${encodeURIComponent(options.category)}`;
  }
  return base;
}
function pageFromPath(pathname = "/") {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return "home";
  if (clean.startsWith("/product/")) return "product";
  return Object.entries(PAGE_PATHS).find(([, path]) => path === clean)?.[0] || "home";
}
function hasProductVideo(product) {
  return Boolean(product?.video && String(product.video).trim());
}
function uniqueProductList(products = []) {
  const seen = new Set();
  return products.filter((product) => {
    if (!product) return false;
    const key = product.id ?? product.name ?? product.video ?? product.image;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function percentageOff(price, compareAtPrice) {
  const p = Number(price || 0);
  const c = Number(compareAtPrice || 0);
  if (!p || !c || c <= p) return 0;
  return Math.round(((c - p) / c) * 100);
}
function fallbackSalePercent(product = {}) {
  const seed = String(product.id ?? product.name ?? product.category ?? "sale");
  const score = Array.from(seed).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return score % 2 === 0 ? 50 : 30;
}
function getSoldCount(product = {}) {
  return Number(product.soldCount ?? product.sold_count ?? 0);
}
function getBestSellerLimit(total = 0) {
  if (total <= 0) return 0;
  return Math.min(total, Math.max(1, Math.ceil(total * 0.43)));
}
function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push("ellipsis-left");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("ellipsis-right");
  items.push(totalPages);
  return items;
}
function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function normalizeProduct(product = {}) {
  const images = Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []);
  return {
    ...product,
    images,
    compareAtPrice: product.compareAtPrice ?? product.compare_at_price ?? null,
    shortDescription: product.shortDescription ?? product.short_description ?? "",
    stockLeft: product.stockLeft ?? product.stock_left ?? product.stock ?? 0,
    soldCount: product.soldCount ?? product.sold_count ?? 0,
    reviewCount: product.reviewCount ?? product.review_count ?? 0,
    variants: Array.isArray(product.variants) ? product.variants : [],
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
  };
}
function normalizeProducts(products = []) {
  return products.map(normalizeProduct);
}
function productFormToSupabasePayload(form) {
  const images = Array.isArray(form.images) ? form.images.filter(Boolean) : [];
  return {
    name: String(form.name || "").trim(),
    category: String(form.category || "Uncategorized").trim(),
    price: Number(form.price || 0),
    compare_at_price: toNullableNumber(form.compareAtPrice),
    short_description: String(form.shortDescription || "").trim(),
    description: String(form.description || "").trim(),
    images,
    image: images[0] || null,
    video: form.video || null,
    stock_left: toNullableNumber(form.stock) ?? 0,
    stock: toNullableNumber(form.stock),
    sold_count: toNullableNumber(form.soldCount) ?? 0,
    rating: toNullableNumber(form.rating) ?? 5,
    review_count: toNullableNumber(form.reviewCount) ?? 0,
    featured: Boolean(form.featured),
    trending: Boolean(form.trending),
  };
}
function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-PK", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function getOrderCustomer(order = {}) {
  return order.customer && typeof order.customer === "object" ? order.customer : {};
}
function getOrderCustomerName(order = {}) {
  const customer = getOrderCustomer(order);
  return customer.name || order.customer_name || order.name || "Customer";
}
function getOrderCustomerPhone(order = {}) {
  const customer = getOrderCustomer(order);
  return customer.phone || order.customer_phone || order.phone || "";
}
function getOrderCustomerCity(order = {}) {
  const customer = getOrderCustomer(order);
  return customer.city || order.customer_city || order.city || "";
}
function getOrderCustomerAddress(order = {}) {
  const customer = getOrderCustomer(order);
  const address = customer.address || order.customer_address || order.address || order.shipping_address || "";
  const city = getOrderCustomerCity(order);
  if (address && city && !String(address).toLowerCase().includes(String(city).toLowerCase())) return `${address}, ${city}`;
  return address || city || "No address provided";
}
function buildStars(rating = 0) {
  const rounded = Math.round(rating);
  return [1, 2, 3, 4, 5].map((n) => n <= rounded);
}
const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar", "Quetta", "Hyderabad", "Gujranwala", "Sialkot", "Bahawalpur"];
const LIVE_NAMES = ["Ayesha", "Bilal", "Hamza", "Sana", "Usman", "Mariam", "Ali", "Fatima", "Hassan", "Sara", "Ahmed", "Zara", "Omar", "Hina", "Tariq", "Nadia"];
const LIVE_ACTIONS = ["just ordered", "added to cart", "is viewing", "just bought"];
const STOREFRONT_CATEGORIES = [
  { name: "Audio", key: "audio", icon: "🎧", keywords: ["audio", "earbud", "earbuds", "headphone", "headphones", "speaker", "sound", "airpods", "handsfree", "bowie"] },
  { name: "Smart Wearables", key: "smart", icon: "⌚", keywords: ["smart", "wearable", "watch", "smartwatch", "band", "fitness"] },
  { name: "Mobile Accessories", key: "mobile", icon: "📱", keywords: ["mobile", "phone", "case", "cover", "protector", "holder", "stand", "accessory"] },
  { name: "Power & Charging", key: "power", icon: "🔌", keywords: ["power", "charging", "charger", "adapter", "cable", "usb", "pd", "fast charger"] },
  { name: "Kitchen", key: "kitchen", icon: "🍳", keywords: ["kitchen", "chopper", "blender", "juicer", "grinder", "cooking", "electric"] },
  { name: "Home Gadgets", key: "home", icon: "🏠", keywords: ["home", "gadget", "lamp", "light", "fan", "humidifier", "organizer", "mini"] },
  { name: "Car Accessories", key: "car", icon: "🚗", keywords: ["car", "vehicle", "auto", "vacuum", "holder", "charger"] },
  { name: "Cleaning & Storage", key: "cleaning", icon: "🧼", keywords: ["cleaning", "cleaner", "storage", "organizer", "lint", "mop", "box"] },
];
function normalizeCategoryName(value = "") {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}
function categoryToneClass(category = "") {
  const cat = normalizeCategoryName(category);
  if (/kitchen|baking|chopper|blender|food/.test(cat)) return "pcard-tone-kitchen";
  if (/home|cleaning|storage|toothpaste|bathroom/.test(cat)) return "pcard-tone-home";
  if (/gift|deal|summer/.test(cat)) return "pcard-tone-gifts";
  return "pcard-tone-default";
}
function matchProductForCategory(products = [], category) {
  return products.find(product => normalizeCategoryName(product?.category) === normalizeCategoryName(category?.name)) || null;
}
// ─── CLOUDINARY UPLOAD ────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = "dntz5x9s4";        // from dashboard
const CLOUDINARY_UPLOAD_PRESET = "ismallone_uploads"; // what you just created

async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("resource_type", file.type.startsWith("video/") ? "video" : "image");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const res = JSON.parse(xhr.responseText);
      if (res.secure_url) resolve(res.secure_url);
      else reject(new Error("Upload failed: " + JSON.stringify(res)));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}
// ─── ANIMATED COUNTER ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const numTarget = parseFloat(String(target).replace(/[^0-9.]/g, ""));
        const isDecimal = String(target).includes(".");
        const steps = 60; const stepTime = duration / steps; let current = 0;
        const increment = numTarget / steps;
        const timer = setInterval(() => {
          current += increment;
          if (current >= numTarget) { current = numTarget; clearInterval(timer); }
          setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
        }, stepTime);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  const str = String(target);
  let display = count;
  if (str.includes("K+")) display = count >= 10 ? "10K+" : count + "K+";
  else if (str.includes("%")) display = `${count}%`;
  else if (str.includes("+")) display = `${Number(count || 0).toLocaleString("en-PK")}+`;
  else if (str.includes("d")) display = count + "d";
  return <span ref={ref}>{display}{str.includes("★") ? " ★" : ""}{str.includes("/5") ? "/5" : ""}</span>;
}

function PremiumMotionLayer({ page }) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const selector = [
      ".storefront-light .sec",
      ".sf-selling-section",
      ".stats-sec",
      ".sf-review-section",
      ".sf-faq-section",
      ".pdp-gallery",
      ".pdp-info",
      ".rv-card",
      ".footer",
    ].join(",");
    const items = Array.from(document.querySelectorAll(selector));
    items.forEach((item, index) => {
      item.classList.add("premium-reveal");
      item.style.setProperty("--reveal-delay", `${Math.min(index * 45, 220)}ms`);
      if (reduceMotion) item.classList.add("in-view");
    });
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(item => item.classList.add("in-view"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [page]);
  return null;
}

// ─── PAGE TRANSITION ──────────────────────────────────────────────────────────
function PageTransition({ trigger }) {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    if (trigger === 0) return;
    setPhase("enter");
    setActive(true);
    const t1 = setTimeout(() => setPhase("exit"), 900);
    const t2 = setTimeout(() => { setActive(false); setPhase("idle"); }, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [trigger]);

  if (!active) return null;

  return (
    <div className={`pt-overlay pt-${phase}`}>
      <div className="pt-backdrop" />
      <div className="pt-center">
        <div className="pt-logo-ring">
          <span className="pt-logo-mark">ISO</span>
        </div>
        <div className="pt-logo-name">ISmallOne</div>
        <div className="pt-line-wrap">
          <div className="pt-line-bar" />
        </div>
      </div>
    </div>
  );
}

function SplashLoader({ ready }) {
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState("enter");

  useEffect(() => {
    if (ready) {
      setPhase("exit");
      const timer = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [ready]);

  if (!visible) return null;

  return (
    <div className={`pt-overlay pt-${phase}`} style={{ zIndex: 1000000, pointerEvents: "all" }}>
      <div className="pt-backdrop" style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)", opacity: 1 }} />
      <div className="pt-center">
        <div className="pt-logo-ring splash-ring-anim">
          <span className="pt-logo-mark">ISO</span>
        </div>
        <div className="pt-logo-name">ISmallOne</div>
        <div className="pt-line-wrap">
          <div className="pt-line-bar splash-line-anim" />
        </div>
      </div>
    </div>
  );
}

// ─── LIVE ACTIVITY FEED ───────────────────────────────────────────────────────
function LiveActivityFeed({ products }) {
  const [visible, setVisible] = useState(null);
  const [isClear, setIsClear] = useState(true);
  const popupRef = useRef(null);
  const queueRef = useRef([]);
  const visibleRef = useRef(null);

  useEffect(() => {
    visibleRef.current = visible;
    if (!visible && queueRef.current.length) {
      setVisible(queueRef.current.shift());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setVisible(null), 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const protectedSelector = [
      "button",
      "a",
      "h1",
      "h2",
      "h3",
      "p",
      ".sec-h2",
      ".sec-sub",
      ".view-all",
      ".sf-btn",
      ".sf-hero-copy",
      ".sf-hero-trust span",
      ".sf-hero-deal",
      ".pcard-actions",
      ".footer-col h4",
    ].join(",");
    const intersects = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const checkClear = () => {
      const popup = popupRef.current;
      if (!popup) return;
      const popupRect = popup.getBoundingClientRect();
      const collision = Array.from(document.querySelectorAll(protectedSelector)).some(el => {
        if (popup.contains(el)) return false;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;
        return intersects(popupRect, rect);
      });
      setIsClear(!collision);
    };
    checkClear();
    window.addEventListener("scroll", checkClear, { passive: true });
    window.addEventListener("resize", checkClear);
    const raf = requestAnimationFrame(checkClear);
    return () => {
      window.removeEventListener("scroll", checkClear);
      window.removeEventListener("resize", checkClear);
      cancelAnimationFrame(raf);
    };
  }, [visible]);

  useEffect(() => {
    const generate = () => {
      if (!products.length) return null;
      const p = products[Math.floor(Math.random() * products.length)];
      const name = LIVE_NAMES[Math.floor(Math.random() * LIVE_NAMES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const action = LIVE_ACTIONS[Math.floor(Math.random() * LIVE_ACTIONS.length)];
      return { id: uid("act"), name, city, action, product: cleanProductName(p.name), productImg: p.images?.[0] };
    };
    const enqueue = () => {
      const act = generate();
      if (!act) return;
      if (visibleRef.current) queueRef.current = [...queueRef.current.slice(-2), act];
      else setVisible(act);
    };
    const firstTimer = setTimeout(enqueue, 1800);
    const interval = setInterval(enqueue, 9000);
    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [products]);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div ref={popupRef} className={`live-feed-popup ${isClear ? "" : "live-feed-hidden"}`}>
      <div className="live-feed-inner">
        <SafeImage src={visible.productImg} alt="" className="live-feed-img" />
        <div className="live-feed-text">
          <div className="live-feed-name"><span className="live-dot" /><strong>{visible.name}</strong> from <strong>{visible.city}</strong></div>
          <div className="live-feed-action">{visible.action} <span>{visible.product}</span></div>
          <div className="live-feed-time">just now</div>
        </div>
        <button className="live-feed-close" onClick={() => setVisible(null)} aria-label="Close notification">×</button>
      </div>
    </div>,
    document.body
  );
}

// ─── WHATSAPP FLOAT ───────────────────────────────────────────────────────────
function WhatsAppFloat({ number }) {
  return (
    <a href={`https://wa.me/${number}?text=Assalam%20o%20Alaikum!%20I%20want%20to%20order%20from%20ISmallOne.`}
      target="_blank" rel="noreferrer" className="wa-float">
      <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span className="wa-tooltip">Chat on WhatsApp</span>
    </a>
  );
}

// ─── 3D PRODUCT VIEWER ────────────────────────────────────────────────────────
function Product3DViewer({ images, productName }) {
  const [angle, setAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const autoRef = useRef(null);
  const imgCount = images.length;
  const currentImg = images[Math.floor(((angle % 360) + 360) % 360 / (360 / imgCount)) % imgCount];

  useEffect(() => {
    if (!isHovered && !isDragging) {
      autoRef.current = setInterval(() => setAngle(a => a + 1.5), 30);
    }
    return () => clearInterval(autoRef.current);
  }, [isHovered, isDragging]);

  const handleStart = (e) => { setIsDragging(true); setStartX(e.clientX || e.touches?.[0]?.clientX); };
  const handleMove = (e) => { if (!isDragging) return; const x = e.clientX || e.touches?.[0]?.clientX; setAngle(a => a + (x - startX) * 0.8); setStartX(x); };
  const handleEnd = () => setIsDragging(false);

  return (
    <div className="viewer3d"
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => { setIsHovered(false); setIsDragging(false); }}
      onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
      onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}>
      <img src={currentImg} alt={productName} className="viewer3d-img"
        style={{ transform: `perspective(800px) rotateY(${(angle * 0.05) % 8}deg) scale(${isHovered ? 1.05 : 1})` }}
        draggable={false} />
      <div className="viewer3d-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
        360° View
      </div>
      <div className="viewer3d-hint">{isDragging ? "↔ Drag to rotate" : "↔ Auto-rotating"}</div>
      <div className="viewer3d-dots">{images.map((_, i) => (<div key={i} className={`viewer3d-dot ${i === (Math.floor(((angle % 360) + 360) % 360 / (360 / imgCount)) % imgCount) ? "active" : ""}`} />))}</div>
    </div>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal({ onClose, onLogin }) {
  const [adminForm, setAdminForm] = useState({
    email: "",
    password: ""
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setErr("");

    // 🔴 FIX: use email, not username
    if (!adminForm.email || !adminForm.password) {
      setErr("Please fill all fields.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminForm.email,
      password: adminForm.password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);   // 🔥 show real error (important)
      return;
    }

    // 🔥 CRITICAL: CHECK ADMIN ROLE
    if (data.user.user_metadata?.role !== "admin") {
      setErr("You are not authorized as admin.");
      return;
    }

    // ✅ SUCCESS
    onLogin({
      id: data.user.id,
      name: data.user.user_metadata?.name || "Admin",
      email: data.user.email,
      role: "admin",
    });

    onClose();
  }

  return (
    <div className="auth-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <div className="auth-left">
          <div className="auth-left-bg" />
          <div className="auth-left-content">
            <div className="auth-logo-big"><span className="auth-logo-mark">ISO</span></div>
            <h2 className="auth-tagline">Pakistan's<br />Premium<br />Store</h2>
            <p className="auth-sub-tag">1,000+ happy customers across Pakistan.</p>
            <div className="auth-perks">
              {["Cash on Delivery", "Fast 3–5 Day Delivery", "Easy Returns", "WhatsApp Support"].map(p => (
                <div key={p} className="auth-perk"><span className="auth-perk-check">✓</span>{p}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-right">
          <button className="auth-close" onClick={onClose}>✕</button>
          <div className="auth-header">
            <div className="auth-admin-badge">🔐 Admin Portal</div>
            <h3 className="auth-title">Admin Login</h3>
            <p className="auth-desc">Restricted access — authorized personnel only</p>
          </div>
          <form onSubmit={handleAdminLogin} className="auth-form">
            <div className="auth-field-wrap"><label>Email</label><div className="auth-inp-wrap"><span className="auth-inp-ico">✉️</span><input className="auth-inp" type="email" placeholder="Enter admin email" value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} /></div></div>
            <div className="auth-field-wrap"><label>Password</label><div className="auth-inp-wrap"><span className="auth-inp-ico">🔑</span><input className="auth-inp" type={showAdminPass ? "text" : "password"} placeholder="Enter admin password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} /><button type="button" className="auth-eye" onClick={() => setShowAdminPass(v => !v)}>{showAdminPass ? "🙈" : "👁️"}</button></div></div>
            {err && <div className="auth-err"><span>⚠️</span>{err}</div>}
            <button type="submit" className={`auth-submit ${loading ? "loading" : ""}`} disabled={loading}>{loading ? <span className="auth-spinner" /> : "Access Admin Panel →"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── RATING STARS ─────────────────────────────────────────────────────────────
function RatingStars({ rating, size = "sm" }) {
  return (
    <div className={`stars stars-${size}`}>
      {buildStars(rating).map((filled, i) => (<span key={i} className={filled ? "star-on" : "star-off"}>★</span>))}
    </div>
  );
}

function SafeImage({ src, alt = "", className = "", loading = "lazy", skeletonClass = "" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = failedSrc === src;
  if (!src || failed) {
    return <div className={`${className} img-skeleton ${skeletonClass}`} role="img" aria-label={alt || "Image loading"} />;
  }
  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" onError={() => setFailedSrc(src)} />;
}

function Button({ variant = "primary", size = "md", className = "", children, ...props }) {
  return <button className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`.trim()} {...props}>{children}</button>;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  return <div className={`toast ${visible ? "toast-in" : ""}`}><span className="toast-check">✓</span>{message}</div>;
}

// ─── COUNTDOWN TIMER ──────────────────────────────────────────────────────────
function CountdownTimer({ saleEndsAt }) {
  const [t, setT] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => { const diff = Math.max(0, new Date(saleEndsAt).getTime() - Date.now()); setT({ h: String(Math.floor(diff / 3600000)).padStart(2, "0"), m: String(Math.floor((diff / 60000) % 60)).padStart(2, "0"), s: String(Math.floor((diff / 1000) % 60)).padStart(2, "0") }); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [saleEndsAt]);
  return (
    <div className="cd-row">
      {[t.h, t.m, t.s].map((val, i) => (
        <React.Fragment key={i}>
          <div className="cd-box"><span className="cd-num">{val}</span><span className="cd-lbl">{["HRS", "MIN", "SEC"][i]}</span></div>
          {i < 2 && <span className="cd-sep">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── SCARCITY METER ───────────────────────────────────────────────────────────
function ScarcityMeter({ stockLeft, soldCount }) {
  const pct = clamp((soldCount / (soldCount + stockLeft)) * 100, 10, 94);
  return (
    <div className="scarcity">
      <div className="scarcity-top"><span><strong>Only {stockLeft}</strong> left</span><span>{soldCount}+ sold</span></div>
      <div className="scarcity-track"><div className="scarcity-bar" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// ─── ACCORDION ────────────────────────────────────────────────────────────────
function Accordion({ title, children, open: defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    // FIXED: content stays mounted so FAQ/PDP accordions animate with max-height.
    <div className={`acc ${open ? "acc-open" : ""}`}>
      <button className="acc-head" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>{title}</span><span className="acc-ico">{open ? "−" : "+"}</span></button>
      <div className="acc-body"><div className="acc-body-inner">{children}</div></div>
    </div>
  );
}

// ─── BUNDLE SELECTOR ──────────────────────────────────────────────────────────
function BundleSelector({ product, selectedBundle, onSelect }) {
  const basePrice = product.price;
  // FIXED: compare price fallback prevents NaN on products without compare-at pricing.
  const comparePrice = product.compareAtPrice || basePrice;
  const bundles = [
    { qty: 1, discountPct: 0, label: "Recommended", popular: true },
    { qty: 2, discountPct: 20, label: "20% OFF" },
    { qty: 3, discountPct: 30, label: "30% OFF" },
  ];
  function bundlePrice(qty, discountPct) { return Math.round(basePrice * (1 - discountPct / 100)) * qty; }
  function bundleCompare(qty) { return comparePrice * qty; }
  return (
    <div className="bundle-wrap">
      <div className="bundle-header"><span className="bundle-title">Quantity Bundles</span></div>
      <div className="bundle-options">
        {bundles.map((b) => {
          const total = bundlePrice(b.qty, b.discountPct);
          const orig = bundleCompare(b.qty);
          const isSelected = selectedBundle?.qty === b.qty;
          return (
            <button key={b.qty} className={`bundle-option ${isSelected ? "bundle-selected" : ""} ${b.popular ? "bundle-popular" : ""}`} onClick={() => onSelect({ ...b, totalPrice: total, originalPrice: orig })}>
              <div className="bundle-option-inner">
                <div className="bundle-radio"><div className={`bundle-radio-dot ${isSelected ? "active" : ""}`} /></div>
                <div className="bundle-qty-info"><span className="bundle-qty-label">Order {b.qty}</span><span className="bundle-sub-label">{b.qty === 1 ? "Base price" : `${b.qty} item bundle`}</span></div>
                <div className="bundle-discount-badge">{b.label}</div>
                <div className="bundle-price-info"><span className="bundle-price">{money(total)}</span><span className="bundle-orig-price">{money(orig)}</span></div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="bundle-footer"><span className="bundle-delivery">Free shipping on 4+ items</span><span className="bundle-total-label">Total: <strong>{money(selectedBundle?.totalPrice || bundlePrice(1, 0))}</strong></span></div>
    </div>
  );
}

function BuyNowButton({ onClick, label = "Order Now" }) {
  return <Button variant="outline" size="lg" className="pdp-buy-btn" onClick={onClick}>{label}</Button>;
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ settings, page, search, setSearch, cartCount, wishlistCount, currentUser, onLogout, onCategorySelect }) {
  const routerNavigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const availableCategories = useMemo(() => STOREFRONT_CATEGORIES, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const navTo = (p) => { routerNavigate(pagePath(p)); setMobileMenuOpen(false); };
  const selectCategory = (category) => {
    if (onCategorySelect) onCategorySelect(category);
    else routerNavigate(pagePath("shop", { category }));
    setMobileMenuOpen(false);
  };
  const goShopForSearch = () => {
    routerNavigate(pagePath("shop"));
  };

  return (
    <>
      <header className={`hdr ${scrolled ? "hdr-scrolled" : ""}`}>
        <div className="hdr-announce"><div className="hdr-announce-inner">Pakistan bhar delivery deals • Cash on Delivery available • 7 din easy return support</div></div>
        <div className="hdr-body">
          <button className="hdr-hamburger" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu">
            <span className={`ham-line ${mobileMenuOpen ? "ham-open" : ""}`}></span>
            <span className={`ham-line ${mobileMenuOpen ? "ham-open" : ""}`}></span>
            <span className={`ham-line ${mobileMenuOpen ? "ham-open" : ""}`}></span>
          </button>
          <button className="hdr-logo" onClick={() => navTo("home")}>
            <span className="hdr-logo-mark">ISO</span>
            <span className="hdr-logo-text">ISmallOne</span>
          </button>
          <nav className="hdr-nav desktop-only">
            {/* FIXED: nav label matches premium Shopify spec. */}
            {[["home", "Home"], ["shop", "All Products"], ["track-order", "Track Order"], ["about", "About"], ["contact", "Contact"]].map(([k, l]) => (
              <button key={k} className={`hdr-nav-btn ${page === k ? "active" : ""}`} onClick={() => navTo(k)}>{l}</button>
            ))}
            {currentUser?.role === "admin" && (
              <button className={`hdr-nav-btn admin-nav-btn ${page === "admin" ? "active" : ""}`} onClick={() => navTo("admin")}>⚙️ Admin</button>
            )}
          </nav>
          <div className="hdr-right">
            <div className="hdr-search desktop-only">
              <span className="hdr-search-ico" aria-hidden="true">⌕</span>
              <input className="hdr-search-inp" placeholder="Search products…" value={search} onChange={e => { setSearch(e.target.value); goShopForSearch(); }} />
            </div>
            <button className="hdr-icon-btn mobile-only" onClick={() => setMobileSearchOpen(v => !v)} aria-label="Search products">
              <span className="hdr-mobile-icon" aria-hidden="true">⌕</span>
            </button>
            <button className="hdr-wish-btn" onClick={() => navTo("wishlist")} aria-label="Open wishlist">
              ♡{wishlistCount > 0 && <span className="hdr-badge">{wishlistCount}</span>}
            </button>
            <button className="hdr-cart-btn" onClick={() => navTo("cart")} aria-label="Open cart">
              <span className="hdr-cart-glyph" aria-hidden="true">Bag</span>
              <span className="hdr-cart-label desktop-only">Cart</span>
              {cartCount > 0 && <span className="hdr-cart-count">{cartCount}</span>}
            </button>
            {currentUser ? (
              <div className="hdr-user-wrap" ref={menuRef}>
                <button className="hdr-user-btn" onClick={() => setUserMenuOpen(v => !v)}>
                  <div className="hdr-user-av">{currentUser.name[0].toUpperCase()}</div>
                  <span className="hdr-user-name desktop-only">{currentUser.name.split(" ")[0]}</span>
                  <span className="hdr-user-caret desktop-only">{userMenuOpen ? "▲" : "▼"}</span>
                </button>
                {userMenuOpen && (
                  <div className="hdr-user-menu">
                    <div className="hdr-um-header">
                      <div className="hdr-um-av">{currentUser.name[0].toUpperCase()}</div>
                      <div><strong>{currentUser.name}</strong><span>{currentUser.email}</span>{currentUser.role === "admin" && <span className="admin-role-badge">Admin</span>}</div>
                    </div>
                    <div className="hdr-um-divider" />
                    {currentUser.role === "admin" && <button className="hdr-um-item" onClick={() => { navTo("admin"); setUserMenuOpen(false); }}>⚙️ Admin Panel</button>}
                    <button className="hdr-um-item" onClick={() => { navTo("cart"); setUserMenuOpen(false); }}>🛒 My Cart</button>
                    <button className="hdr-um-item" onClick={() => { navTo("wishlist"); setUserMenuOpen(false); }}>♡ Wishlist</button>
                    <div className="hdr-um-divider" />
                    <button className="hdr-um-item hdr-um-logout" onClick={() => { onLogout(); setUserMenuOpen(false); }}>🚪 Sign Out</button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {mobileSearchOpen && (
          <div className="mobile-search-bar">
            <span className="hdr-search-ico" aria-hidden="true">⌕</span>
            <input className="hdr-search-inp" placeholder="Search products…" value={search} onChange={e => { setSearch(e.target.value); goShopForSearch(); }} autoFocus />
            <button onClick={() => setMobileSearchOpen(false)} style={{ padding: "0 12px", color: "var(--muted)", fontSize: "18px" }}>✕</button>
          </div>
        )}
        {availableCategories.length > 0 && (
          <div className="hdr-cats desktop-only">
            {availableCategories.map(c => (
              <button key={c.key} className="hdr-cat" onClick={() => selectCategory(c.name)}>{c.name}</button>
            ))}
          </div>
        )}
      </header>

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <div className="hdr-logo"><span className="hdr-logo-mark">ISO</span><span className="hdr-logo-text">ISmallOne</span></div>
              <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>
            {currentUser && (
              <div className="mobile-user-card">
                <div className="hdr-um-av">{currentUser.name[0].toUpperCase()}</div>
                <div><strong>{currentUser.name}</strong><span>{currentUser.email}</span>{currentUser.role === "admin" && <span className="admin-role-badge" style={{ display: "block", marginTop: "4px" }}>Admin</span>}</div>
              </div>
            )}
            <nav className="mobile-nav">
              {[["home", "🏠", "Home"], ["shop", "🛍️", "Shop All"], ["track-order", "📦", "Track Order"], ["about", "ℹ️", "About Us"], ["contact", "📞", "Contact"]].map(([k, ico, l]) => (
                <button key={k} className={`mobile-nav-btn ${page === k ? "active" : ""}`} onClick={() => navTo(k)}>
                  <span>{ico}</span><span>{l}</span><span className="mobile-nav-arrow">›</span>
                </button>
              ))}
              {currentUser?.role === "admin" && (
                <button className="mobile-nav-btn admin-mobile-btn" onClick={() => navTo("admin")}>
                  <span>⚙️</span><span>Admin Panel</span><span className="mobile-nav-arrow">›</span>
                </button>
              )}
            </nav>
            {availableCategories.length > 0 && (
              <>
                <div className="mobile-menu-divider" />
                <div className="mobile-menu-section-title">Categories</div>
                <div className="mobile-cats-grid">
                  {availableCategories.map(c => (
                    <button key={c.key} className="mobile-cat-chip" onClick={() => selectCategory(c.name)}>{c.name}</button>
                  ))}
                </div>
              </>
            )}
            {currentUser && (
              <>
                <div className="mobile-menu-divider" />
                <div className="mobile-menu-section-title">Account</div>
                <nav className="mobile-nav">
                  <button className="mobile-nav-btn" onClick={() => navTo("cart")}><span>🛒</span><span>My Cart ({cartCount})</span><span className="mobile-nav-arrow">›</span></button>
                  <button className="mobile-nav-btn" onClick={() => navTo("wishlist")}><span>♡</span><span>Wishlist ({wishlistCount})</span><span className="mobile-nav-arrow">›</span></button>
                  <button className="mobile-nav-btn" style={{ color: "#dc2626" }} onClick={() => { onLogout(); setMobileMenuOpen(false); }}><span>🚪</span><span>Sign Out</span><span className="mobile-nav-arrow">›</span></button>
                </nav>
              </>
            )}
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-section-title">Help</div>
            <nav className="mobile-nav">
              {[["track-order", "📦", "Track Order"], ["faq", "❓", "FAQ"], ["shipping-policy", "🚚", "Shipping Policy"], ["returns", "🔄", "Returns"]].map(([k, ico, l]) => (
                <button key={k} className="mobile-nav-btn" onClick={() => navTo(k)}><span>{ico}</span><span>{l}</span><span className="mobile-nav-arrow">›</span></button>
              ))}
            </nav>
            <div className="mobile-menu-footer">
              <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" className="mobile-wa-btn">
                <span>📱</span> Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductVisual({ product, className = "", label = "", loading = "lazy", imageOnly = false, preferVideo = false, forceImage = false }) {
  const imageSrc = product?.images?.[0] || product?.image || product?.thumbnail;
  const shouldShowVideo = product?.video && !imageOnly && preferVideo && !forceImage;
  if (shouldShowVideo) {
    return (
      <video key={product.video} className={className} poster={imageSrc || undefined} autoPlay muted loop playsInline preload="metadata">
        <source src={product.video} type="video/mp4" />
      </video>
    );
  }
  if (imageSrc) {
    return <SafeImage className={className} src={imageSrc} alt={product.name || label || "Product"} loading={loading} />;
  }
  if (!imageOnly && product?.video) {
    return (
      <video key={product.video} className={className} autoPlay muted loop playsInline preload="metadata">
        <source src={product.video} type="video/mp4" />
      </video>
    );
  }
  const fallbackClass = label && String(label).length <= 4 ? "sf-product-fallback" : "sf-product-skeleton";
  return <div className={`${className} sf-product-placeholder ${fallbackClass}`} aria-label={label || "Product image"}><span>{label || "ISO"}</span></div>;
}

// ─── HERO BANNER ──────────────────────────────────────────────────────────────
function HeroBanner({ openProduct, products }) {
  const routerNavigate = useNavigate();
  const heroProducts = useMemo(() => {
    const videoPicks = products.filter(hasProductVideo);
    const priority = products.filter(product => /earbud|headphone|audio|watch|charger|lamp|gadget|kitchen|home/i.test([product.name, product.category].join(" ")));
    return uniqueProductList([...videoPicks, ...priority, ...products]).slice(0, 6);
  }, [products]);
  const heroCopy = [
    ["Roz ke kaam, ab asaan.", "Smart gadgets jo waqai kaam aate hain."],
    ["Choti cheez, bara kaam.", "Room, kitchen aur phone setup ke liye useful picks."],
    ["Dekho, pasand karo, order karo.", "COD, quick support aur fair prices ek jagah."],
    ["Ghar ho ya desk, scene set.", "Useful accessories jo daily routine mein fit ho jati hain."],
    ["Naye deals, real kaam.", "ISmallOne shelf se rotating premium picks."],
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const mainProduct = heroProducts[activeSlide % Math.max(heroProducts.length, 1)];
  const [heroTitle, heroSubtitle] = heroCopy[activeSlide % heroCopy.length];

  useEffect(() => {
    if (heroProducts.length <= 1 && heroCopy.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveSlide(index => (index + 1) % Math.max(heroProducts.length, heroCopy.length));
    }, 3000);
    return () => clearInterval(timer);
  }, [heroProducts.length, heroCopy.length]);

  return (
    <section className="sf-hero">
      <div className="sf-hero-copy sf-hero-fade" key={`copy-${activeSlide}`}>
        <div className="sf-kicker">ISmallOne • Nayi collection</div>
        <h1>{heroTitle}</h1>
        <p>{heroSubtitle}</p>
        <div className="sf-hero-actions">
          <button className="sf-btn sf-btn-primary" onClick={() => mainProduct ? openProduct(mainProduct) : routerNavigate(pagePath("shop"))}>Top Products Dekho</button>
          <button className="sf-btn sf-btn-secondary" onClick={() => routerNavigate(pagePath("shop"))}>View All Products</button>
        </div>
        <div className="sf-hero-trust"><span>Cash on Delivery</span><span className="sf-hero-deal">4 items par free shipping</span><span>Dispatch se pehle checked</span><span>7 din return support</span></div>
      </div>
      <div className="sf-hero-showcase">
        <div className="sf-hero-label">Premium pick</div>
        <button
          className="sf-hero-product sf-hero-fade"
          key={`product-${mainProduct?.id || activeSlide}`}
          onClick={() => mainProduct ? openProduct(mainProduct) : routerNavigate(pagePath("shop"))}
        >
          <ProductVisual product={mainProduct} className="sf-hero-product-img" label="Featured Product" loading="eager" preferVideo />
          <span>{mainProduct ? cleanProductName(mainProduct.name) : "Featured Product"}</span>
          <strong>{mainProduct ? money(mainProduct.price) : "Shop now"}</strong>
        </button>
        <div className="sf-hero-dots" aria-label="Featured product slides">
          {Array.from({ length: Math.max(heroProducts.length, 1) }).map((_, index) => (
            <button
              key={index}
              className={index === activeSlide % Math.max(heroProducts.length, 1) ? "active" : ""}
              onClick={() => setActiveSlide(index)}
              aria-label={`Show premium pick ${index + 1}`}
            />
          ))}
        </div>
        <div className="sf-hero-note">Cash on Delivery nationwide</div>
      </div>
    </section>
  );
}

// ─── CERTIFICATIONS ───────────────────────────────────────────────────────────
function CertificationsSection() {
  const certs = [
    { icon: "🏅", title: "ISO Certified Quality", sub: "Products meet international standards", color: "#f59e0b" },
    { icon: "🔒", title: "SSL Secured Checkout", sub: "256-bit encryption on all transactions", color: "#3b82f6" },
    { icon: "✅", title: "100% Authentic Products", sub: "Verified & sourced from trusted suppliers", color: "#10b981" },
    { icon: "🛡️", title: "Order Protection", sub: "Full refund on damaged items", color: "#8b5cf6" },
    { icon: "🇵🇰", title: "Pakistan Trusted Store", sub: "Registered & operating since 2021", color: "#d90429" },
    { icon: "💬", title: "24/7 WhatsApp Support", sub: "Dedicated team always available", color: "#25D366" },
  ];
  return (
    <section className="cert-sec">
      <div className="sec-head sec-centered">
        <div className="eyebrow">Trust & Credibility</div>
        <h2 className="sec-h2">Certifications & Guarantees</h2>
        <p className="sec-sub sec-sub-center">Shop with complete confidence — certified, verified, and trusted</p>
      </div>
      <div className="cert-grid">
        {certs.map((c, i) => (
          <div key={c.title} className="cert-card" style={{ "--cert-color": c.color, animationDelay: `${i * 0.1}s` }}>
            <div className="cert-icon-ring"><span className="cert-icon">{c.icon}</span></div>
            <div className="cert-badge-line"><div className="cert-badge-dot" /></div>
            <h4 className="cert-title">{c.title}</h4>
            <p className="cert-sub-text">{c.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── TICKER ───────────────────────────────────────────────────────────────────
function TickerBar() {
  const items = ["⭐ Ayesha from Lahore — Fast delivery!", "⭐ Bilal from Karachi — Easy COD.", "⭐ Hamza from Islamabad — Product matched perfectly.", "⭐ Mariam from Faisalabad — Smooth ordering.", "⭐ Sana from Rawalpindi — Great value.", "⭐ Usman from Multan — Will order again!"];
  return (
    <div className="ticker">
      <div className="ticker-label">Live Reviews</div>
      <div className="ticker-track-wrap"><div className="ticker-track">{[...items, ...items].map((t, i) => <span key={i} className="ticker-item">{t}</span>)}</div></div>
    </div>
  );
}

// ─── TRUST BAR ────────────────────────────────────────────────────────────────
function TrustBar() {
  const items = [{ ico: "🚚", title: "Free Delivery", sub: "Orders above Rs 3,000" }, { ico: "💵", title: "Cash on Delivery", sub: "Available nationwide" }, { ico: "🔄", title: "Easy Returns", sub: "7-day return policy" }, { ico: "🛡️", title: "Secure Checkout", sub: "100% trusted store" }, { ico: "💬", title: "WhatsApp Support", sub: "Quick order help" }];
  return (
    <div className="trust-bar">
      {items.map(item => (<div key={item.title} className="trust-item"><span className="trust-ico">{item.ico}</span><div className="trust-text"><strong>{item.title}</strong><span>{item.sub}</span></div></div>))}
    </div>
  );
}

// ─── CATEGORY GRID ────────────────────────────────────────────────────────────
function CategoryGrid({ products = [], onCategorySelect }) {
  const categoryItems = useMemo(() => [...STOREFRONT_CATEGORIES, ...STOREFRONT_CATEGORIES], []);
  return (
    <section className="sec cat-sec sf-cats-section">
      <div className="sec-head sec-centered"><div className="eyebrow">Curated departments</div><h2 className="sec-h2">Shop By Categories</h2></div>
      <div className="sf-cat-marquee" aria-label="Store categories">
        <div className="cat-grid sf-cat-grid sf-cat-track-live">
          {categoryItems.map((c, index) => {
            const matchedProduct = matchProductForCategory(products, c);
            return (
              <button key={`${c.name}-${index}`} className={`cat-card sf-cat-card ${matchedProduct ? "" : "sf-cat-fallback-card"}`} onClick={() => onCategorySelect?.(c.name)} aria-label={`Shop ${c.name}`}>
                <div className="cat-icon-wrap sf-cat-icon"><ProductVisual product={matchedProduct} className="sf-cat-img" label={c.icon} imageOnly /></div>
                <span className="cat-nm">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrendingCategories({ categories, activeCategory, onChange }) {
  return (
    <section className="sec sf-trending-section">
      <div className="sec-head sec-centered"><div className="eyebrow">Quick filter</div><h2 className="sec-h2">Trending Categories</h2></div>
      <div className="sf-pill-row">
        {categories.map(cat => <button key={cat} className={`sf-filter-pill ${activeCategory === cat ? "active" : ""}`} onClick={() => onChange(cat)}>{cat}</button>)}
      </div>
    </section>
  );
}

function SaleRibbon() {
  const items = ["Sale live", "50% tak discount", "Cash on Delivery", "Limited stock", "Free delivery deals"];
  return (
    <div className="sale-ribbon" aria-label="Current sale offers">
      <div className="sale-ribbon-track">
        {[...items, ...items, ...items].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </div>
    </div>
  );
}

// ─── FLASH SALE ───────────────────────────────────────────────────────────────
function FlashSale({ saleEndsAt, products, openProduct, addToCart, wishlist, toggleWishlist }) {
  return (
    <section className="flash-sec">
      <div className="flash-hdr">
        <div className="flash-hdr-left"><span className="flash-pill">⚡ Flash Sale</span><h2 className="flash-h2">Today's Best Deals</h2><p className="flash-sub">Limited time — grab them before they're gone</p></div>
        <div className="flash-cd"><span className="flash-ends-lbl">⏱ Sale ends in:</span><CountdownTimer saleEndsAt={saleEndsAt} /></div>
      </div>
      <div className="flash-grid">{products.slice(0, 4).map(p => (<ProductCard key={p.id} product={p} onOpen={openProduct} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isWishlisted={wishlist.includes(p.id)} isFlash />))}</div>
    </section>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
function ProductCard({ product, onOpen, onAddToCart, onToggleWishlist, isWishlisted, isFlash }) {
  const off = percentageOff(product.price, product.compareAtPrice);
  const [hov, setHov] = useState(false);
  const cleanName = cleanProductName(product.name);
  const toneClass = categoryToneClass(product.category);
  const defaultVariant = product.variants?.[0] || null;
  const promoLabel = `-${off > 0 ? off : fallbackSalePercent(product)}%`;

  return (
    <div className={`pcard ${toneClass} ${isFlash ? "pcard-flash" : ""}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <div className="pcard-img-wrap">
        <button className="pcard-img-btn" onClick={() => onOpen(product)} aria-label={`View ${cleanName}`}>
          <ProductVisual product={product} className={`pcard-img ${hov ? "pcard-img-z" : ""}`} label={cleanName} preferVideo={!hov} forceImage={hov} />
        </button>
        <div className="pcard-cat pcard-cat-on-img">{promoLabel}</div>
        <button className={`pcard-wish ${isWishlisted ? "wished" : ""}`} onClick={() => onToggleWishlist(product.id)} aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}>{isWishlisted ? "♥" : "♡"}</button>
      </div>
      <div className="pcard-body">
        <h3 className="pcard-name" onClick={() => onOpen(product)}>{cleanName}</h3>
        <div className="pcard-chips">
          <span>COD</span>
          {(product.rating || product.reviewCount) && <span>{product.rating || 5}★</span>}
          {defaultVariant?.label && <span>{defaultVariant.label}</span>}
        </div>
        {(product.reviewCount || product.rating) ? <div className="pcard-rating"><RatingStars rating={product.rating || 5} /><span className="pcard-rv">{product.rating || 5} ({product.reviewCount || 24})</span></div> : null}
        <div className="pcard-buyline">
          <div className="pcard-prices">
            <span className="pcard-price-label">Today price</span>
            <strong className="pcard-price">{money(product.price)}</strong>
            {product.compareAtPrice > product.price && <span className="pcard-old">{money(product.compareAtPrice)}</span>}
          </div>
          <Button variant="primary" size="sm" className="pcard-add" onClick={() => onAddToCart(product, 1, defaultVariant)}>Add to Cart</Button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT ROW ──────────────────────────────────────────────────────────────
function ProductRow({ title, eyebrow, products, openProduct, addToCart, wishlist, toggleWishlist }) {
  const ref = useRef(null);
  const scroll = dir => { if (ref.current) ref.current.scrollBy({ left: dir * 280, behavior: "smooth" }); };
  const isBestSelling = /best selling/i.test(title);
  return (
    <section className={`sec product-row-sec ${isBestSelling ? "best-selling-row" : ""}`}>
      <div className="row-hdr"><div><div className="eyebrow">{eyebrow}</div><h2 className="sec-h2">{title}</h2>{isBestSelling && <div className="best-scroll-hint">Swipe right for more hot deals <span>→</span></div>}</div><div className="row-controls"><button className="row-arr" onClick={() => scroll(-1)}>‹</button><button className="row-arr row-arr-next" onClick={() => scroll(1)}>›</button><button className="view-all">View All →</button></div></div>
      <div className={`hscroll ${isBestSelling ? "hscroll-best" : ""}`} ref={ref}><div className="hscroll-inner">{products.map(p => (<div key={p.id} className="hscroll-item"><ProductCard product={p} onOpen={openProduct} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isWishlisted={wishlist.includes(p.id)} /></div>))}</div></div>
    </section>
  );
}

// ─── PRODUCT GRID ─────────────────────────────────────────────────────────────
function PGrid({ products, openProduct, addToCart, wishlist, toggleWishlist }) {
  if (!products.length) return <div className="empty-state"><span className="empty-ico">📦</span><h3>No products found</h3><p>Try a different search or category.</p></div>;
  return <div className="pgrid">{products.map(p => (<ProductCard key={p.id} product={p} onOpen={openProduct} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isWishlisted={wishlist.includes(p.id)} />))}</div>;
}

// ─── BRAND BANNER ─────────────────────────────────────────────────────────────
function BrandBanner({ openProduct, product }) {
  const off = percentageOff(product?.price, product?.compareAtPrice);
  return (
    <section className="brand-sec">
      <div className="brand-inner">
        <div className="brand-copy">
          <span className="brand-pill">🏆 Editor's Pick</span>
          <h2 className="brand-h2">Premium Quality,<br />Unbeatable Price</h2>
          <p className="brand-p">Hand-picked products, trusted sellers, seamless shopping — from browsing to delivery at your doorstep.</p>
          <div className="brand-feats">{["30-day satisfaction guarantee", "Authentic products only", "COD with no extra charges", "Delivered across Pakistan"].map(f => (<div key={f} className="brand-feat"><span className="feat-check">✓</span> {f}</div>))}</div>
          <button className="btn-dark-lg" onClick={() => openProduct(product)}>Shop This Deal →</button>
        </div>
        <div className="brand-visual">
          <div className="brand-img-wrap">
            {product?.video ? (
              <video src={product.video} poster={product?.images?.[0]} className="brand-img" autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain", background: "var(--color-bg)" }} />
            ) : (
              <img className="brand-img" src={product?.images?.[0]} alt={product?.name} />
            )}
            {off > 0 && <div className="brand-save">Save {off}%</div>}
          </div>
          <div className="brand-prod-row"><strong>{product?.name}</strong><span>{money(product?.price)}</span></div>
        </div>
      </div>
    </section>
  );
}

// ─── PROMO STRIP ──────────────────────────────────────────────────────────────
function PromoStrip() {
  const routerNavigate = useNavigate();
  return (
    <section className="promo-strip">
      <div className="promo-card promo-card-1"><div className="promo-content"><span className="promo-tag">Summer 2026</span><h3>Beat the Heat</h3><p>Up to 40% off on cooling gadgets</p><button className="promo-btn" onClick={() => routerNavigate(pagePath("shop"))}>Shop Now →</button></div><span className="promo-emoji">☀️</span></div>
      <div className="promo-card promo-card-2"><div className="promo-content"><span className="promo-tag">New Arrivals</span><h3>Smart Watch Season</h3><p>Latest models, best prices in PK</p><button className="promo-btn" onClick={() => routerNavigate(pagePath("shop"))}>Explore →</button></div><span className="promo-emoji">⌚</span></div>
      <div className="promo-card promo-card-3"><div className="promo-content"><span className="promo-tag">Live Tracking</span><h3>Track Your Order</h3><p>Check your order status anytime</p><button className="promo-btn" onClick={() => routerNavigate(pagePath("track-order"))}>Track Now →</button></div><span className="promo-emoji">📦</span></div>
    </section>
  );
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
function Testimonials() {
  const data = [{ name: "Ali Raza", city: "Lahore", text: "Quality zabardast hai. Delivery fast thi aur COD se order easy ho gaya.", rating: 5 }, { name: "Hina Fatima", city: "Islamabad", text: "Mini chopper aur blender dono kaam ke hain. Packing bhi neat thi.", rating: 5 }, { name: "Usman Khan", city: "Karachi", text: "Fast charger original nikla. WhatsApp support ne quickly guide kiya.", rating: 5 }, { name: "Sara Ahmed", city: "Rawalpindi", text: "Product same as shown. Return policy dekh kar trust aa gaya.", rating: 5 }, { name: "Bilal Khan", city: "Multan", text: "Packaging premium thi, price bhi reasonable. Dobara order karunga.", rating: 5 }, { name: "Mariam Noor", city: "Faisalabad", text: "WhatsApp support quick tha. Proper brand feel hai.", rating: 5 }];
  return (
    <section className="testi-sec sf-review-section">
      <div className="sec-head sec-centered"><div className="eyebrow">Customer proof</div><h2 className="sec-h2">Store Reviews</h2></div>
      <div className="testi-grid">{data.map((r, i) => (<div key={i} className="testi-card"><div className="testi-quote">"</div><RatingStars rating={r.rating} size="md" /><p className="testi-text">{r.text}</p><div className="testi-author"><div className="testi-av">{r.name[0]}</div><div className="testi-author-info"><strong>{r.name}</strong><span>📍 {r.city}</span></div></div></div>))}</div>
    </section>
  );
}

// ─── STATS SECTION ────────────────────────────────────────────────────────────
function StatsSection() {
  const stats = [
    { num: "1000+", label: "Happy Customers", sub: "Across Pakistan" },
    { num: "95%", label: "COD Success Rate", sub: "Pay after receiving" },
    { num: "24", label: "Hour Dispatch", sub: "Fast order processing" },
    { num: "7", label: "Day Return Support", sub: "Easy replacement help" },
  ];
  return (
    <section className="stats-sec">
      <div className="stats-inner">
        <div className="stats-grid">{stats.map(s => (<div key={s.label} className="stat-card"><strong className="stat-num"><AnimatedCounter target={s.num} duration={1300} /></strong><span className="stat-label">{s.label}</span><small className="stat-sub">{s.sub}</small></div>))}</div>
      </div>
    </section>
  );
}

function StoreFAQ() {
  const faqs = [
    ["Do you offer Cash on Delivery?", "Yes. Cash on Delivery is available across Pakistan on eligible orders."],
    ["How long does delivery take?", "Orders are processed within 24 hours and usually delivered in 3 to 5 working days."],
    ["Can I return a product?", "Yes. You can request a 7-day return or replacement for damaged or incorrect items."],
    ["Are products checked before dispatch?", "Yes. Products are hand-checked before packing whenever possible."],
  ];
  return (
    <section className="sec sf-faq-section">
      <div className="sec-head sec-centered"><div className="eyebrow">Need help?</div><h2 className="sec-h2">FAQs</h2></div>
      <div className="sf-faq-list">
        {faqs.map(([q, a], i) => <Accordion key={q} title={q} open={i === 0}><p className="acc-p">{a}</p></Accordion>)}
      </div>
    </section>
  );
}

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────
function Newsletter({ onAdminAccess }) {
  return (
    <section className="nl-sec">
      <div className="nl-inner">
        <div className="nl-ico">🎁</div>
        <h2>Exclusive Deals Pehle Paayen</h2>
        <p>1,000+ shoppers ke saath new arrivals, flash deals, aur WhatsApp-only offers receive karein.</p>
        <div className="nl-form"><input className="nl-inp" placeholder="Enter your phone number or email" /><button className="nl-btn" onClick={() => alert("Thank you for subscribing!")}>Subscribe & Save</button></div>
        <div className="nl-trust">No spam  ·  Unsubscribe anytime  ·  Exclusive deals</div>
        <button type="button" className="admin-dot" aria-label="Admin access" onClick={onAdminAccess} />
      </div>
    </section>
  );
}

// ─── SITE FOOTER ──────────────────────────────────────────────────────────────
function SiteFooter() {
  const routerNavigate = useNavigate();
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-col footer-quick">
          {/* FIXED: footer follows requested three-column layout while keeping the ISmallOne brand visible. */}
          <div className="footer-logo"><span className="hdr-logo-mark">ISO</span><span className="footer-logo-txt">ISmallOne</span></div>
          <p>Gadgets, accessories, and useful finds selected for everyday Pakistani homes.</p>
          <h4>Quick Links</h4><button onClick={() => routerNavigate(pagePath("home"))}>Home</button><button onClick={() => routerNavigate(pagePath("shop"))}>All Products</button><button onClick={() => routerNavigate(pagePath("track-order"))}>Track Order</button><button onClick={() => routerNavigate(pagePath("about"))}>About Us</button><button onClick={() => routerNavigate(pagePath("contact"))}>Contact</button>
        </div>
        <div className="footer-col"><h4>Policies</h4><button onClick={() => routerNavigate(pagePath("privacy-policy"))}>Privacy Policy</button><button onClick={() => routerNavigate(pagePath("returns"))}>Refund Policy</button><button onClick={() => routerNavigate(pagePath("shipping-policy"))}>Shipping Policy</button><button onClick={() => routerNavigate(pagePath("terms"))}>Terms of Service</button><button onClick={() => routerNavigate(pagePath("faq"))}>FAQs</button></div>
        <div className="footer-col footer-newsletter"><h4>Newsletter</h4><p>Enter your email for updates</p><div className="footer-signup"><input placeholder="Email address" /><button>Get Deals</button></div><div className="footer-socials"><a href="#" className="social-a">f</a><a href="#" className="social-a">ig</a></div></div>
      </div>
      <div className="footer-bottom"><span>© 2026 ISmallOne PK. All rights reserved.</span><span>Cash on Delivery - 7-Day Return - WhatsApp Support</span></div>
    </footer>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ products, wishlist, toggleWishlist, openProduct, addToCart, onCategorySelect, onAdminAccess }) {
  const routerNavigate = useNavigate();
  const featured = useMemo(() => products.filter(p => p.featured), [products]);
  const allSortedProducts = useMemo(() => {
    return [...products].sort((a, b) => getSoldCount(b) - getSoldCount(a));
  }, [products]);
  const bestSellerLimit = getBestSellerLimit(allSortedProducts.length);
  const topProducts = useMemo(() => allSortedProducts.slice(0, bestSellerLimit), [allSortedProducts, bestSellerLimit]);
  const heroProducts = useMemo(() => {
    const videoPicks = products.filter(hasProductVideo);
    const source = featured.length ? featured : topProducts;
    return uniqueProductList([...videoPicks, ...source, ...topProducts, ...allSortedProducts]).slice(0, 6);
  }, [products, featured, topProducts, allSortedProducts]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [homeProductPage, setHomeProductPage] = useState(1);
  const homepageCategories = useMemo(() => {
    return ["All", ...STOREFRONT_CATEGORIES.map(category => category.name)];
  }, []);
  const filteredHomeProducts = useMemo(() => {
    if (activeCategory === "All") return allSortedProducts;
    return allSortedProducts.filter(p => p.category === activeCategory);
  }, [activeCategory, allSortedProducts]);
  const totalHomePages = Math.max(1, Math.ceil(filteredHomeProducts.length / 9));
  const safeHomePage = Math.min(homeProductPage, totalHomePages);
  const visibleProducts = useMemo(() => {
    const start = (safeHomePage - 1) * 9;
    return filteredHomeProducts.slice(start, start + 9);
  }, [filteredHomeProducts, safeHomePage]);
  useEffect(() => {
    setHomeProductPage(1);
  }, [activeCategory]);
  useEffect(() => {
    setHomeProductPage(page => Math.min(page, totalHomePages));
  }, [totalHomePages]);
  return (
    <main className="storefront-light">
      <HeroBanner openProduct={openProduct} products={heroProducts.length ? heroProducts : allSortedProducts} />
      <CategoryGrid products={allSortedProducts} onCategorySelect={onCategorySelect} />
      <TrendingCategories categories={homepageCategories} activeCategory={activeCategory} onChange={setActiveCategory} />
      <SaleRibbon />
      <section className="sec sf-best-section">
        <div className="sec-head"><div><div className="eyebrow">Featured collection</div><h2 className="sec-h2">All Products</h2><p className="sec-sub">Rozmarra ke kaam ke products, carefully selected.</p></div><button className="view-all" onClick={() => routerNavigate(pagePath("shop"))}>View All</button></div>
        {visibleProducts.length ? (
          <PGrid products={visibleProducts} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
        ) : (
          <div className="empty-state home-empty"><h3>No products found</h3><p>Is category mein abhi products add nahi hue.</p></div>
        )}
        {totalHomePages > 1 && (
          <div className="home-pagination" aria-label="All products pages">
            <button className="page-btn page-arrow" disabled={safeHomePage === 1} onClick={() => setHomeProductPage(page => Math.max(1, page - 1))}>‹</button>
            {getPaginationItems(safeHomePage, totalHomePages).map(item => (
              typeof item === "string"
                ? <span key={item} className="page-ellipsis">...</span>
                : <button key={item} className={`page-btn ${item === safeHomePage ? "active" : ""}`} aria-current={item === safeHomePage ? "page" : undefined} onClick={() => setHomeProductPage(item)}>{item}</button>
            ))}
            <button className="page-btn page-arrow" disabled={safeHomePage === totalHomePages} onClick={() => setHomeProductPage(page => Math.min(totalHomePages, page + 1))}>›</button>
          </div>
        )}
      </section>
      <section className="sf-selling-section">
        <ProductRow title="Best Selling" eyebrow="Customer favorites" products={topProducts} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      </section>
      <StatsSection />
      <Testimonials />
      <StoreFAQ />
      <Newsletter onAdminAccess={onAdminAccess} />
    </main>
  );
}

// ─── SHOP PAGE ────────────────────────────────────────────────────────────────
function ShopPage({ products, search, wishlist, toggleWishlist, openProduct, addToCart }) {
  const routerNavigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState("featured");
  const cat = searchParams.get("category") || "All";
  const cats = useMemo(() => {
    const productCats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return ["All", ...new Set([...STOREFRONT_CATEGORIES.map(category => category.name), ...productCats, cat].filter(Boolean))];
  }, [products, cat]);
  const setCat = (nextCategory) => {
    routerNavigate(pagePath("shop", { category: nextCategory }));
  };
  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) list = list.filter(p => [p.name, p.category, p.shortDescription].join(" ").toLowerCase().includes(search.toLowerCase()));
    if (cat !== "All") list = list.filter(p => p.category === cat);
    if (sortBy === "price-low") list.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") list.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sortBy === "sold") list.sort((a, b) => getSoldCount(b) - getSoldCount(a));
    return list;
  }, [products, search, cat, sortBy]);
  return (
    <main className="product-page-shell">
      <section className="sec">
        <div className="sec-head"><div className="eyebrow">Browse Store</div><h1 className="sec-h2">All Products</h1><p className="sec-sub">Showing {filtered.length} products</p></div>
        <div className="shop-filters">
          <div className="cat-chips">{cats.map(c => (<button key={c} className={`cat-chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>))}</div>
          <div className="sort-row"><span>Sort by:</span><select className="sort-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="rating">Top Rated</option><option value="sold">Best Selling</option></select></div>
        </div>
        <PGrid products={filtered} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      </section>
    </main>
  );
}

// ─── PRODUCT PAGE ─────────────────────────────────────────────────────────────
function PdpSaleTrust() {
  return (
    <div className="pdp-title-trust" aria-label="Sale item, rated 4.5 stars, trusted">
      <span className="pdp-sale-sticker">SALE</span>
      <span className="pdp-half-stars" aria-hidden="true">
        <span>★</span><span>★</span><span>★</span><span>★</span><span className="half">★</span>
      </span>
      <span className="pdp-trusted-word">Trusted</span>
    </div>
  );
}

function PdpDealAlert({ off, timerKey }) {
  const saleText = off > 0 ? `-${off}% Sale` : "Sale Live";
  const [secondsLeft, setSecondsLeft] = useState(60 * 60);

  useEffect(() => {
    setSecondsLeft(60 * 60);
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timerKey]);

  const saleTimer = useMemo(() => {
    const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((secondsLeft / 60) % 60)).padStart(2, "0");
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [secondsLeft]);
  const progressPct = `${Math.max(0, Math.min(100, (secondsLeft / 3600) * 100))}%`;

  return (
    <div className="pdp-deal-alert" aria-label="Free delivery limited time sale offer">
      <span className="pdp-deal-icon" aria-hidden="true">🚚</span>
      <span className="pdp-deal-main">Free Delivery!</span>
      <span className="pdp-deal-sub">Limited Time Only</span>
      <span className="pdp-deal-timer" style={{ "--timer-progress": progressPct }}><span>Sale Ends In</span><strong>{saleTimer}</strong></span>
      <span className="pdp-deal-sale">{saleText}</span>
    </div>
  );
}

function ProductPage({ settings, product, products, wishlist, toggleWishlist, openProduct, addToCart, buyNow }) {
  const hasVideo = !!product.video;
  const mediaItems = [
    ...(product.images || []).map(src => ({ type: "image", src })),
    ...(hasVideo ? [{ type: "video", src: product.video }] : []),
  ];
  const [mediaIdx, setMediaIdx] = useState(0);
  const variantOptions = useMemo(() => Array.isArray(product.variants) ? product.variants : [], [product.variants]);
  const defaultBundle = useMemo(() => ({
    qty: 1,
    discountPct: 0,
    label: "Recommended",
    popular: true,
    totalPrice: product.price,
    originalPrice: product.compareAtPrice || product.price,
  }), [product.compareAtPrice, product.price]);
  const [variant, setVariant] = useState(() => variantOptions[0] || null);
  const [show3d, setShow3d] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(() => defaultBundle);
  const [infoOpen, setInfoOpen] = useState(false);
  const [videoAspect, setVideoAspect] = useState(null);
  const autoSlideRef = useRef(null);

  useEffect(() => {
    setMediaIdx(0);
    setVariant(variantOptions[0] || null);
    setSelectedBundle(defaultBundle);
    setInfoOpen(false);
    setShow3d(false);
    setVideoAspect(null);
  }, [defaultBundle, product.id, variantOptions]);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (mediaItems.length <= 1) return;
    autoSlideRef.current = setInterval(() => {
      setMediaIdx(i => (i + 1) % mediaItems.length);
    }, 4000);
    return () => clearInterval(autoSlideRef.current);
  }, [product.id, mediaItems.length]);

  const off = percentageOff(product.price, product.compareAtPrice);
  const dealOff = off > 0 ? off : fallbackSalePercent(product);
  const viewNow = 18 + ((product.soldCount || 10) % 31);
  const effectiveUnitPrice = selectedBundle ? Math.round(product.price * (1 - selectedBundle.discountPct / 100)) : (variant?.price || product.price);
  const wa = ["Assalam o Alaikum,", "", `I want to order from ${settings.storeName}.`, `Product: ${product.name}`, `Variant: ${variant?.label || "Default"}`, `Quantity: ${selectedBundle?.qty || 1}`, `Price: ${money(selectedBundle?.totalPrice || product.price)}`, "", "Please guide me about delivery."].join("\n");

  const currentMedia = mediaItems[mediaIdx] || null;
  // FIXED: quantity selector updates the same pricing object used by bundle/cart actions.
  const updateQuantity = useCallback((nextQty) => {
    const qty = clamp(Math.round(Number(nextQty) || 1), 1, 99);
    const discountPct = qty === 2 ? 20 : qty === 3 ? 30 : 0;
    const label = qty === 1 ? "Recommended" : qty === 2 ? "20% OFF" : qty === 3 ? "30% OFF" : "Custom";
    const unitPrice = Math.round(product.price * (1 - discountPct / 100));
    setSelectedBundle({
      qty,
      discountPct,
      label,
      totalPrice: unitPrice * qty,
      originalPrice: (product.compareAtPrice || product.price) * qty,
    });
  }, [product.compareAtPrice, product.price]);

  const reviews = product.reviews?.length ? product.reviews : [
    { id: 1, name: "Ali R.", date: "2026-04-20T10:00:00Z", rating: 5, text: "Product bohat zabardast hai, bilkul same as shown 🔥 Highly recommended." },
    { id: 2, name: "Sara M.", date: "2026-04-18T14:30:00Z", rating: 5, text: "Original product and fast delivery. Very satisfied with the quality!" },
    { id: 3, name: "Usman A.", date: "2026-04-15T09:15:00Z", rating: 4, text: "Good experience overall. Pakistan bhar mein aisi service rare hai." }
  ];

  return (
    <main className="pdp-page">
      <section className="sec">
        <div className="pdp">
          <div className="pdp-mobile-head">
            <div className="pdp-cat">{product.category}</div>
            <PdpDealAlert off={dealOff} timerKey={product.id} />
            <h1 className="pdp-title">{cleanProductName(product.name)}</h1>
            <PdpSaleTrust />
          </div>
          <div className="pdp-gallery">
            <div
              className={`pdp-main-box ${currentMedia?.type === "video" ? "pdp-main-box-video" : ""}`}
              style={currentMedia?.type === "video" && videoAspect ? { "--pdp-media-aspect": videoAspect } : undefined}
            >
              {show3d ? (
                <Product3DViewer images={product.images} productName={product.name} />
              ) : currentMedia?.type === "video" ? (
                <video
                  key={currentMedia.src}
                  src={currentMedia.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="pdp-video"
                  onLoadedMetadata={event => {
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth && videoHeight) setVideoAspect(`${videoWidth} / ${videoHeight}`);
                  }}
                />
              ) : (
                <SafeImage className="pdp-main-img" src={currentMedia?.src} alt={cleanProductName(product.name)} loading="eager" />
              )}
              {off > 0 && <div className="pdp-off-badge">-{off}% OFF</div>}
              {product.images?.length > 0 && (
                <button className="pdp-3d-toggle" onClick={() => setShow3d(v => !v)}>{show3d ? "📷 Photos" : "🔄 360° View"}</button>
              )}
            </div>
            {!show3d && mediaItems.length > 1 && (
              <div className="pdp-thumbs">
                {mediaItems.map((item, i) => (
                  <button key={i} className={`pdp-thumb ${mediaIdx === i ? "active" : ""}`}
                    onClick={() => { setMediaIdx(i); clearInterval(autoSlideRef.current); }}>
                    {item.type === "video"
                      ? <div className="pdp-video-thumb">▶</div>
                      : <SafeImage src={item.src} alt="" className="pdp-thumb-img" />
                    }
                  </button>
                ))}
              </div>
            )}
            <div className="pdp-trust-lines">
              <div className="tl-item">Original product checked before dispatch</div>
              <div className="tl-item">Cash on Delivery across Pakistan</div>
              <div className="tl-item">Order support available on WhatsApp</div>
              <div className="tl-item">Easy replacement for damaged items</div>
            </div>
          </div>
          <div className="pdp-info">
            <div className="pdp-cat">{product.category}</div>
            <PdpDealAlert off={dealOff} timerKey={product.id} />
            <h1 className="pdp-title">{cleanProductName(product.name)}</h1>
            <PdpSaleTrust />
            <div className="pdp-rating-row"><RatingStars rating={product.rating || 5} size="md" /><span className="pdp-rv">Rated {product.rating || 5}/5 · {(product.reviewCount || 0) + 24} reviews</span><span className="pdp-verified">✓ Verified</span></div>
            {/* FIXED: PDP trust badge row added per audit spec. */}
            <div className="pdp-trust-badges"><span>Hand-Checked</span><span>24hr Processing</span><span>COD Available</span></div>
            <div className="pdp-price-row">
              <strong className="pdp-price">{money(selectedBundle?.totalPrice || product.price)}</strong>
              {(selectedBundle?.originalPrice || product.compareAtPrice) > (selectedBundle?.totalPrice || product.price) && (
                <><span className="pdp-old">{money(selectedBundle?.originalPrice || product.compareAtPrice)}</span><span className="pdp-save">You save {money((selectedBundle?.originalPrice || product.compareAtPrice) - (selectedBundle?.totalPrice || product.price))}</span></>
              )}
            </div>
            <div className="pdp-stock-strip">
              <ScarcityMeter stockLeft={product.stockLeft || 5} soldCount={product.soldCount || 100} />
              <div className="pdp-proof"><span><strong>{viewNow}</strong> viewing now</span><span><strong>{(product.soldCount || 100)}+</strong> sold</span></div>
            </div>
            <button type="button" className={`pdp-archive-bar ${infoOpen ? "open" : ""}`} aria-expanded={infoOpen} onClick={() => setInfoOpen(v => !v)}>{STORE_NAME} quality promise <span>{infoOpen ? "▲" : "▼"}</span></button>
            <div className={`pdp-archive-content ${infoOpen ? "open" : ""}`}><p>Every order is packed carefully, checked before dispatch, and supported by {STORE_NAME} after purchase.</p></div>
            {/* FIXED: quantity selector added before bundle rows. */}
            <div className="pdp-qty-selector" aria-label="Quantity selector">
              <span>Quantity</span>
              <div className="pdp-qty-controls">
                <button type="button" onClick={() => updateQuantity((selectedBundle?.qty || 1) - 1)} aria-label="Decrease quantity">−</button>
                <strong>{selectedBundle?.qty || 1}</strong>
                <button type="button" onClick={() => updateQuantity((selectedBundle?.qty || 1) + 1)} aria-label="Increase quantity">+</button>
              </div>
            </div>
            {variantOptions.length > 0 && (
              <div className="pdp-variants"><h4>Select Variant:</h4><div className="var-row">{variantOptions.map(v => (<button key={v.id} className={`var-chip ${variant?.id === v.id ? "active" : ""}`} onClick={() => setVariant(v)}>{v.label}</button>))}</div></div>
            )}
            <BundleSelector product={product} selectedBundle={selectedBundle} onSelect={setSelectedBundle} />
            <div className="pdp-cta-row">
              <Button variant="primary" size="lg" className="pdp-add-btn" onClick={() => addToCart(product, selectedBundle?.qty || 1, variant, effectiveUnitPrice)}>Add to Cart</Button>
              <Button variant="outline" size="lg" className="pdp-buy-btn" onClick={() => buyNow(product, selectedBundle?.qty || 1, variant, effectiveUnitPrice)}>Order with COD</Button>
            </div>
            <div className="pdp-safe-checkout"><span aria-hidden="true">🔒</span> Guaranteed Safe Checkout</div>
            <a className="pdp-wa-btn pdp-wa-tertiary" href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer">Order on WhatsApp</a>
            <div className="pdp-offer"><strong>Special Offer:</strong> Get 10% off on advance full payment</div>
            <div className="pdp-timeline">
              <div className="tl-step"><span className="tl-ico">📦</span><strong>Ordered</strong><span>Today</span></div>
              <div className="tl-line" />
              <div className="tl-step"><span className="tl-ico">🏭</span><strong>Dispatched</strong><span>Tomorrow</span></div>
              <div className="tl-line" />
              <div className="tl-step"><span className="tl-ico">🚚</span><strong>Delivered</strong><span>3–5 Days</span></div>
            </div>
            <div className="pdp-accs">
              <Accordion title="📋 Product Features" open><ul className="spec-list">{product.shortSpecs?.map(s => <li key={s}>{s}</li>)}</ul></Accordion>
              <Accordion title="📖 Description"><p className="acc-p">{product.description}</p></Accordion>
              <Accordion title="📦 What's in the Box"><p className="acc-p">1 × {product.name} · Manufacturer's warranty · User manual</p></Accordion>
              <Accordion title="🔄 Return Policy"><p className="acc-p">7-day return for damaged or incorrect products. Contact WhatsApp support for assistance.</p></Accordion>
            </div>
          </div>
        </div>
      </section>
      <section className="sec">
        <div className="sec-head"><div className="eyebrow">⭐ Reviews</div><h2 className="sec-h2">Customer Reviews</h2></div>
        <div className="rv-grid">{reviews.map((r, idx) => (<div key={r.id || idx} className="rv-card"><div className="rv-hdr"><div className="rv-av">{r.name[0]}</div><div className="rv-meta"><strong>{r.name}</strong><span>{formatDate(r.date)}</span></div><RatingStars rating={r.rating} size="md" /></div><p className="rv-text">{r.text}</p><span className="rv-verified">✓ Verified Purchase</span></div>))}</div>
      </section>
      {products && products.length > 0 && (
        <section className="sec">
          <ProductRow title="You May Also Like" eyebrow="Hand-picked for you" products={products.filter(p => p.id !== product.id).slice(0, 6)} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
        </section>
      )}
      {products && products.length > 1 && (
        <section className="sec">
          <ProductRow title="Recently Viewed" eyebrow="Continue browsing" products={products.filter(p => p.id !== product.id).slice(-6)} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
        </section>
      )}
      <div className="pdp-sticky-orderbar" role="region" aria-label="Sticky product order bar">
        <div className="pdp-sticky-qty">
          <span>Quantity</span>
          <div className="pdp-sticky-qty-controls">
            <button type="button" onClick={() => updateQuantity((selectedBundle?.qty || 1) - 1)} aria-label="Decrease sticky quantity">−</button>
            <strong>{selectedBundle?.qty || 1}</strong>
            <button type="button" onClick={() => updateQuantity((selectedBundle?.qty || 1) + 1)} aria-label="Increase sticky quantity">+</button>
          </div>
        </div>
        <button
          type="button"
          className="pdp-sticky-cod-btn"
          onClick={() => buyNow(product, selectedBundle?.qty || 1, variant, effectiveUnitPrice)}
        >
          <span>Order Now</span>
          <strong>{money(selectedBundle?.totalPrice || product.price)}</strong>
          <em>Cash on Delivery</em>
        </button>
      </div>
    </main>
  );
}

function ProductRoutePage({ settings, products, wishlist, toggleWishlist, openProduct, addToCart, buyNow }) {
  const { slug } = useParams();
  const routerNavigate = useNavigate();
  const product = useMemo(() => findProductBySlug(products, slug), [products, slug]);
  if (!product) {
    return (
      <main>
        <section className="sec">
          <div className="empty-state">
            <span className="empty-ico">📦</span>
            <h3>Product not found</h3>
            <p>This product may have been removed or the link is old.</p>
            <button className="btn-red-lg" onClick={() => routerNavigate(pagePath("shop"))} style={{ marginTop: "16px" }}>Browse Products</button>
          </div>
        </section>
      </main>
    );
  }
  return (
    <ProductPage
      settings={settings}
      product={product}
      products={products}
      wishlist={wishlist}
      toggleWishlist={toggleWishlist}
      openProduct={openProduct}
      addToCart={addToCart}
      buyNow={buyNow}
    />
  );
}

// ─── WISHLIST PAGE ────────────────────────────────────────────────────────────
function WishlistPage({ items, wishlist, toggleWishlist, openProduct, addToCart }) {
  return (<main><section className="sec"><div className="sec-head"><div className="eyebrow">Saved Items</div><h1 className="sec-h2">Your Wishlist</h1><p className="sec-sub">{items.length} item{items.length !== 1 ? "s" : ""} saved</p></div>{items.length ? <PGrid products={items} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} /> : (<div className="empty-state"><span className="empty-ico">♡</span><h3>Your wishlist is empty</h3><p>Save products you love and come back to them later.</p></div>)}</section></main>);
}

// ─── CART PAGE ────────────────────────────────────────────────────────────────
function CartPage({ cart, updateCartQty, removeFromCart, subtotal, shipping, total }) {
  const routerNavigate = useNavigate();
  return (
    <main><section className="sec">
      <div className="sec-head"><div className="eyebrow">Shopping Cart</div><h1 className="sec-h2">Your Cart</h1><p className="sec-sub">{cart.length} item{cart.length !== 1 ? "s" : ""}</p></div>
      {!cart.length ? (
        <div className="empty-state"><span className="empty-ico">🛒</span><h3>Your cart is empty</h3><p>Add some products to get started.</p><button className="btn-red-lg" onClick={() => routerNavigate(pagePath("shop"))} style={{ marginTop: "16px" }}>Browse Products</button></div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.id} className="cart-card">
                <SafeImage src={item.image} alt={cleanProductName(item.name)} className="cart-img" />
                <div className="cart-info"><h3>{cleanProductName(item.name)}</h3><p>{item.variantLabel || "Default"}</p><strong>{money(item.price)}</strong></div>
                <div className="cart-qty"><button onClick={() => updateCartQty(item.id, item.qty - 1)}>−</button><span>{item.qty}</span><button onClick={() => updateCartQty(item.id, item.qty + 1)}>+</button></div>
                <strong className="cart-total">{money(item.price * item.qty)}</strong>
                <button className="cart-rm" onClick={() => removeFromCart(item.id)}>✕</button>
              </div>
            ))}
          </div>
          <div className="order-card">
            <h3>Order Summary</h3>
            <div className="sum-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div className="sum-row"><span>Shipping</span><strong>{shipping === 0 ? "FREE 🎉" : money(shipping)}</strong></div>
            {shipping > 0 && <p className="free-hint">Add {money(3000 - subtotal)} more for free shipping</p>}
            <div className="sum-divider" />
            <div className="sum-row total"><span>Total</span><strong>{money(total)}</strong></div>
            <button className="btn-checkout" onClick={() => routerNavigate(pagePath("checkout"))}>Proceed to Checkout →</button>
            <button className="btn-continue" onClick={() => routerNavigate(pagePath("shop"))}>Continue Shopping</button>
            <div className="secure-row"><span>🔒 Secure</span><span>💵 COD</span></div>
          </div>
        </div>
      )}
    </section></main>
  );
}

// ─── CHECKOUT PAGE ────────────────────────────────────────────────────────────
function CheckoutPage({ cart, subtotal, shipping, total, placeOrder, coupons }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", notes: "" });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");

  const handleApplyCoupon = () => {
    setCouponError("");
    const coupon = (coupons || []).find(c => c.code.toUpperCase() === couponCode.toUpperCase());
    if (coupon) {
      setAppliedCoupon(coupon);
      setCouponCode("");
    } else {
      setCouponError("Invalid coupon code.");
      setAppliedCoupon(null);
    }
  };

  const discountAmount = appliedCoupon
    ? (appliedCoupon.type === "percent" ? (subtotal * appliedCoupon.value / 100) : appliedCoupon.value)
    : 0;

  return (
    <main><section className="sec">
      <div className="sec-head"><div className="eyebrow">Checkout</div><h1 className="sec-h2">Complete Your Order</h1><p className="sec-sub">Cash on Delivery · Fast & Secure</p></div>
      <div className="checkout-layout">
        <div className="checkout-form-card">
          <h3>🚚 Delivery Details</h3>
          <div className="checkout-grid">
            <input className="field" placeholder="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <input className="field" placeholder="Phone Number *" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            <input className="field" placeholder="City *" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            <input className="field" placeholder="Complete Address *" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            <textarea className="field field-area span2" placeholder="Order notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="cod-box"><strong>💵 Payment: Cash on Delivery</strong><p>Pay when your order arrives. No advance needed.</p></div>
        </div>
        <div className="order-card">
          <h3>Your Order</h3>
          <div className="co-items">{cart.map(item => (<div key={item.id} className="co-row"><SafeImage src={item.image} alt={cleanProductName(item.name)} className="co-img" /><div className="co-info"><span>{cleanProductName(item.name)}</span><span className="co-var">{item.variantLabel || "Default"} × {item.qty}</span></div><strong>{money(item.price * item.qty)}</strong></div>))}</div>

          <div className="coupon-box" style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                className="field"
                placeholder="Coupon code"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value)}
                style={{ height: "40px" }}
              />
              <button
                className="btn-red-lg"
                style={{ height: "40px", padding: "0 16px", fontSize: "13px" }}
                onClick={handleApplyCoupon}
              >Apply</button>
            </div>
            {couponError && <p style={{ fontSize: "11px", color: "var(--red)", marginTop: "4px" }}>{couponError}</p>}
            {appliedCoupon && <p style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>✓ Coupon <strong>{appliedCoupon.code}</strong> applied!</p>}
          </div>

          <div className="sum-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="sum-row"><span>Shipping</span><strong>{shipping === 0 ? "FREE" : money(shipping)}</strong></div>
          {appliedCoupon && (
            <div className="sum-row" style={{ color: "#16a34a" }}>
              <span>Discount ({appliedCoupon.code})</span>
              <strong>-{money(discountAmount)}</strong>
            </div>
          )}
          <div className="sum-divider" />
          <div className="sum-row total"><span>Total</span><strong>{money(Math.max(0, total - discountAmount))}</strong></div>
          <button className="btn-place" onClick={() => placeOrder({ ...form, coupon: appliedCoupon?.code })}>✓ Place Order — {money(Math.max(0, total - discountAmount))}</button>
        </div>
      </div>
    </section></main>
  );
}

// ─── CONFIRMATION PAGE ────────────────────────────────────────────────────────
function ConfirmationPage({ order }) {
  const routerNavigate = useNavigate();
  return (
    <main><section className="sec"><div className="confirm-wrap"><div className="confirm-ico">✓</div><h1>Order Placed!</h1><p>We'll contact you on WhatsApp to confirm delivery details.</p>{order && (<div className="confirm-details"><div className="cd-row-info"><span>Order ID</span><strong>{order.order_id || order.orderId || order.id}</strong></div><div className="cd-row-info"><span>Date</span><strong>{formatDate(order.createdAt || order.created_at)}</strong></div><div className="cd-row-info"><span>Total</span><strong>{money(order.total)}</strong></div><div className="cd-row-info"><span>Status</span><strong className="status-badge">{order.status}</strong></div></div>)}<div className="confirm-btns"><button className="btn-red-lg" onClick={() => routerNavigate(pagePath("home"))}>Continue Shopping</button><button className="btn-outline-lg" onClick={() => routerNavigate(pagePath("shop"))}>Browse More</button></div></div></section></main>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
function AboutPage() {
  const cards = [{ ico: "🎯", title: "Our Mission", text: "To bring premium quality gadgets and lifestyle products to Pakistani consumers at fair prices with a seamless shopping experience." }, { ico: "🏆", title: "Why Choose Us", text: "100% authentic products, cash on delivery, fast nationwide shipping, and dedicated WhatsApp customer support 7 days a week." }, { ico: "📦", title: "Fast Delivery", text: "We dispatch within 24 hours and deliver across Pakistan in 3–5 business days." }, { ico: "💚", title: "Customer First", text: "Over 1,000 satisfied customers and counting. We prioritize your satisfaction with easy returns." }];
  return (<main><section className="sec"><div className="sec-head sec-centered"><div className="eyebrow">Our Story</div><h1 className="sec-h2">About ISmallOne PK</h1><p className="sec-sub sec-sub-center">Building Pakistan's most trusted gadget store</p></div><div className="about-grid">{cards.map(c => (<div key={c.title} className="about-card"><span className="about-ico">{c.ico}</span><h3>{c.title}</h3><p>{c.text}</p></div>))}</div></section></main>);
}

// ─── CONTACT PAGE ─────────────────────────────────────────────────────────────
function ContactPage({ settings }) {
  return (<main><section className="sec"><div className="sec-head"><div className="eyebrow">Get in Touch</div><h1 className="sec-h2">Contact Us</h1><p className="sec-sub">We're here 7 days a week</p></div><div className="contact-layout"><div className="contact-info"><h3>Support Details</h3>{[{ ico: "📱", title: "WhatsApp", val: `+${settings.whatsappNumber}` }, { ico: "✉️", title: "Email", val: settings.supportEmail }, { ico: "🕐", title: "Hours", val: "Monday to Saturday, 10am – 8pm" }, { ico: "🚚", title: "Delivery", val: "3–5 working days nationwide" }, { ico: "💵", title: "Payment", val: "Cash on Delivery available" }].map(i => (<div key={i.title} className="contact-item"><span className="ci-ico">{i.ico}</span><div><strong>{i.title}</strong><p>{i.val}</p></div></div>))}</div><div className="contact-form"><h3>Send a Message</h3><input className="field" placeholder="Your Name" /><input className="field" placeholder="Phone Number" /><input className="field" placeholder="Email Address" /><textarea className="field field-area" placeholder="Your Message" /><button className="btn-red-lg" onClick={() => alert("Message sent! We will contact you soon.")}>Send Message</button></div></div></section></main>);
}

// ─── POLICY PAGES ─────────────────────────────────────────────────────────────
function PolicyPage({ title, icon, content }) {
  return (
    <main><section className="sec">
      <div className="policy-hero"><span className="policy-icon">{icon}</span><div className="eyebrow">ISmallOne PK</div><h1 className="sec-h2">{title}</h1><p className="policy-updated">Last updated: April 2026</p></div>
      <div className="policy-body">
        {content.map((section, i) => (
          <div key={i} className="policy-section">
            {section.heading && <h3 className="policy-h3">{section.heading}</h3>}
            {section.text && <p className="policy-text">{section.text}</p>}
            {section.list && <ul className="policy-list">{section.list.map((item, j) => <li key={j}>{item}</li>)}</ul>}
          </div>
        ))}
      </div>
    </section></main>
  );
}

function ShippingPolicyPage() {
  const content = [
    { heading: "📦 Delivery Timeframes", text: "We process and dispatch orders within 24 hours. Standard delivery across Pakistan takes 3–5 business days. Major cities may receive within 2–3 days." },
    { heading: "🚚 Shipping Rates", list: ["Orders above Rs 3,000: FREE Shipping", "Orders below Rs 3,000: Rs 199 flat rate", "Same-day dispatch on orders placed before 12 PM"] },
    { heading: "🌍 Coverage Areas", text: "We deliver to all major cities and towns across Pakistan including: Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad, Gujranwala, Sialkot, Bahawalpur." },
    { heading: "📱 Order Tracking", text: "Once dispatched, you will receive a WhatsApp message with tracking details. Contact us anytime on WhatsApp for real-time updates." },
    { heading: "⚠️ Important Notes", list: ["Delivery times may vary during peak seasons", "Ensure your address and phone number are correct", "Someone must be available to receive the order", "COD orders: exact change appreciated"] },
  ];
  return <PolicyPage title="Shipping Policy" icon="🚚" content={content} />;
}

function ReturnPolicyPage() {
  const content = [
    { heading: "✅ Return Eligibility", text: "We offer a 7-day return policy from the date of delivery. Items must be unused, in the same condition received, and in original packaging." },
    { heading: "📋 Eligible Return Reasons", list: ["Product received in damaged condition", "Wrong product delivered", "Product not as described", "Manufacturing defects"] },
    { heading: "❌ Non-Returnable Items", list: ["Items showing signs of use or damage by customer", "Items without original packaging", "Items returned after 7 days", "Customized items"] },
    { heading: "🔄 Return Process", text: "Contact our WhatsApp support within 7 days of receiving your order. Provide your order ID, product photos, and reason for return." },
    { heading: "💰 Refunds", text: "Approved refunds are processed within 3–5 business days via JazzCash, EasyPaisa, or bank transfer." },
  ];
  return <PolicyPage title="Returns & Refunds" icon="🔄" content={content} />;
}

function PrivacyPolicyPage() {
  const content = [
    { heading: "📊 Information We Collect", list: ["Name, phone number, and email address", "Delivery address for order fulfillment", "Order history and purchase preferences", "WhatsApp interactions for support"] },
    { heading: "🔒 How We Use Your Information", text: "Your information is used solely for processing orders, delivering products, and providing customer support. We never sell or share your personal data." },
    { heading: "🛡️ Data Security", text: "All transactions are encrypted and your personal information is stored securely. Our systems are regularly audited." },
    { heading: "📞 Contact Us", text: "For any privacy concerns, contact us at support@ISmallOne.shop or via WhatsApp." },
  ];
  return <PolicyPage title="Privacy Policy" icon="🔒" content={content} />;
}

function TermsPage() {
  const content = [
    { heading: "📜 Acceptance of Terms", text: "By accessing and using ISmallOne, you accept and agree to be bound by these Terms and Conditions." },
    { heading: "🛒 Product & Pricing", list: ["All prices are in Pakistani Rupees (PKR)", "Prices may change without prior notice", "Product images are for representation purposes", "Stock availability not guaranteed until order confirmation"] },
    { heading: "💵 Payment Terms", text: "We accept Cash on Delivery, JazzCash, EasyPaisa, and bank transfers. COD orders must be paid in full upon delivery." },
    { heading: "🚫 Prohibited Activities", list: ["Placing fraudulent or prank orders", "Providing false delivery information", "Attempting to exploit pricing errors", "Abusive behavior toward staff"] },
  ];
  return <PolicyPage title="Terms & Conditions" icon="📜" content={content} />;
}

function FAQPage({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <main><section className="sec">
      <div className="sec-head sec-centered"><div className="eyebrow">Help Center</div><h1 className="sec-h2">Frequently Asked Questions</h1><p className="sec-sub sec-sub-center">Everything you need to know about shopping at ISmallOne</p></div>
      <div className="faq-wrap">
        {faqs.map((faq, i) => (
          <div key={i} className={`faq-item ${open === i ? "faq-open" : ""}`}>
            <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}><span>{faq.q}</span><span className="faq-ico">{open === i ? "−" : "+"}</span></button>
            {open === i && <div className="faq-a">{faq.a}</div>}
          </div>
        ))}
      </div>
    </section></main>
  );
}

function TrackOrderPage({ settings }) {
  const [orderIdInput, setOrderIdInput] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrack = async () => {
    if (!orderIdInput.trim()) {
      setError("Please enter your Order ID");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const input = orderIdInput.trim();
      const { data, error: err } = await supabase
        .from("orders")
        .select("*")
        .ilike("order_id", input)
        .maybeSingle();

      if (err) throw err;
      if (!data) throw new Error("Order not found. Please check your Order ID.");
      setOrder(data);
    } catch (e) {
      setError(e.message);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStepClass = (stepStatus) => {
    if (!order) return "";
    const statuses = ["Pending", "Processing", "Shipped", "Delivered"];
    const currentIdx = statuses.indexOf(order.status || "Pending");
    const stepIdx = statuses.indexOf(stepStatus);
    if (currentIdx >= stepIdx) return "done";
    if (currentIdx === stepIdx - 1) return "active";
    return "";
  };

  return (
    <main><section className="sec">
      <div className="sec-head sec-centered">
        <div className="eyebrow">Order Tracking</div>
        <h1 className="sec-h2">Track Your Order</h1>
        <p className="sec-sub sec-sub-center">Enter your Order ID for live status updates</p>
      </div>
      <div className="track-wrap">
        <div className="track-card">
          <div className="track-icon">📦</div>
          <h3>Track Order</h3>
          <input className="field" placeholder="Order ID (e.g., ISO-123456 or ORD-123)" value={orderIdInput} onChange={e => setOrderIdInput(e.target.value)} style={{ marginBottom: "16px" }} />
          <button className="btn-red-lg" style={{ width: "100%" }} onClick={handleTrack} disabled={loading}>
            {loading ? "Searching..." : "Track Order"}
          </button>

          {error && <p style={{ color: "var(--red)", marginTop: "12px", fontSize: "13px", fontWeight: "600" }}>{error}</p>}

          {order && (
            <div className="track-result" style={{ animation: "fadeIn 0.4s ease" }}>
              <div style={{ marginBottom: "20px", padding: "12px", background: "var(--bg-soft)", borderRadius: "var(--r)", border: "1.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--muted)" }}>Status:</span>
                  <strong style={{ color: "var(--red)" }}>{order.status}</strong>
                </div>
              </div>
              <div className="track-timeline">
                <div className={`track-step ${getStepClass("Pending")}`}><div className="track-step-dot" /><div className="track-step-info"><strong>Order Placed</strong><span>Confirmed</span></div></div>
                <div className={`track-step ${getStepClass("Processing")}`}><div className="track-step-dot" /><div className="track-step-info"><strong>Processing</strong><span>Being prepared</span></div></div>
                <div className={`track-step ${getStepClass("Shipped")}`}><div className="track-step-dot" /><div className="track-step-info"><strong>Shipped</strong><span>Out for delivery</span></div></div>
                <div className={`track-step ${getStepClass("Delivered")}`}><div className="track-step-dot" /><div className="track-step-info"><strong>Delivered</strong><span>Arrived at destination</span></div></div>
              </div>
              <div className="track-wa">
                <p>Need more help? Contact us on WhatsApp:</p>
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" className="pdp-wa-btn" style={{ marginTop: "10px" }}>📱 WhatsApp Support</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section></main>
  );
}
// ─── ADMIN PRODUCT FORM WITH CLOUDINARY UPLOAD ───────────────────────────────
function AdminProductForm({ onAdd, onSubmit, initialProduct = null, onCancel = null, submitLabel = "Add Product" }) {
  const buildForm = useCallback((product) => ({
    name: product?.name || "",
    category: product?.category || "",
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? product?.compare_at_price ?? "",
    shortDescription: product?.shortDescription ?? product?.short_description ?? "",
    description: product?.description || "",
    stock: product?.stockLeft ?? product?.stock_left ?? product?.stock ?? "",
    soldCount: product?.soldCount ?? product?.sold_count ?? "",
    rating: product?.rating ?? "",
    reviewCount: product?.reviewCount ?? product?.review_count ?? "",
    featured: Boolean(product?.featured),
    trending: Boolean(product?.trending),
  }), []);
  const buildImages = useCallback((product) => {
    const list = Array.isArray(product?.images) ? product.images : (product?.image ? [product.image] : []);
    return list.filter(Boolean).map(url => ({ url, preview: url }));
  }, []);
  const buildVideo = useCallback((product) => product?.video ? { url: product.video, preview: product.video } : null, []);
  const [form, setForm] = useState(() => buildForm(initialProduct));
  const [images, setImages] = useState(() => buildImages(initialProduct));      // array of { url, preview }
  const [video, setVideo] = useState(() => buildVideo(initialProduct));       // { url, preview }
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imageProgress, setImageProgress] = useState([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  useEffect(() => {
    setForm(buildForm(initialProduct));
    setImages(buildImages(initialProduct));
    setVideo(buildVideo(initialProduct));
    setErrors({});
  }, [buildForm, buildImages, buildVideo, initialProduct]);

  async function handleImageSelect(e) {
    const files = Array.from(e.target.files).slice(0, 5 - images.length);
    if (!files.length) return;

    setUploadingImages(true);
    setImageProgress(files.map(() => 0));

    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      try {
        const url = await uploadToCloudinary(file, (pct) => {
          setImageProgress(prev => {
            const next = [...prev];
            next[i] = pct;
            return next;
          });
        });
        uploaded.push({ url, preview });
      } catch (err) {
        alert(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    setImages(prev => [...prev, ...uploaded]);
    setUploadingImages(false);
    setImageProgress([]);
    e.target.value = "";
  }

  async function handleVideoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingVideo(true);
    setVideoProgress(0);

    const preview = URL.createObjectURL(file);
    try {
      const url = await uploadToCloudinary(file, setVideoProgress);
      setVideo({ url, preview });
    } catch (err) {
      alert(`Failed to upload video: ${err.message}`);
    }

    setUploadingVideo(false);
    setVideoProgress(0);
    e.target.value = "";
  }

  function removeImage(i) {
    setImages(prev => prev.filter((_, idx) => idx !== i));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Product name is required";
    if (!form.price || isNaN(Number(form.price))) errs.price = "Valid price required";
    setErrors(errs);
    return !Object.keys(errs).length;
  }
  async function handleSubmit() {
    if (!validate()) return;
    const submit = onSubmit || onAdd;
    if (!submit) return;
    setSaving(true);
    try {
      await submit({
        name: form.name,
        category: form.category || "Uncategorized",
        price: form.price,
        compareAtPrice: form.compareAtPrice,
        shortDescription: form.shortDescription,
        description: form.description,
        images: images.map(i => i.url),
        video: video?.url || null,
        stock: form.stock,
        soldCount: form.soldCount,
        rating: form.rating,
        reviewCount: form.reviewCount,
        featured: form.featured,
        trending: form.trending,
      });
      if (!initialProduct) {
        setForm(buildForm(null));
        setImages([]);
        setVideo(null);
        setErrors({});
      }
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set([form.category, ...STOREFRONT_CATEGORIES.map(c => c.name)].filter(Boolean))];

  return (
    <div className="apf-wrap">

      {/* ── TEXT FIELDS ── */}
      <div className="apf-field">
        <label>Product Name *</label>
        <input className={`field ${errors.name ? "field-err" : ""}`}
          placeholder="e.g. Premium Smart Watch"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        {errors.name && <span className="apf-err">{errors.name}</span>}
      </div>

      <div className="apf-2col">
        <div className="apf-field">
          <label>Category</label>
          <select className="field"
            value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="apf-field">
          <label>Price (Rs) *</label>
          <input className={`field ${errors.price ? "field-err" : ""}`}
            placeholder="e.g. 2999"
            type="number"
            value={form.price}
            onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
          {errors.price && <span className="apf-err">{errors.price}</span>}
        </div>
      </div>

      <div className="apf-2col">
        <div className="apf-field">
          <label>Compare At Price (Rs)</label>
          <input className="field" placeholder="e.g. 4999 (optional)"
            type="number"
            value={form.compareAtPrice}
            onChange={e => setForm(p => ({ ...p, compareAtPrice: e.target.value }))} />
        </div>
        <div className="apf-field">
          <label>Short Description</label>
          <input className="field" placeholder="One-line summary"
            value={form.shortDescription}
            onChange={e => setForm(p => ({ ...p, shortDescription: e.target.value }))} />
        </div>
      </div>

      <div className="apf-2col">
        <div className="apf-field">
          <label>Stock Left</label>
          <input className="field" placeholder="e.g. 12"
            type="number"
            value={form.stock}
            onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
        </div>
        <div className="apf-field">
          <label>Sold Count</label>
          <input className="field" placeholder="e.g. 100"
            type="number"
            value={form.soldCount}
            onChange={e => setForm(p => ({ ...p, soldCount: e.target.value }))} />
        </div>
      </div>

      <div className="apf-2col">
        <div className="apf-field">
          <label>Rating</label>
          <input className="field" placeholder="1 to 5"
            type="number"
            min="1"
            max="5"
            step="0.1"
            value={form.rating}
            onChange={e => setForm(p => ({ ...p, rating: e.target.value }))} />
        </div>
        <div className="apf-field">
          <label>Review Count</label>
          <input className="field" placeholder="e.g. 24"
            type="number"
            value={form.reviewCount}
            onChange={e => setForm(p => ({ ...p, reviewCount: e.target.value }))} />
        </div>
      </div>

      <div className="apf-checks">
        <label><input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} /> Featured product</label>
        <label><input type="checkbox" checked={form.trending} onChange={e => setForm(p => ({ ...p, trending: e.target.checked }))} /> Trending product</label>
      </div>

      <div className="apf-field">
        <label>Full Description</label>
        <textarea className="field field-area" placeholder="Detailed product description..."
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      </div>

      {/* ── IMAGE UPLOAD ── */}
      <div className="apf-field">
        <label>Product Images * <span className="apf-hint">({images.length}/5 uploaded)</span></label>
        <div className={`upload-zone ${errors.images ? "upload-zone-err" : ""}`}
          onClick={() => !uploadingImages && images.length < 5 && imgInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
            if (files.length) handleImageSelect({ target: { files, value: "" } });
          }}>
          <input ref={imgInputRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={handleImageSelect} />

          {images.length === 0 && !uploadingImages ? (
            <div className="upload-zone-empty">
              <span className="upload-zone-ico">🖼️</span>
              <strong>Click or drag images here</strong>
              <span>JPG, PNG, WEBP · Up to 5 images · Max 10MB each</span>
              <span className="upload-zone-mobile">📱 On mobile, tap to open gallery</span>
            </div>
          ) : (
            <div className="upload-preview-grid">
              {images.map((img, i) => (
                <div key={i} className="upload-thumb">
                  <img src={img.preview} alt="" />
                  <div className="upload-thumb-overlay">
                    <button className="upload-thumb-del"
                      onClick={e => { e.stopPropagation(); removeImage(i); }}>✕</button>
                    <span className="upload-thumb-order">#{i + 1}</span>
                  </div>
                  <div className="upload-thumb-done">✓</div>
                </div>
              ))}
              {uploadingImages && imageProgress.map((pct, i) => (
                <div key={`uploading-${i}`} className="upload-thumb upload-thumb-loading">
                  <div className="upload-progress-circle">
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#d90429" strokeWidth="3"
                        strokeDasharray={`${pct * 0.942} 100`} strokeLinecap="round"
                        transform="rotate(-90 18 18)" />
                    </svg>
                    <span>{pct}%</span>
                  </div>
                </div>
              ))}
              {!uploadingImages && images.length < 5 && (
                <div className="upload-add-more" onClick={e => { e.stopPropagation(); imgInputRef.current?.click(); }}>
                  <span>+</span><small>Add more</small>
                </div>
              )}
            </div>
          )}
        </div>
        {errors.images && <span className="apf-err">{errors.images}</span>}
      </div>

      {/* ── VIDEO UPLOAD ── */}
      <div className="apf-field">
        <label>Product Video <span className="apf-hint">(optional · any size)</span></label>
        <div className="upload-zone upload-zone-video"
          onClick={() => !uploadingVideo && !video && vidInputRef.current?.click()}>
          <input ref={vidInputRef} type="file" accept="video/*"
            style={{ display: "none" }} onChange={handleVideoSelect} />

          {!video && !uploadingVideo && (
            <div className="upload-zone-empty">
              <span className="upload-zone-ico">🎬</span>
              <strong>Click to upload product video</strong>
              <span>MP4, MOV, AVI · Any size · Uploaded to cloud</span>
              <span className="upload-zone-mobile">📱 On mobile, tap to open gallery</span>
            </div>
          )}

          {uploadingVideo && (
            <div className="upload-video-progress">
              <div className="uvp-bar-wrap">
                <div className="uvp-bar" style={{ width: `${videoProgress}%` }} />
              </div>
              <div className="uvp-info">
                <span>⬆️ Uploading video to cloud...</span>
                <strong>{videoProgress}%</strong>
              </div>
              <span className="uvp-note">Large files may take a few minutes. Please don't close this page.</span>
            </div>
          )}

          {video && !uploadingVideo && (
            <div className="upload-video-preview">
              <video src={video.preview} controls playsInline muted className="uvp-video" />
              <button className="uvp-remove"
                onClick={e => { e.stopPropagation(); setVideo(null); }}>
                ✕ Remove Video
              </button>
              <span className="uvp-done">✓ Video uploaded to cloud</span>
            </div>
          )}
        </div>
      </div>

      {/* ── SUBMIT ── */}
      <div className="apf-actions">
        {onCancel && <button className="btn-outline-lg apf-cancel" onClick={onCancel} type="button">Cancel</button>}
        <button className="btn-red-lg apf-submit"
          onClick={handleSubmit}
          disabled={uploadingImages || uploadingVideo || saving}
          style={{ width: "100%", justifyContent: "center", opacity: (uploadingImages || uploadingVideo || saving) ? 0.6 : 1 }}>
          {uploadingImages ? "Uploading images..." :
            uploadingVideo ? "Uploading video..." :
              saving ? "Saving to Supabase..." :
              submitLabel}
        </button>
      </div>
    </div>
  );
}
// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
function AdminPage({
  products,
  orders,
  settings,
  saveSettings,
  coupons,
  setCoupons,
  faqs,
  setFaqs,
  addProduct,
  updateProduct,
  deleteProduct,
  updateOrderStatus,
  currentUser,
  onOpenAdminAuth,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("iso_admin_tab") || "dashboard");
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    localStorage.setItem("iso_admin_tab", activeTab);
  }, [activeTab]);
  const [editSettings, setEditSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(settings || {});
  const [couponForm, setCouponForm] = useState({ code: "", type: "percent", value: "" });
  const [faqForm, setFaqForm] = useState({ q: "", a: "" });

  useEffect(() => {
    setSettingsForm(settings || {});
  }, [settings]);

  if (!currentUser || currentUser.role !== "admin") {
    return (<main><section className="sec"><div className="admin-locked"><div className="admin-lock-ico">🔐</div><h2>Admin Access Required</h2><p>This area is restricted to authorized administrators only.</p><button className="btn-red-lg" onClick={onOpenAdminAuth} style={{ marginTop: "24px" }}>Admin Login →</button></div></section></main>);
  }

  const rev = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "Pending").length;
  const tabs = [{ id: "dashboard", label: "📊 Dashboard" }, { id: "orders", label: "📦 Orders" }, { id: "products", label: "🛍️ Products" }, { id: "users", label: "👥 Users" }, { id: "coupons", label: "🎫 Coupons" }, { id: "settings", label: "⚙️ Settings" }, { id: "faq", label: "❓ FAQ" }];

  async function handleSave() {
    try {
      await saveSettings(settingsForm);
      setEditSettings(false);
    } catch (err) {
      console.error("Failed to save settings in AdminPage", err);
    }
  }
  async function handleAddCoupon() {
    if (!couponForm.code || !couponForm.value) return;
    try {
      const saved = await addCoupon({
        code: couponForm.code.toUpperCase(),
        type: couponForm.type,
        value: Number(couponForm.value),
      });
      setCoupons((prev) => [...prev, saved || { code: couponForm.code.toUpperCase(), type: couponForm.type, value: Number(couponForm.value) }]);
    } catch {
      setCoupons((prev) => [...prev, { code: couponForm.code.toUpperCase(), type: couponForm.type, value: Number(couponForm.value) }]);
    }
    setCouponForm({ code: "", type: "percent", value: "" });
  }
  async function removeCoupon(code) {
    const existing = coupons.find((c) => c.code === code);
    try {
      if (existing?.id) await deleteCoupon(existing.id);
    } catch (err) {
      console.warn("Failed to delete coupon in Supabase", err);
    }
    setCoupons((prev) => prev.filter((c) => c.code !== code));
  }
  async function addFaqItem() {
    if (!faqForm.q || !faqForm.a) return;
    try {
      const saved = await addFaq({ q: faqForm.q, a: faqForm.a, question: faqForm.q, answer: faqForm.a });
      setFaqs((prev) => [...prev, saved || faqForm]);
    } catch {
      setFaqs((prev) => [...prev, faqForm]);
    }
    setFaqForm({ q: "", a: "" });
  }
  async function removeFaq(i) {
    const item = faqs[i];
    try {
      if (item?.id) await deleteFaq(item.id);
    } catch (err) {
      console.warn("Failed to delete FAQ in Supabase", err);
    }
    setFaqs((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <main><section className="sec">
      <div className="sec-head"><div className="eyebrow">Store Control</div><h1 className="sec-h2">Admin Panel</h1><div className="admin-welcome">Welcome back, <strong>{currentUser.name}</strong> 👋 {pendingOrders > 0 && <span className="pending-badge">{pendingOrders} pending</span>}</div></div>
      <div className="admin-tabs">
        {tabs.map(t => (<button key={t.id} className={`admin-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>))}
      </div>

      {activeTab === "dashboard" && (
        <>
          <div className="admin-stats">
            <div className="admin-stat"><strong>{products.length}</strong><span>Products</span></div>
            <div className="admin-stat"><strong>{orders.length}</strong><span>Orders</span></div>
            <div className="admin-stat red"><strong>{money(rev)}</strong><span>Revenue</span></div>
            <div className="admin-stat"><strong>{[].length || 0}</strong><span>Users</span></div>
            <div className="admin-stat"><strong>{pendingOrders}</strong><span>Pending</span></div>
            <div className="admin-stat"><strong>{coupons?.length || 0}</strong><span>Coupons</span></div>
          </div>
          <div className="admin-quick-stats">
            <div className="qs-card"><span>📦 Most Sold</span><strong>{[...products].sort((a, b) => Number(b.soldCount || b.sold_count || 0) - Number(a.soldCount || a.sold_count || 0))[0]?.name || "—"}</strong></div>
            <div className="qs-card"><span>⭐ Top Rated</span><strong>{[...products].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0]?.name || "—"}</strong></div>
            <div className="qs-card"><span>📋 Latest Order</span><strong>{orders[0]?.orderId || orders[0]?.order_id || "No orders yet"}</strong></div>
          </div>
        </>
      )}

      {activeTab === "orders" && (
        <div className="admin-card">
          <h3>All Orders ({orders.length})</h3>
          <div className="orders-list">{orders.length ? orders.map(o => (
            <div key={o.orderId || o.order_id || o.id} className="order-row">
              <div>
                <strong>{o.orderId || o.order_id || o.id}</strong>
                <span>{getOrderCustomerName(o)} · {money(o.total)}</span>
                <span className="order-address">📍 {getOrderCustomerAddress(o)}</span>
                {getOrderCustomerPhone(o) && <span className="order-phone">☎ {getOrderCustomerPhone(o)}</span>}
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatDate(o.createdAt || o.created_at)}</span>
              </div>
              <div className="order-acts">
                <span className={`o-status o-${(o.status || "").toLowerCase()}`}>{o.status}</span>
                <button className="o-btn" onClick={() => updateOrderStatus(o.id || o.order_id || o.orderId, "Confirmed")}>Confirm</button>
                <button className="o-btn" onClick={() => updateOrderStatus(o.id || o.order_id || o.orderId, "Shipped")}>Ship</button>
                <button className="o-btn" onClick={() => updateOrderStatus(o.id || o.order_id || o.orderId, "Delivered")} style={{ background: "#16a34a" }}>Deliver</button>
              </div>
            </div>
          )) : <div style={{ padding: "40px", color: "#888", textAlign: "center" }}>No orders yet.</div>}</div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="admin-layout">
          <div className="admin-card">
            <h3>{editingProduct ? `Edit Product: ${cleanProductName(editingProduct.name)}` : "Add New Product"}</h3>
            <AdminProductForm
              key={editingProduct?.id || "new-product"}
              initialProduct={editingProduct}
              submitLabel={editingProduct ? "Save Product Changes" : "Add Product"}
              onCancel={editingProduct ? () => setEditingProduct(null) : null}
              onAdd={async (product) => {
                await addProduct(product);
                setEditingProduct(null);
              }}
              onSubmit={editingProduct ? async (product) => {
                await updateProduct(editingProduct.id, product);
                setEditingProduct(null);
              } : null}
            />
          </div>
          <div className="admin-card admin-products-card">
            <h3>Products ({products.length})</h3>
            <div className="admin-pgrid">{products.map(p => (
              <div key={p.id} className={`admin-pcard ${editingProduct?.id === p.id ? "admin-pcard-editing" : ""}`}>
                {p.video ? (
                  <video src={p.video} className="admin-pimg" muted playsInline />
                ) : (
                  <SafeImage src={p.images?.[0] || p.image} alt={p.name} className="admin-pimg" />
                )}
                <div className="admin-pinfo">
                  <strong>{cleanProductName(p.name)}</strong>
                  <span>{p.category || "Uncategorized"}</span>
                  <span className="admin-pprice">{money(p.price)}</span>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {p.images?.length || 0} image{p.images?.length !== 1 ? "s" : ""}
                    {p.video ? " · video" : ""}
                  </span>
                </div>
                <div className="admin-pactions">
                  <button className="admin-edit" onClick={() => {
                    setEditingProduct(p);
                    showToast(`Editing ${cleanProductName(p.name)}`);
                  }}>Edit</button>
                  <button className="admin-del" onClick={() => {
                    if (window.confirm(`Delete ${cleanProductName(p.name)}?`)) deleteProduct(p.id);
                  }}>Delete</button>
                </div>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="admin-card">
          <h3>Registered Users ({[].length || 0})</h3>
          <div style={{ padding: "40px", color: "#888", textAlign: "center" }}>Customer accounts are disabled.</div>
        </div>
      )}

      {activeTab === "coupons" && (
        <div className="admin-layout">
          <div className="admin-card">
            <h3>Add Coupon</h3>
            <input className="field" placeholder="Coupon Code (e.g. SAVE20)" value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value }))} style={{ marginBottom: "10px" }} />
            <select className="field" value={couponForm.type} onChange={e => setCouponForm(p => ({ ...p, type: e.target.value }))} style={{ marginBottom: "10px" }}><option value="percent">Percentage Off</option><option value="flat">Flat Discount (Rs)</option></select>
            <input className="field" placeholder="Value (e.g. 10 for 10%)" value={couponForm.value} onChange={e => setCouponForm(p => ({ ...p, value: e.target.value }))} style={{ marginBottom: "16px" }} />
            <button className="btn-red-lg" onClick={handleAddCoupon}>Add Coupon</button>
          </div>
          <div className="admin-card">
            <h3>Active Coupons ({coupons?.length || 0})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(coupons || []).map(c => (
                <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-soft)", padding: "12px 16px", borderRadius: "var(--r)", border: "1.5px solid var(--border)" }}>
                  <div><strong style={{ fontSize: "16px", fontFamily: "var(--font-head)" }}>{c.code}</strong><span style={{ marginLeft: "12px", color: "var(--muted)", fontSize: "13px" }}>{c.type === "percent" ? `${c.value}% off` : `Rs ${c.value} off`}</span></div>
                  <button onClick={() => removeCoupon(c.code)} style={{ background: "#fee2e2", color: "var(--red)", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>Store Settings</h3>
            <button className="btn-red-lg" style={{ height: "40px", padding: "0 20px", fontSize: "14px" }} onClick={editSettings ? handleSave : () => setEditSettings(true)}>{editSettings ? "💾 Save Changes" : "✏️ Edit Settings"}</button>
          </div>
          <div className="checkout-grid">
            {[{ key: "storeName", label: "Store Name" }, { key: "whatsappNumber", label: "WhatsApp Number" }, { key: "supportEmail", label: "Support Email" }, { key: "shippingFee", label: "Shipping Fee (Rs)" }, { key: "freeShippingThreshold", label: "Free Shipping Threshold (Rs)" }].map(f => (
              <div key={f.key} className="auth-field-wrap"><label>{f.label}</label><input className="field" value={settingsForm[f.key] || ""} onChange={e => setSettingsForm(p => ({ ...p, [f.key]: e.target.value }))} disabled={!editSettings} /></div>
            ))}
            <div className="auth-field-wrap" style={{ gridColumn: "1/-1" }}><label>Announcement Bar</label><input className="field" value={settingsForm.announcement || ""} onChange={e => setSettingsForm(p => ({ ...p, announcement: e.target.value }))} disabled={!editSettings} /></div>
            <div className="auth-field-wrap" style={{ gridColumn: "1/-1" }}><label>Hero Subtitle</label><textarea className="field field-area" value={settingsForm.heroSubtitle || ""} onChange={e => setSettingsForm(p => ({ ...p, heroSubtitle: e.target.value }))} disabled={!editSettings} /></div>
          </div>
        </div>
      )}

      {activeTab === "faq" && (
        <div className="admin-layout">
          <div className="admin-card">
            <h3>Add FAQ</h3>
            <input className="field" placeholder="Question" value={faqForm.q} onChange={e => setFaqForm(p => ({ ...p, q: e.target.value }))} style={{ marginBottom: "10px" }} />
            <textarea className="field field-area" placeholder="Answer" value={faqForm.a} onChange={e => setFaqForm(p => ({ ...p, a: e.target.value }))} style={{ marginBottom: "16px" }} />
            <button className="btn-red-lg" onClick={addFaqItem}>Add FAQ</button>
          </div>
          <div className="admin-card">
            <h3>FAQ Items ({faqs?.length || 0})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
              {(faqs || []).map((faq, i) => (
                <div key={i} style={{ background: "var(--bg-soft)", padding: "14px", borderRadius: "var(--r)", border: "1.5px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div><strong style={{ display: "block", fontSize: "14px", marginBottom: "4px" }}>{faq.q || faq.question}</strong><span style={{ fontSize: "13px", color: "var(--muted)" }}>{faq.a || faq.answer}</span></div>
                    <button onClick={() => removeFaq(i)} style={{ background: "#fee2e2", color: "var(--red)", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section></main>
  );
}

// ─── COMPLETE CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

  :root{
    --color-bg:${DESIGN_TOKENS.colors.bg};--color-primary:${DESIGN_TOKENS.colors.primary};--color-primary-hover:${DESIGN_TOKENS.colors.primaryHover};--color-accent:${DESIGN_TOKENS.colors.accent};
    --color-text:${DESIGN_TOKENS.colors.text};--color-text-muted:${DESIGN_TOKENS.colors.muted};--color-card-bg:${DESIGN_TOKENS.colors.cardBg};--color-card-border:${DESIGN_TOKENS.colors.cardBorder};--color-urgency:${DESIGN_TOKENS.colors.urgency};
    --shadow-rest:${DESIGN_TOKENS.shadow.rest};--shadow-elevated:${DESIGN_TOKENS.shadow.elevated};
    --shadow-warm:${DESIGN_TOKENS.shadow.warm};--gradient-hero:${DESIGN_TOKENS.gradients.hero};--gradient-dark-section:${DESIGN_TOKENS.gradients.darkSection};--gradient-gold-badge:${DESIGN_TOKENS.gradients.goldBadge};
    --gradient-card-kitchen:${DESIGN_TOKENS.gradients.cardKitchen};--gradient-card-home:${DESIGN_TOKENS.gradients.cardHome};--gradient-card-gifts:${DESIGN_TOKENS.gradients.cardGifts};--gradient-card-default:${DESIGN_TOKENS.gradients.cardDefault};
    --red:var(--color-primary);--red-dark:var(--color-primary-hover);--red-soft:#eef5ef;--red-border:#c8d8ce;
    --forest:var(--color-primary);--forest-2:var(--color-primary-hover);--cream:var(--color-bg);--cream-2:var(--color-card-bg);--gold:var(--color-accent);
    --dark:var(--color-text);--text:var(--color-text);--muted:var(--color-text-muted);--light:#9a9a9a;
    --bg:var(--color-bg);--bg-soft:var(--color-card-bg);--bg-gray:#eeeeea;--border:var(--color-card-border);
    --sh:var(--shadow-rest);--sh-lg:var(--shadow-elevated);--sh-xl:var(--shadow-elevated);
    --r:${DESIGN_TOKENS.radius.button};--r-lg:${DESIGN_TOKENS.radius.card};--r-xl:18px;
    --font-head:'Poppins',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--font-body:'Poppins',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;font-size:16px;-webkit-text-size-adjust:100%;overflow-x:hidden;max-width:100%}
  body{font-family:var(--font-body);background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased;width:100%;max-width:100%;min-height:100vh;}
  #root{width:100%;max-width:100%;overflow-x:hidden;min-height:100vh}
  a{text-decoration:none;color:inherit}
  button{cursor:pointer;font-family:inherit;border:none;background:none;-webkit-tap-highlight-color:transparent;}
  input,textarea,select{font-family:inherit;-webkit-appearance:none;}
  img{display:block;max-width:100%}
  h1,h2,h3,h4{line-height:1.15;font-weight:800;color:var(--text);font-family:var(--font-head)}
  .ui-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:8px;font-weight:600;line-height:1;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,border-color .15s ease;color:var(--color-text);border:1px solid transparent;box-shadow:none;}
  .ui-btn:hover{transform:translateY(-1px)}
  .ui-btn-primary{background:var(--color-primary);color:#fff;box-shadow:var(--shadow-rest);}
  .ui-btn-primary:hover{background:var(--color-primary-hover);box-shadow:var(--shadow-elevated);}
  .ui-btn-secondary{background:#eef5ef;color:var(--color-primary);border-color:#c8d8ce;}
  .ui-btn-secondary:hover{background:#e2eee5;border-color:var(--color-primary);}
  .ui-btn-outline{background:#fff;color:var(--color-primary);border-color:var(--color-primary);}
  .ui-btn-outline:hover{background:#eef5ef;box-shadow:var(--shadow-rest);}
  .ui-btn-sm{min-height:40px;padding:0 12px;font-size:12px;}
  .ui-btn-md{min-height:44px;padding:0 16px;font-size:14px;}
  .ui-btn-lg{min-height:52px;padding:0 20px;font-size:15px;}
  .img-skeleton{display:block;background:linear-gradient(110deg,#efe4d5 8%,#fffaf1 18%,#efe4d5 33%);background-size:200% 100%;animation:skeletonPulse 1.25s ease-in-out infinite;}

  .desktop-only{display:flex}
  .mobile-only{display:none}



  /* ── PAGE TRANSITION & SPLASH ── */
  .pt-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;}
  .pt-backdrop{position:absolute;inset:0;background:linear-gradient(135deg, #ffffff 0%, #fff1f2 100%);opacity:0;transition:opacity 0.25s ease;}
  .pt-enter .pt-backdrop{opacity:1}
  .pt-exit .pt-backdrop{opacity:0}
  
  .pt-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0;transform:scale(0.85);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);}
  .pt-enter .pt-center{opacity:1;transform:scale(1)}
  .pt-exit .pt-center{opacity:0;transform:scale(1.05)}

  .pt-logo-ring{width:76px;height:76px;background:var(--red);border-radius:22px;display:grid;place-items:center;box-shadow:0 0 0 0 rgba(217,4,41,0.4);position:relative;}
  .pt-logo-mark{font-size:24px;font-weight:900;color:white;font-family:var(--font-head);letter-spacing:-1px;}
  .pt-logo-name{font-size:18px;font-weight:800;color:var(--dark);font-family:var(--font-head);letter-spacing:-0.5px;margin-top:4px;}
  
  .pt-line-wrap{width:140px;height:4px;background:var(--red-soft);border-radius:999px;overflow:hidden;margin-top:6px;}
  .pt-line-bar{height:100%;width:0%;background:var(--red);border-radius:999px;}
  
  .pt-enter .pt-logo-ring{animation:ptRingPulse 0.8s ease forwards;}
  .pt-enter .pt-line-bar{animation:ptLineFill 0.8s cubic-bezier(0.4,0,0.2,1) forwards;}
  
  @keyframes ptRingPulse{0%{box-shadow:0 0 0 0 rgba(217,4,41,0.4)}70%{box-shadow:0 0 0 20px rgba(217,4,41,0)}100%{box-shadow:0 0 0 0 rgba(217,4,41,0)}}
  @keyframes ptLineFill{to{width:100%}}

  .splash-overlay{position:fixed;inset:0;background:linear-gradient(135deg, #ffffff 0%, #fff1f2 100%);display:flex;align-items:center;justify-content:center;z-index:999999;}
  .splash-overlay .pt-center{opacity:1;transform:scale(1);}
  .splash-ring-anim{animation:ptRingPulse .8s ease infinite !important;}
  .splash-line-anim{animation:splashLineLoop 1s ease-in-out infinite !important;}
  @keyframes splashLineLoop{0%{width:0%;margin-left:0}50%{width:100%;margin-left:0}100%{width:0%;margin-left:100%}}

  /* ── TOAST ── */
  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--dark);color:white;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:all .35s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;box-shadow:var(--sh-xl);pointer-events:none;max-width:calc(100vw - 32px);}
  .toast-check{color:#4ade80;margin-right:8px;font-weight:900}
  .toast-in{opacity:1;transform:translateX(-50%) translateY(0)}

  /* ── STARS ── */
  .stars{display:inline-flex;gap:2px}
  .star-on{color:#f59e0b}.star-off{color:#d1d5db}
  .stars-sm .star-on,.stars-sm .star-off{font-size:13px}
  .stars-md .star-on,.stars-md .star-off{font-size:16px}

  /* ── SHAKE ── */
  @keyframes shake{0%,100%{transform:translateX(0)}10%{transform:translateX(-4px) rotate(-1.5deg)}20%{transform:translateX(4px) rotate(1.5deg)}30%{transform:translateX(-4px)}40%{transform:translateX(4px)}50%{transform:translateX(-3px)}60%{transform:translateX(3px)}70%{transform:translateX(-2px)}80%{transform:translateX(2px)}90%{transform:translateX(-1px)}}
  .btn-shake{animation:shake 0.6s cubic-bezier(.36,.07,.19,.97) both}
  .btn-ripple{position:absolute;width:0;height:0;background:rgba(255,255,255,0.4);border-radius:50%;transform:translate(-50%,-50%);animation:rippleEffect 0.7s ease-out forwards;pointer-events:none;}
  @keyframes rippleEffect{0%{width:0;height:0;opacity:1}100%{width:300px;height:300px;opacity:0}}

  /* ── HERO CARD ANIMATIONS ── */
  @keyframes heroCardExit{0%{opacity:1;transform:translateX(0) scale(1)}100%{opacity:0;transform:translateX(-40px) scale(0.96)}}
  @keyframes heroCardEnter{0%{opacity:0;transform:translateX(40px) scale(0.96)}100%{opacity:1;transform:translateX(0) scale(1)}}
  .hero-card-exit{animation:heroCardExit 0.35s cubic-bezier(0.4,0,1,1) forwards}
  .hero-card-enter{animation:heroCardEnter 0.4s cubic-bezier(0,0,0.2,1) forwards}
  .hero-card-visible{opacity:1;transform:translateX(0) scale(1)}

  /* ── 3D VIEWER ── */
  .viewer3d{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;cursor:grab;background:var(--bg-soft);border-radius:inherit;display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;}
  .viewer3d:active{cursor:grabbing}
  .viewer3d-img{width:100%;height:100%;object-fit:cover;transition:transform 0.15s ease;pointer-events:none;}
  .viewer3d-badge{position:absolute;top:12px;left:12px;background:rgba(0,0,0,.75);color:white;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);z-index:5;}
  .viewer3d-hint{position:absolute;bottom:50px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:white;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:600;backdrop-filter:blur(8px);z-index:5;white-space:nowrap;pointer-events:none;}
  .viewer3d-dots{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:5;}
  .viewer3d-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);transition:all .2s;}
  .viewer3d-dot.active{background:white;transform:scale(1.4)}

  /* ── LIVE FEED ── */
  .live-feed-popup{position:fixed;bottom:100px;left:16px;z-index:8000;animation:slideInLeft 0.5s cubic-bezier(0.34,1.56,.64,1) forwards,fadeOut 0.5s ease 3.5s forwards;max-width:min(280px,calc(100vw - 32px));}
  @keyframes slideInLeft{from{opacity:0;transform:translateX(-120%)}to{opacity:1;transform:translateX(0)}}
  @keyframes fadeOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-30px)}}
  .live-feed-inner{background:white;border-radius:var(--r-lg);border:1.5px solid var(--border);box-shadow:var(--sh-xl);padding:12px;display:flex;align-items:center;gap:10px;}
  .live-feed-img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0}
  .live-feed-name{font-size:12px;margin-bottom:2px;color:var(--text)}
  .live-feed-name strong{font-weight:700}
  .live-feed-action{font-size:11px;color:var(--muted)}
  .live-feed-action span{color:var(--red);font-weight:600}
  .live-feed-time{font-size:10px;color:var(--light);margin-top:2px}
  .live-dot{display:inline-block;width:7px;height:7px;background:#16a34a;border-radius:50%;margin-right:5px;animation:pulse 1.2s infinite;vertical-align:middle}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}

  /* ── WHATSAPP FLOAT ── */
  .wa-float{position:fixed;bottom:24px;left:16px;z-index:9000;width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(37,211,102,.5);transition:all .25s;border:3px solid white;animation:waPulse 2.5s ease-in-out infinite;}
  .wa-float:hover{transform:scale(1.12)}
  @keyframes waPulse{0%,100%{box-shadow:0 8px 28px rgba(37,211,102,.5)}50%{box-shadow:0 8px 28px rgba(37,211,102,.5),0 0 0 12px rgba(37,211,102,.15)}}
  .wa-tooltip{position:absolute;left:64px;top:50%;transform:translateY(-50%);background:var(--dark);color:white;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;white-space:nowrap;opacity:0;transition:opacity .2s;pointer-events:none;}
  .wa-tooltip::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);border:5px solid transparent;border-right-color:var(--dark);}
  .wa-float:hover .wa-tooltip{opacity:1}

  /* ── AUTH MODAL ── */
  .auth-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.65);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .22s ease;}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .auth-modal{width:100%;max-width:920px;border-radius:28px;overflow:hidden;display:grid;grid-template-columns:320px 1fr;background:white;box-shadow:0 40px 120px rgba(0,0,0,.35);animation:modalUp .32s cubic-bezier(0.34,1.4,0.64,1);max-height:94vh;overflow-y:auto;}
  @keyframes modalUp{from{opacity:0;transform:translateY(32px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .auth-left{position:relative;background:linear-gradient(160deg,#0a0a0a 0%,#1a0303 40%,#d90429 100%);padding:48px 32px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
  .auth-left-bg{position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,rgba(217,4,41,0.3) 0%,transparent 60%);pointer-events:none;}
  .auth-left-content{position:relative;z-index:1}
  .auth-logo-big{width:64px;height:64px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.2);border-radius:18px;display:grid;place-items:center;margin-bottom:28px;backdrop-filter:blur(10px);}
  .auth-logo-big .auth-logo-mark{font-size:20px;font-weight:900;color:white;font-family:var(--font-head);letter-spacing:-1px}
  .auth-tagline{font-size:32px;font-weight:800;color:white;line-height:1.1;margin-bottom:14px;font-family:var(--font-head)}
  .auth-sub-tag{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:24px;line-height:1.6}
  .auth-perks{display:flex;flex-direction:column;gap:10px}
  .auth-perk{display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,.8);font-weight:500}
  .auth-perk-check{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.15);display:grid;place-items:center;font-size:10px;color:white;font-weight:900;flex-shrink:0;border:1px solid rgba(255,255,255,.3);}
  .auth-right{padding:40px 36px;background:white;position:relative;overflow-y:auto;}
  .auth-close{position:absolute;top:18px;right:18px;width:36px;height:36px;border-radius:50%;background:var(--bg-soft);color:var(--muted);font-size:14px;display:grid;place-items:center;transition:all .2s;z-index:2;border:1.5px solid var(--border);}
  .auth-close:hover{background:#fee2e2;color:var(--red);border-color:var(--red-border)}
  .auth-header{margin-bottom:24px}
  .auth-admin-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#1a0a0a,#2d1a1a);color:#ff6b6b;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;border:1px solid rgba(217,4,41,.3);}
  .auth-title{font-size:26px;font-weight:800;color:var(--dark);margin-bottom:6px;font-family:var(--font-head)}
  .auth-desc{font-size:13px;color:var(--muted);line-height:1.6}
  .auth-form{display:flex;flex-direction:column;gap:14px}
  .auth-2col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .auth-field-wrap{display:flex;flex-direction:column;gap:5px}
  .auth-field-wrap label{font-size:13px;font-weight:700;color:var(--text)}
  .auth-inp-wrap{position:relative;display:flex;align-items:center;border:2px solid var(--border);border-radius:var(--r);background:var(--bg-soft);transition:border-color .2s;overflow:hidden;}
  .auth-inp-wrap:focus-within{border-color:var(--red);background:white}
  .auth-inp-ico{position:absolute;left:14px;font-size:16px;pointer-events:none;z-index:1}
  .auth-inp{flex:1;height:46px;padding:0 16px 0 42px;font-size:15px;color:var(--text);border:none;outline:none;background:transparent;}
  .auth-eye{width:42px;height:42px;display:grid;place-items:center;font-size:14px;flex-shrink:0;color:var(--muted);}
  .auth-err{display:flex;align-items:center;gap:8px;background:#fff1f2;border:1.5px solid #ffc9ce;border-radius:var(--r);padding:12px 14px;font-size:13px;font-weight:600;color:#b91c1c;}
  .auth-submit{width:100%;height:50px;background:var(--red);color:white;border-radius:var(--r);font-size:15px;font-weight:700;transition:all .25s;box-shadow:0 8px 24px rgba(217,4,41,.2);display:flex;align-items:center;justify-content:center;margin-top:4px;}
  .auth-submit:hover:not(:disabled){background:var(--red-dark);transform:translateY(-2px)}
  .auth-submit:disabled{opacity:.75;cursor:not-allowed}
  .auth-spinner{width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .auth-divider{display:flex;align-items:center;gap:12px;color:var(--light);font-size:13px;margin:4px 0}
  .auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--border)}
  .auth-switch{font-size:14px;color:var(--muted);text-align:center;margin-top:8px}
  .auth-switch button{color:var(--red);font-weight:700;text-decoration:underline;}

  /* ── HEADER ── */
  .hdr{position:sticky;top:0;z-index:500;background:rgba(255,255,255,.97);backdrop-filter:blur(24px);border-bottom:1px solid var(--border);transition:box-shadow .3s;width:100%;max-width:100%;overflow:hidden;}
  .hdr-scrolled{box-shadow:0 4px 24px rgba(0,0,0,.08)}
  /* FIX: changed translateX(100vw) to translateX(100%) to prevent mobile overflow */
  .hdr-announce{background:var(--red);color:white;overflow:hidden;height:36px;display:flex;align-items:center;width:100%;}
  .hdr-announce-inner{white-space:nowrap;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;animation:marquee 28s linear infinite;padding:0 40px;will-change:transform;}
  @keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
  .hdr-body{width:100%;padding:0 20px;display:flex;align-items:center;gap:10px;height:64px;overflow:hidden;}
  .hdr-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;gap:5px;width:40px;height:40px;border-radius:10px;transition:background .2s;flex-shrink:0;}
  .hdr-hamburger:hover{background:var(--bg-soft)}
  .ham-line{width:22px;height:2px;background:var(--dark);border-radius:2px;transition:all .3s;}
  .hdr-logo{display:flex;align-items:center;gap:8px;flex-shrink:0}
  .hdr-logo-mark{width:36px;height:36px;background:var(--red);color:white;border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:900;letter-spacing:-.5px;flex-shrink:0;font-family:var(--font-head);}
  .hdr-logo-text{font-size:18px;font-weight:800;color:var(--dark);letter-spacing:-.5px;font-family:var(--font-head);}
  .hdr-nav{align-items:center;gap:2px;flex:1;justify-content:center}
  .hdr-nav-btn{padding:8px 14px;border-radius:10px;font-weight:600;font-size:13px;color:var(--muted);transition:all .2s;font-family:var(--font-body);}
  .hdr-nav-btn:hover{color:var(--text);background:var(--bg-gray)}
  .hdr-nav-btn.active{color:var(--red);background:var(--red-soft)}
  .admin-nav-btn{border:1.5px solid #fde68a;background:#fffbf0;color:#a16207 !important}
  .admin-nav-btn.active{background:#fef3c7 !important;color:#92400e !important}
  .hdr-right{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;}
  .hdr-icon-btn{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}
  .hdr-icon-btn:hover{background:var(--bg-gray)}
  .hdr-search{position:relative;align-items:center}
  .hdr-search-ico{position:absolute;left:12px;font-size:17px;color:var(--muted);pointer-events:none}
  .hdr-search-inp{height:40px;width:190px;border:2px solid var(--border);border-radius:var(--r);padding:0 14px 0 36px;font-size:13px;outline:none;transition:border-color .2s;background:var(--bg-soft);color:var(--text);}
  .hdr-search-inp:focus{border-color:var(--red);background:white}
  .hdr-wish-btn{position:relative;width:40px;height:40px;border-radius:10px;font-size:19px;color:var(--text);display:grid;place-items:center;transition:background .2s;flex-shrink:0;}
  .hdr-wish-btn:hover{background:var(--bg-gray)}
  .hdr-badge{position:absolute;top:2px;right:2px;width:17px;height:17px;background:var(--red);color:white;border-radius:50%;font-size:10px;font-weight:800;display:grid;place-items:center;}
  .hdr-cart-btn{display:flex;align-items:center;gap:6px;background:var(--red);color:white;padding:9px 16px;border-radius:var(--r);font-weight:700;font-size:13px;transition:all .2s;position:relative;flex-shrink:0;}
  .hdr-cart-btn:hover{background:var(--red-dark)}
  .hdr-cart-label{display:inline}
  .hdr-cart-count{background:white;color:var(--red);width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:900;display:grid;place-items:center;}
  .hdr-login-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--r);border:2px solid var(--border);background:white;color:var(--text);font-size:13px;font-weight:600;transition:all .2s;flex-shrink:0;}
  .hdr-login-btn:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .hdr-user-wrap{position:relative;flex-shrink:0}
  .hdr-user-btn{display:flex;align-items:center;gap:6px;padding:5px 10px 5px 5px;border-radius:var(--r);border:2px solid var(--border);background:white;transition:all .2s;}
  .hdr-user-btn:hover{border-color:var(--red);background:var(--red-soft)}
  .hdr-user-av{width:30px;height:30px;border-radius:7px;background:var(--red);color:white;display:grid;place-items:center;font-size:13px;font-weight:800;flex-shrink:0;font-family:var(--font-head);}
  .hdr-user-name{font-size:13px;font-weight:600;color:var(--text)}
  .hdr-user-caret{font-size:10px;color:var(--muted)}
  .hdr-user-menu{position:absolute;top:calc(100% + 10px);right:0;width:250px;background:white;border-radius:var(--r-lg);border:1.5px solid var(--border);box-shadow:var(--sh-xl);overflow:hidden;z-index:600;animation:menuDrop .2s cubic-bezier(0.34,1.4,0.64,1);}
  @keyframes menuDrop{from{opacity:0;transform:translateY(-8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .hdr-um-header{padding:14px;display:flex;align-items:center;gap:10px;background:var(--bg-soft);border-bottom:1px solid var(--border);}
  .hdr-um-av{width:42px;height:42px;border-radius:9px;background:var(--red);color:white;display:grid;place-items:center;font-size:17px;font-weight:800;flex-shrink:0;font-family:var(--font-head);}
  .hdr-um-header strong{display:block;font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head)}
  .hdr-um-header span{display:block;font-size:12px;color:var(--muted)}
  .admin-role-badge{display:inline-block;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;margin-top:3px}
  .hdr-um-divider{height:1px;background:var(--border)}
  .hdr-um-item{width:100%;text-align:left;padding:12px 14px;font-size:13px;font-weight:500;color:var(--text);transition:background .15s;display:flex;align-items:center;gap:8px;}
  .hdr-um-item:hover{background:var(--bg-soft)}
  .hdr-um-logout{color:#dc2626}
  .hdr-um-logout:hover{background:#fff1f2}
  .hdr-cats{padding:0 20px 10px;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none;max-width:100%;}
  .hdr-cats::-webkit-scrollbar{display:none}
  .hdr-cat{white-space:nowrap;padding:5px 12px;border-radius:999px;border:1.5px solid var(--border);background:white;font-size:12px;font-weight:600;color:var(--muted);transition:all .2s;flex-shrink:0;}
  .hdr-cat:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .mobile-search-bar{display:flex;align-items:center;padding:0 16px 12px;gap:6px;position:relative;width:100%;}
  .mobile-search-bar .hdr-search-ico{position:absolute;left:28px;}
  .mobile-search-bar .hdr-search-inp{flex:1;width:100%;height:44px;padding-left:40px;}

  /* ── MOBILE MENU ── */
  .mobile-menu-overlay{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);animation:fadeIn .2s ease;}
  .mobile-menu{position:fixed;top:0;left:0;bottom:0;width:min(88vw,340px);background:white;z-index:9999;overflow-y:auto;animation:slideMenuIn .3s cubic-bezier(0.34,1.2,0.64,1);}
  @keyframes slideMenuIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
  .mobile-menu-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--bg-soft);}
  .mobile-menu-close{width:38px;height:38px;border-radius:10px;background:var(--bg-gray);color:var(--muted);font-size:15px;display:grid;place-items:center;flex-shrink:0;transition:all .2s;}
  .mobile-menu-close:hover{background:#fee2e2;color:var(--red)}
  .mobile-user-card{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#fff1f2,#ffe4e6);border-bottom:1px solid var(--red-border);}
  .mobile-user-card strong{display:block;font-size:15px;font-weight:700;color:var(--dark);font-family:var(--font-head)}
  .mobile-user-card span{font-size:12px;color:var(--muted)}
  .mobile-nav{display:flex;flex-direction:column;}
  .mobile-nav-btn{display:flex;align-items:center;gap:12px;padding:14px 20px;font-size:15px;font-weight:500;color:var(--text);border-bottom:1px solid var(--bg-gray);transition:background .15s;text-align:left;width:100%;}
  .mobile-nav-btn:hover,.mobile-nav-btn.active{background:var(--red-soft);color:var(--red)}
  .mobile-nav-btn span:first-child{font-size:18px;width:24px;text-align:center;flex-shrink:0;}
  .mobile-nav-btn span:nth-child(2){flex:1}
  .mobile-nav-arrow{font-size:16px;color:var(--muted)}
  .admin-mobile-btn{background:#fffbf0;color:#a16207}
  .mobile-menu-divider{height:1px;background:var(--border);margin:8px 0;}
  .mobile-menu-section-title{padding:10px 20px 4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-family:var(--font-head);}
  .mobile-cats-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 20px;}
  .mobile-cat-chip{padding:10px 12px;border-radius:var(--r);border:1.5px solid var(--border);background:white;font-size:13px;font-weight:600;color:var(--text);text-align:center;transition:all .2s;}
  .mobile-cat-chip:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .mobile-menu-footer{padding:20px;}
  .mobile-wa-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:#25D366;color:white;border-radius:var(--r-lg);font-size:15px;font-weight:700;}

  /* ── HERO ── */
  .hero{background:linear-gradient(145deg,#ffffff 0%,#fef2f2 40%,#fff8f8 70%,#ffffff 100%);border-bottom:1px solid #f0d8d8;position:relative;overflow:hidden;width:100%;max-width:100%;}
  .hero-bg-shape{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(217,4,41,.06) 0%,transparent 70%);pointer-events:none;}
  .hero-bg-shape-1{width:700px;height:700px;top:-200px;right:-100px}
  .hero-bg-shape-2{width:500px;height:500px;bottom:-150px;left:-100px}
  .hero-inner{width:100%;padding:56px 40px 40px;display:grid;grid-template-columns:1fr 460px;gap:48px;align-items:center;position:relative;z-index:1;}
  .hero-pill{display:inline-flex;align-items:center;gap:10px;padding:7px 16px;border-radius:999px;background:var(--red-soft);border:1.5px solid var(--red-border);color:var(--red);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px;font-family:var(--font-body);}
  .hero-dot-pulse{width:8px;height:8px;background:var(--red);border-radius:50%;animation:pulse 1.6s infinite;flex-shrink:0;}
  .hero-h1{font-size:clamp(36px,4.5vw,68px);font-weight:800;line-height:1.04;letter-spacing:-2px;color:var(--dark);margin-bottom:16px;font-family:var(--font-head);}
  .hero-h1-accent{color:var(--red);position:relative;display:inline-block;}
  .hero-h1-accent::after{content:'';position:absolute;bottom:-4px;left:0;right:0;height:4px;background:var(--red);border-radius:2px;opacity:.3;}
  .hero-p{font-size:16px;color:var(--muted);line-height:1.7;max-width:520px;margin-bottom:20px}
  .hero-trust{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
  .hero-trust-item{font-size:12px;font-weight:600;color:var(--muted)}
  .hero-btns{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:36px}
  .btn-red-lg{height:50px;padding:0 24px;background:var(--red);color:white;border-radius:var(--r);font-size:15px;font-weight:700;transition:all .25s;box-shadow:0 8px 24px rgba(217,4,41,.25);display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);}
  .btn-red-lg:hover{background:var(--red-dark);transform:translateY(-2px);box-shadow:0 12px 32px rgba(217,4,41,.35)}
  .hero-cta .btn-arrow{display:inline-block;transition:transform .2s;}
  .hero-cta:hover .btn-arrow{transform:translateX(4px)}
  .btn-outline-lg{height:50px;padding:0 22px;background:white;color:var(--text);border-radius:var(--r);font-size:15px;font-weight:600;border:2px solid var(--border);transition:all .25s;font-family:var(--font-body);}
  .btn-outline-lg:hover{border-color:var(--red);color:var(--red);transform:translateY(-2px)}
  .btn-dark-lg{height:50px;padding:0 24px;background:var(--dark);color:white;border-radius:var(--r);font-size:15px;font-weight:700;transition:all .25s;display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);}
  .btn-dark-lg:hover{background:#1f2937;transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,.25)}
  .hero-stats{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  .hero-stat{display:flex;flex-direction:column;gap:2px}
  .hero-stat strong{font-size:22px;font-weight:800;color:var(--dark);font-family:var(--font-head);}
  .hero-stat span{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .hero-stat-div{width:1px;height:36px;background:var(--border)}
  .hero-visual{position:relative}
  .hero-img-card{border-radius:28px;overflow:hidden;position:relative;background:var(--bg-soft);box-shadow:var(--sh-xl);aspect-ratio:4/5;border:1.5px solid var(--border);}
  .hero-off-badge{position:absolute;top:16px;left:16px;background:var(--red);color:white;padding:8px 12px;border-radius:12px;font-size:13px;font-weight:900;line-height:1.2;text-align:center;z-index:10;font-family:var(--font-head);}
  .hero-hot-badge{position:absolute;top:16px;right:16px;background:rgba(0,0,0,.8);color:white;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;z-index:10;backdrop-filter:blur(8px);}
  .hero-float-card{position:absolute;bottom:110px;left:-24px;background:white;border-radius:16px;padding:12px 16px;box-shadow:var(--sh-xl);border:1.5px solid var(--border);z-index:10;animation:floatY 3s ease-in-out infinite;}
  @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
  .hero-float-stars{color:#f59e0b;font-size:13px;margin-bottom:3px}
  .hero-float-text{font-size:12px;font-weight:600;color:var(--dark);margin-bottom:2px}
  .hero-float-name{font-size:11px;color:var(--muted)}
  .hero-peek{position:absolute;bottom:0;left:0;right:0;background:rgba(255,255,255,.95);backdrop-filter:blur(20px);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--border);}
  .hero-peek-name{font-size:13px;font-weight:700;color:var(--dark);font-family:var(--font-head);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
  .hero-peek-prices{display:flex;align-items:center;gap:8px;margin-top:2px}
  .hero-peek-price{font-size:16px;font-weight:800;color:var(--red);font-family:var(--font-head);}
  .hero-peek-old{font-size:12px;color:var(--light);text-decoration:line-through}
  .hero-peek-btn{background:var(--red);color:white;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap;transition:all .2s;flex-shrink:0;}
  .hero-peek-btn:hover{background:var(--red-dark)}
  .hero-dots{display:flex;justify-content:center;gap:8px;margin-top:16px}
  .hero-dot-btn{width:8px;height:8px;border-radius:50%;background:var(--border);transition:all .3s;border:none;}
  .hero-dot-btn.active{width:24px;border-radius:4px;background:var(--red)}
  /* FIX: ribbon uses overflow:hidden on parent, inner uses translateX % not vw */
  .hero-ribbon{border-top:1px solid var(--border);background:var(--bg-soft);overflow:hidden;height:40px;display:flex;align-items:center;width:100%;}
  .hero-ribbon-track{display:flex;animation:ribbonScroll 30s linear infinite;white-space:nowrap;will-change:transform;}
  @keyframes ribbonScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .hero-ribbon-item{padding:0 28px;font-size:12px;font-weight:600;color:var(--muted);border-right:1px solid var(--border);flex-shrink:0;}

  /* ── TICKER ── */
  .ticker{display:flex;align-items:center;background:var(--dark);color:white;overflow:hidden;height:38px;width:100%;max-width:100%;}
  .ticker-label{white-space:nowrap;padding:0 16px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--red);border-right:1px solid rgba(255,255,255,.15);height:100%;display:flex;align-items:center;flex-shrink:0;background:rgba(217,4,41,.15);}
  .ticker-track-wrap{flex:1;overflow:hidden;min-width:0;}
  .ticker-track{display:flex;animation:tickerScroll 35s linear infinite;will-change:transform;}
  @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .ticker-item{padding:0 24px;font-size:12px;font-weight:500;color:rgba(255,255,255,.8);white-space:nowrap;border-right:1px solid rgba(255,255,255,.1);}

  /* ── TRUST BAR ── */
  .trust-bar{display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap;background:white;border-bottom:1px solid var(--border);border-top:1px solid var(--border);width:100%;overflow:hidden;}
  .trust-item{display:flex;align-items:center;gap:10px;padding:14px 20px;border-right:1px solid var(--border);}
  .trust-ico{font-size:20px;flex-shrink:0}
  .trust-text{display:flex;flex-direction:column;gap:1px}
  .trust-text strong{font-size:13px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .trust-text span{font-size:11px;color:var(--muted)}

  /* ── SECTION COMMON ── */
  .sec{width:100%;padding:64px 40px;overflow:hidden;}
  .sec-head{margin-bottom:36px}
  .sec-centered{text-align:center}
  .eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--red);margin-bottom:8px;font-family:var(--font-head);}
  .sec-h2{font-size:clamp(24px,3vw,38px);font-weight:800;color:var(--dark);letter-spacing:-1px;margin-bottom:10px;font-family:var(--font-head);}
  .sec-sub{font-size:15px;color:var(--muted);line-height:1.7;max-width:520px}
  .sec-sub-center{margin:0 auto;text-align:center}

  /* ── CATEGORY GRID ── */
  .cat-sec{background:var(--bg-soft)}
  .cat-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
  .cat-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 12px;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--cat-bg,white);transition:all .28s;position:relative;overflow:hidden;}
  .cat-card::before{content:'';position:absolute;inset:0;background:var(--cat-color);opacity:0;transition:opacity .25s;}
  .cat-card:hover{transform:translateY(-6px);box-shadow:0 16px 40px rgba(0,0,0,.1);border-color:var(--cat-color);}
  .cat-card:hover .cat-nm{color:var(--cat-color)}
  .cat-icon-wrap{width:56px;height:56px;border-radius:16px;background:white;display:grid;place-items:center;box-shadow:var(--sh);transition:transform .25s;z-index:1;}
  .cat-card:hover .cat-icon-wrap{transform:scale(1.12)}
  .cat-emo{font-size:26px}
  .cat-nm{font-size:13px;font-weight:700;color:var(--dark);text-align:center;z-index:1;transition:color .25s;font-family:var(--font-head);}
  .cat-arrow{font-size:14px;color:var(--muted);transition:all .25s;z-index:1;}
  .cat-card:hover .cat-arrow{color:var(--cat-color);transform:translateX(4px)}

  /* ── FLASH SALE ── */
  .flash-sec{padding:64px 40px;background:linear-gradient(145deg,#0a0a0a,#1a0303 40%,#2d0505);overflow:hidden;}
  .flash-hdr{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:36px;flex-wrap:wrap;gap:16px}
  .flash-pill{display:inline-block;background:var(--red);color:white;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
  .flash-h2{font-size:clamp(22px,2.5vw,34px);font-weight:800;color:white;letter-spacing:-1px;margin-bottom:6px;font-family:var(--font-head);}
  .flash-sub{font-size:14px;color:rgba(255,255,255,.55)}
  .flash-cd{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
  .flash-ends-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5)}
  .cd-row{display:flex;align-items:center;gap:6px}
  .cd-box{background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 14px;text-align:center;min-width:56px;backdrop-filter:blur(10px);}
  .cd-num{display:block;font-size:24px;font-weight:900;color:white;font-family:var(--font-head);line-height:1;}
  .cd-lbl{display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.4);margin-top:4px}
  .cd-sep{font-size:24px;font-weight:900;color:rgba(255,255,255,.4);line-height:1}
  .flash-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}

  /* ── PRODUCT CARD ── */
  .pcard{border-radius:var(--r-lg);border:1.5px solid var(--border);background:white;overflow:hidden;transition:all .3s;display:flex;flex-direction:column;}
  .pcard:hover{box-shadow:0 16px 48px rgba(0,0,0,.1);transform:translateY(-6px);border-color:rgba(217,4,41,.2);}
  .pcard-flash{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04);backdrop-filter:blur(10px);}
  .pcard-flash .pcard-body{background:rgba(255,255,255,.05)}
  .pcard-flash .pcard-cat,.pcard-flash .pcard-desc,.pcard-flash .pcard-rv,.pcard-flash .pcard-stock{color:rgba(255,255,255,.5)}
  .pcard-flash .pcard-name,.pcard-flash .pcard-price{color:white}
  .pcard-flash .star-off{color:rgba(255,255,255,.2)}
  .pcard-img-wrap{position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--bg-soft);}
  .pcard-img-btn{width:100%;height:100%;display:block;}
  .pcard-img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(0.25,0.46,0.45,0.94);}
  .pcard-img-z{transform:scale(1.06)}
  .pcard-sale-badge{position:absolute;top:10px;left:10px;background:var(--red);color:white;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;z-index:5;}
  .pcard-hot-badge{position:absolute;top:10px;right:44px;background:rgba(0,0,0,.75);color:white;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:700;z-index:5;backdrop-filter:blur(8px);}
  .pcard-wish{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);font-size:16px;color:var(--muted);display:grid;place-items:center;transition:all .2s;z-index:5;border:1.5px solid var(--border);}
  .pcard-wish.wished,.pcard-wish:hover{color:var(--red);background:white;border-color:var(--red-border)}
  .pcard-overlay{position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;z-index:4;}
  .pcard-overlay-show{opacity:1}
  .pcard-overlay button{background:white;color:var(--dark);padding:10px 20px;border-radius:var(--r);font-size:13px;font-weight:700;transition:all .2s;}
  .pcard-overlay button:hover{background:var(--red);color:white}
  .pcard-body{padding:14px;flex:1;display:flex;flex-direction:column;gap:6px}
  .pcard-cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--red)}
  .pcard-name{font-size:14px;font-weight:700;color:var(--dark);line-height:1.3;cursor:pointer;font-family:var(--font-head);}
  .pcard-name:hover{color:var(--red)}
  .pcard-desc{font-size:12px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .pcard-rating{display:flex;align-items:center;gap:6px}
  .pcard-rv{font-size:11px;color:var(--muted)}
  .pcard-prices{display:flex;align-items:center;gap:8px;margin-top:auto}
  .pcard-price{font-size:17px;font-weight:800;color:var(--dark);font-family:var(--font-head);}
  .pcard-old{font-size:12px;color:var(--light);text-decoration:line-through}
  .pcard-foot{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
  .pcard-stock{font-size:11px;font-weight:600;color:var(--red)}
  .pcard-add{background:var(--red);color:white;padding:8px 14px;border-radius:9px;font-size:12px;font-weight:700;transition:all .2s;}
  .pcard-add:hover{background:var(--red-dark);transform:translateY(-1px)}

  /* ── PRODUCT GRID ── */
  .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
  .empty-state{text-align:center;padding:80px 40px;color:var(--muted)}
  .empty-ico{display:block;font-size:56px;margin-bottom:16px}
  .empty-state h3{font-size:22px;font-weight:700;color:var(--dark);margin-bottom:8px;font-family:var(--font-head);}

  /* ── ROW SECTION ── */
  .row-hdr{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:10px}
  .row-controls{display:flex;align-items:center;gap:8px}
  .row-arr{width:38px;height:38px;border-radius:50%;border:1.5px solid var(--border);background:white;color:var(--text);font-size:18px;display:grid;place-items:center;transition:all .2s;}
  .row-arr:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .view-all{padding:9px 18px;border-radius:var(--r);border:1.5px solid var(--border);background:white;font-size:13px;font-weight:600;color:var(--text);transition:all .2s;}
  .view-all:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .hscroll{overflow-x:auto;scrollbar-width:none;max-width:100%;}
  .hscroll::-webkit-scrollbar{display:none}
  .hscroll-inner{display:flex;gap:16px;padding-bottom:4px;}
  .hscroll-item{flex:0 0 240px}

  /* ── BRAND BANNER ── */
  .brand-sec{background:linear-gradient(145deg,var(--bg-soft),white);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:64px 40px;overflow:hidden;}
  .brand-inner{display:grid;grid-template-columns:1fr 440px;gap:60px;align-items:center;}
  .brand-pill{display:inline-block;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;}
  .brand-h2{font-size:clamp(28px,3vw,44px);font-weight:800;color:var(--dark);letter-spacing:-1.5px;line-height:1.1;margin-bottom:14px;font-family:var(--font-head);}
  .brand-p{font-size:15px;color:var(--muted);line-height:1.7;margin-bottom:24px;max-width:480px}
  .brand-feats{display:flex;flex-direction:column;gap:8px;margin-bottom:28px}
  .brand-feat{font-size:14px;font-weight:500;color:var(--text);display:flex;align-items:center;gap:8px}
  .feat-check{color:#16a34a;font-weight:900}
  .brand-visual{position:relative}
  .brand-img-wrap{border-radius:var(--r-xl);overflow:hidden;position:relative;box-shadow:var(--sh-xl);aspect-ratio:4/3;}
  .brand-img{width:100%;height:100%;object-fit:cover}
  .brand-save{position:absolute;top:20px;right:20px;background:var(--red);color:white;padding:10px 14px;border-radius:14px;font-size:15px;font-weight:900;font-family:var(--font-head);}
  .brand-prod-row{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:white;border-radius:var(--r-lg);margin-top:-24px;position:relative;z-index:2;box-shadow:var(--sh);border:1.5px solid var(--border);}
  .brand-prod-row strong{font-size:15px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .brand-prod-row span{font-size:16px;font-weight:800;color:var(--red);font-family:var(--font-head);}

  /* ── PROMO STRIP ── */
  .promo-strip{padding:0 40px 64px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .promo-card{border-radius:var(--r-xl);overflow:hidden;padding:36px 32px;display:flex;align-items:flex-end;justify-content:space-between;position:relative;min-height:180px;transition:transform .3s;}
  .promo-card:hover{transform:translateY(-4px)}
  .promo-card-1{background:linear-gradient(135deg,#0f172a,#1e3a5f)}
  .promo-card-2{background:linear-gradient(135deg,#1a0a2e,#4a1a7e)}
  .promo-card-3{background:linear-gradient(135deg,#0d2614,#1a4d2e)}
  .promo-tag{display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;}
  .promo-content h3{font-size:20px;font-weight:800;color:white;margin-bottom:4px;font-family:var(--font-head);}
  .promo-content p{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:14px}
  .promo-btn{background:white;color:var(--dark);padding:8px 16px;border-radius:var(--r);font-size:12px;font-weight:700;transition:all .2s;}
  .promo-btn:hover{background:var(--red);color:white}
  .promo-emoji{font-size:64px;opacity:.7;flex-shrink:0}

  /* ── CERTIFICATIONS ── */
  .cert-sec{padding:64px 40px;background:var(--bg-soft);border-top:1px solid var(--border);overflow:hidden;}
  .cert-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:36px}
  .cert-card{background:white;border-radius:var(--r-lg);padding:24px 16px;text-align:center;border:1.5px solid var(--border);transition:all .3s;position:relative;overflow:hidden;}
  .cert-card::before{content:'';position:absolute;inset:0;background:var(--cert-color);opacity:0;transition:opacity .25s;}
  .cert-card:hover{transform:translateY(-6px);box-shadow:0 16px 40px rgba(0,0,0,.08);border-color:var(--cert-color);}
  .cert-icon-ring{width:52px;height:52px;border-radius:14px;background:color-mix(in srgb,var(--cert-color) 12%,white);display:grid;place-items:center;margin:0 auto 12px;border:1.5px solid color-mix(in srgb,var(--cert-color) 25%,white);transition:transform .3s;position:relative;z-index:1;}
  .cert-card:hover .cert-icon-ring{transform:scale(1.1)}
  .cert-icon{font-size:24px}
  .cert-badge-line{width:24px;height:2px;background:var(--cert-color);border-radius:2px;margin:0 auto 10px;position:relative;z-index:1;opacity:.6;}
  .cert-title{font-size:13px;font-weight:700;color:var(--dark);margin-bottom:4px;line-height:1.3;position:relative;z-index:1;font-family:var(--font-head);}
  .cert-sub-text{font-size:11px;color:var(--muted);line-height:1.5;position:relative;z-index:1;}

  /* ── TESTIMONIALS ── */
  .testi-sec{padding:64px 40px;background:var(--bg-soft);overflow:hidden;}
  .testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:16px}
  .testi-card{background:white;border-radius:var(--r-lg);padding:28px;border:1.5px solid var(--border);position:relative;overflow:hidden;transition:all .3s;}
  .testi-card:hover{transform:translateY(-4px);box-shadow:var(--sh-lg);border-color:rgba(217,4,41,.2);}
  .testi-quote{position:absolute;top:16px;right:20px;font-size:60px;color:var(--red-soft);line-height:1;font-family:Georgia,serif;font-weight:900;}
  .testi-text{font-size:14px;color:var(--text);line-height:1.7;margin:12px 0 18px;position:relative;z-index:1}
  .testi-author{display:flex;align-items:center;gap:12px}
  .testi-av{width:38px;height:38px;border-radius:50%;background:var(--red);color:white;display:grid;place-items:center;font-size:16px;font-weight:800;flex-shrink:0;font-family:var(--font-head);}
  .testi-author-info strong{display:block;font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .testi-author-info span{font-size:12px;color:var(--muted)}

  /* ── STATS SECTION ── */
  .stats-sec{background:linear-gradient(145deg,#0a0a0a,#1a0303 40%,#d90429);padding:64px 40px;overflow:hidden;}
  .stats-inner{max-width:1200px;margin:0 auto}
  .stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-top:36px}
  .stat-card{background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.1);border-radius:var(--r-lg);padding:24px 16px;text-align:center;backdrop-filter:blur(10px);transition:all .3s;}
  .stat-card:hover{background:rgba(255,255,255,.12);transform:translateY(-4px)}
  .stat-ico{font-size:28px;display:block;margin-bottom:10px}
  .stat-num{font-size:28px;font-weight:900;color:white;display:block;font-family:var(--font-head);}
  .stat-label{font-size:11px;color:rgba(255,255,255,.55);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-top:4px;display:block}

  /* ── NEWSLETTER ── */
  .nl-sec{padding:64px 40px;background:white;border-top:1px solid var(--border);overflow:hidden;}
  .nl-inner{max-width:580px;margin:0 auto;text-align:center}
  .nl-ico{font-size:48px;margin-bottom:16px}
  .nl-inner h2{font-size:28px;font-weight:800;color:var(--dark);margin-bottom:10px;font-family:var(--font-head);}
  .nl-inner p{font-size:15px;color:var(--muted);line-height:1.7;margin-bottom:28px}
  .nl-form{display:flex;gap:10px;margin-bottom:14px}
  .nl-inp{flex:1;min-width:0;height:50px;border:2px solid var(--border);border-radius:var(--r);padding:0 16px;font-size:14px;outline:none;transition:border-color .2s;font-family:var(--font-body);}
  .nl-inp:focus{border-color:var(--red)}
  .nl-btn{height:50px;padding:0 20px;background:var(--red);color:white;border-radius:var(--r);font-size:14px;font-weight:700;white-space:nowrap;transition:all .2s;}
  .nl-btn:hover{background:var(--red-dark)}
  .nl-trust{font-size:12px;color:var(--muted)}
  .admin-dot{width:8px;height:8px;border-radius:50%;background:var(--red);display:block;margin:18px auto 0;border:0;opacity:.72;box-shadow:0 0 0 0 rgba(232,25,44,.25);transition:opacity .2s,transform .2s,box-shadow .2s;}
  .admin-dot:hover{opacity:1;transform:scale(1.35);box-shadow:0 0 0 8px rgba(232,25,44,.08);}
  .home-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:34px;flex-wrap:wrap;}
  .page-btn{min-width:46px;height:46px;border-radius:14px;border:1.5px solid var(--border);background:#fff;color:#4b5563;font-size:20px;font-weight:800;display:grid;place-items:center;transition:all .2s;box-shadow:0 8px 20px rgba(27,67,50,.06);}
  .page-btn:hover:not(:disabled){border-color:var(--forest);color:var(--forest);transform:translateY(-2px);}
  .page-btn.active{background:var(--forest);border-color:var(--forest);color:#fff;box-shadow:0 14px 28px rgba(27,67,50,.18);}
  .page-btn:disabled{opacity:.32;cursor:not-allowed;}
  .page-arrow{font-size:30px;font-weight:500;}
  .page-ellipsis{min-width:42px;text-align:center;color:#4b5563;font-size:24px;font-weight:800;letter-spacing:.08em;}
  .home-empty{margin-top:10px;}

  /* ── FOOTER ── */
  .footer{background:var(--dark);color:rgba(255,255,255,.7);padding:0;overflow:hidden;}
  .footer-top{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;padding:60px 40px 40px;}
  .footer-brand p{font-size:13px;line-height:1.7;margin:12px 0 16px;max-width:280px;}
  .footer-logo{display:flex;align-items:center;gap:8px}
  .footer-logo-txt{font-size:20px;font-weight:800;color:white;font-family:var(--font-head);}
  .footer-socials{display:flex;gap:8px}
  .social-a{width:36px;height:36px;border-radius:9px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);display:grid;place-items:center;font-size:13px;font-weight:700;color:white;transition:all .2s;text-transform:uppercase;}
  .social-a:hover{background:var(--red);border-color:var(--red)}
  .footer-col h4{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:white;margin-bottom:16px;font-family:var(--font-head);}
  .footer-col button,.footer-col p,.footer-col a{display:block;font-size:13px;color:rgba(255,255,255,.6);margin-bottom:8px;line-height:1.5;text-align:left;transition:color .2s;}
  .footer-col button:hover,.footer-col a:hover{color:white}
  .footer-pays{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
  .footer-pays span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:rgba(255,255,255,.7);}
  .footer-bottom{border-top:1px solid rgba(255,255,255,.1);padding:20px 40px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.4);flex-wrap:wrap;gap:8px;}

  /* ── BREADCRUMB ── */
  .breadcrumb{font-size:12px;color:var(--muted);margin-bottom:24px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .bc-cur{font-weight:600;color:var(--text)}

  /* ── PRODUCT DETAIL PAGE ── */
  .pdp{display:grid;grid-template-columns:1fr 480px;gap:52px;align-items:start}
  .pdp-mobile-head{display:none;}
  .pdp-gallery{display:flex;flex-direction:column;gap:12px;position:sticky;top:90px;}
  .pdp-main-box{border-radius:var(--r-xl);overflow:hidden;background:var(--bg-soft);position:relative;aspect-ratio:1;border:1.5px solid var(--border);max-height:500px;}
  .pdp-main-img{width:100%;height:100%;object-fit:contain;max-height:500px;}
  .pdp-off-badge{position:absolute;top:16px;left:16px;background:var(--red);color:white;padding:8px 14px;border-radius:12px;font-size:14px;font-weight:900;z-index:5;font-family:var(--font-head);}
  .pdp-3d-toggle{position:absolute;bottom:16px;right:16px;background:rgba(0,0,0,.75);color:white;padding:8px 14px;border-radius:var(--r);font-size:12px;font-weight:700;backdrop-filter:blur(10px);z-index:5;border:1px solid rgba(255,255,255,.15);transition:all .2s;}
  .pdp-3d-toggle:hover{background:var(--red)}
  .pdp-thumbs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;}
  .pdp-thumbs::-webkit-scrollbar{display:none}
  .pdp-thumb{width:70px;height:70px;border-radius:var(--r);overflow:hidden;border:2px solid var(--border);flex-shrink:0;transition:border-color .2s;}
  .pdp-thumb.active{border-color:var(--red)}
  .pdp-thumb img{width:100%;height:100%;object-fit:cover}
  .pdp-info{display:flex;flex-direction:column;gap:16px}
  .pdp-cat{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--red);font-family:var(--font-head);}
  .pdp-title{font-size:clamp(22px,2.5vw,34px);font-weight:800;color:var(--dark);letter-spacing:-1px;line-height:1.15;font-family:var(--font-head);}
  .pdp-rating-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .pdp-rv{font-size:13px;color:var(--muted)}
  .pdp-verified{font-size:12px;font-weight:700;color:#16a34a;background:#f0fdf4;padding:3px 10px;border-radius:999px;border:1px solid #bbf7d0;}
  .pdp-price-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .pdp-price{font-size:36px;font-weight:900;color:var(--dark);font-family:var(--font-head);}
  .pdp-old{font-size:18px;color:var(--light);text-decoration:line-through}
  .pdp-save{background:var(--red-soft);color:var(--red);padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;border:1.5px solid var(--red-border);}

  /* ── PDP TRUST LINES ── */
  .pdp-trust-lines{margin-top:20px;display:flex;flex-direction:column;gap:10px;background:var(--bg-soft);padding:16px;border-radius:var(--r-lg);border:1px solid var(--border);}
  .tl-item{font-size:14px;font-weight:600;color:var(--dark);display:flex;align-items:center;gap:8px;}
  .pdp-urgency{color:var(--red);font-weight:700;font-size:14px;margin-bottom:8px;}

  /* ── AESTHETICS & HERO ── */
  .hero-bg-anim{position:absolute;inset:0;background:linear-gradient(45deg, #1e0000, #ff002b, #110000);background-size:400% 400%;animation:gradientBG 15s ease infinite;z-index:0;opacity:0.9;}
  @keyframes gradientBG {0% {background-position: 0% 50%;} 50% {background-position: 100% 50%;} 100% {background-position: 0% 50%;}}
  .glass-effect{background:rgba(255, 255, 255, 0.05);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);border-radius:24px;}
  .glass-card{box-shadow:0 8px 32px 0 rgba(0,0,0,0.37);border:1px solid rgba(255,255,255,0.18);}
  .hero-h1, .hero-p, .hero-trust-item, .hero-stat strong, .hero-stat span {color: white !important;}
  .hero-pill {background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white;}
  .hero-stat-div {background: rgba(255,255,255,0.2);}
  .hero-ribbon {background: #0a0a0a; color: white;}
  .hero-ribbon-item {color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2);}

  /* ── SCARCITY METER ── */
  .scarcity{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:var(--r-lg);padding:14px}
  .scarcity-top{display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:8px}
  .scarcity-top strong{color:var(--red)}
  .scarcity-track{height:8px;background:var(--border);border-radius:4px;overflow:hidden}
  .scarcity-bar{height:100%;border-radius:4px;background:linear-gradient(90deg,#f59e0b,var(--red));transition:width 1s cubic-bezier(0.25,0.46,0.45,0.94);}
  .scarcity-note{font-size:11px;color:var(--red);font-weight:600;margin-top:6px}
  .pdp-proof{display:flex;gap:20px;font-size:13px;color:var(--muted);flex-wrap:wrap}
  .pdp-proof strong{color:var(--dark);font-weight:700}

  /* ── VARIANTS ── */
  .pdp-variants h4{font-size:14px;font-weight:700;color:var(--dark);margin-bottom:10px}
  .var-row{display:flex;gap:8px;flex-wrap:wrap}
  .var-chip{padding:8px 16px;border-radius:var(--r);border:2px solid var(--border);background:white;font-size:13px;font-weight:600;color:var(--text);transition:all .2s;}
  .var-chip.active{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .var-chip:hover{border-color:var(--red);color:var(--red)}

  /* ── BUNDLE SELECTOR ── */
  .bundle-wrap{border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
  .bundle-header{background:linear-gradient(135deg,#fff1f2,#ffe4e6);padding:10px 16px;border-bottom:1px solid var(--red-border);}
  .bundle-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--red)}
  .bundle-options{display:flex;flex-direction:column}
  .bundle-option{width:100%;text-align:left;padding:0;border:none;background:white;border-bottom:1px solid var(--border);transition:background .15s;position:relative;cursor:pointer;}
  .bundle-option:last-child{border-bottom:none}
  .bundle-option:hover{background:var(--bg-soft)}
  .bundle-selected{background:var(--red-soft) !important}
  .bundle-popular{border:2px solid var(--red) !important;background:var(--red-soft) !important}
  .bundle-popular-tag{background:var(--red);color:white;font-size:10px;font-weight:800;text-align:center;padding:3px;letter-spacing:.04em}
  .bundle-option-inner{display:flex;align-items:center;gap:12px;padding:12px 14px;}
  .bundle-radio{flex-shrink:0}
  .bundle-radio-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);display:grid;place-items:center;transition:all .2s;}
  .bundle-radio-dot.active{border-color:var(--red);background:var(--red);}
  .bundle-radio-dot.active::after{content:'';width:7px;height:7px;border-radius:50%;background:white;}
  .bundle-qty-info{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}
  .bundle-qty-label{font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .bundle-sub-label{font-size:11px;color:var(--muted)}
  .bundle-discount-badge{background:var(--red-soft);color:var(--red);border:1.5px solid var(--red-border);padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;}
  .bundle-price-info{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;}
  .bundle-price{font-size:15px;font-weight:800;color:var(--dark);font-family:var(--font-head);}
  .bundle-orig-price{font-size:11px;color:var(--light);text-decoration:line-through}
  .bundle-footer{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-soft);border-top:1px solid var(--border);}
  .bundle-delivery{font-size:12px;color:var(--muted)}
  .bundle-total-label{font-size:14px;font-weight:600;color:var(--text)}
  .bundle-total-label strong{color:var(--red);font-family:var(--font-head);}

  /* ── PDP CTA ── */
  .pdp-cta-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .pdp-add-btn{height:52px;background:var(--dark);color:white;border-radius:var(--r);font-size:15px;font-weight:700;transition:all .25s;}
  .pdp-add-btn:hover{background:#1f2937;transform:translateY(-2px)}
  .pdp-buy-btn{height:52px;background:linear-gradient(135deg,var(--red),#ff1a3e);color:white;border-radius:var(--r);font-size:15px;font-weight:700;width:100%;box-shadow:0 8px 24px rgba(217,4,41,.3);transition:all .25s;}
  .pdp-buy-btn:hover{background:linear-gradient(135deg,var(--red-dark),#d90429);transform:translateY(-2px);}
  .pdp-wa-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;padding:14px;border-radius:var(--r);font-size:14px;font-weight:700;transition:all .2s;}
  .pdp-wa-btn:hover{background:#1ebe5d;transform:translateY(-2px)}
  .pdp-offer{background:linear-gradient(135deg,#fffbf0,#fef3c7);border:1.5px solid #fde68a;border-radius:var(--r);padding:12px 14px;font-size:13px;color:#92400e;}
  .pdp-offer strong{font-weight:700}

  /* ── PDP TIMELINE ── */
  .pdp-timeline{display:flex;align-items:center;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:var(--r-lg);padding:16px 20px;}
  .tl-step{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;text-align:center;}
  .tl-ico{font-size:20px}
  .tl-step strong{font-size:12px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .tl-step span{font-size:11px;color:var(--muted)}
  .tl-line{flex:0 0 32px;height:2px;background:linear-gradient(90deg,var(--red),rgba(217,4,41,.3));}

  /* ── ACCORDION ── */
  .pdp-accs{display:flex;flex-direction:column;gap:0;border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
  .acc{border-bottom:1px solid var(--border)}
  .acc:last-child{border-bottom:none}
  .acc-head{width:100%;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;font-size:14px;font-weight:700;color:var(--dark);transition:background .15s;text-align:left;font-family:var(--font-head);}
  .acc-head:hover{background:var(--bg-soft)}
  .acc-ico{font-size:18px;font-weight:400;color:var(--red);flex-shrink:0}
  .acc-body{padding:14px 16px;border-top:1px solid var(--border);background:var(--bg-soft);}
  .spec-list{display:flex;flex-direction:column;gap:8px;list-style:none}
  .spec-list li{font-size:13px;color:var(--text);padding-left:16px;position:relative;line-height:1.5}
  .spec-list li::before{content:'✓';position:absolute;left:0;color:#16a34a;font-weight:900}
  .acc-p{font-size:13px;color:var(--muted);line-height:1.7}

  /* ── REVIEWS ── */
  .rv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
  .rv-card{background:white;border-radius:var(--r-lg);padding:20px;border:1.5px solid var(--border);transition:all .3s;}
  .rv-card:hover{box-shadow:var(--sh);transform:translateY(-2px)}
  .rv-hdr{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .rv-av{width:36px;height:36px;border-radius:50%;background:var(--red);color:white;display:grid;place-items:center;font-size:15px;font-weight:800;flex-shrink:0;font-family:var(--font-head);}
  .rv-meta strong{display:block;font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .rv-meta span{display:block;font-size:11px;color:var(--muted)}
  .rv-text{font-size:13px;color:var(--text);line-height:1.7;margin-bottom:10px}
  .rv-verified{font-size:11px;font-weight:600;color:#16a34a}

  /* ── SHOP PAGE ── */
  .shop-filters{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;}
  .cat-chips{display:flex;gap:8px;flex-wrap:wrap}
  .cat-chip{padding:8px 16px;border-radius:999px;border:2px solid var(--border);background:white;font-size:13px;font-weight:600;color:var(--muted);transition:all .2s;}
  .cat-chip.active{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .cat-chip:hover{border-color:var(--red);color:var(--red)}
  .sort-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);flex-shrink:0;}
  .sort-sel{border:2px solid var(--border);border-radius:var(--r);padding:8px 12px;font-size:13px;font-weight:600;outline:none;transition:border-color .2s;background:white;font-family:var(--font-body);}
  .sort-sel:focus{border-color:var(--red)}

  /* ── CART ── */
  .cart-layout{display:grid;grid-template-columns:1fr 360px;gap:28px;align-items:start}
  .cart-items{display:flex;flex-direction:column;gap:12px}
  .cart-card{background:white;border:1.5px solid var(--border);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;gap:14px;transition:box-shadow .2s;}
  .cart-card:hover{box-shadow:var(--sh)}
  .cart-img{width:80px;height:80px;border-radius:var(--r);object-fit:cover;border:1px solid var(--border);flex-shrink:0;}
  .cart-info{flex:1;min-width:0;}
  .cart-info h3{font-size:15px;font-weight:700;color:var(--dark);margin-bottom:3px;font-family:var(--font-head);}
  .cart-info p{font-size:12px;color:var(--muted);margin-bottom:4px}
  .cart-info strong{font-size:14px;color:var(--red);font-weight:700;font-family:var(--font-head);}
  .cart-qty{display:flex;align-items:center;border:1.5px solid var(--border);border-radius:var(--r);overflow:hidden;flex-shrink:0;}
  .cart-qty button{width:36px;height:36px;background:var(--bg-soft);color:var(--text);font-size:18px;font-weight:600;display:grid;place-items:center;transition:background .15s;}
  .cart-qty button:hover{background:var(--border)}
  .cart-qty span{width:40px;text-align:center;font-size:14px;font-weight:700}
  .cart-total{font-size:15px;font-weight:800;color:var(--dark);width:90px;text-align:right;font-family:var(--font-head);flex-shrink:0;}
  .cart-rm{width:32px;height:32px;border-radius:8px;background:var(--bg-soft);color:var(--muted);font-size:14px;display:grid;place-items:center;transition:all .2s;flex-shrink:0;}
  .cart-rm:hover{background:#fee2e2;color:var(--red)}

  /* ── ORDER CARD ── */
  .order-card{background:white;border-radius:var(--r-xl);padding:24px;border:1.5px solid var(--border);box-shadow:var(--sh);position:sticky;top:90px;}
  .order-card h3{font-size:18px;font-weight:800;color:var(--dark);margin-bottom:18px;font-family:var(--font-head);}
  .sum-row{display:flex;justify-content:space-between;font-size:14px;color:var(--muted);margin-bottom:10px;}
  .sum-row strong{color:var(--dark);font-weight:700}
  .sum-row.total{font-size:17px;color:var(--dark);font-weight:700}
  .sum-row.total strong{font-size:20px;color:var(--red);font-family:var(--font-head);}
  .sum-divider{height:1px;background:var(--border);margin:12px 0}
  .free-hint{font-size:12px;color:var(--red);margin-bottom:10px}
  .btn-checkout{width:100%;height:52px;background:var(--red);color:white;border-radius:var(--r-lg);font-size:16px;font-weight:700;margin-top:14px;transition:all .25s;box-shadow:0 8px 24px rgba(217,4,41,.25);font-family:var(--font-body);}
  .btn-checkout:hover{background:var(--red-dark);transform:translateY(-2px)}
  .btn-continue{width:100%;height:46px;background:var(--bg-soft);color:var(--text);border-radius:var(--r-lg);font-size:14px;font-weight:600;margin-top:10px;border:1.5px solid var(--border);transition:all .2s;font-family:var(--font-body);}
  .btn-continue:hover{border-color:var(--red);color:var(--red)}
  .secure-row{display:flex;justify-content:center;gap:20px;font-size:12px;color:var(--muted);margin-top:12px}

  /* ── CHECKOUT ── */
  .checkout-layout{display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:start}
  .checkout-form-card{background:white;border-radius:var(--r-xl);padding:28px;border:1.5px solid var(--border);box-shadow:var(--sh);}
  .checkout-form-card h3{font-size:20px;font-weight:800;color:var(--dark);margin-bottom:20px;font-family:var(--font-head);}
  .checkout-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .field{width:100%;height:48px;border:2px solid var(--border);border-radius:var(--r);padding:0 14px;font-size:14px;color:var(--text);outline:none;transition:border-color .2s;background:var(--bg-soft);font-family:var(--font-body);}
  .field:focus{border-color:var(--red);background:white}
  .field-area{height:100px;padding:12px 14px;resize:vertical}
  .span2{grid-column:1/-1}
  .cod-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #bbf7d0;border-radius:var(--r-lg);padding:16px;margin-top:16px;}
  .cod-box strong{display:block;font-size:14px;font-weight:700;color:#15803d;margin-bottom:4px;font-family:var(--font-head);}
  .cod-box p{font-size:13px;color:#16a34a}
  .co-items{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
  .co-row{display:flex;align-items:center;gap:10px}
  .co-img{width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid var(--border);flex-shrink:0;}
  .co-info{flex:1;min-width:0;}
  .co-info span{display:block;font-size:13px;font-weight:600;color:var(--dark);font-family:var(--font-head);}
  .co-var{font-size:11px !important;color:var(--muted) !important;font-weight:400 !important}
  .btn-place{width:100%;height:54px;background:linear-gradient(135deg,var(--red),#ff1a3e);color:white;border-radius:var(--r-lg);font-size:16px;font-weight:700;margin-top:14px;box-shadow:0 8px 24px rgba(217,4,41,.25);transition:all .25s;font-family:var(--font-body);}
  .btn-place:hover{background:linear-gradient(135deg,var(--red-dark),var(--red));transform:translateY(-2px)}

  /* ── CONFIRMATION ── */
  .confirm-wrap{text-align:center;padding:60px 20px;max-width:520px;margin:0 auto;}
  .confirm-ico{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#15803d);color:white;font-size:36px;display:grid;place-items:center;margin:0 auto 20px;box-shadow:0 16px 40px rgba(22,163,74,.3);}
  .confirm-wrap h1{font-size:32px;font-weight:800;color:var(--dark);margin-bottom:10px;font-family:var(--font-head);}
  .confirm-wrap p{font-size:15px;color:var(--muted);line-height:1.7;margin-bottom:28px}
  .confirm-details{background:var(--bg-soft);border:1.5px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:28px;text-align:left;}
  .cd-row-info{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;}
  .cd-row-info:last-child{border-bottom:none}
  .cd-row-info span{color:var(--muted)}
  .cd-row-info strong{font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .status-badge{background:var(--red-soft);color:var(--red);padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1.5px solid var(--red-border);}
  .confirm-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

  /* ── ABOUT ── */
  .about-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
  .about-card{background:white;border-radius:var(--r-xl);padding:32px;border:1.5px solid var(--border);transition:all .3s;}
  .about-card:hover{transform:translateY(-4px);box-shadow:var(--sh-lg);border-color:rgba(217,4,41,.2);}
  .about-ico{font-size:36px;display:block;margin-bottom:16px}
  .about-card h3{font-size:20px;font-weight:800;color:var(--dark);margin-bottom:10px;font-family:var(--font-head);}
  .about-card p{font-size:14px;color:var(--muted);line-height:1.7}

  /* ── CONTACT ── */
  .contact-layout{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
  .contact-info h3,.contact-form h3{font-size:22px;font-weight:800;color:var(--dark);margin-bottom:20px;font-family:var(--font-head);}
  .contact-item{display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;padding:14px;background:var(--bg-soft);border-radius:var(--r-lg);border:1.5px solid var(--border);}
  .ci-ico{font-size:22px;flex-shrink:0}
  .contact-item strong{display:block;font-size:14px;font-weight:700;color:var(--dark);margin-bottom:3px;font-family:var(--font-head);}
  .contact-item p{font-size:13px;color:var(--muted);margin:0}
  .contact-form{display:flex;flex-direction:column;gap:12px;padding:28px;background:white;border-radius:var(--r-xl);border:1.5px solid var(--border);box-shadow:var(--sh);}

  /* ── POLICY PAGE ── */
  .policy-hero{text-align:center;margin-bottom:40px}
  .policy-icon{font-size:56px;display:block;margin-bottom:16px}
  .policy-updated{font-size:13px;color:var(--muted);margin-top:8px}
  .policy-body{max-width:760px;margin:0 auto}
  .policy-section{margin-bottom:28px}
  .policy-h3{font-size:18px;font-weight:800;color:var(--dark);margin-bottom:10px;font-family:var(--font-head);}
  .policy-text{font-size:14px;color:var(--muted);line-height:1.8}
  .policy-list{list-style:none;display:flex;flex-direction:column;gap:8px}
  .policy-list li{font-size:14px;color:var(--muted);padding-left:20px;position:relative;line-height:1.6}
  .policy-list li::before{content:'→';position:absolute;left:0;color:var(--red);font-weight:700}

  /* ── FAQ ── */
  .faq-wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:0;border:1.5px solid var(--border);border-radius:var(--r-xl);overflow:hidden}
  .faq-item{border-bottom:1px solid var(--border);background:white;transition:background .15s;}
  .faq-item:last-child{border-bottom:none}
  .faq-item.faq-open{background:var(--bg-soft)}
  .faq-q{width:100%;display:flex;justify-content:space-between;align-items:center;padding:18px 22px;font-size:15px;font-weight:700;color:var(--dark);text-align:left;gap:12px;font-family:var(--font-head);}
  .faq-ico{font-size:20px;color:var(--red);font-weight:400;flex-shrink:0}
  .faq-a{padding:0 22px 18px;font-size:14px;color:var(--muted);line-height:1.7}

  /* ── TRACK ORDER ── */
  .track-wrap{display:flex;justify-content:center;padding:20px 0}
  .track-card{background:white;border-radius:var(--r-xl);padding:36px;border:1.5px solid var(--border);box-shadow:var(--sh);width:100%;max-width:480px;text-align:center}
  .track-icon{font-size:48px;margin-bottom:16px}
  .track-card h3{font-size:22px;font-weight:800;color:var(--dark);margin-bottom:20px;font-family:var(--font-head);}
  .track-result{margin-top:24px;text-align:left}
  .track-timeline{display:flex;flex-direction:column;gap:0;margin-bottom:20px}
  .track-step{display:flex;align-items:flex-start;gap:14px;padding:14px 0;position:relative;}
  .track-step:not(:last-child)::after{content:'';position:absolute;left:9px;top:32px;bottom:0;width:2px;background:var(--border);}
  .track-step.done::after{background:var(--red)}
  .track-step-dot{width:20px;height:20px;border-radius:50%;border:2.5px solid var(--border);background:white;flex-shrink:0;margin-top:2px;position:relative;z-index:1;transition:all .3s;}
  .track-step.done .track-step-dot{border-color:var(--red);background:var(--red)}
  .track-step.active .track-step-dot{border-color:var(--red);background:white;box-shadow:0 0 0 4px rgba(217,4,41,.15);}
  .track-step-info strong{display:block;font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .track-step-info span{font-size:12px;color:var(--muted)}
  .track-wa{text-align:center}
  .track-wa p{font-size:13px;color:var(--muted);margin-bottom:8px}

  /* ── ADMIN ── */
  .admin-locked{text-align:center;padding:80px 40px}
  .admin-lock-ico{font-size:64px;margin-bottom:16px}
  .admin-locked h2{font-size:28px;font-weight:800;color:var(--dark);margin-bottom:10px;font-family:var(--font-head);}
  .admin-locked p{font-size:15px;color:var(--muted)}
  .admin-welcome{font-size:15px;color:var(--muted);margin-top:4px}
  .pending-badge{display:inline-block;background:var(--red);color:white;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-left:8px}
  .admin-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;border-bottom:1.5px solid var(--border);padding-bottom:16px;}
  .admin-tab{padding:9px 18px;border-radius:var(--r);font-size:13px;font-weight:600;color:var(--muted);border:1.5px solid var(--border);background:white;transition:all .2s;font-family:var(--font-body);}
  .admin-tab.active{background:var(--dark);color:white;border-color:var(--dark)}
  .admin-tab:hover:not(.active){border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .admin-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}
  .admin-stat{background:white;border-radius:var(--r-lg);padding:20px;text-align:center;border:1.5px solid var(--border);box-shadow:var(--sh);}
  .admin-stat strong{display:block;font-size:22px;font-weight:800;color:var(--dark);margin-bottom:4px;font-family:var(--font-head);}
  .admin-stat span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  .admin-stat.red strong{color:var(--red)}
  .admin-quick-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
  .qs-card{background:white;border-radius:var(--r-lg);padding:18px 20px;border:1.5px solid var(--border);}
  .qs-card span{display:block;font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
  .qs-card strong{display:block;font-size:15px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .admin-card{background:white;border-radius:var(--r-xl);padding:24px;border:1.5px solid var(--border);box-shadow:var(--sh);}
  .admin-card h3{font-size:18px;font-weight:800;color:var(--dark);margin-bottom:20px;font-family:var(--font-head);}
  .admin-layout{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
  .orders-list{display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto;}
  .order-row{background:var(--bg-soft);border-radius:var(--r-lg);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border:1.5px solid var(--border);}
  .order-row>div:first-child{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .order-row strong{font-size:14px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .order-row span{font-size:12px;color:var(--muted)}
  .order-address{color:var(--dark) !important;line-height:1.45;white-space:normal;overflow-wrap:anywhere;}
  .order-phone{color:var(--forest) !important;font-weight:700;}
  .order-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .o-status{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg-gray);color:var(--muted);}
  .o-pending{background:#fff7ed;color:#ea580c}
  .o-confirmed{background:#f0fdf4;color:#16a34a}
  .o-shipped{background:#eff6ff;color:#2563eb}
  .o-delivered{background:#f0fdf4;color:#15803d}
  .o-btn{background:var(--dark);color:white;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;transition:background .2s;}
  .o-btn:hover{background:var(--red)}
  .admin-pgrid{display:flex;flex-direction:column;gap:10px}
  .admin-pcard{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-soft);border-radius:var(--r-lg);border:1.5px solid var(--border);}
  .admin-pcard-editing{border-color:var(--color-primary);background:#eef5ef;}
  .admin-pimg{width:54px;height:54px;border-radius:var(--r);object-fit:cover;border:1px solid var(--border);flex-shrink:0}
  .admin-pinfo{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
  .admin-pinfo strong{font-size:13px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .admin-pinfo span{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .admin-pprice{color:var(--red) !important;font-weight:700 !important}
  .admin-products-card{max-height:720px;overflow-y:auto;}
  .admin-pactions{display:flex;gap:8px;align-items:center;flex-shrink:0;}
  .admin-edit{background:#eef5ef;color:var(--color-primary);border:1px solid #c8d8ce;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;transition:all .2s;}
  .admin-edit:hover{background:var(--color-primary);border-color:var(--color-primary);color:white;}
  .admin-del{background:#fee2e2;color:var(--red);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;flex-shrink:0;transition:all .2s;}
  .admin-del:hover{background:var(--red);color:white}
  .users-table{display:flex;flex-direction:column;gap:0;border:1.5px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
  .users-thead{display:grid;grid-template-columns:1fr 1.5fr 1fr 1fr;background:var(--bg-gray);padding:10px 14px;gap:10px;}
  .users-thead span{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  .users-row{display:grid;grid-template-columns:1fr 1.5fr 1fr 1fr;padding:12px 14px;gap:10px;border-top:1px solid var(--border);background:white;transition:background .15s;}
  .users-row:hover{background:var(--bg-soft)}
  .users-row span{font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* ── RESPONSIVE ── */
  @media(max-width:1200px){
    .cert-grid{grid-template-columns:repeat(3,1fr)}
    .stats-grid{grid-template-columns:repeat(3,1fr)}
    .admin-stats{grid-template-columns:repeat(3,1fr)}
    .cat-grid{grid-template-columns:repeat(3,1fr)}
  }
  @media(max-width:1024px){
    .hero-inner{grid-template-columns:1fr;padding:40px 24px;gap:32px}
    .hero-visual{display:block}
    .brand-inner{grid-template-columns:1fr;gap:32px}
    .pdp{grid-template-columns:1fr}
    .pdp-gallery{position:static}
    .cart-layout,.checkout-layout{grid-template-columns:1fr}
    .order-card{position:static}
    .testi-grid{grid-template-columns:repeat(2,1fr)}
    .flash-grid{grid-template-columns:repeat(2,1fr)}
    .promo-strip{grid-template-columns:1fr;padding:0 24px 48px}
    .footer-top{grid-template-columns:1fr 1fr;gap:24px}
    .contact-layout{grid-template-columns:1fr}
    .admin-layout{grid-template-columns:1fr}
    .admin-stats{grid-template-columns:repeat(3,1fr)}
    .admin-quick-stats{grid-template-columns:repeat(2,1fr)}
  }
  @media(max-width:768px){
    .desktop-only{display:none !important}
    .mobile-only{display:flex !important}
    .hdr-hamburger{display:flex}
    .hdr-logo-text{font-size:16px}
    .hdr-body{padding:0 12px;gap:6px}
    .hdr-cart-btn{padding:9px 12px}
    .hdr-cart-label{display:none}
    .hdr-login-btn span:not(.hdr-login-ico){display:none}
    .hero-inner{padding:24px 16px;grid-template-columns:1fr;gap:20px}
    .hero-visual{display:block;width:100%;max-width:360px;margin:0 auto}
    .hero-img-card{aspect-ratio:3/4;max-height:380px}
    .hero-float-card{display:none}
    .hero-h1{font-size:26px;letter-spacing:-0.5px}
    .hero-btns{flex-direction:column}
    .btn-red-lg,.btn-outline-lg{width:100%;justify-content:center}
    .sec{padding:36px 16px}
    .brand-sec{padding:36px 16px}
    .flash-sec{padding:36px 16px}
    .cat-grid{grid-template-columns:repeat(2,1fr)}
    .cert-grid{grid-template-columns:repeat(2,1fr)}
    .testi-grid{grid-template-columns:1fr}
    .stats-grid{grid-template-columns:repeat(2,1fr)}
    .flash-grid{grid-template-columns:repeat(2,1fr)}
    .flash-hdr{flex-direction:column;align-items:flex-start}
    .flash-cd{align-items:flex-start}
    .pgrid{grid-template-columns:repeat(2,1fr);gap:10px}
    .cart-layout{gap:16px}
    .checkout-layout{gap:16px}
    .checkout-grid{grid-template-columns:1fr}
    .span2{grid-column:1}
    .about-grid{grid-template-columns:1fr}
    .footer-top{grid-template-columns:1fr;gap:20px;padding:32px 16px}
    .footer-bottom{padding:16px;flex-direction:column;text-align:center}
    .admin-stats{grid-template-columns:repeat(2,1fr)}
    .admin-quick-stats{grid-template-columns:1fr}
    .nl-form{flex-direction:column}
    .trust-bar{flex-direction:column;align-items:stretch}
    .trust-item{border-right:none;border-bottom:1px solid var(--border)}
    .pdp-cta-row{grid-template-columns:1fr}
    .bundle-option-inner{flex-wrap:wrap;gap:8px}
    .rv-grid{grid-template-columns:1fr}
    .users-thead,.users-row{grid-template-columns:1fr 1fr}
    .users-thead span:nth-child(3),.users-thead span:nth-child(4),
    .users-row span:nth-child(3),.users-row span:nth-child(4){display:none}
    .hscroll-item{flex:0 0 180px}
    .promo-strip{padding:0 16px 36px}
    .promo-card{padding:24px 20px}
    .promo-emoji{font-size:44px}
  }
  @media(max-width:480px){
    .cat-grid{grid-template-columns:repeat(2,1fr)}
    .cert-grid{grid-template-columns:repeat(2,1fr)}
    .flash-grid{grid-template-columns:1fr}
    .pgrid{grid-template-columns:1fr}
    .stats-grid{grid-template-columns:repeat(2,1fr)}
    .admin-stats{grid-template-columns:repeat(2,1fr)}
    .sec-h2{font-size:22px}
    .auth-modal{grid-template-columns:1fr}
    .auth-left{display:none}
    .auth-right{padding:28px 20px}
    .auth-2col{grid-template-columns:1fr}
    .cd-num{font-size:20px}
    .hero-stats{display:flex;gap:10px;flex-wrap:wrap}
    .hero-stat strong{font-size:15px}
    .hero-stat span{font-size:10px}
    .hero-stat-div{display:none}
    .pdp-price{font-size:28px}
    .hscroll-item{flex:0 0 160px}
    .cart-total{width:70px;font-size:13px}
  }

  /* ── ADMIN PRODUCT FORM ── */
  .apf-wrap{display:flex;flex-direction:column;gap:16px}
  .apf-field{display:flex;flex-direction:column;gap:5px}
  .apf-field label{font-size:13px;font-weight:700;color:var(--text)}
  .apf-hint{font-weight:400;color:var(--muted);font-size:12px}
  .apf-err{font-size:12px;color:var(--red);font-weight:600}
  .apf-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .apf-checks{display:flex;gap:12px;flex-wrap:wrap;}
  .apf-checks label{display:flex;align-items:center;gap:8px;background:var(--bg-soft);border:1.5px solid var(--border);border-radius:var(--r);padding:10px 12px;font-size:13px;font-weight:700;color:var(--text);}
  .apf-checks input{width:16px;height:16px;accent-color:var(--color-primary);-webkit-appearance:auto;}
  .apf-actions{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin-top:8px;}
  .apf-cancel{height:50px;padding:0 18px;}
  .field-err{border-color:var(--red) !important}
  .apf-submit{margin-top:0}

  /* ── UPLOAD ZONE ── */
  .upload-zone{border:2px dashed var(--border);border-radius:var(--r-lg);padding:20px;cursor:pointer;transition:all .2s;background:var(--bg-soft);min-height:120px;display:flex;align-items:center;justify-content:center;width:100%;}
  .upload-zone:hover{border-color:var(--red);background:var(--red-soft)}
  .upload-zone-err{border-color:var(--red) !important}
  .upload-zone-video{min-height:160px}
  .upload-zone-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;pointer-events:none;width:100%}
  .upload-zone-ico{font-size:36px}
  .upload-zone-empty strong{font-size:14px;font-weight:700;color:var(--dark)}
  .upload-zone-empty span{font-size:12px;color:var(--muted)}
  .upload-zone-mobile{color:var(--red) !important;font-weight:600 !important}
  .upload-preview-grid{display:flex;flex-wrap:wrap;gap:10px;width:100%;padding:4px;}
  .upload-thumb{width:80px;height:80px;border-radius:var(--r);overflow:hidden;position:relative;border:2px solid var(--border);flex-shrink:0;background:var(--bg-gray);}
  .upload-thumb img{width:100%;height:100%;object-fit:cover}
  .upload-thumb-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);opacity:0;transition:opacity .2s;display:flex;align-items:flex-start;justify-content:flex-end;padding:4px;}
  .upload-thumb:hover .upload-thumb-overlay{opacity:1}
  .upload-thumb-del{width:22px;height:22px;border-radius:50%;background:var(--red);color:white;font-size:10px;display:grid;place-items:center;border:2px solid white;cursor:pointer;font-weight:900;line-height:1;}
  .upload-thumb-order{position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,.6);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
  .upload-thumb-done{position:absolute;bottom:4px;right:4px;background:#16a34a;color:white;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;}
  .upload-thumb-loading{display:flex;align-items:center;justify-content:center;background:var(--bg-gray);}
  .upload-progress-circle{position:relative;width:50px;height:50px;display:flex;align-items:center;justify-content:center;}
  .upload-progress-circle svg{position:absolute;inset:0;width:100%;height:100%}
  .upload-progress-circle span{font-size:11px;font-weight:700;color:var(--dark);position:relative;z-index:1;}
  .upload-add-more{width:80px;height:80px;border:2px dashed var(--border);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;transition:all .2s;color:var(--muted);background:white;flex-shrink:0;}
  .upload-add-more:hover{border-color:var(--red);color:var(--red);background:var(--red-soft)}
  .upload-add-more span{font-size:24px;font-weight:300;line-height:1}
  .upload-add-more small{font-size:10px;font-weight:600}
  .upload-video-progress{width:100%;display:flex;flex-direction:column;gap:10px;padding:8px;}
  .uvp-bar-wrap{height:10px;background:var(--border);border-radius:999px;overflow:hidden}
  .uvp-bar{height:100%;background:linear-gradient(90deg,var(--red),#ff6b6b);border-radius:999px;transition:width .3s ease;}
  .uvp-info{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:var(--text)}
  .uvp-info strong{color:var(--red);font-size:16px;font-family:var(--font-head);}
  .uvp-note{font-size:11px;color:var(--muted);text-align:center}
  .upload-video-preview{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
  .uvp-video{width:100%;max-height:200px;border-radius:var(--r-lg);background:#000;object-fit:contain;}
  .uvp-remove{background:#fee2e2;color:var(--red);padding:8px 18px;border-radius:var(--r);font-size:13px;font-weight:700;border:1.5px solid var(--red-border);transition:all .2s;}
  .uvp-remove:hover{background:var(--red);color:white}
  .uvp-done{font-size:12px;font-weight:600;color:#16a34a;background:#f0fdf4;padding:4px 12px;border-radius:999px;border:1px solid #bbf7d0;}
  .pdp-video{width:100%;height:100%;object-fit:contain;border-radius:var(--r-xl);background:var(--color-bg);}
  .pdp-media-tabs{display:flex;gap:8px;margin-bottom:10px;}
  .pdp-media-tabs button{padding:8px 18px;border-radius:var(--r);border:2px solid var(--border);font-size:13px;font-weight:600;color:var(--muted);background:white;transition:all .2s;cursor:pointer;}
  .pdp-media-tabs button.active{border-color:var(--red);color:var(--red);background:var(--red-soft)}

  @media(max-width:768px){
    .apf-2col{grid-template-columns:1fr}
    .upload-thumb{width:70px;height:70px}
    .upload-add-more{width:70px;height:70px}
  }

  /* --- Premium cream / forest-green Shopify theme audit fixes --- */
  :root{
    --color-bg:${DESIGN_TOKENS.colors.bg};--color-primary:${DESIGN_TOKENS.colors.primary};--color-primary-hover:${DESIGN_TOKENS.colors.primaryHover};--color-accent:${DESIGN_TOKENS.colors.accent};
    --color-text:${DESIGN_TOKENS.colors.text};--color-text-muted:${DESIGN_TOKENS.colors.muted};--color-card-bg:${DESIGN_TOKENS.colors.cardBg};--color-card-border:${DESIGN_TOKENS.colors.cardBorder};--color-urgency:${DESIGN_TOKENS.colors.urgency};
    --shadow-rest:${DESIGN_TOKENS.shadow.rest};--shadow-elevated:${DESIGN_TOKENS.shadow.elevated};
    --red:var(--color-primary);--red-dark:var(--color-primary-hover);--red-soft:#eef5ef;--red-border:#c8d8ce;
    --forest:var(--color-primary);--forest-2:var(--color-primary-hover);--cream:var(--color-bg);--cream-2:var(--color-card-bg);--gold:var(--color-accent);
    --dark:var(--color-text);--text:var(--color-text);--muted:var(--color-text-muted);--bg:var(--color-bg);--bg-soft:var(--color-card-bg);--bg-gray:#eeeeea;--border:var(--color-card-border);
    --sh:var(--shadow-rest);--sh-lg:var(--shadow-elevated);--sh-xl:var(--shadow-elevated);
    --r:${DESIGN_TOKENS.radius.button};--r-lg:${DESIGN_TOKENS.radius.card};--r-xl:18px;
  }
  body{background:var(--cream);color:var(--text);font-family:var(--font-body);font-weight:400;}
  h1,h2,h3,h4{font-family:var(--font-head);letter-spacing:-.02em;}
  .pt-backdrop,.splash-overlay{background:linear-gradient(135deg,var(--cream),#fff);}

  /* FIXED: forest announcement/nav, sticky at top with slide-down animation. */
  .hdr{position:sticky;top:0;z-index:100;background:var(--forest);border-bottom:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(27,67,50,.16);animation:navDrop .42s ease both;overflow:visible;}
  @keyframes navDrop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
  .hdr-announce{height:36px;background:var(--forest);border-bottom:1px solid rgba(255,255,255,.16);justify-content:center;}
  .hdr-announce-inner{animation:marquee 32s linear infinite;color:#fff;font-size:11px;letter-spacing:.12em;text-align:center;}
  .hdr-body{height:70px;background:var(--forest);}
  .hdr-logo-text,.hdr-nav-btn,.hdr-wish-btn,.hdr-user-name,.hdr-user-caret{color:#fff;}
  .hdr-logo-mark{background:transparent;border:1.5px solid var(--gold);color:#fff;border-radius:6px;}
  .hdr-nav-btn{opacity:.82;border-radius:6px;}
  .hdr-nav-btn:hover,.hdr-nav-btn.active{background:rgba(255,255,255,.1);color:#fff;opacity:1;}
  .hdr-search-inp{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.24);color:#fff;}
  .hdr-search-inp::placeholder{color:rgba(255,255,255,.68);}
  .hdr-search-ico{color:rgba(255,255,255,.78);}
  .hdr-cart-btn{background:#fff;color:var(--forest);border-radius:6px;box-shadow:none;}
  .hdr-cart-count,.hdr-badge{background:var(--gold);color:#1a1a1a;}
  .hdr-login-btn,.hdr-user-btn{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff;}
  .hdr-hamburger:hover,.hdr-icon-btn:hover,.hdr-wish-btn:hover{background:rgba(255,255,255,.1);}
  .ham-line{background:#fff;}
  .hdr-cats{background:var(--forest);padding:0 32px 12px;}
  .hdr-cat{background:transparent;border:1px solid rgba(255,255,255,.22);color:#fff;border-radius:999px;}
  .hdr-cat:hover,.hdr-cat-deal{background:var(--gold);border-color:var(--gold);color:#1a1a1a;}

  .storefront-light{background:linear-gradient(180deg,#fff 0%,var(--cream) 42%,#fff 100%);min-height:100vh;padding-bottom:40px;}
  .sf-btn{height:48px;border-radius:6px;padding:0 20px;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.02em;display:inline-flex;align-items:center;justify-content:center;transition:all .2s;}
  .sf-btn-primary{background:var(--forest);color:#fff;box-shadow:0 12px 24px rgba(27,67,50,.2);}
  .sf-btn-primary:hover{background:var(--forest-2);box-shadow:0 16px 30px rgba(27,67,50,.28);}
  .sf-btn-secondary{background:transparent;color:var(--forest);border:1.5px solid var(--forest);}
  .sf-btn-secondary:hover{background:var(--forest);color:#fff;}
  .eyebrow,.sf-kicker{color:var(--gold);}

  .sf-hero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(360px,.98fr);gap:52px;background:linear-gradient(135deg,#fff 0%,#f7f6f2 58%,#eeeeea 100%);padding:64px 52px 58px;border-bottom:1px solid var(--border);min-height:78vh;align-items:center;position:relative;overflow:hidden;}
  .sf-hero::before{content:"";position:absolute;inset:auto 0 0 0;height:9px;background:linear-gradient(90deg,var(--forest),var(--gold),var(--forest));opacity:.95;}
  .sf-hero-copy{position:relative;z-index:2;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;}
  .sf-kicker{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;margin-bottom:16px;color:var(--forest);}
  .sf-hero h1{font-size:clamp(2.45rem,5vw,5.6rem);line-height:.98;text-transform:none;letter-spacing:-.055em;max-width:780px;word-break:normal;overflow-wrap:normal;hyphens:none;color:var(--dark);margin-bottom:18px;}
  .sf-hero-deal{display:inline-flex;border:1px solid rgba(201,168,76,.65);color:var(--forest);background:#fff;border-radius:999px;padding:11px 16px;font-weight:800;font-size:12px;letter-spacing:.01em;margin-bottom:20px;box-shadow:0 12px 28px rgba(27,67,50,.08);}
  .sf-hero p{font-size:17px;color:var(--muted);max-width:620px;margin-bottom:24px;line-height:1.75;}
  .sf-hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;}
  .sf-hero-trust{display:flex;flex-wrap:wrap;gap:10px;}
  .sf-hero-trust span{background:#fff;border:1px solid var(--border);color:var(--forest);border-radius:999px;padding:10px 13px;font-size:12px;font-weight:750;box-shadow:0 10px 22px rgba(27,67,50,.06);}
  .sf-hero-showcase{position:relative;min-height:560px;border-radius:28px;background:linear-gradient(155deg,#ffffff 0%,#f7f6f2 56%,#e9ece5 100%);border:1px solid var(--border);box-shadow:0 30px 80px rgba(27,67,50,.16);overflow:hidden;display:flex;flex-direction:column;padding:82px 28px 22px;}
  .sf-hero-showcase::before{content:"";position:absolute;left:28px;right:28px;top:30px;height:76px;border-top:1px solid rgba(27,67,50,.14);border-bottom:1px solid rgba(27,67,50,.08);}
  .sf-hero-label{position:absolute;top:26px;left:26px;z-index:3;background:var(--forest);color:#fff;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;letter-spacing:.02em;box-shadow:0 12px 22px rgba(27,67,50,.18);}
  .sf-hero-product{position:relative;inset:auto;display:flex;flex:1;min-height:0;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;z-index:2;width:100%;padding:0 12px;margin:0 0 18px;}
  .sf-hero-product-img{width:100%;height:auto;max-height:300px;object-fit:contain;filter:drop-shadow(0 28px 38px rgba(27,67,50,.2));transition:transform .45s ease;}
  .sf-hero-product:hover .sf-hero-product-img{transform:translateY(-5px) scale(1.02);}
  .sf-hero-product span{font-size:15px;font-weight:750;color:var(--dark);max-width:380px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .sf-hero-product strong{color:var(--forest);font-size:20px;font-weight:850;}
  .sf-mini-stack{position:relative;left:auto;right:auto;bottom:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;z-index:3;width:100%;margin-top:auto;}
  .sf-mini-product{height:92px;border-radius:18px;background:rgba(255,255,255,.88);border:1px solid var(--border);padding:10px;box-shadow:0 12px 24px rgba(27,67,50,.1);backdrop-filter:blur(10px);transition:transform .25s ease,border-color .25s ease;}
  .sf-mini-product:hover{transform:translateY(-4px);border-color:rgba(27,67,50,.35);}
  .sf-mini-img{width:100%;height:100%;object-fit:contain;}
  .sf-hero-note{position:absolute;right:26px;top:26px;z-index:3;background:#fff;color:var(--forest);border:1px solid var(--border);border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;}
  .sf-product-placeholder.sf-product-skeleton{position:relative;overflow:hidden;background:linear-gradient(110deg,#efe4d5 8%,#fffaf1 18%,#efe4d5 33%);background-size:200% 100%;border:0;color:transparent;animation:skeletonPulse 1.25s ease-in-out infinite;}
  .sf-product-placeholder.sf-product-skeleton span{font-size:0;}
  .sf-product-placeholder.sf-product-fallback{display:grid;place-items:center;background:linear-gradient(135deg,#fff,#eef5ef);color:var(--forest);font-size:44px;}
  @keyframes skeletonPulse{to{background-position:-200% 0;}}

  .sec{background:var(--cream);}
  .sec-centered{text-align:center;justify-content:center;}
  .sec-h2{color:var(--forest);text-transform:none;letter-spacing:-.035em;}
  .sf-cats-section .sec-head{text-align:center;justify-content:center;}
  .sf-cat-marquee{overflow:hidden;max-width:1440px;margin:0 auto;padding:8px 0 14px;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);}
  .sf-cat-grid{display:flex;gap:26px;width:max-content;padding:4px 0 12px;scrollbar-width:none;}
  .sf-cat-track{animation:catDriftRight 42s linear infinite;will-change:transform;}
  .sf-cat-track-live{animation:catDriftRight 42s linear infinite;will-change:transform;}
  .sf-cat-marquee:hover .sf-cat-track{animation-play-state:paused;}
  .sf-cat-marquee:hover .sf-cat-track-live{animation-play-state:paused;}
  .sf-cat-grid::-webkit-scrollbar{display:none;}
  @keyframes catDriftRight{from{transform:translateX(-50%)}to{transform:translateX(0)}}
  .sf-cat-card{min-width:190px;background:transparent;border:0;box-shadow:none;padding:0;gap:12px;}
  .sf-cat-card:hover{transform:translateY(0);box-shadow:none;border-color:transparent;}
  .sf-cat-icon{width:184px;height:118px;border-radius:999px;background:#fff;border:1px solid var(--border);box-shadow:0 14px 28px rgba(27,67,50,.12);transition:transform .25s ease,border-color .25s ease;overflow:hidden;}
  .sf-cat-card:hover .sf-cat-icon{transform:scale(1.05);}
  .sf-cat-img{width:100%;height:100%;object-fit:contain;border-radius:999px;padding:10px;}
  .sf-cat-card .cat-nm{font-size:13px;color:var(--forest);text-transform:none;letter-spacing:-.01em;font-weight:800;}
  .sf-pill-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
  .sf-filter-pill{height:40px;border-radius:999px;border:1px solid var(--border);background:#fff;color:var(--forest);padding:0 18px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;transition:all .2s;}
  .sf-filter-pill:hover,.sf-filter-pill.active{background:var(--forest);border-color:var(--forest);color:#fff;}

  .storefront-light .pgrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;}
  .pcard{background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 18px rgba(27,67,50,.06);}
  .pcard:hover{transform:translateY(-4px);box-shadow:0 18px 36px rgba(27,67,50,.13);border-color:#d8c9b8;}
  .pcard-img-wrap{background:#fff;aspect-ratio:1;}
  .pcard-img{object-fit:contain;}
  .pcard-sale-badge{background:var(--forest);border-radius:6px;}
  .pcard-hot-badge{display:none;}
  .pcard-wish.wished,.pcard-wish:hover{color:var(--forest);border-color:var(--forest);}
  .pcard-cat{color:var(--gold);}
  .pcard-price{color:var(--forest);}
  .pcard-stock{color:var(--forest);}
  .pcard-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
  .pcard-add{background:var(--forest);border-radius:6px;color:#fff;}
  .pcard-add:hover{background:var(--forest-2);}
  .pcard-buy{background:#fff;color:var(--forest);border:1px solid var(--forest);border-radius:6px;font-size:12px;font-weight:700;transition:all .2s;}
  .pcard-buy:hover{background:var(--forest);color:#fff;}
  .sf-selling-section .row-hdr{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;}
  .sf-selling-section .row-hdr>div:first-child{grid-column:2;text-align:center;}
  .sf-selling-section .row-controls{grid-column:3;justify-content:flex-end;}

  .stats-sec{background:var(--cream);padding:0 40px 42px;}
  .stats-inner{max-width:1440px;margin:0 auto;}
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);background:var(--cream);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
  .stat-card{background:transparent;border:0;border-radius:0;box-shadow:none;padding:34px 20px;border-right:1px solid var(--border);}
  .stat-card:last-child{border-right:0;}
  .stat-card:hover{transform:none;box-shadow:none;}
  .stat-ico{display:none;}
  .stat-num{display:block;color:var(--forest);font-size:40px;font-family:var(--font-head);}
  .stat-label{display:block;color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;}
  .stat-sub{display:block;margin-top:7px;color:#81776b;font-size:12px;font-weight:700;letter-spacing:0;text-transform:none;}

  .sf-review-section{background:var(--forest);max-width:none;}
  .sf-review-section .sec-h2,.sf-review-section .eyebrow{color:#fff;}
  .sf-review-section .sec-h2::after{content:'';display:block;width:58px;height:2px;background:var(--gold);margin:12px auto 0;}
  .sf-review-section .testi-grid{max-width:1440px;margin:18px auto 0;grid-template-columns:repeat(3,1fr);gap:18px;}
  .sf-review-section .testi-card{background:#fff;border:0;border-radius:10px;box-shadow:0 16px 34px rgba(0,0,0,.16);}
  .sf-review-section .testi-quote{display:none;}
  .sf-review-section .star-on{color:var(--gold);}

  .sf-faq-section{background:var(--cream);}
  .sf-faq-list{max-width:840px;margin:0 auto;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;}
  .acc-body{max-height:0;overflow:hidden;padding:0 !important;border-top:0 !important;background:var(--cream-2);transition:max-height .3s ease,border-color .3s ease;}
  .acc-open .acc-body{max-height:260px;border-top:1px solid var(--border) !important;}
  .acc-body-inner{padding:14px 16px;}
  .acc-ico{color:var(--forest);}

  .pdp{grid-template-columns:minmax(0,1.1fr) minmax(360px,.9fr);gap:44px;}
  .pdp-main-box,.pdp-thumb,.checkout-form-card,.order-card,.cart-card,.rv-card,.contact-form,.about-card{background:#fff;border-color:var(--border);border-radius:10px;}
  .pdp-title{color:var(--forest);text-transform:none;letter-spacing:-.035em;font-weight:800;}
  .pdp-price{color:var(--forest);}
  .pdp-verified,.rv-verified{background:#eef5ef;color:var(--forest);border-color:#c8d8ce;}
  .pdp-trust-badges{display:flex;gap:8px;flex-wrap:wrap;}
  .pdp-trust-badges span{background:#eef5ef;color:var(--forest);border:1px solid #c8d8ce;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;text-transform:none;letter-spacing:0;}
  .pdp-archive-bar{background:var(--forest);color:#fff;border-radius:8px;padding:14px 16px;text-transform:none;font-weight:750;font-size:13px;letter-spacing:0;display:flex;justify-content:space-between;align-items:center;}
  .pdp-archive-bar span{transition:transform .2s;}
  .pdp-archive-bar.open span{transform:rotate(180deg);}
  .pdp-archive-content{max-height:0;overflow:hidden;border:1px solid transparent;border-radius:8px;background:#fff;transition:max-height .3s ease,border-color .3s ease,margin .3s ease;}
  .pdp-archive-content.open{max-height:110px;border-color:var(--border);margin-top:-6px;}
  .pdp-archive-content p{padding:14px 16px;color:var(--muted);font-size:13px;line-height:1.6;}
  .pdp-qty-selector{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:12px 14px;}
  .pdp-qty-selector>span{font-size:12px;font-weight:900;text-transform:uppercase;color:var(--forest);letter-spacing:.06em;}
  .pdp-qty-controls{display:flex;align-items:center;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--cream-2);}
  .pdp-qty-controls button{width:38px;height:38px;background:#fff;color:var(--forest);font-size:20px;font-weight:900;}
  .pdp-qty-controls button:hover{background:var(--forest);color:#fff;}
  .pdp-qty-controls strong{width:44px;text-align:center;color:var(--dark);font-weight:900;}
  .pdp-cta-row{grid-template-columns:1fr;}
  .pdp-add-btn,.pdp-buy-btn{background:var(--forest);border-radius:6px;color:#fff;}
  .pdp-add-btn:hover,.pdp-buy-btn:hover{background:var(--forest-2);}
  .pdp-safe-checkout{text-align:center;color:var(--muted);font-size:12px;font-weight:800;display:flex;justify-content:center;align-items:center;gap:6px;}
  .bundle-wrap{border-color:var(--border);border-radius:8px;background:#fff;}
  .bundle-header{background:var(--cream-2);border-color:var(--border);}
  .bundle-title{color:var(--forest);}
  .bundle-selected{background:#f8fbf7 !important;border-left:4px solid var(--forest) !important;}
  .bundle-popular{border:1px solid var(--border) !important;}
  .bundle-radio-dot.active{border-color:var(--forest);background:var(--forest);}
  .bundle-discount-badge{background:#fff8df;color:var(--forest);border-color:#ead990;border-radius:999px;}

  .footer{background:var(--forest);color:rgba(255,255,255,.78);}
  .footer-top{grid-template-columns:1.25fr 1fr 1.25fr;border-bottom:1px solid rgba(255,255,255,.14);}
  .footer-logo-txt,.footer-col h4{color:#fff;}
  .footer-col button,.footer-col p{color:rgba(255,255,255,.72);}
  .footer-col button:hover{color:var(--gold);}
  .footer-signup{display:flex;gap:8px;margin:12px 0;}
  .footer-signup input{min-width:0;flex:1;height:42px;border-radius:6px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.1);color:#fff;padding:0 12px;}
  .footer-signup input::placeholder{color:rgba(255,255,255,.55);}
  .footer-signup button{height:42px;border-radius:6px;background:var(--gold);color:#1a1a1a;padding:0 14px;font-weight:900;}
  .social-a{border-color:rgba(255,255,255,.22);}
  .social-a:hover{background:var(--gold);border-color:var(--gold);color:#1a1a1a;}

  /* --- Priority 0 premium polish and shared component normalization --- */
  h1{font-weight:700;}
  h2{font-weight:600;}
  body,.pcard-desc,.sec-sub,.pdp-rv{font-weight:400;}
  .pcard-price,.pdp-price,.cart-total,.bundle-price{font-weight:700;}
  .live-feed-popup{position:fixed;left:16px;bottom:96px;z-index:520;max-width:280px;width:calc(100vw - 32px);animation:slideInLeft .25s ease forwards;pointer-events:none;}
  .live-feed-inner{position:relative;background:#fff;border:1px solid var(--color-card-border);border-radius:12px;box-shadow:var(--shadow-rest);padding:10px 34px 10px 10px;display:flex;align-items:center;gap:10px;pointer-events:auto;}
  .live-feed-img{width:42px;height:42px;border-radius:8px;object-fit:cover;background:var(--color-bg);flex-shrink:0;}
  .live-feed-name{font-size:11px;color:var(--color-text);line-height:1.35;}
  .live-feed-name strong{font-weight:600;}
  .live-feed-action{font-size:11px;color:var(--color-text-muted);line-height:1.35;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}
  .live-feed-action span{color:var(--color-primary);font-weight:600;}
  .live-feed-time{font-size:10px;color:var(--color-text-muted);margin-top:2px;}
  .live-dot{display:inline-block;width:7px;height:7px;background:var(--color-accent);border-radius:999px;margin-right:5px;}
  .live-feed-close{position:absolute;right:8px;top:7px;width:24px;height:24px;border-radius:999px;color:var(--color-text-muted);font-size:18px;line-height:1;display:grid;place-items:center;}
  .live-feed-close:hover{background:var(--color-bg);color:var(--color-primary);}
  .hdr-icon-btn,.hdr-wish-btn,.hdr-cart-btn,.hdr-login-btn,.hdr-user-btn{min-width:44px;min-height:44px;}
  .hdr-mobile-icon{font-size:20px;line-height:1;}
  .hdr-cart-glyph{font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;}
  .hdr-badge,.hdr-cart-count{min-width:18px;width:auto;padding:0 5px;}
  .btn-red-lg,.btn-dark-lg,.btn-checkout,.btn-place,.nl-btn,.promo-btn,.hero-peek-btn{
    background:var(--color-primary) !important;color:#fff !important;border-radius:8px !important;box-shadow:var(--shadow-rest) !important;font-weight:600 !important;border:1px solid var(--color-primary) !important;
  }
  .btn-red-lg:hover,.btn-dark-lg:hover,.btn-checkout:hover,.btn-place:hover,.nl-btn:hover,.promo-btn:hover,.hero-peek-btn:hover{
    background:var(--color-primary-hover) !important;box-shadow:var(--shadow-elevated) !important;
  }
  .btn-outline-lg,.btn-continue{
    background:#fff !important;color:var(--color-primary) !important;border:1px solid var(--color-primary) !important;border-radius:8px !important;font-weight:600 !important;
  }

  .pcard{background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:12px;box-shadow:var(--shadow-rest);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;overflow:hidden;}
  .pcard:hover{transform:translateY(-4px);box-shadow:var(--shadow-elevated);border-color:var(--color-card-border);}
  .pcard-img-wrap{aspect-ratio:4/5;background:#fff;padding:12px;}
  .pcard-img-btn{border-radius:10px;overflow:hidden;background:linear-gradient(180deg,#fff,var(--color-bg));}
  .pcard-img{width:100%;height:100%;object-fit:contain;transition:transform .15s ease;}
  .pcard-img-z{transform:scale(1.02);}
  .pcard-sale-badge,.pcard-cat-on-img{border-radius:999px;font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;padding:5px 9px;z-index:5;}
  .pcard-cat-on-img{position:absolute;top:12px;left:12px;background:#f6e8b6;color:var(--color-text);max-width:calc(100% - 64px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pcard-sale-badge{position:absolute;left:12px;bottom:12px;background:var(--color-primary);color:#fff;}
  .pcard-hot-badge{display:none !important;}
  .pcard-wish{top:12px;right:12px;width:38px;height:38px;background:#fff;border:1px solid var(--color-card-border);color:var(--color-primary);box-shadow:var(--shadow-rest);}
  .pcard-wish.wished,.pcard-wish:hover{background:#fff;color:var(--color-primary);border-color:var(--color-primary);}
  .pcard-overlay{display:none;}
  .pcard-body{padding:14px;gap:8px;}
  .pcard-body>.pcard-cat{position:static;align-self:flex-start;margin-top:-2px;}
  .pcard-name{font-size:15px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--color-text);}
  .pcard-name:hover{color:var(--color-primary);}
  .pcard-rating{min-height:18px;}
  .star-on{color:var(--color-accent);}
  .star-off{color:#ded8cc;}
  .pcard-price{font-size:17px;color:var(--color-primary);}
  .pcard-stock{color:var(--color-primary);font-weight:600;}
  .pcard-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
  .pcard-add,.pcard-buy{width:100%;border-radius:8px !important;font-weight:600 !important;}

  .pdp-video{width:100%;height:100%;object-fit:contain;border-radius:var(--r-xl);background:var(--color-bg);}
  .pdp-thumb-img,.pdp-video-thumb{width:100%;height:100%;object-fit:cover;border-radius:8px;background:var(--color-bg);}
  .pdp-video-thumb{display:grid;place-items:center;color:var(--color-primary);font-size:20px;}
  .pdp-stock-strip{background:#fff;border:1px solid var(--color-card-border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;}
  .scarcity{padding:0;border:0;background:transparent;border-radius:0;}
  .scarcity-top{font-size:12px;font-weight:600;color:var(--color-text-muted);}
  .scarcity-top strong{color:var(--color-urgency);}
  .scarcity-track{height:6px;background:var(--color-card-border);border-radius:999px;}
  .scarcity-bar{background:var(--color-urgency);border-radius:999px;}
  .pdp-proof{font-size:12px;color:var(--color-text-muted);gap:12px;}
  .pdp-proof strong{color:var(--color-primary);}
  .pdp-urgency{display:none;}
  .pdp-cta-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .pdp-add-btn,.pdp-buy-btn{width:100%;border-radius:8px !important;}
  .pdp-add-btn{background:var(--color-primary) !important;color:#fff !important;border-color:var(--color-primary) !important;box-shadow:var(--shadow-rest) !important;}
  .pdp-add-btn:hover{background:var(--color-primary-hover) !important;box-shadow:var(--shadow-elevated) !important;}
  .pdp-buy-btn{background:#fff !important;color:var(--color-primary) !important;border-color:var(--color-primary) !important;box-shadow:none !important;}
  .pdp-buy-btn:hover{background:#eef5ef !important;color:var(--color-primary) !important;box-shadow:var(--shadow-rest) !important;}
  .pdp-wa-tertiary{align-self:flex-start;background:#eef5ef;color:var(--color-primary);border:1px solid #c8d8ce;padding:10px 14px;border-radius:999px;font-size:13px;box-shadow:none;}
  .pdp-wa-tertiary:hover{background:#e2eee5;color:var(--color-primary);transform:none;}
  .pdp-trust-lines{background:#fff;border:1px solid var(--color-card-border);}
  .tl-item{font-size:13px;color:var(--color-text-muted);}
  .testi-av,.rv-av{background:#f6e8b6;color:var(--color-primary);border:1px solid rgba(201,168,76,.45);}

  /* --- Mobile fit + premium product frames --- */
  main,.sec,.storefront-light,.pdp,.pdp-gallery,.pdp-info,.pdp-main-box,.pdp-thumbs,.pdp-stock-strip,.pdp-archive-bar,.pdp-archive-content,.pdp-qty-selector,.bundle-wrap,.bundle-option,.bundle-option-inner,.bundle-footer,.pdp-cta-row,.pdp-timeline,.pgrid,.hscroll,.hscroll-inner{max-width:100%;min-width:0;}
  .pdp-info>*{max-width:100%;min-width:0;}
  .bundle-option-inner{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px;}
  .bundle-discount-badge{grid-column:3;grid-row:1;max-width:92px;overflow:hidden;text-overflow:ellipsis;text-align:center;}
  .bundle-price-info{grid-column:2 / 4;grid-row:2;align-items:flex-start;margin-left:0;}
  .bundle-footer{gap:10px;flex-wrap:wrap;}
  .bundle-delivery,.bundle-total-label{min-width:0;}

  .pcard{position:relative;border-radius:18px;border:1px solid rgba(232,221,208,.95);background:linear-gradient(180deg,#fff 0%,#fff 58%,#fbf7ef 100%);box-shadow:0 10px 28px rgba(27,67,50,.09);overflow:hidden;}
  .pcard::before{content:"";position:absolute;inset:0;border-radius:18px;pointer-events:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.9);}
  .pcard:hover{transform:translateY(-4px);box-shadow:0 18px 42px rgba(27,67,50,.16);}
  .pcard-img-wrap{margin:10px 10px 0;border-radius:16px;aspect-ratio:4/5;background:linear-gradient(145deg,#fff,#f5ede0);padding:12px;border:1px solid rgba(232,221,208,.9);}
  .pcard-img-btn{border-radius:13px;background:radial-gradient(circle at 50% 20%,#ffffff 0%,#f7f2e9 72%);}
  .pcard-body{padding:12px 12px 14px;}
  .pcard-cat-on-img{top:10px;left:10px;background:#f4e5aa;border:1px solid rgba(201,168,76,.45);}
  .pcard-wish{top:10px;right:10px;}
  .pcard-sale-badge{left:10px;bottom:10px;}

  @media(max-width:1100px){
    .sf-hero{grid-template-columns:1fr;}
    .sf-hero-showcase{min-height:500px;}
    .storefront-light .pgrid{grid-template-columns:repeat(3,minmax(0,1fr));}
    .sf-review-section .testi-grid{grid-template-columns:repeat(2,1fr);}
    .footer-top{grid-template-columns:1fr 1fr;}
  }
  @media(max-width:768px){
    html,body,#root{width:100%;max-width:100vw;overflow-x:hidden;}
    main{width:100%;max-width:100vw;overflow:hidden;}
    .sec{padding-left:12px !important;padding-right:12px !important;}
    .hdr-body{background:var(--forest);}
    .hdr-cats{display:none !important;}
    .mobile-menu{background:var(--cream-2);}
    .sf-hero{padding:32px 16px 38px;min-height:auto;align-items:start;gap:28px;}
    .sf-hero h1{font-size:clamp(2.35rem,12vw,3.35rem);letter-spacing:-.055em;}
    .sf-hero p{font-size:15px;line-height:1.65;}
    .sf-hero-actions{display:grid;grid-template-columns:1fr;width:100%;}
    .sf-hero-actions .sf-btn{width:100%;}
    .sf-hero-product{inset:auto;padding:0;margin-bottom:14px;}
    .sf-hero-product-img{max-height:210px;}
    .sf-hero-product span{font-size:13px;max-width:260px;}
    .sf-hero-product strong{font-size:17px;}
    .sf-hero-showcase{min-height:460px;border-radius:22px;padding:72px 16px 16px;}
    .sf-hero-note{display:none;}
    .sf-mini-stack{left:auto;right:auto;bottom:auto;gap:8px;}
    .sf-mini-product{height:76px;border-radius:14px;}
    .sf-cat-marquee{mask-image:linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent);}
    .sf-cat-grid{display:flex;gap:18px;}
    .sf-cat-card{min-width:158px;}
    .sf-cat-icon{width:154px;height:98px;}
    .storefront-light .pgrid,.pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
    .stats-grid{grid-template-columns:1fr;}
    .stat-card{border-right:0;border-bottom:1px solid var(--border);}
    .sf-review-section .testi-grid{grid-template-columns:1fr;}
    .sf-selling-section .row-hdr{grid-template-columns:1fr;gap:12px;text-align:center;}
    .sf-selling-section .row-hdr>div:first-child,.sf-selling-section .row-controls{grid-column:auto;justify-content:center;}
    .pdp{grid-template-columns:minmax(0,1fr);gap:22px;width:100%;overflow:hidden;}
    .pdp-mobile-head{display:block;order:-2;width:100%;padding:0 2px 4px;}
    .pdp-mobile-head .pdp-title{font-size:clamp(24px,8vw,34px);line-height:1.08;margin:0;color:var(--forest);letter-spacing:-.035em;}
    .pdp-mobile-head .pdp-cat{font-size:11px;margin-bottom:6px;color:var(--forest);}
    .pdp-info{gap:12px;width:100%;overflow:hidden;}
    .pdp-info>.pdp-cat,.pdp-info>.pdp-title{display:none;}
    .pdp-title{font-size:clamp(20px,7vw,28px);line-height:1.2;}
    .pdp-price{font-size:28px;}
    .pdp-rating-row,.pdp-price-row,.pdp-trust-badges,.pdp-proof{gap:8px;}
    .pdp-main-box{border-radius:14px;max-height:none;}
    .pdp-trust-lines{margin-top:10px;padding:14px;gap:9px;}
    .pdp-thumbs{padding-bottom:2px;}
    .pdp-thumb{width:58px;height:58px;border-radius:10px;}
    .pdp-qty-selector{padding:10px;align-items:center;}
    .pdp-qty-selector>span{font-size:11px;}
    .pdp-qty-controls button{width:34px;height:34px;}
    .pdp-qty-controls strong{width:36px;}
    .bundle-option-inner{grid-template-columns:auto minmax(0,1fr);gap:8px;padding:11px 10px;}
    .bundle-discount-badge{grid-column:2;grid-row:2;justify-self:start;max-width:100%;font-size:10px;padding:3px 8px;}
    .bundle-price-info{grid-column:1 / 3;grid-row:3;align-items:flex-start;padding-left:26px;}
    .bundle-footer{padding:10px;font-size:12px;}
    .pdp-cta-row{grid-template-columns:1fr;gap:8px;}
    .pdp-wa-tertiary{width:100%;justify-content:center;border-radius:8px;}
    .pdp-timeline{padding:12px 8px;}
    .tl-line{flex-basis:18px;}
    .home-pagination{gap:8px;margin-top:26px;}
    .page-btn{min-width:42px;height:42px;border-radius:12px;font-size:17px;}
    .page-arrow{font-size:26px;}
    .page-ellipsis{min-width:30px;font-size:20px;}
    .live-feed-popup{left:10px;bottom:86px;max-width:250px;width:min(250px,calc(100vw - 20px));pointer-events:none;}
    .live-feed-inner{pointer-events:none;}
    .live-feed-close{display:none;}
    .wa-float{width:50px;height:50px;left:12px;bottom:18px;}
    .pcard{border-radius:16px;}
    .pcard-img-wrap{margin:8px 8px 0;padding:9px;border-radius:14px;}
    .pcard-img-btn{border-radius:11px;}
    .pcard-body{padding:10px;}
    .pcard-name{font-size:13px;}
    .pcard-desc{display:none;}
    .pcard-prices{gap:5px;flex-wrap:wrap;}
    .pcard-price{font-size:15px;}
    .pcard-old{font-size:10px;}
    .pcard-stock,.pcard-rv{font-size:10px;}
    .pcard-actions{grid-template-columns:1fr;gap:6px;}
    .pcard-add,.pcard-buy{min-height:38px;font-size:11px;padding:0 8px;}
    .footer-top{grid-template-columns:1fr;}
    .footer-signup{flex-direction:column;}
  }
  @media(max-width:360px){
    .storefront-light .pgrid,.pgrid{grid-template-columns:1fr;}
    .pcard-actions{grid-template-columns:1fr 1fr;}
    .apf-actions{grid-template-columns:1fr;}
  }

  /* --- Final storefront correction layer: Priority 0 + floating premium cards --- */
  .live-feed-popup{
    position:fixed;
    left:16px;
    bottom:16px;
    width:min(260px,calc(100vw - 32px));
    max-width:260px;
    z-index:99998;
    pointer-events:none;
    animation:liveFeedIn .22s ease both,liveFeedOut .35s ease 3.65s forwards;
    transition:opacity .18s ease,transform .18s ease;
  }
  .live-feed-hidden{opacity:0;transform:translateY(8px);visibility:hidden;}
  .live-feed-inner{
    position:relative;
    display:flex;
    align-items:center;
    gap:10px;
    min-height:64px;
    padding:10px 34px 10px 10px;
    border-radius:16px;
    border:1px solid rgba(232,221,208,.95);
    background:rgba(255,255,255,.96);
    box-shadow:var(--shadow-warm);
    pointer-events:none;
  }
  .live-feed-img{width:42px;height:42px;border-radius:10px;object-fit:cover;background:var(--cream);flex-shrink:0;}
  .live-feed-text{min-width:0;}
  .live-feed-name,.live-feed-action{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .live-feed-name{font-size:11px;color:var(--dark);line-height:1.35;}
  .live-feed-action{font-size:11px;color:var(--muted);line-height:1.35;}
  .live-feed-close{
    position:absolute;
    right:7px;
    top:7px;
    display:grid;
    place-items:center;
    width:24px;
    height:24px;
    border-radius:999px;
    color:var(--forest);
    background:#f7f2e9;
    pointer-events:auto;
    font-size:18px;
    line-height:1;
  }
  @keyframes liveFeedIn{from{opacity:0;transform:translateX(-12px) translateY(8px)}to{opacity:1;transform:translateX(0) translateY(0)}}
  @keyframes liveFeedOut{to{opacity:0;transform:translateX(-10px) translateY(8px)}}

  .sf-hero{
    background:var(--gradient-hero);
    grid-template-columns:minmax(0,1fr) minmax(320px,.9fr);
    min-height:auto;
    padding:72px 52px 64px;
    border-bottom:1px solid rgba(232,221,208,.95);
    isolation:isolate;
  }
  .sf-hero::after{
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:0;
    background:
      radial-gradient(circle at 82% 18%,rgba(201,168,76,.22),transparent 28%),
      radial-gradient(circle at 8% 84%,rgba(27,67,50,.12),transparent 30%),
      linear-gradient(90deg,rgba(255,255,255,.22),transparent 50%);
  }
  .sf-hero-copy,.sf-hero-showcase{z-index:1;}
  .sf-hero-fade{animation:heroSoftFade .48s ease both;}
  @keyframes heroSoftFade{
    0%{opacity:0;transform:translateY(10px) scale(.992);}
    100%{opacity:1;transform:translateY(0) scale(1);}
  }
  .sf-hero h1{max-width:660px;letter-spacing:-.045em;}
  .sf-hero p{max-width:520px;font-size:18px;line-height:1.65;color:#5d5a54;}
  .sf-hero-deal{background:var(--gradient-gold-badge) !important;color:#1a1a1a !important;border-color:transparent !important;box-shadow:0 10px 24px rgba(126,86,38,.16) !important;}
  .sf-hero-showcase{
    min-height:520px;
    border:1px solid rgba(255,255,255,.68);
    outline:1px solid rgba(201,168,76,.16);
    background:
      linear-gradient(145deg,rgba(255,255,255,.34),rgba(255,255,255,0) 42%),
      radial-gradient(circle at 50% 30%,#fffaf1 0%,#efe2cd 58%,#e4d0ac 100%);
    box-shadow:0 34px 80px rgba(126,86,38,.18),inset 0 1px 0 rgba(255,255,255,.72);
    overflow:hidden;
    justify-content:center;
    padding:76px 32px 36px;
  }
  .sf-hero-showcase::after{
    content:"";
    position:absolute;
    inset:18px;
    border-radius:22px;
    border:1px solid rgba(201,168,76,.2);
    pointer-events:none;
  }
  .sf-hero-showcase::before{display:none;}
  .sf-hero-product{position:relative;min-height:360px;margin:0;padding:0;isolation:isolate;}
  .sf-hero-product::after{
    content:"";
    position:absolute;
    left:19%;
    right:19%;
    bottom:74px;
    height:28px;
    border-radius:999px;
    background:radial-gradient(ellipse at center,rgba(126,86,38,.26),rgba(126,86,38,0) 70%);
    filter:blur(7px);
    z-index:-1;
  }
  .sf-hero-product-img{max-height:330px;object-fit:contain;filter:drop-shadow(0 24px 26px rgba(126,86,38,.18));}
  video.sf-hero-product-img{width:100%;height:330px;border-radius:18px;object-fit:contain;background:rgba(255,255,255,.26);}
  .sf-hero-label{background:var(--gradient-gold-badge);color:#1a1a1a;box-shadow:0 12px 24px rgba(126,86,38,.18);}
  .sf-hero-dots{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:7px;z-index:4;}
  .sf-hero-dots button{width:7px;height:7px;border-radius:999px;background:rgba(27,67,50,.28);transition:width .2s ease,background .2s ease;}
  .sf-hero-dots button.active{width:22px;background:var(--forest);}

  .sf-review-section,.footer{background:var(--gradient-dark-section);}
  .bundle-discount-badge{background:var(--gradient-gold-badge) !important;color:#1a1a1a !important;border-color:transparent !important;}

  .sf-cat-icon{width:176px;height:104px;border-radius:999px;background:#fff;box-shadow:var(--shadow-warm);}
  .sf-cat-img{width:100%;height:100%;object-fit:cover;object-position:center;border-radius:999px;padding:0;}
  .sf-cat-fallback-card .sf-cat-icon{background:linear-gradient(135deg,#fffaf1,#e8d9c0);}
  .sf-cat-fallback-card .sf-product-placeholder{display:grid;place-items:center;color:var(--forest);font-size:34px;background:transparent;}

  .pcard{
    --card-gradient:var(--gradient-card-default);
    --card-button:linear-gradient(135deg,#1b4332 0%,#2d6a4f 100%);
    position:relative;
    overflow:hidden;
    border:1px solid rgba(232,221,208,.92);
    border-radius:24px;
    background:#fffaf6;
    box-shadow:var(--shadow-warm);
    transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;
  }
  .pcard-tone-kitchen{--card-gradient:var(--gradient-card-kitchen);--card-button:linear-gradient(135deg,#d88a36 0%,#a95d25 100%);}
  .pcard-tone-home{--card-gradient:var(--gradient-card-home);--card-button:linear-gradient(135deg,#1b4332 0%,#5d8b64 100%);}
  .pcard-tone-gifts{--card-gradient:var(--gradient-card-gifts);--card-button:linear-gradient(135deg,#c9a84c 0%,#9d7728 100%);}
  .pcard:hover{transform:translateY(-4px);box-shadow:0 24px 54px rgba(126,86,38,.18);border-color:#decbb4;}
  .pcard-img-wrap{
    position:relative;
    margin:10px 10px 0;
    aspect-ratio:1.05;
    border-radius:22px 22px 18px 18px;
    background:var(--card-gradient);
    border:1px solid rgba(255,255,255,.55);
    padding:0;
    overflow:hidden;
  }
  .pcard-img-btn{position:relative;width:100%;height:100%;display:grid;place-items:center;padding:14%;border-radius:inherit;background:transparent;overflow:visible;}
  .pcard-img-btn::after{
    content:"";
    position:absolute;
    left:24%;
    right:24%;
    bottom:16%;
    height:18px;
    border-radius:999px;
    background:radial-gradient(ellipse at center,rgba(126,86,38,.22),rgba(126,86,38,0) 70%);
    filter:blur(6px);
  }
  .pcard-img{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 16px 16px rgba(91,64,34,.16));transition:transform .15s ease;}
  video.pcard-img{border-radius:14px;background:rgba(255,255,255,.26);}
  .pcard-img-z{transform:translateY(-3px) scale(1.03);}
  .pcard-cat-on-img{
    top:12px;
    left:12px;
    max-width:calc(100% - 68px);
    height:28px;
    display:inline-flex;
    align-items:center;
    border:0;
    border-radius:999px;
    background:var(--gradient-gold-badge);
    color:#1a1a1a;
    font-size:10px;
    font-weight:800;
    letter-spacing:0;
    text-transform:none;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:clip;
    box-shadow:0 8px 18px rgba(126,86,38,.16);
  }
  .pcard-sale-badge{
    left:12px;
    bottom:12px;
    border-radius:999px;
    background:rgba(27,67,50,.9);
    color:#fff;
    font-weight:800;
  }
  .pcard-wish{
    top:12px;
    right:12px;
    width:36px;
    height:36px;
    border:1px solid rgba(255,255,255,.34);
    background:rgba(27,67,50,.78);
    color:#fff;
    box-shadow:none;
    backdrop-filter:blur(10px);
  }
  .pcard-wish.wished,.pcard-wish:hover{background:var(--forest);color:#fff;border-color:rgba(255,255,255,.55);}
  .pcard-body{padding:16px;gap:9px;background:#fffaf6;}
  .pcard-name{
    font-size:16px;
    line-height:1.28;
    font-weight:800;
    letter-spacing:0;
    color:var(--dark);
    font-family:var(--font-body);
    word-break:normal;
    overflow-wrap:normal;
    hyphens:none;
    display:-webkit-box;
    -webkit-line-clamp:2;
    -webkit-box-orient:vertical;
    overflow:hidden;
    min-height:41px;
  }
  .pcard-chips{display:flex;gap:6px;flex-wrap:wrap;min-height:24px;}
  .pcard-chips span{
    display:inline-flex;
    align-items:center;
    height:24px;
    border-radius:999px;
    border:1px solid #e3d5c4;
    color:#6b6258;
    background:#fff;
    padding:0 8px;
    font-size:10px;
    font-weight:750;
    white-space:nowrap;
  }
  .pcard-rating{display:none;}
  .pcard-buyline{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:auto;}
  .pcard-prices{display:flex;flex-direction:column;align-items:flex-start;gap:1px;margin:0;min-width:0;}
  .pcard-price-label{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#81776b;font-weight:850;}
  .pcard-price{font-size:18px;line-height:1.1;color:var(--forest);font-weight:900;}
  .pcard-old{font-size:11px;color:#a79c8e;text-decoration:line-through;}
  .pcard-add{
    min-height:38px;
    width:auto;
    flex:0 0 auto;
    padding:0 14px;
    border-radius:999px !important;
    background:var(--card-button) !important;
    color:#fff !important;
    border:0 !important;
    box-shadow:0 10px 20px rgba(27,67,50,.16);
    font-size:11px;
    font-weight:850 !important;
    white-space:nowrap;
  }
  .pcard-add:hover{transform:translateY(-1px);filter:saturate(1.06);}
  .pcard-actions,.pcard-buy,.pcard-foot,.pcard-desc,.pcard-overlay,.pcard-hot-badge{display:none !important;}

  @media(max-width:768px){
    .hdr-login-btn,.hdr-user-wrap{display:none !important;}
    .hdr-right{gap:6px;}
    .hdr-cart-btn{min-width:48px;padding:8px 11px;}
    .wa-float{left:auto;right:12px;bottom:18px;}
    .live-feed-popup{left:16px;bottom:16px;width:min(260px,calc(100vw - 32px));}
    .live-feed-inner{pointer-events:none;}
    .live-feed-close{display:grid;pointer-events:auto;}
    .sf-hero{grid-template-columns:1fr;padding:30px 16px 38px;gap:24px;}
    .sf-hero-copy{width:100%;max-width:100%;order:1;}
    .sf-hero h1{font-size:clamp(2.35rem,11vw,3.1rem);}
    .sf-hero p{width:100%;max-width:310px;}
    .sf-hero-actions{grid-template-columns:1fr 1fr;}
    .sf-hero-actions .sf-btn{width:100%;padding:0 10px;font-size:11px;}
    .sf-hero-trust{width:100%;}
    .sf-hero-trust span{padding:8px 10px;font-size:11px;}
    .sf-hero-showcase{order:2;width:100%;justify-self:stretch;min-height:390px;padding:62px 18px 34px;border-radius:24px;}
    .sf-hero-product{min-height:290px;}
    .sf-hero-product::after{bottom:64px;}
    .sf-hero-product-img{max-height:235px;}
    video.sf-hero-product-img{height:235px;}
    .sf-cat-card{min-width:142px;}
    .sf-cat-icon{width:138px;height:88px;}
    .storefront-light .pgrid,.pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
    .pcard{border-radius:20px;}
    .pcard-img-wrap{margin:8px 8px 0;border-radius:18px;aspect-ratio:1.02;}
    .pcard-img-btn{padding:13%;}
    .pcard-body{padding:13px 11px 12px;gap:8px;}
    .pcard-name{font-size:14px;min-height:36px;}
    .pcard-chips span{font-size:9px;height:22px;padding:0 7px;}
    .pcard-buyline{align-items:flex-start;flex-direction:column;gap:8px;}
    .pcard-add{width:100%;min-height:36px;font-size:10px;}
    .pcard-price{font-size:16px;}
  }
  @media(max-width:360px){
    .sf-hero-actions{grid-template-columns:1fr;}
    .storefront-light .pgrid,.pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
    .pcard-name{font-size:13px;}
    .pcard-body{padding:11px 9px;}
    .pcard-add{padding:0 8px;}
  }

  /* --- Premium Shopify-style motion polish --- */
  .premium-reveal{
    opacity:0;
    transform:translateY(18px);
    transition:opacity .56s ease,transform .56s cubic-bezier(.22,.9,.25,1);
    transition-delay:var(--reveal-delay,0ms);
    will-change:opacity,transform;
  }
  .premium-reveal.in-view{opacity:1;transform:translateY(0);}

  .storefront-light{
    position:relative;
    isolation:isolate;
    overflow:hidden;
    background:
      linear-gradient(135deg,rgba(255,255,255,.96),rgba(250,246,239,.72) 38%,rgba(255,255,255,.94) 100%),
      radial-gradient(circle at 14% 10%,rgba(218,190,123,.12),transparent 30%),
      radial-gradient(circle at 88% 42%,rgba(27,67,50,.08),transparent 32%);
  }
  .product-page-shell{
    position:relative;
    isolation:isolate;
    overflow:hidden;
    min-height:100vh;
    background:
      linear-gradient(135deg,rgba(255,255,255,.98),rgba(250,246,239,.78) 44%,rgba(255,255,255,.96) 100%),
      radial-gradient(circle at 8% 18%,rgba(255,111,97,.08),transparent 28%),
      radial-gradient(circle at 92% 30%,rgba(45,197,173,.08),transparent 32%);
  }
  .storefront-light::before,
  .storefront-light::after,
  .product-page-shell::before,
  .product-page-shell::after{
    content:"";
    position:absolute;
    inset:0;
    z-index:0;
    pointer-events:none;
  }
  .storefront-light::before,
  .product-page-shell::before{
    opacity:.68;
    background:
      radial-gradient(circle at 8% 12%,rgba(27,67,50,.16) 0 34px,rgba(255,255,255,.5) 35px 43px,transparent 44px),
      radial-gradient(circle at 92% 18%,rgba(201,168,76,.18) 0 42px,rgba(255,255,255,.55) 43px 55px,transparent 56px),
      linear-gradient(135deg,rgba(27,67,50,.18),rgba(255,255,255,.54) 45%,rgba(201,168,76,.22)) 14% 48%/96px 96px no-repeat,
      linear-gradient(135deg,rgba(232,25,44,.12),rgba(255,255,255,.58) 46%,rgba(27,67,50,.14)) 84% 62%/118px 118px no-repeat,
      radial-gradient(circle at 18% 82%,rgba(60,214,190,.13) 0 30px,rgba(255,255,255,.46) 31px 40px,transparent 41px);
    animation:premiumObjectDrift 20s ease-in-out infinite alternate;
  }
  .storefront-light::after,
  .product-page-shell::after{
    opacity:.5;
    background:
      linear-gradient(135deg,rgba(255,255,255,.64),rgba(27,67,50,.16)) 72% 9%/82px 82px no-repeat,
      linear-gradient(135deg,rgba(255,255,255,.62),rgba(201,168,76,.2)) 5% 38%/70px 70px no-repeat,
      radial-gradient(circle at 88% 84%,rgba(232,25,44,.1) 0 28px,rgba(255,255,255,.48) 29px 38px,transparent 39px),
      radial-gradient(circle at 38% 72%,rgba(201,168,76,.13) 0 26px,rgba(255,255,255,.45) 27px 34px,transparent 35px);
    animation:premiumObjectDriftAlt 24s ease-in-out infinite alternate;
  }
  .storefront-light > *,
  .product-page-shell > *{
    position:relative;
    z-index:1;
  }
  .storefront-light .sec,
  .product-page-shell .sec{
    background:transparent;
  }
  .sf-hero,
  .pdp{
    position:relative;
    isolation:isolate;
  }
  .pdp > *{
    position:relative;
    z-index:1;
  }
  .pdp::before{
    content:"";
    position:absolute;
    inset:18px;
    z-index:0;
    pointer-events:none;
    border-radius:28px;
    opacity:.42;
    background:
      radial-gradient(circle at 4% 18%,rgba(27,67,50,.15) 0 30px,rgba(255,255,255,.54) 31px 40px,transparent 41px),
      linear-gradient(135deg,rgba(255,255,255,.58),rgba(201,168,76,.18)) 94% 64%/96px 96px no-repeat,
      radial-gradient(circle at 72% 14%,rgba(232,25,44,.1) 0 24px,rgba(255,255,255,.48) 25px 32px,transparent 33px);
  }
  .sf-hero{
    background:
      radial-gradient(circle at 6% 16%,rgba(27,67,50,.13) 0 34px,rgba(255,255,255,.5) 35px 44px,transparent 45px),
      linear-gradient(135deg,rgba(255,255,255,.6),rgba(201,168,76,.18)) right 7% top 18%/96px 96px no-repeat,
      radial-gradient(circle at 18% 78%,rgba(232,25,44,.09) 0 26px,rgba(255,255,255,.42) 27px 35px,transparent 36px),
      linear-gradient(135deg,#fff 0%,#f7f6f2 58%,#eeeeea 100%);
  }
  @keyframes premiumObjectDrift{
    from{transform:translate3d(-6px,0,0) rotate(-1deg);}
    to{transform:translate3d(8px,10px,0) rotate(1deg);}
  }
  @keyframes premiumObjectDriftAlt{
    from{transform:translate3d(7px,-4px,0) rotate(1deg);}
    to{transform:translate3d(-9px,8px,0) rotate(-1deg);}
  }
  .sf-hero::after{opacity:.92;transform:none;}
  .sf-hero-showcase{
    animation:none;
    background:
      linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,255,255,.24) 38%,rgba(236,224,204,.9)),
      radial-gradient(circle at 50% 26%,#fffdf7 0%,#f2e8d7 58%,#e6d5b8 100%);
    border:1px solid rgba(255,255,255,.84);
    outline:1px solid rgba(201,168,76,.22);
    box-shadow:0 22px 56px rgba(126,86,38,.16),inset 0 1px 0 rgba(255,255,255,.92);
  }
  .sf-hero-showcase::before{
    display:block;
    content:"";
    position:absolute;
    inset:1px;
    height:auto;
    border:0;
    border-radius:inherit;
    pointer-events:none;
    background:linear-gradient(115deg,rgba(255,255,255,.42),rgba(255,255,255,0) 42%);
    z-index:1;
  }
  .sf-hero-showcase:hover{
    box-shadow:0 28px 68px rgba(126,86,38,.2),inset 0 1px 0 rgba(255,255,255,.96);
  }
  .sf-hero-label,.sf-hero-note,.sf-hero-trust span{animation:none;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;}
  .sf-hero-trust span:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(126,86,38,.12);}

  .sf-cat-icon{transition:transform .24s ease,box-shadow .24s ease;}
  .sf-cat-card:hover .sf-cat-icon{
    transform:translateY(-4px) scale(1.025);
    box-shadow:0 18px 38px rgba(126,86,38,.16);
  }
  .sf-cat-card{
    min-width:194px !important;
    gap:12px !important;
  }
  .sf-cat-icon{
    width:168px !important;
    height:168px !important;
    border-radius:50% !important;
    background:radial-gradient(circle at 35% 25%,#2f6b54 0%,var(--forest) 58%,#0f2f23 100%) !important;
    border:6px solid rgba(255,255,255,.88) !important;
    box-shadow:0 18px 42px rgba(27,67,50,.18),inset 0 1px 0 rgba(255,255,255,.28) !important;
    display:grid !important;
    place-items:center !important;
    overflow:hidden !important;
  }
  .sf-cat-img{
    width:100% !important;
    height:100% !important;
    border-radius:50% !important;
    object-fit:contain !important;
    object-position:center !important;
    padding:10px !important;
    background:transparent !important;
    mix-blend-mode:normal !important;
    opacity:1 !important;
    filter:saturate(1.08) contrast(1.06) drop-shadow(0 10px 12px rgba(0,0,0,.18));
  }
  .sf-cat-fallback-card .sf-product-placeholder{
    color:#fff !important;
    background:transparent !important;
    mix-blend-mode:normal;
    font-size:34px !important;
  }
  .sf-cat-card .cat-nm{
    color:var(--forest) !important;
    font-weight:850 !important;
  }

  .sale-ribbon{
    width:100%;
    margin:8px 0 -18px;
    height:46px;
    overflow:hidden;
    border-radius:0;
    border:1px solid rgba(201,168,76,.34);
    background:linear-gradient(135deg,var(--forest),#245b45 48%,#c9a84c 100%);
    box-shadow:0 16px 34px rgba(27,67,50,.14);
    position:relative;
    z-index:3;
  }
  .sale-ribbon::before{
    content:"";
    position:absolute;
    inset:1px;
    border-radius:0;
    border:1px solid rgba(255,255,255,.22);
    pointer-events:none;
  }
  .sale-ribbon-track{
    display:inline-flex;
    align-items:center;
    gap:22px;
    height:100%;
    white-space:nowrap;
    color:#fff;
    font-size:12px;
    font-weight:900;
    letter-spacing:.12em;
    text-transform:uppercase;
    width:max-content;
    animation:saleRibbonLoop 42s linear infinite;
    will-change:transform;
    padding:0 42px;
  }
  @keyframes saleRibbonLoop{
    from{transform:translateX(0);}
    to{transform:translateX(-33.333%);}
  }
  .sale-ribbon-track span{
    display:inline-flex;
    align-items:center;
    gap:8px;
  }
  .sale-ribbon-track span::before{
    content:"SALE";
    display:inline-flex;
    align-items:center;
    height:22px;
    padding:0 8px;
    border-radius:999px;
    background:#fff;
    color:var(--forest);
    font-size:9px;
    letter-spacing:.08em;
  }

  .pcard-cat-on-img{
    min-width:58px;
    justify-content:center;
    background:linear-gradient(135deg,#e8192c 0%,#b71222 48%,#c9a84c 100%) !important;
    color:#fff !important;
    border:1px solid rgba(255,255,255,.35) !important;
    box-shadow:0 10px 20px rgba(232,25,44,.2) !important;
    font-weight:900 !important;
    letter-spacing:.04em !important;
    text-transform:uppercase !important;
  }

  .best-selling-row{
    position:relative;
    overflow:hidden;
  }
  .best-scroll-hint{
    display:inline-flex;
    align-items:center;
    gap:7px;
    margin-top:8px;
    color:var(--forest);
    font-size:12px;
    font-weight:850;
    background:#fff;
    border:1px solid rgba(201,168,76,.38);
    border-radius:999px;
    padding:7px 12px;
    box-shadow:0 10px 22px rgba(27,67,50,.08);
  }
  .best-scroll-hint span,
  .best-selling-row .row-arr-next{
    animation:scrollCue 1.4s ease-in-out infinite;
  }
  .hscroll-best{
    position:relative;
    overflow-x:auto;
    scroll-snap-type:x proximity;
  }
  .hscroll-best::after{
    content:"";
    position:absolute;
    right:0;
    top:0;
    bottom:4px;
    width:92px;
    pointer-events:none;
    background:linear-gradient(90deg,rgba(250,246,239,0),rgba(250,246,239,.94));
    border-radius:0 24px 24px 0;
  }
  .hscroll-best .hscroll-item{
    scroll-snap-align:start;
    will-change:transform;
    animation:bestCardNudge 3.8s ease-in-out infinite;
  }
  .hscroll-best .hscroll-item:nth-child(2){animation-delay:.12s;}
  .hscroll-best .hscroll-item:nth-child(3){animation-delay:.24s;}
  .hscroll-best .hscroll-item:nth-child(4){animation-delay:.36s;}
  .hscroll-best .hscroll-item:nth-child(5){animation-delay:.48s;}
  .hscroll-best .hscroll-item:nth-child(n+6){animation-delay:.6s;}
  @keyframes bestCardNudge{
    0%,58%,100%{transform:translateX(0);}
    70%{transform:translateX(-12px);}
    82%{transform:translateX(0);}
  }
  @keyframes scrollCue{
    0%,100%{transform:translateX(0);}
    50%{transform:translateX(5px);}
  }
  @media(max-width:768px){
    .sf-cat-card{min-width:148px !important;}
    .sf-cat-icon{width:132px !important;height:132px !important;border-width:5px !important;}
    .sf-cat-img{padding:8px !important;}
    .sale-ribbon{
      width:100%;
      margin:0 0 -12px;
      height:40px;
    }
    .sale-ribbon-track{
      font-size:10px;
      gap:16px;
      padding:0 30px;
    }
    .best-scroll-hint{
      font-size:11px;
      padding:6px 10px;
    }
    .hscroll-best .hscroll-item{
      animation-duration:4.2s;
    }
  }

  .pcard{
    will-change:transform;
    transform:translateZ(0);
    box-shadow:0 10px 28px rgba(126,86,38,.1),0 1px 0 rgba(255,255,255,.9) inset;
    transition:transform .22s cubic-bezier(.22,.9,.25,1),box-shadow .22s ease,border-color .22s ease;
  }
  .pcard::before{
    content:"";
    position:absolute;
    inset:0;
    border-radius:inherit;
    pointer-events:none;
    background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.36) 18%,transparent 38%);
    transform:translateX(-120%);
    opacity:0;
    z-index:3;
  }
  .pcard:hover{transform:translateY(-5px);box-shadow:0 18px 46px rgba(126,86,38,.16),0 1px 0 rgba(255,255,255,.9) inset;border-color:#dcc7a8;}
  .pcard:hover::before{animation:cardSheen .64s ease forwards;opacity:1;}
  @keyframes cardSheen{0%{transform:translateX(-120%);opacity:0;}25%{opacity:.7;}100%{transform:translateX(120%);opacity:0;}}
  .pcard-img-wrap::after{
    content:"";
    position:absolute;
    inset:-32% -16% auto;
    height:70%;
    border-radius:50%;
    background:radial-gradient(circle,rgba(255,255,255,.42),transparent 62%);
    opacity:.5;
    z-index:0;
    pointer-events:none;
    transition:transform .24s ease,opacity .24s ease;
  }
  .pcard:hover .pcard-img-wrap::after{transform:translateY(5px) scale(1.05);opacity:.72;}
  .pcard-img-btn{z-index:1;transition:transform .24s cubic-bezier(.22,.9,.25,1);}
  .pcard:hover .pcard-img-btn{transform:translateY(-4px) scale(1.012);}
  .pcard-wish{transition:transform .18s ease,background .18s ease,border-color .18s ease;}
  .pcard-wish:hover{transform:scale(1.08);}
  .pcard-add,.pdp-add-btn,.pdp-buy-btn{
    position:relative;
    overflow:hidden;
  }
  .pcard-add::after,.pdp-add-btn::after,.pdp-buy-btn::after{
    content:"";
    position:absolute;
    inset:-40% auto -40% -35%;
    width:34%;
    transform:skewX(-18deg);
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.48),transparent);
    opacity:.65;
    animation:premiumButtonShine 5.2s ease-in-out infinite;
    pointer-events:none;
  }
  @keyframes premiumButtonShine{
    0%,76%{left:-38%;opacity:0;}
    84%{opacity:.62;}
    100%{left:120%;opacity:0;}
  }

  .pdp-main-box{
    isolation:isolate;
    box-shadow:0 26px 66px rgba(126,86,38,.14),inset 0 1px 0 rgba(255,255,255,.8);
    background:radial-gradient(circle at 50% 22%,#fffaf1 0%,#f3eadb 60%,#e7d8c1 100%);
  }
  .pdp-main-box-video{
    background:#0e1712 !important;
    aspect-ratio:var(--pdp-media-aspect,9 / 16) !important;
  }
  .pdp-main-box::after{
    content:"";
    position:absolute;
    inset:auto 10% 8%;
    height:28px;
    border-radius:999px;
    background:radial-gradient(ellipse at center,rgba(126,86,38,.24),transparent 70%);
    z-index:0;
    pointer-events:none;
    opacity:.52;
    transform:scaleX(1.02);
  }
  .pdp-main-img,.pdp-video{position:relative;z-index:1;transition:transform .26s cubic-bezier(.22,.9,.25,1);}
  .pdp-main-box-video .pdp-video{
    width:100% !important;
    height:100% !important;
    max-width:100% !important;
    max-height:100% !important;
    object-fit:contain !important;
    object-position:center center !important;
    background:#0e1712 !important;
    transform:none !important;
  }
  .pdp-main-box:hover .pdp-main-img,.pdp-main-box:hover .pdp-video{transform:translateY(-4px) scale(1.008);}
  .pdp-main-box-video:hover .pdp-video{transform:none !important;}
  .pdp-buy-btn{
    background:linear-gradient(135deg,#e8192c 0%,#b71222 58%,#ff3b4f 100%) !important;
    color:#fff !important;
    border-color:#e8192c !important;
    box-shadow:0 16px 32px rgba(232,25,44,.28) !important;
    min-height:58px !important;
    font-size:16px !important;
    font-weight:900 !important;
    letter-spacing:.02em !important;
    animation:codButtonShake 1.75s ease-in-out infinite;
  }
  .pdp-buy-btn:hover{
    background:linear-gradient(135deg,#c91424 0%,#98101c 100%) !important;
    color:#fff !important;
    box-shadow:0 20px 42px rgba(232,25,44,.36) !important;
  }
  @keyframes codButtonShake{
    0%,58%,100%{transform:translate3d(0,0,0) scale(1);}
    64%{transform:translate3d(-8px,-3px,0) scale(1.035);}
    70%{transform:translate3d(8px,2px,0) scale(1.035);}
    76%{transform:translate3d(-6px,-4px,0) scale(1.025);}
    82%{transform:translate3d(6px,1px,0) scale(1.025);}
    88%{transform:translate3d(0,-5px,0) scale(1.04);}
    94%{transform:translate3d(0,0,0) scale(1);}
  }
  .pdp-thumb{transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;}
  .pdp-thumb:hover,.pdp-thumb.active{transform:translateY(-3px);box-shadow:0 12px 26px rgba(27,67,50,.14);}
  .pdp-trust-badges span,.pdp-verified,.pdp-save{
    animation:trustBadgePop .56s ease both;
  }
  .pdp-trust-badges span:nth-child(2){animation-delay:.08s;}
  .pdp-trust-badges span:nth-child(3){animation-delay:.16s;}
  @keyframes trustBadgePop{from{opacity:0;transform:translateY(8px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
  .pdp-stock-strip,.bundle-wrap,.pdp-archive-bar,.pdp-timeline,.pdp-offer{
    box-shadow:0 12px 30px rgba(126,86,38,.08);
    transition:transform .2s ease,box-shadow .2s ease;
  }
  .pdp-stock-strip:hover,.bundle-wrap:hover,.pdp-archive-bar:hover,.pdp-timeline:hover,.pdp-offer:hover{
    transform:translateY(-2px);
    box-shadow:0 18px 42px rgba(126,86,38,.12);
  }

  .pdp-page{padding-bottom:116px;}
  .pdp-deal-alert{
    position:relative;
    display:grid;
    grid-template-columns:auto auto auto minmax(132px,1fr) auto;
    align-items:center;
    gap:9px;
    width:100%;
    padding:12px 14px;
    border-radius:18px;
    overflow:hidden;
    background:linear-gradient(135deg,#123f2d 0%,#1d5b40 58%,#d2ad3b 140%);
    color:#fff;
    border:1px solid rgba(255,255,255,.16);
    box-shadow:0 18px 44px rgba(27,67,50,.26),inset 0 1px 0 rgba(255,255,255,.2);
    isolation:isolate;
    animation:pdpDealPulse 2.4s ease-in-out infinite;
  }
  .pdp-deal-alert::before{
    content:"";
    position:absolute;
    inset:0;
    background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.22) 42%,transparent 72%);
    transform:translateX(-120%) skewX(-15deg);
    animation:pdpDealSweep 2.9s ease-in-out infinite;
    z-index:-1;
  }
  .pdp-deal-icon{
    display:grid;
    place-items:center;
    width:36px;
    height:36px;
    border-radius:999px;
    background:rgba(255,255,255,.16);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.2);
    font-size:18px;
  }
  .pdp-deal-main{
    font-size:18px;
    font-weight:950;
    letter-spacing:-.01em;
    white-space:nowrap;
  }
  .pdp-deal-sub{
    color:#f5d76e;
    font-size:12px;
    font-weight:950;
    text-transform:uppercase;
    letter-spacing:.08em;
    white-space:nowrap;
  }
  .pdp-deal-timer{
    position:relative;
    justify-self:end;
    display:inline-flex;
    align-items:center;
    gap:8px;
    min-height:34px;
    padding:4px 10px;
    border-radius:999px;
    background:rgba(255,255,255,.13);
    border:1px solid rgba(255,255,255,.18);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
    white-space:nowrap;
    overflow:hidden;
    isolation:isolate;
  }
  .pdp-deal-timer::before{
    content:"";
    position:absolute;
    inset:0 auto 0 0;
    width:var(--timer-progress,100%);
    border-radius:inherit;
    background:linear-gradient(90deg,#ff8a00 0%,#ffb000 45%,#ffe16a 100%);
    opacity:.9;
    box-shadow:0 0 22px rgba(255,176,0,.34);
    transition:width .6s linear;
    z-index:-1;
  }
  .pdp-deal-timer span{
    color:#173b2d;
    font-size:10px;
    font-weight:950;
    text-transform:uppercase;
    letter-spacing:.08em;
  }
  .pdp-deal-timer strong{
    color:#fff;
    font-family:var(--font-head);
    font-size:17px;
    line-height:1;
    letter-spacing:.04em;
    text-shadow:0 2px 10px rgba(93,45,0,.32);
  }
  .pdp-deal-sale{
    justify-self:end;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:32px;
    padding:0 12px;
    border-radius:999px;
    background:#fff;
    color:#164b35;
    font-size:12px;
    font-weight:950;
    text-transform:uppercase;
    letter-spacing:.04em;
    box-shadow:0 10px 22px rgba(0,0,0,.13);
    white-space:nowrap;
  }
  .pdp-title-trust{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-6px;}
  .pdp-sale-sticker{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 14px;border-radius:999px;background:linear-gradient(135deg,var(--forest),#0e3a28);color:#fff;font-size:12px;font-weight:950;letter-spacing:.08em;box-shadow:0 12px 24px rgba(27,67,50,.2),inset 0 1px 0 rgba(255,255,255,.18);}
  .pdp-half-stars{display:inline-flex;align-items:center;gap:1px;font-size:18px;line-height:1;color:#d5a62d;text-shadow:0 2px 8px rgba(213,166,45,.18);}
  .pdp-half-stars .half{background:linear-gradient(90deg,#d5a62d 52%,#d9d2c2 52%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;}
  .pdp-trusted-word{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;background:#f7f0df;color:#9a6b12;border:1px solid rgba(154,107,18,.18);font-size:12px;font-weight:900;letter-spacing:.02em;}
  .pdp-sticky-orderbar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9400;width:min(960px,calc(100vw - 28px));display:grid;grid-template-columns:minmax(190px,260px) minmax(280px,1fr);gap:12px;align-items:center;padding:12px;background:rgba(255,255,255,.94);border:1px solid rgba(27,67,50,.18);border-radius:22px;box-shadow:0 24px 70px rgba(27,67,50,.24),0 1px 0 rgba(255,255,255,.9) inset;backdrop-filter:blur(18px);}
  .pdp-sticky-qty{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f7f3ea;border:1px solid rgba(27,67,50,.12);border-radius:16px;padding:9px 10px 9px 14px;min-width:0;}
  .pdp-sticky-qty>span{font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;color:var(--forest);white-space:nowrap;}
  .pdp-sticky-qty-controls{display:grid;grid-template-columns:34px 38px 34px;align-items:center;border-radius:999px;background:#fff;border:1px solid rgba(27,67,50,.14);overflow:hidden;box-shadow:0 10px 22px rgba(27,67,50,.08);}
  .pdp-sticky-qty-controls button{height:34px;color:var(--forest);font-size:20px;font-weight:950;background:#fff;transition:background .16s,color .16s,transform .16s;}
  .pdp-sticky-qty-controls button:hover{background:var(--forest);color:#fff;}
  .pdp-sticky-qty-controls strong{text-align:center;color:var(--forest);font-size:16px;font-weight:950;font-family:var(--font-head);}
  .pdp-sticky-cod-btn{min-height:56px;border-radius:16px;background:linear-gradient(135deg,#164b35 0%,#0e3325 54%,#1f6c4c 100%);color:#fff;display:grid;grid-template-columns:auto auto auto;align-items:center;justify-content:center;gap:10px;padding:0 22px;border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 44px rgba(27,67,50,.35),inset 0 1px 0 rgba(255,255,255,.2);font-weight:950;letter-spacing:.01em;animation:forestCodShake 1.38s cubic-bezier(.2,.8,.2,1) infinite;overflow:hidden;position:relative;}
  .pdp-sticky-cod-btn::after{content:"";position:absolute;inset:-50% auto -50% -34%;width:28%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:stickyCodShine 2.4s ease-in-out infinite;pointer-events:none;}
  .pdp-sticky-cod-btn span{font-size:16px;text-transform:uppercase;}
  .pdp-sticky-cod-btn strong{font-size:18px;color:#f5d76e;font-family:var(--font-head);}
  .pdp-sticky-cod-btn em{font-style:normal;font-size:12px;color:rgba(255,255,255,.78);font-weight:900;}
  .pdp-sticky-cod-btn:hover{filter:saturate(1.08) brightness(1.03);box-shadow:0 24px 58px rgba(27,67,50,.46),inset 0 1px 0 rgba(255,255,255,.24);}
  @keyframes forestCodShake{
    0%,48%,100%{transform:translate3d(0,0,0) scale(1);}
    55%{transform:translate3d(-12px,-4px,0) rotate(-1.2deg) scale(1.035);}
    61%{transform:translate3d(12px,3px,0) rotate(1.2deg) scale(1.04);}
    67%{transform:translate3d(-9px,4px,0) rotate(-.8deg) scale(1.025);}
    73%{transform:translate3d(9px,-5px,0) rotate(.8deg) scale(1.035);}
    81%{transform:translate3d(0,-7px,0) scale(1.045);}
    90%{transform:translate3d(0,0,0) scale(1);}
  }
  @keyframes stickyCodShine{
    0%,54%{left:-38%;opacity:0;}
    68%{opacity:.65;}
    100%{left:122%;opacity:0;}
  }
  @keyframes pdpDealPulse{
    0%,100%{transform:translateY(0) scale(1);box-shadow:0 18px 44px rgba(27,67,50,.24),inset 0 1px 0 rgba(255,255,255,.2);}
    50%{transform:translateY(-1px) scale(1.01);box-shadow:0 22px 54px rgba(27,67,50,.32),inset 0 1px 0 rgba(255,255,255,.24);}
  }
  @keyframes pdpDealSweep{
    0%,48%{transform:translateX(-120%) skewX(-15deg);opacity:0;}
    62%{opacity:1;}
    100%{transform:translateX(130%) skewX(-15deg);opacity:0;}
  }

  /* --- PDP mobile/tablet hardening: prevents gallery/info overlap on real phones --- */
  @media(max-width:1024px){
    .pdp{
      display:flex !important;
      flex-direction:column !important;
      grid-template-columns:1fr !important;
      gap:18px !important;
      width:100% !important;
      max-width:100vw !important;
      overflow:visible !important;
    }
    .pdp-mobile-head{
      display:block !important;
      order:0;
      width:100%;
      padding:0 2px 2px;
    }
    .pdp-mobile-head>.pdp-cat{
      display:none !important;
    }
    .pdp-mobile-head .pdp-cat{
      font-size:11px;
      line-height:1.2;
      margin-bottom:7px;
      color:var(--forest);
    }
    .pdp-mobile-head .pdp-title{
      font-size:clamp(28px,8.6vw,44px);
      line-height:1.05;
      margin:0;
      color:var(--forest);
      letter-spacing:-.045em;
      overflow-wrap:anywhere;
    }
    .pdp-gallery{
      order:1;
      position:static !important;
      display:flex !important;
      flex-direction:column !important;
      gap:12px !important;
      width:100% !important;
      overflow:visible !important;
      transform:none !important;
      opacity:1 !important;
    }
    .pdp-main-box{
      width:100%;
      max-height:min(58vh,560px) !important;
      border-radius:18px !important;
      aspect-ratio:4 / 3 !important;
      display:grid !important;
      place-items:center !important;
      overflow:hidden !important;
    }
    .pdp-main-img,.pdp-video{width:100% !important;height:100% !important;object-fit:contain !important;}
    .pdp-main-box-video{
      aspect-ratio:var(--pdp-media-aspect,9 / 16) !important;
      max-height:min(66svh,620px) !important;
      min-height:420px !important;
      background:#0e1712 !important;
    }
    .pdp-thumbs{
      width:100%;
      gap:9px !important;
      overflow-x:auto !important;
      padding:2px 0 6px !important;
    }
    .pdp-thumb{
      width:70px !important;
      height:70px !important;
      border-radius:16px !important;
    }
    .pdp-trust-lines{
      position:relative !important;
      z-index:1;
      width:100% !important;
      margin:4px 0 0 !important;
      padding:16px 16px !important;
      gap:11px !important;
      border-radius:18px !important;
      background:#fff !important;
      box-shadow:0 14px 34px rgba(27,67,50,.08);
    }
    .tl-item{
      font-size:14px !important;
      line-height:1.38 !important;
      color:#5f6262 !important;
      overflow-wrap:anywhere;
    }
    .pdp-info{
      order:2;
      display:flex !important;
      flex-direction:column !important;
      gap:14px !important;
      width:100% !important;
      padding:14px 0 0 !important;
      overflow:visible !important;
      transform:none !important;
      opacity:1 !important;
      clear:both;
    }
    .pdp-info>.pdp-cat,
    .pdp-info>.pdp-title,
    .pdp-info>.pdp-deal-alert,
    .pdp-info>.pdp-title-trust{
      display:none !important;
    }
    .pdp-rating-row{
      display:grid !important;
      grid-template-columns:auto minmax(0,1fr);
      align-items:center;
      gap:8px 10px !important;
      width:100%;
      margin:0 !important;
      padding:0 !important;
      position:relative;
      z-index:2;
    }
    .pdp-rating-row .stars{
      white-space:nowrap;
    }
    .pdp-rv{
      min-width:0;
      font-size:14px !important;
      line-height:1.35;
      overflow-wrap:anywhere;
    }
    .pdp-verified{
      grid-column:1 / -1;
      justify-self:start;
      font-size:13px !important;
      padding:8px 14px !important;
    }
    .pdp-trust-badges{
      display:grid !important;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:8px !important;
      width:100%;
    }
    .pdp-trust-badges span{
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      text-align:center;
      line-height:1.15;
      padding:8px 6px !important;
      font-size:12px !important;
      white-space:normal;
    }
    .pdp-price-row{
      display:grid !important;
      grid-template-columns:auto minmax(0,1fr);
      align-items:end;
      gap:6px 12px !important;
      width:100%;
    }
    .pdp-price{
      font-size:clamp(34px,11vw,50px) !important;
      line-height:1 !important;
      letter-spacing:-.045em;
    }
    .pdp-old{
      font-size:clamp(19px,5.8vw,28px) !important;
      line-height:1.1;
      min-width:0;
    }
    .pdp-save{
      grid-column:1 / -1;
      justify-self:start;
      font-size:13px !important;
      padding:9px 14px !important;
      line-height:1.2;
    }
    .pdp-sticky-orderbar{
      width:min(720px,calc(100vw - 20px));
      grid-template-columns:minmax(150px,210px) minmax(0,1fr);
      gap:8px;
      padding:10px;
      border-radius:18px;
      bottom:10px;
    }
    .pdp-sticky-cod-btn{
      min-height:52px;
      padding:0 14px;
      gap:7px;
      grid-template-columns:auto auto;
    }
    .pdp-sticky-cod-btn em{grid-column:1 / -1;font-size:10px;margin-top:-4px;}
  }

  @media(max-width:480px){
    .sf-kicker,
    .sf-hero-trust{
      display:none !important;
    }
    .sf-hero{
      padding-top:22px !important;
      gap:14px !important;
    }
    .sf-hero h1{
      margin-bottom:10px !important;
      font-size:clamp(2.1rem,10vw,2.85rem) !important;
    }
    .sf-hero p{
      margin-bottom:14px !important;
      line-height:1.5 !important;
    }
    .sf-hero-actions{
      margin-bottom:0 !important;
    }
    .sf-hero-showcase{
      min-height:440px !important;
      padding-top:58px !important;
    }
    .sf-hero-product{
      min-height:320px !important;
    }
    .sf-hero-product-img{
      max-height:270px !important;
    }
    video.sf-hero-product-img{
      height:270px !important;
    }
    .pdp-page>.sec{
      padding-top:8px !important;
    }
    .pdp{
      gap:10px !important;
    }
    .pdp-mobile-head{padding-bottom:0 !important;}
    .pdp-mobile-head .pdp-title{font-size:clamp(23px,7.6vw,31px);line-height:1.02;}
    .pdp-deal-alert{
      grid-template-columns:auto minmax(0,1fr) auto;
      gap:7px;
      padding:10px;
      border-radius:16px;
      margin:0 0 10px;
    }
    .pdp-deal-icon{width:32px;height:32px;font-size:16px;}
    .pdp-deal-main{font-size:16px;}
    .pdp-deal-sub{grid-column:2 / 3;font-size:10px;line-height:1.1;}
    .pdp-deal-timer{grid-column:1 / -1;justify-self:stretch;justify-content:space-between;min-height:32px;padding:4px 10px;}
    .pdp-deal-timer span{font-size:9px;}
    .pdp-deal-timer strong{font-size:16px;}
    .pdp-deal-sale{grid-column:3 / 4;grid-row:1 / 3;min-height:30px;padding:0 10px;font-size:10px;}
    .pdp-title-trust{gap:6px;margin-top:10px;}
    .pdp-sale-sticker{min-height:28px;padding:0 12px;font-size:11px;}
    .pdp-half-stars{font-size:16px;}
    .pdp-trusted-word{min-height:28px;padding:0 10px;font-size:11px;}
    .pdp-trust-lines{padding:15px 14px !important;}
    .pdp-gallery{gap:10px !important;padding-bottom:134px !important;}
    .pdp-main-box{aspect-ratio:1 / 1 !important;max-height:calc(100svh - 430px) !important;min-height:250px !important;}
    .pdp-main-box-video{aspect-ratio:var(--pdp-media-aspect,9 / 16) !important;max-height:none !important;min-height:0 !important;}
    .pdp-off-badge{top:10px !important;left:10px !important;padding:7px 12px !important;border-radius:12px !important;font-size:12px !important;}
    .tl-item{font-size:13.5px !important;}
    .pdp-trust-badges{grid-template-columns:1fr 1fr;}
    .pdp-trust-badges span:last-child{grid-column:1 / -1;}
    .pdp-price-row{grid-template-columns:1fr;}
    .pdp-old,.pdp-save{justify-self:start;}
    .pdp-page{padding-bottom:152px;}
    .pdp-sticky-orderbar{
      width:calc(100vw - 16px);
      grid-template-columns:112px minmax(0,1fr);
      gap:7px;
      padding:8px;
      border-radius:18px;
      bottom:8px;
    }
    .pdp-sticky-qty{display:grid;grid-template-columns:1fr;justify-items:center;gap:4px;padding:7px 6px;border-radius:14px;}
    .pdp-sticky-qty>span{font-size:9px;letter-spacing:.05em;}
    .pdp-sticky-qty-controls{grid-template-columns:27px 28px 27px;}
    .pdp-sticky-qty-controls button{height:28px;font-size:17px;}
    .pdp-sticky-qty-controls strong{width:auto;font-size:14px;}
    .pdp-sticky-cod-btn{min-height:58px;width:100%;grid-template-columns:auto auto;gap:6px;padding:0 8px;border-radius:15px;}
    .pdp-sticky-cod-btn span{font-size:13px;}
    .pdp-sticky-cod-btn strong{font-size:15px;}
    .pdp-sticky-cod-btn em{font-size:9px;}
  }

  @media(max-width:640px){
    .pdp-page{
      margin-top:0 !important;
      padding-top:0 !important;
    }
    .pdp-page>.sec{
      padding-top:0 !important;
      margin-top:0 !important;
    }
    .pdp{
      margin-top:0 !important;
    }
    .pdp-mobile-head{
      margin-top:0 !important;
      padding-top:0 !important;
    }
    .pdp-deal-alert{
      margin-top:0 !important;
    }
    .pdp-main-box-video .pdp-video{
      object-fit:contain !important;
      object-position:center center !important;
      transform:none !important;
    }
  }

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important;transition-duration:.001ms !important;}
    .premium-reveal{opacity:1 !important;transform:none !important;filter:none !important;}
  }
`;
// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const page = pageFromPath(location.pathname);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [coupons, setCoupons] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoading(false), 750);
    return () => clearTimeout(timer);
  }, []);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [toast, setToast] = useState({ message: "", visible: false });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);
  useEffect(() => {
    async function loadAll() {
      try {
        // Keep storefront visitors logged out by default; admins must log in manually per session.
        try {
          await supabase.auth.signOut();
        } catch (authErr) {
          console.warn("Could not clear saved auth session:", authErr);
        }
        setCurrentUser(null);

        const [prods, ords, sett, coups, faqItems] = await Promise.all([
          getProducts(),
          getOrders(),
          getSettings(),
          getCoupons(),
          getFaqs(),
        ]);
        setProducts(normalizeProducts(prods || []));
        setOrders(ords || []);
        if (sett) {
          // Normalize snake_case from DB to camelCase for UI
          const normalized = {
            ...DEFAULT_SETTINGS,
            ...sett,
            storeName: sett.store_name || sett.storeName || DEFAULT_SETTINGS.storeName,
            heroTitle: sett.hero_title || sett.heroTitle || DEFAULT_SETTINGS.heroTitle,
            whatsappNumber: sett.whatsapp_number || sett.whatsappNumber || DEFAULT_SETTINGS.whatsappNumber,
            supportEmail: sett.support_email || sett.supportEmail || DEFAULT_SETTINGS.supportEmail,
            shippingFee: sett.shipping_fee ?? sett.shippingFee ?? DEFAULT_SETTINGS.shippingFee,
            freeShippingThreshold: sett.free_shipping_threshold ?? sett.freeShippingThreshold ?? DEFAULT_SETTINGS.freeShippingThreshold,
            heroSubtitle: sett.hero_subtitle || sett.heroSubtitle || DEFAULT_SETTINGS.heroSubtitle,
            announcement: sett.announcement || DEFAULT_SETTINGS.announcement,
          };
          setSettings(normalized);
        }
        setCoupons(coups || []);
        setFaqs(faqItems || []);
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const openCategory = useCallback((category) => {
    setSearch("");
    routerNavigate(pagePath("shop", { category: category || "All" }));
  }, [routerNavigate]);

  const showToast = useCallback((msg) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast({ message: msg, visible: false }), 2500);
  }, []);

  const openProduct = useCallback((product) => {
    if (product) routerNavigate(productPath(product));
  }, [routerNavigate]);

  const addToCart = useCallback((product, qty = 1, variant = null, unitPrice = null) => {
    const price = unitPrice || variant?.price || product.price;
    const id = uid("ci");
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id && i.variantLabel === (variant?.label || "Default"));
      if (existing) return prev.map(i => i.productId === product.id && i.variantLabel === (variant?.label || "Default") ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id, productId: product.id, name: product.name, image: product.images?.[0], price, qty, variantLabel: variant?.label || "Default" }];
    });
    showToast(`${product.name} added to cart!`);
  }, [showToast]);

  const buyNow = useCallback((product, qty = 1, variant = null, unitPrice = null) => {
    addToCart(product, qty, variant, unitPrice);
    routerNavigate(pagePath("checkout"));
  }, [addToCart, routerNavigate]);

  const updateCartQty = useCallback((id, qty) => {
    if (qty < 1) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  }, []);

  const removeFromCart = useCallback((id) => setCart(prev => prev.filter(i => i.id !== id)), []);

  const toggleWishlist = useCallback((productId) => {
    setWishlist(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  }, []);

  const subtotal = (cart || []).reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.qty || 0),
    0
  );
  const freeShippingThreshold = Number(
    settings?.free_shipping_threshold ?? settings?.freeShippingThreshold ?? 3000
  );
  const shippingFee = Number(settings?.shipping_fee ?? settings?.shippingFee ?? 199);
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingFee;
  const total = subtotal + shipping;
  const wishlistItems = products.filter((p) => wishlist.includes(p.id));



  const placeOrder = useCallback(async (form) => {
    if (!form.name || !form.phone || !form.city || !form.address) {
      showToast("Please fill all required fields!"); return;
    }

    let finalDiscount = 0;
    if (form.coupon) {
      const coupon = coupons.find(c => c.code.toUpperCase() === form.coupon.toUpperCase());
      if (coupon) {
        finalDiscount = coupon.type === "percent" ? (subtotal * coupon.value / 100) : coupon.value;
      }
    }

    const order = {
      order_id: `ISO-${Date.now().toString().slice(-6)}`,
      customer: form,
      items: cart,
      subtotal,
      shipping,
      discount: finalDiscount,
      total: Math.max(0, total - finalDiscount),
      status: "Pending",
    };
    try {
      const saved = await apiPlaceOrder(order);
      setOrders(prev => [saved, ...prev]);
      setLastOrder(saved);
      setCart([]);
      routerNavigate(pagePath("confirmation"));
    } catch (err) {
      showToast("Failed to place order. Try again.");
      console.error(err);
    }
  }, [cart, subtotal, shipping, total, coupons, showToast, routerNavigate]);



  const addProduct = useCallback(async (form) => {
    if (!form.name) return;

    try {
      const data = await apiAddProduct(productFormToSupabasePayload(form));
      setProducts(prev => [normalizeProduct(data), ...prev]);
      showToast("Product added!");
    } catch (err) {
      console.error(err);
      showToast("Failed to add product");
    }
  }, [showToast]);

  const updateProduct = useCallback(async (id, form) => {
    if (!id || !form.name) return;
    try {
      const data = await apiUpdateProduct(id, productFormToSupabasePayload(form));
      const normalized = normalizeProduct(data);
      setProducts(prev => prev.map(p => p.id === id ? normalized : p));
      showToast("Product updated in Supabase.");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update product.");
      throw err;
    }
  }, [showToast]);

  const deleteProduct = useCallback(async (id) => {
    try {
      await apiDeleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast("Product deleted.");
    } catch (err) {
      showToast("Failed to delete product.");
      console.error(err);
    }
  }, [showToast]);

  const updateOrderStatus = useCallback(async (orderId, status) => {
    try {
      await apiUpdateOrderStatus(orderId, status);
      setOrders(prev => prev.map(o => (o.id === orderId || o.order_id === orderId || o.orderId === orderId) ? { ...o, status } : o));
      showToast(`Order status updated to ${status}`);
    } catch (err) {
      showToast("Failed to update order.");
      console.error(err);
    }
  }, [showToast]);

  const handleSaveSettings = useCallback(async (newSettings) => {
    try {
      // Map to snake_case for Supabase
      const mapped = {
        store_name: newSettings.storeName,
        hero_title: newSettings.heroTitle,
        whatsapp_number: newSettings.whatsappNumber,
        support_email: newSettings.supportEmail,
        shipping_fee: Number(newSettings.shippingFee),
        free_shipping_threshold: Number(newSettings.freeShippingThreshold),
        announcement: newSettings.announcement,
        hero_subtitle: newSettings.heroSubtitle,
        sale_ends_at: newSettings.saleEndsAt
      };

      const saved = await updateSettings(mapped);

      // Merge saved with newSettings to ensure all fields (camelCase and snake_case) are available
      setSettings(prev => ({ ...prev, ...newSettings, ...saved }));
      showToast("Settings saved successfully!");
    } catch (err) {
      showToast("Failed to save settings. Please check table schema.");
      console.error(err);
      throw err;
    }
  }, [showToast]);



  const isReady = !loading && !minLoading;
  return (
    <>
      <style>{CSS}</style>
      <SplashLoader ready={isReady} />

      <div style={{ opacity: isReady ? 1 : 0, transition: "opacity 0.25s ease" }}>
        <PageTransition trigger={`${location.key}-${location.pathname}-${location.search}`} />
        <Header settings={settings} page={page} search={search} setSearch={setSearch} cartCount={cart.reduce((s, i) => s + i.qty, 0)} wishlistCount={wishlist.length} currentUser={currentUser} onCategorySelect={openCategory} onLogout={async () => {
          await supabase.auth.signOut();
          setCurrentUser(null);
        }} />


        <Routes>
          <Route path="/" element={<HomePage products={products} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} onCategorySelect={openCategory} onAdminAccess={() => setShowAuth(true)} />} />
          <Route path="/shop" element={<ShopPage products={products} search={search} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} />} />
          <Route path="/product/:slug" element={<ProductRoutePage settings={settings} products={products} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} buyNow={buyNow} />} />
          <Route path="/wishlist" element={<WishlistPage items={wishlistItems} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} />} />
          <Route path="/cart" element={<CartPage cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} subtotal={subtotal} shipping={shipping} total={total} />} />
          <Route path="/checkout" element={<CheckoutPage cart={cart} subtotal={subtotal} shipping={shipping} total={total} placeOrder={placeOrder} coupons={coupons} />} />
          <Route path="/confirmation" element={<ConfirmationPage order={lastOrder} />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage settings={settings} />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/returns" element={<ReturnPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/faq" element={<FAQPage faqs={faqs} />} />
          <Route path="/track-order" element={<TrackOrderPage settings={settings} />} />
          <Route path="/admin" element={<AdminPage products={products} orders={orders} settings={settings} saveSettings={handleSaveSettings} coupons={coupons} setCoupons={setCoupons} faqs={faqs} setFaqs={setFaqs} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} updateOrderStatus={updateOrderStatus} currentUser={currentUser} onOpenAdminAuth={() => setShowAuth(true)} showToast={showToast} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <PremiumMotionLayer page={page} />
        <SiteFooter />
        <WhatsAppFloat number={settings.whatsappNumber} />
        <LiveActivityFeed products={products} />
        <Toast message={toast.message} visible={toast.visible} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={(user) => { setCurrentUser(user); showToast(`Welcome, ${user.name}!`); }} />}
      </div>
    </>
  );
}
