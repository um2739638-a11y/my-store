// v2 - updated

import { supabase } from "./lib/supabase";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { getProducts, getOrders, getSettings, getCoupons, getFaqs, addProduct as apiAddProduct, deleteProduct as apiDeleteProduct, placeOrder as apiPlaceOrder, updateOrderStatus as apiUpdateOrderStatus } from "./lib/api";




function getCountdownTarget() {
  const now = new Date();
  const target = new Date();
  target.setDate(now.getDate() + 2);
  target.setHours(23, 59, 59, 999);
  return target.toISOString();
}

const DEFAULT_SETTINGS = {
  storeName: "ISmallOne",
  heroTitle: "Pakistan's #1 Trending Gadgets & Lifestyle Store",
  heroSubtitle:
    "Premium products, fast delivery across Pakistan, and cash on delivery available. Trusted by 10,000+ happy customers.",
  announcement: "FREE DELIVERY ON ORDERS ABOVE Rs 3,000  •  CASH ON DELIVERY AVAILABLE  •  LIMITED TIME DEALS",
  supportEmail: "support@ISmallOne.shop",
  whatsappNumber: "923008631809",
  shippingFee: 199,
  freeShippingThreshold: 3000,
  saleEndsAt: getCountdownTarget(),
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
}
function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}
function slugify(text = "") {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
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
function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-PK", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function buildStars(rating = 0) {
  const rounded = Math.round(rating);
  return [1, 2, 3, 4, 5].map((n) => n <= rounded);
}
function averageRating(reviews = []) {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length;
}
const CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar", "Quetta", "Hyderabad", "Gujranwala", "Sialkot", "Bahawalpur"];
const LIVE_NAMES = ["Ayesha", "Bilal", "Hamza", "Sana", "Usman", "Mariam", "Ali", "Fatima", "Hassan", "Sara", "Ahmed", "Zara", "Omar", "Hina", "Tariq", "Nadia"];
const LIVE_ACTIONS = ["just ordered", "added to cart", "is viewing", "just bought"];
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
function findProductBySlug(products, slug) { return products.find((item) => item.slug === slug) || null; }

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
  else if (str.includes("+")) display = count + "+";
  else if (str.includes("d")) display = count + "d";
  return <span ref={ref}>{display}{str.includes("★") ? " ★" : ""}{str.includes("/5") ? "/5" : ""}</span>;
}

// ─── PAGE TRANSITION — ISO LOGO + WHITE LINE ──────────────────────────────────
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

// ─── LIVE ACTIVITY FEED ───────────────────────────────────────────────────────
function LiveActivityFeed({ products }) {
  const [visible, setVisible] = useState(null);
  useEffect(() => {
    const generate = () => {
      if (!products.length) return null;
      const p = products[Math.floor(Math.random() * products.length)];
      const name = LIVE_NAMES[Math.floor(Math.random() * LIVE_NAMES.length)];
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const action = LIVE_ACTIONS[Math.floor(Math.random() * LIVE_ACTIONS.length)];
      return { id: uid("act"), name, city, action, product: p.name, productImg: p.images?.[0] };
    };
    const show = () => { const act = generate(); if (!act) return; setVisible(act); setTimeout(() => setVisible(null), 4000); };
    show();
    const interval = setInterval(show, 7000);
    return () => clearInterval(interval);
  }, [products]);
  if (!visible) return null;
  return (
    <div className="live-feed-popup">
      <div className="live-feed-inner">
        <img src={visible.productImg} alt="" className="live-feed-img" />
        <div className="live-feed-text">
          <div className="live-feed-name"><span className="live-dot" /><strong>{visible.name}</strong> from <strong>{visible.city}</strong></div>
          <div className="live-feed-action">{visible.action} <span>{visible.product}</span></div>
          <div className="live-feed-time">⏱ just now</div>
        </div>
      </div>
    </div>
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
function AuthModal({ onClose, onLogin, isAdminLogin }) {
  const [mode, setMode] = useState(isAdminLogin ? "admin" : "login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [adminForm, setAdminForm] = useState({
    email: "",
    password: ""
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showAdminEmail, setShowAdminEmail] = useState(false);

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

  async function handleLogin(e) {
    e.preventDefault(); setErr("");
    if (!form.email || !form.password) { setErr("Please fill all fields."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setLoading(false);
    if (error) { setErr("Invalid email or password."); return; }
    onLogin({ id: data.user.id, name: data.user.user_metadata?.name || "Customer", email: data.user.email, role: "user" });
    onClose();
  }

  async function handleRegister(e) {
    e.preventDefault(); setErr("");
    if (!form.name || !form.email || !form.phone || !form.password || !form.confirm) { setErr("Please fill all fields."); return; }
    if (form.password !== form.confirm) { setErr("Passwords do not match."); return; }
    if (form.password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, phone: form.phone } }
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onLogin({ id: data.user.id, name: form.name, email: form.email, role: "user" });
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
            <p className="auth-sub-tag">10,000+ happy customers across Pakistan.</p>
            <div className="auth-perks">
              {["Cash on Delivery", "Fast 3–5 Day Delivery", "Easy Returns", "WhatsApp Support"].map(p => (
                <div key={p} className="auth-perk"><span className="auth-perk-check">✓</span>{p}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="auth-right">
          <button className="auth-close" onClick={onClose}>✕</button>
          {mode === "admin" ? (
            <>
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
              {!isAdminLogin && <div className="auth-switch">Not admin? <button onClick={() => { setMode("login"); setErr(""); }}>Customer Login</button></div>}
            </>
          ) : mode === "login" ? (
            <>
              <div className="auth-header"><h3 className="auth-title">Welcome Back</h3><p className="auth-desc">Sign in to your ISmallOne account</p></div>
              <form onSubmit={handleLogin} className="auth-form">
                <div className="auth-field-wrap"><label>Email Address</label><div className="auth-inp-wrap"><span className="auth-inp-ico">✉️</span><input className="auth-inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div></div>
                <div className="auth-field-wrap"><label>Password</label><div className="auth-inp-wrap"><span className="auth-inp-ico">🔒</span><input className="auth-inp" type={showPass ? "text" : "password"} placeholder="Enter your password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /><button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁️"}</button></div></div>
                {err && <div className="auth-err"><span>⚠️</span>{err}</div>}
                <button type="submit" className={`auth-submit ${loading ? "loading" : ""}`} disabled={loading}>{loading ? <span className="auth-spinner" /> : "Sign In →"}</button>
              </form>
              <div className="auth-divider"><span>or</span></div>
              <div className="auth-switch">New customer? <button onClick={() => { setMode("register"); setErr(""); }}>Create Account</button></div>
              <div className="auth-switch" style={{ marginTop: "8px" }}>Admin? <button onClick={() => { setMode("admin"); setErr(""); }}>Admin Login</button></div>
            </>
          ) : (
            <>
              <div className="auth-header"><h3 className="auth-title">Create Account</h3><p className="auth-desc">Join 10,000+ happy customers</p></div>
              <form onSubmit={handleRegister} className="auth-form">
                <div className="auth-field-wrap"><label>Full Name</label><div className="auth-inp-wrap"><span className="auth-inp-ico">👤</span><input className="auth-inp" placeholder="Your full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div></div>
                <div className="auth-field-wrap"><label>Email Address</label><div className="auth-inp-wrap"><span className="auth-inp-ico">✉️</span><input className="auth-inp" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div></div>
                <div className="auth-field-wrap"><label>Phone Number</label><div className="auth-inp-wrap"><span className="auth-inp-ico">📱</span><input className="auth-inp" placeholder="+92 300 0000000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div></div>
                <div className="auth-2col">
                  <div className="auth-field-wrap"><label>Password</label><div className="auth-inp-wrap"><span className="auth-inp-ico">🔒</span><input className="auth-inp" type={showPass ? "text" : "password"} placeholder="Min 6 chars" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /><button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁️"}</button></div></div>
                  <div className="auth-field-wrap"><label>Confirm</label><div className="auth-inp-wrap"><span className="auth-inp-ico">🔐</span><input className="auth-inp" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} /></div></div>
                </div>
                {err && <div className="auth-err"><span>⚠️</span>{err}</div>}
                <button type="submit" className={`auth-submit ${loading ? "loading" : ""}`} disabled={loading}>{loading ? <span className="auth-spinner" /> : "Create My Account →"}</button>
              </form>
              <div className="auth-switch">Already have an account? <button onClick={() => { setMode("login"); setErr(""); }}>Sign In</button></div>
            </>
          )}
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
      <div className="scarcity-top"><span>🔥 <strong>{stockLeft}</strong> items left</span><span>{soldCount}+ sold</span></div>
      <div className="scarcity-track"><div className="scarcity-bar" style={{ width: `${pct}%` }} /></div>
      <p className="scarcity-note">Hurry — sells out fast!</p>
    </div>
  );
}

// ─── ACCORDION ────────────────────────────────────────────────────────────────
function Accordion({ title, children, open: defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc">
      <button className="acc-head" onClick={() => setOpen(v => !v)}><span>{title}</span><span className="acc-ico">{open ? "−" : "+"}</span></button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

// ─── BUNDLE SELECTOR ──────────────────────────────────────────────────────────
function BundleSelector({ product, selectedBundle, onSelect }) {
  const basePrice = product.price;
  const comparePrice = product.compareAtPrice;
  const bundles = [
    { qty: 1, discountPct: 10, label: "Standard price" },
    { qty: 2, discountPct: 20, label: "Most popular", popular: true },
    { qty: 3, discountPct: 30, label: "Best value" },
  ];
  function bundlePrice(qty, discountPct) { return Math.round(basePrice * (1 - discountPct / 100)) * qty; }
  function bundleCompare(qty) { return comparePrice * qty; }
  return (
    <div className="bundle-wrap">
      <div className="bundle-header"><span className="bundle-title">⚡ Limited Time Offer</span></div>
      <div className="bundle-options">
        {bundles.map((b) => {
          const total = bundlePrice(b.qty, b.discountPct);
          const orig = bundleCompare(b.qty);
          const isSelected = selectedBundle?.qty === b.qty;
          return (
            <button key={b.qty} className={`bundle-option ${isSelected ? "bundle-selected" : ""} ${b.popular ? "bundle-popular" : ""}`} onClick={() => onSelect({ ...b, totalPrice: total, originalPrice: orig })}>
              {b.popular && <div className="bundle-popular-tag">⭐ Most Popular</div>}
              <div className="bundle-option-inner">
                <div className="bundle-radio"><div className={`bundle-radio-dot ${isSelected ? "active" : ""}`} /></div>
                <div className="bundle-qty-info"><span className="bundle-qty-label">{b.qty} Qty</span><span className="bundle-sub-label">{b.label}</span></div>
                <div className="bundle-discount-badge">{b.discountPct}% Off</div>
                <div className="bundle-price-info"><span className="bundle-price">{money(total)}</span><span className="bundle-orig-price">{money(orig)}</span></div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="bundle-footer"><span className="bundle-delivery">🚚 Free delivery</span><span className="bundle-total-label">Total: <strong>{money(selectedBundle?.totalPrice || bundlePrice(1, 10))}</strong></span></div>
    </div>
  );
}

// ─── BUY NOW BUTTON — auto-shakes every 1.5 seconds ──────────────────────────
function BuyNowButton({ onClick, label = "⚡ Buy It Now" }) {
  const [shaking, setShaking] = useState(false);
  const [ripples, setRipples] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { id, x, y }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700);
    onClick();
  };

  return (
    <button className={`pdp-buy-btn ${shaking ? "btn-shake" : ""}`} onClick={handleClick} style={{ position: "relative", overflow: "hidden" }}>
      {ripples.map(r => (<span key={r.id} className="btn-ripple" style={{ left: r.x, top: r.y }} />))}
      {label}
    </button>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ settings, page, setPage, search, setSearch, cartCount, wishlistCount, currentUser, onOpenAuth, onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

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

  const navTo = (p) => { setPage(p); setMobileMenuOpen(false); };

  return (
    <>
      <header className={`hdr ${scrolled ? "hdr-scrolled" : ""}`}>
        <div className="hdr-announce"><div className="hdr-announce-inner">{settings.announcement}</div></div>
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
            {[["home", "Home"], ["shop", "Shop"], ["about", "About"], ["contact", "Contact"]].map(([k, l]) => (
              <button key={k} className={`hdr-nav-btn ${page === k ? "active" : ""}`} onClick={() => navTo(k)}>{l}</button>
            ))}
            {currentUser?.role === "admin" && (
              <button className={`hdr-nav-btn admin-nav-btn ${page === "admin" ? "active" : ""}`} onClick={() => navTo("admin")}>⚙️ Admin</button>
            )}
          </nav>
          <div className="hdr-right">
            <div className="hdr-search desktop-only">
              <span className="hdr-search-ico">⌕</span>
              <input className="hdr-search-inp" placeholder="Search products…" value={search} onChange={e => { setSearch(e.target.value); setPage("shop"); }} />
            </div>
            <button className="hdr-icon-btn mobile-only" onClick={() => setMobileSearchOpen(v => !v)} aria-label="Search">
              <span style={{ fontSize: "20px" }}>🔍</span>
            </button>
            <button className="hdr-wish-btn" onClick={() => navTo("wishlist")}>
              ♡{wishlistCount > 0 && <span className="hdr-badge">{wishlistCount}</span>}
            </button>
            <button className="hdr-cart-btn" onClick={() => navTo("cart")}>
              <span>🛒</span>
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
            ) : (
              <button className="hdr-login-btn" onClick={onOpenAuth}>
                <span className="hdr-login-ico">👤</span>
                <span className="desktop-only">Sign In</span>
              </button>
            )}
          </div>
        </div>
        {mobileSearchOpen && (
          <div className="mobile-search-bar">
            <span className="hdr-search-ico">⌕</span>
            <input className="hdr-search-inp" placeholder="Search products…" value={search} onChange={e => { setSearch(e.target.value); setPage("shop"); }} autoFocus />
            <button onClick={() => setMobileSearchOpen(false)} style={{ padding: "0 12px", color: "var(--muted)", fontSize: "18px" }}>✕</button>
          </div>
        )}
        <div className="hdr-cats desktop-only">
          {["Hair Care", "Smart Watches", "Home Decor", "Projectors", "Home Essentials", "Summer Deals", "New Arrivals", "Best Sellers", "Flash Deals", "Accessories", "Kitchen", "Gifts"].map(c => (
            <button key={c} className="hdr-cat" onClick={() => navTo("shop")}>{c}</button>
          ))}
        </div>
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
              {[["home", "🏠", "Home"], ["shop", "🛍️", "Shop All"], ["about", "ℹ️", "About Us"], ["contact", "📞", "Contact"]].map(([k, ico, l]) => (
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
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-section-title">Categories</div>
            <div className="mobile-cats-grid">
              {["Hair Care", "Smart Watches", "Home Decor", "Projectors", "Home Essentials", "Summer Deals"].map(c => (
                <button key={c} className="mobile-cat-chip" onClick={() => navTo("shop")}>{c}</button>
              ))}
            </div>
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-section-title">Account</div>
            <nav className="mobile-nav">
              {currentUser ? (
                <>
                  <button className="mobile-nav-btn" onClick={() => navTo("cart")}><span>🛒</span><span>My Cart ({cartCount})</span><span className="mobile-nav-arrow">›</span></button>
                  <button className="mobile-nav-btn" onClick={() => navTo("wishlist")}><span>♡</span><span>Wishlist ({wishlistCount})</span><span className="mobile-nav-arrow">›</span></button>
                  <button className="mobile-nav-btn" style={{ color: "#dc2626" }} onClick={() => { onLogout(); setMobileMenuOpen(false); }}><span>🚪</span><span>Sign Out</span><span className="mobile-nav-arrow">›</span></button>
                </>
              ) : (
                <button className="mobile-nav-btn" onClick={() => { onOpenAuth(); setMobileMenuOpen(false); }}><span>👤</span><span>Sign In / Register</span><span className="mobile-nav-arrow">›</span></button>
              )}
            </nav>
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

// ─── HERO BANNER ──────────────────────────────────────────────────────────────
function HeroBanner({ settings, openProduct, products }) {
  const featured = products.filter(p => p.featured);
  const [idx, setIdx] = useState(0);
  const [animState, setAnimState] = useState("visible");

  useEffect(() => {
    const t = setInterval(() => {
      setAnimState("exit");
      setTimeout(() => { setIdx(i => (i + 1) % Math.max(1, featured.length)); setAnimState("enter"); setTimeout(() => setAnimState("visible"), 400); }, 350);
    }, 2800);
    return () => clearInterval(t);
  }, [featured.length]);

  const goTo = (i) => {
    if (i === idx) return;
    setAnimState("exit");
    setTimeout(() => { setIdx(i); setAnimState("enter"); setTimeout(() => setAnimState("visible"), 400); }, 350);
  };

  const hero = featured[idx] || products[0];
  const off = percentageOff(hero?.price, hero?.compareAtPrice);

  return (
    <section className="hero">
      <div className="hero-bg-shape hero-bg-shape-1" />
      <div className="hero-bg-shape hero-bg-shape-2" />
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="hero-pill"><span className="hero-dot-pulse"></span>Pakistan's #1 Gadget Store</div>
          <h1 className="hero-h1">Gadgets That <span className="hero-h1-accent">Elevate</span><br />Your Lifestyle</h1>
          <p className="hero-p">{settings.heroSubtitle}</p>
          <div className="hero-trust">
            <span className="hero-trust-item">✓ Cash on Delivery</span>
            <span className="hero-trust-item">✓ 3–5 Day Delivery</span>
            <span className="hero-trust-item">✓ Easy Returns</span>
            <span className="hero-trust-item">✓ 10,000+ Customers</span>
          </div>
          <div className="hero-btns">
            <button className="btn-red-lg hero-cta" onClick={() => openProduct(hero)}><span>Shop Best Sellers</span><span className="btn-arrow">→</span></button>
            <button className="btn-outline-lg">View All Deals</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><strong><AnimatedCounter target="10K+" duration={2000} /></strong><span>Happy Customers</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><strong><AnimatedCounter target="4.8" duration={1800} />★</strong><span>Avg Rating</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><strong><AnimatedCounter target="500+" duration={1600} /></strong><span>Daily Orders</span></div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat"><strong>3–5d</strong><span>Delivery</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className={`hero-img-card hero-card-anim hero-card-${animState}`}>
            {hero?.video ? (
              <video key={hero.video} src={hero.video} autoPlay muted loop playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <Product3DViewer images={hero?.images || []} productName={hero?.name || ""} />
            )}
            {off > 0 && <div className="hero-off-badge">-{off}%<br /><small>OFF</small></div>}
            <div className="hero-hot-badge">🔥 Trending</div>
            <div className="hero-float-card">
              <div className="hero-float-stars">★★★★★</div>
              <div className="hero-float-text">"Received in 3 days!"</div>
              <div className="hero-float-name">— Ayesha, Lahore</div>
            </div>
            <div className="hero-peek">
              <div className="hero-peek-info">
                <span className="hero-peek-name">{hero?.name}</span>
                <div className="hero-peek-prices">
                  <span className="hero-peek-price">{money(hero?.price)}</span>
                  {hero?.compareAtPrice > hero?.price && <span className="hero-peek-old">{money(hero?.compareAtPrice)}</span>}
                </div>
              </div>
              <button className="hero-peek-btn" onClick={() => openProduct(hero)}>View →</button>
            </div>
          </div>
          <div className="hero-dots">{featured.map((_, i) => (<button key={i} className={`hero-dot-btn ${i === idx ? "active" : ""}`} onClick={() => goTo(i)} />))}</div>
        </div>
      </div>
      <div className="hero-ribbon">
        <div className="hero-ribbon-track">
          {["🚚 Free delivery above Rs 3,000", "💵 Cash on Delivery", "🔄 Easy Returns", "⭐ 10,000+ Happy Customers", "📦 Fast Dispatch", "🇵🇰 Pakistan Wide", "🎁 Gift Wrapping Available", "🚚 Free delivery above Rs 3,000", "💵 Cash on Delivery", "🔄 Easy Returns", "⭐ 10,000+ Happy Customers", "📦 Fast Dispatch", "🇵🇰 Pakistan Wide", "🎁 Gift Wrapping Available"].map((s, i) => (
            <span key={i} className="hero-ribbon-item">{s}</span>
          ))}
        </div>
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
    { icon: "🛡️", title: "Buyer Protection", sub: "Full refund on damaged items", color: "#8b5cf6" },
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
function CategoryGrid({ setPage }) {
  const cats = [{ name: "Hair Care", emoji: "💆", color: "#FF6B9D", bg: "#fff0f6" }, { name: "Smart Watches", emoji: "⌚", color: "#4F7FFF", bg: "#f0f4ff" }, { name: "Home Decor", emoji: "🏠", color: "#9B59B6", bg: "#f8f0ff" }, { name: "Projectors", emoji: "📽️", color: "#27AE60", bg: "#f0fff5" }, { name: "Home Essentials", emoji: "🏡", color: "#E67E22", bg: "#fff8f0" }, { name: "Summer Deals", emoji: "☀️", color: "#E74C3C", bg: "#fff5f5" }];
  return (
    <section className="sec cat-sec">
      <div className="sec-head"><div className="eyebrow">Browse by Category</div><h2 className="sec-h2">Shop What You Love</h2><p className="sec-sub">Curated categories with Pakistan's best-selling products</p></div>
      <div className="cat-grid">
        {cats.map(c => (<button key={c.name} className="cat-card" style={{ "--cat-color": c.color, "--cat-bg": c.bg }} onClick={() => setPage("shop")}><div className="cat-icon-wrap"><span className="cat-emo">{c.emoji}</span></div><span className="cat-nm">{c.name}</span><span className="cat-arrow">→</span></button>))}
      </div>
    </section>
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
  const [show3d, setShow3d] = useState(false);

  return (
    <div className={`pcard ${isFlash ? "pcard-flash" : ""}`}
      onMouseEnter={() => { setHov(true); setTimeout(() => setShow3d(true), 200); }}
      onMouseLeave={() => { setHov(false); setShow3d(false); }}>
      <div className="pcard-img-wrap">
        {show3d ? (
          <Product3DViewer images={product.images || []} productName={product.name} />
        ) : (
          <button className="pcard-img-btn" onClick={() => onOpen(product)}><img className={`pcard-img ${hov ? "pcard-img-z" : ""}`} src={product.images?.[0]} alt={product.name} /></button>
        )}
        {off > 0 && <div className="pcard-sale-badge">-{off}%</div>}
        {product.trending && <div className="pcard-hot-badge">🔥 Hot</div>}
        <button className={`pcard-wish ${isWishlisted ? "wished" : ""}`} onClick={() => onToggleWishlist(product.id)}>{isWishlisted ? "♥" : "♡"}</button>
        {!show3d && <div className={`pcard-overlay ${hov ? "pcard-overlay-show" : ""}`}><button onClick={() => onOpen(product)}>Quick View</button></div>}
      </div>
      <div className="pcard-body">
        <div className="pcard-cat">{product.category}</div>
        <h3 className="pcard-name" onClick={() => onOpen(product)}>{product.name}</h3>
        <p className="pcard-desc">{product.shortDescription}</p>
        <div className="pcard-rating"><RatingStars rating={product.rating} /><span className="pcard-rv">{product.rating} ({product.reviewCount})</span></div>
        <div className="pcard-prices"><strong className="pcard-price">{money(product.price)}</strong>{product.compareAtPrice > product.price && <span className="pcard-old">{money(product.compareAtPrice)}</span>}</div>
        <div className="pcard-foot"><span className="pcard-stock">🔥 {product.stockLeft} left</span><button className="pcard-add" onClick={() => onAddToCart(product, 1, product.variants?.[0] || null)}>+ Cart</button></div>
      </div>
    </div>
  );
}

// ─── PRODUCT ROW ──────────────────────────────────────────────────────────────
function ProductRow({ title, eyebrow, products, openProduct, addToCart, wishlist, toggleWishlist }) {
  const ref = useRef(null);
  const scroll = dir => { if (ref.current) ref.current.scrollBy({ left: dir * 280, behavior: "smooth" }); };
  return (
    <section className="sec">
      <div className="row-hdr"><div><div className="eyebrow">{eyebrow}</div><h2 className="sec-h2">{title}</h2></div><div className="row-controls"><button className="row-arr" onClick={() => scroll(-1)}>‹</button><button className="row-arr" onClick={() => scroll(1)}>›</button><button className="view-all">View All →</button></div></div>
      <div className="hscroll" ref={ref}><div className="hscroll-inner">{products.map(p => (<div key={p.id} className="hscroll-item"><ProductCard product={p} onOpen={openProduct} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} isWishlisted={wishlist.includes(p.id)} /></div>))}</div></div>
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
          <div className="brand-img-wrap"><img className="brand-img" src={product?.images?.[0]} alt={product?.name} />{off > 0 && <div className="brand-save">Save {off}%</div>}</div>
          <div className="brand-prod-row"><strong>{product?.name}</strong><span>{money(product?.price)}</span></div>
        </div>
      </div>
    </section>
  );
}

// ─── PROMO STRIP ──────────────────────────────────────────────────────────────
function PromoStrip({ setPage }) {
  return (
    <section className="promo-strip">
      <div className="promo-card promo-card-1"><div className="promo-content"><span className="promo-tag">Summer 2026</span><h3>Beat the Heat</h3><p>Up to 40% off on cooling gadgets</p><button className="promo-btn" onClick={() => setPage("shop")}>Shop Now →</button></div><span className="promo-emoji">☀️</span></div>
      <div className="promo-card promo-card-2"><div className="promo-content"><span className="promo-tag">New Arrivals</span><h3>Smart Watch Season</h3><p>Latest models, best prices in PK</p><button className="promo-btn" onClick={() => setPage("shop")}>Explore →</button></div><span className="promo-emoji">⌚</span></div>
      <div className="promo-card promo-card-3"><div className="promo-content"><span className="promo-tag">COD Available</span><h3>Order With Confidence</h3><p>Pay only when you receive</p><button className="promo-btn" onClick={() => setPage("shop")}>Order Now →</button></div><span className="promo-emoji">📦</span></div>
    </section>
  );
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
function Testimonials() {
  const data = [{ name: "Ayesha K.", city: "Lahore", text: "Super fast delivery! Product was exactly as shown. Will order again.", rating: 5 }, { name: "Muhammad B.", city: "Karachi", text: "Best online store in Pakistan. COD made it easy and WhatsApp support is amazing.", rating: 5 }, { name: "Sana A.", city: "Islamabad", text: "Got a great deal on the smartwatch. Quality exceeded my expectations!", rating: 5 }, { name: "Hamza R.", city: "Faisalabad", text: "Packaging was excellent. Arrived in perfect condition within 4 days.", rating: 4 }, { name: "Fatima M.", city: "Rawalpindi", text: "Ordered the moon lamp as a gift — recipient loved it!", rating: 5 }, { name: "Ali Z.", city: "Multan", text: "Top-notch store. Fair prices and smooth checkout. Highly recommend!", rating: 5 }];
  return (
    <section className="testi-sec">
      <div className="sec-head sec-centered"><div className="eyebrow">What Customers Say</div><h2 className="sec-h2">Loved Across Pakistan 🇵🇰</h2><p className="sec-sub sec-sub-center">Real reviews from real customers across every city</p></div>
      <div className="testi-grid">{data.map((r, i) => (<div key={i} className="testi-card"><div className="testi-quote">"</div><RatingStars rating={r.rating} size="md" /><p className="testi-text">{r.text}</p><div className="testi-author"><div className="testi-av">{r.name[0]}</div><div className="testi-author-info"><strong>{r.name}</strong><span>📍 {r.city}</span></div></div></div>))}</div>
    </section>
  );
}

// ─── STATS SECTION ────────────────────────────────────────────────────────────
function StatsSection() {
  const stats = [{ num: "10K+", label: "Happy Customers", ico: "😊" }, { num: "500+", label: "Daily Orders", ico: "📦" }, { num: "4.8", label: "Average Rating", ico: "⭐" }, { num: "3", label: "Day Delivery", ico: "🚚" }, { num: "100", label: "% Authentic", ico: "✅" }, { num: "7", label: "Day Returns", ico: "🔄" }];
  return (
    <section className="stats-sec">
      <div className="stats-inner">
        <div className="sec-head sec-centered"><div className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>Our Numbers</div><h2 className="sec-h2" style={{ color: "white" }}>Pakistan Trusts ISmallOne</h2></div>
        <div className="stats-grid">{stats.map(s => (<div key={s.label} className="stat-card"><span className="stat-ico">{s.ico}</span><strong className="stat-num"><AnimatedCounter target={s.num} duration={2000} /></strong><span className="stat-label">{s.label}</span></div>))}</div>
      </div>
    </section>
  );
}

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────
function Newsletter() {
  return (
    <section className="nl-sec">
      <div className="nl-inner">
        <div className="nl-ico">🎁</div>
        <h2>Get Exclusive Deals First</h2>
        <p>Join 10,000+ smart shoppers. Flash sales, new arrivals, and WhatsApp-only deals.</p>
        <div className="nl-form"><input className="nl-inp" placeholder="Enter your phone number or email" /><button className="nl-btn">Subscribe & Save</button></div>
        <div className="nl-trust">✓ No spam  ·  ✓ Unsubscribe anytime  ·  ✓ Exclusive deals</div>
      </div>
    </section>
  );
}

// ─── SITE FOOTER ──────────────────────────────────────────────────────────────
function SiteFooter({ setPage }) {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="footer-logo"><span className="hdr-logo-mark">ISO</span><span className="footer-logo-txt">ISmallOne</span></div>
          <p>Pakistan's premier online gadget store. Quality products, fast delivery, trusted by thousands.</p>
          <div className="footer-socials"><a href="#" className="social-a">f</a><a href="#" className="social-a">ig</a><a href="#" className="social-a">wa</a></div>
        </div>
        <div className="footer-col"><h4>Quick Links</h4><button onClick={() => setPage("home")}>Home</button><button onClick={() => setPage("shop")}>Shop All</button><button onClick={() => setPage("about")}>About Us</button><button onClick={() => setPage("contact")}>Contact</button></div>
        <div className="footer-col"><h4>Customer Care</h4><button onClick={() => setPage("track-order")}>Track Your Order</button><button onClick={() => setPage("returns")}>Returns & Refunds</button><button onClick={() => setPage("shipping-policy")}>Shipping Policy</button><button onClick={() => setPage("privacy-policy")}>Privacy Policy</button><button onClick={() => setPage("faq")}>FAQs</button><button onClick={() => setPage("terms")}>Terms & Conditions</button></div>
        <div className="footer-col"><h4>Contact Us</h4><p>📱 +92 300 863 1809</p><p>✉️ support@ISmallOne</p><p>🕐 Mon–Sat, 10am–8pm</p><div className="footer-pays"><span>COD</span><span>JazzCash</span><span>Bank</span></div></div>
      </div>
      <div className="footer-bottom"><span>© 2026 ISmallOne PK. All rights reserved.</span><span>Made with ❤️ in Pakistan</span></div>
    </footer>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ settings, products, wishlist, toggleWishlist, openProduct, addToCart, setPage }) {
  const featured = products.filter(p => p.featured);
  const trending = products.filter(p => p.trending);
  const bestSellers = [...products].sort((a, b) => b.soldCount - a.soldCount);
  return (
    <main>
      <HeroBanner settings={settings} openProduct={openProduct} products={products} />
      <TickerBar />
      <TrustBar />
      <CategoryGrid setPage={setPage} />
      <FlashSale saleEndsAt={settings.saleEndsAt} products={trending} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      <ProductRow title="Featured Products" eyebrow="✨ Hand-picked for you" products={featured} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      <PromoStrip setPage={setPage} />
      <BrandBanner openProduct={openProduct} product={products[0]} />
      <ProductRow title="Trending Right Now" eyebrow="🔥 Pakistan's Favourites" products={trending} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      <CertificationsSection />
      <StatsSection />
      <section className="sec">
        <div className="sec-head"><div className="eyebrow">🏆 Best Sellers</div><h2 className="sec-h2">All Products</h2><p className="sec-sub">Our complete collection — sorted by popularity</p></div>
        <PGrid products={bestSellers} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} />
      </section>
      <Testimonials />
      <Newsletter />
    </main>
  );
}

// ─── SHOP PAGE ────────────────────────────────────────────────────────────────
function ShopPage({ products, search, wishlist, toggleWishlist, openProduct, addToCart }) {
  const [sortBy, setSortBy] = useState("featured");
  const [cat, setCat] = useState("All");
  const cats = ["All", "Hair Care", "Smart Watches", "Home Decor", "Projectors", "Home Essentials", "Summer Deals"];
  const filtered = useMemo(() => {
    let list = [...products];
    if (search.trim()) list = list.filter(p => [p.name, p.category, p.shortDescription].join(" ").toLowerCase().includes(search.toLowerCase()));
    if (cat !== "All") list = list.filter(p => p.category === cat);
    if (sortBy === "price-low") list.sort((a, b) => a.price - b.price);
    if (sortBy === "price-high") list.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sortBy === "sold") list.sort((a, b) => b.soldCount - a.soldCount);
    return list;
  }, [products, search, cat, sortBy]);
  return (
    <main>
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
function ProductPage({ settings, product, addToCart, buyNow }) {
  const hasVideo = !!product.video;
  const mediaItems = [
    ...(hasVideo ? [{ type: "video", src: product.video }] : []),
    ...(product.images || []).map(src => ({ type: "image", src })),
  ];
  const [mediaIdx, setMediaIdx] = useState(0);
  const [variant, setVariant] = useState(product.variants?.[0] || null);
  const [show3d, setShow3d] = useState(false);
  const defaultBundle = { qty: 2, discountPct: 20, label: "Most popular", popular: true, totalPrice: Math.round(product.price * 0.8) * 2, originalPrice: product.compareAtPrice * 2 };
  const [selectedBundle, setSelectedBundle] = useState(defaultBundle);
  const autoSlideRef = useRef(null);

  useEffect(() => {
    setMediaIdx(0);
    setVariant(product.variants?.[0] || null);
    setSelectedBundle(defaultBundle);
    setShow3d(false);
  }, [product.id]);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (mediaItems.length <= 1) return;
    autoSlideRef.current = setInterval(() => {
      setMediaIdx(i => (i + 1) % mediaItems.length);
    }, 4000);
    return () => clearInterval(autoSlideRef.current);
  }, [product.id, mediaItems.length]);

  const off = percentageOff(product.price, product.compareAtPrice);
  const viewNow = 18 + (product.soldCount % 31);
  const effectiveUnitPrice = selectedBundle ? Math.round(product.price * (1 - selectedBundle.discountPct / 100)) : (variant?.price || product.price);
  const wa = ["Assalam o Alaikum,", "", `I want to order from ${settings.storeName}.`, `Product: ${product.name}`, `Variant: ${variant?.label || "Default"}`, `Quantity: ${selectedBundle?.qty || 1}`, `Price: ${money(selectedBundle?.totalPrice || product.price)}`, "", "Please guide me about delivery."].join("\n");

  const currentMedia = mediaItems[mediaIdx] || null;

  return (
    <main>
      <section className="sec">
        <div className="breadcrumb"><span>Home</span> › <span>{product.category}</span> › <span className="bc-cur">{product.name}</span></div>
        <div className="pdp">
          <div className="pdp-gallery">
            <div className="pdp-main-box">
              {show3d ? (
                <Product3DViewer images={product.images} productName={product.name} />
              ) : currentMedia?.type === "video" ? (
                <video key={currentMedia.src} src={currentMedia.src} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", maxHeight: "500px", objectFit: "contain", background: "#000", borderRadius: "var(--r-xl)" }} />
              ) : (
                <img className="pdp-main-img" src={currentMedia?.src} alt={product.name} />
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
                      ? <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>▶</div>
                      : <img src={item.src} alt="" />
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pdp-info">
            <div className="pdp-cat">{product.category}</div>
            <h1 className="pdp-title">{product.name}</h1>
            <div className="pdp-rating-row"><RatingStars rating={product.rating} size="md" /><span className="pdp-rv">Rated {product.rating}/5 · {product.reviewCount} reviews</span><span className="pdp-verified">✓ Verified</span></div>
            <div className="pdp-price-row">
              <strong className="pdp-price">{money(selectedBundle?.totalPrice || product.price)}</strong>
              {(selectedBundle?.originalPrice || product.compareAtPrice) > (selectedBundle?.totalPrice || product.price) && (
                <><span className="pdp-old">{money(selectedBundle?.originalPrice || product.compareAtPrice)}</span><span className="pdp-save">You save {money((selectedBundle?.originalPrice || product.compareAtPrice) - (selectedBundle?.totalPrice || product.price))}</span></>
              )}
            </div>
            <ScarcityMeter stockLeft={product.stockLeft} soldCount={product.soldCount} />
            <div className="pdp-proof"><span>👁️ <strong>{viewNow}</strong> viewing now</span><span>❤️ <strong>{product.soldCount}+</strong> love this</span></div>
            {product.variants?.length > 0 && (
              <div className="pdp-variants"><h4>Select Variant:</h4><div className="var-row">{product.variants.map(v => (<button key={v.id} className={`var-chip ${variant?.id === v.id ? "active" : ""}`} onClick={() => setVariant(v)}>{v.label}</button>))}</div></div>
            )}
            <BundleSelector product={product} selectedBundle={selectedBundle} onSelect={setSelectedBundle} />
            <div className="pdp-cta-row">
              <button className="pdp-add-btn" onClick={() => addToCart(product, selectedBundle?.qty || 1, variant, effectiveUnitPrice)}>🛒 Add to Cart</button>
              <BuyNowButton onClick={() => buyNow(product, selectedBundle?.qty || 1, variant, effectiveUnitPrice)} />
            </div>
            <a className="pdp-wa-btn" href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(wa)}`} target="_blank" rel="noreferrer">📱 Order on WhatsApp</a>
            <div className="pdp-offer">🎁 <strong>Special Offer:</strong> Get 10% off on advance full payment</div>
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
        <div className="rv-grid">{product.reviews.map(r => (<div key={r.id} className="rv-card"><div className="rv-hdr"><div className="rv-av">{r.name[0]}</div><div className="rv-meta"><strong>{r.name}</strong><span>{formatDate(r.date)}</span></div><RatingStars rating={r.rating} size="md" /></div><p className="rv-text">{r.text}</p><span className="rv-verified">✓ Verified Purchase</span></div>))}</div>
      </section>
    </main>
  );
}

// ─── WISHLIST PAGE ────────────────────────────────────────────────────────────
function WishlistPage({ items, wishlist, toggleWishlist, openProduct, addToCart }) {
  return (<main><section className="sec"><div className="sec-head"><div className="eyebrow">Saved Items</div><h1 className="sec-h2">Your Wishlist</h1><p className="sec-sub">{items.length} item{items.length !== 1 ? "s" : ""} saved</p></div>{items.length ? <PGrid products={items} openProduct={openProduct} addToCart={addToCart} wishlist={wishlist} toggleWishlist={toggleWishlist} /> : (<div className="empty-state"><span className="empty-ico">♡</span><h3>Your wishlist is empty</h3><p>Save products you love and come back to them later.</p></div>)}</section></main>);
}

// ─── CART PAGE ────────────────────────────────────────────────────────────────
function CartPage({ cart, setPage, updateCartQty, removeFromCart, subtotal, shipping, total }) {
  return (
    <main><section className="sec">
      <div className="sec-head"><div className="eyebrow">Shopping Cart</div><h1 className="sec-h2">Your Cart</h1><p className="sec-sub">{cart.length} item{cart.length !== 1 ? "s" : ""}</p></div>
      {!cart.length ? (
        <div className="empty-state"><span className="empty-ico">🛒</span><h3>Your cart is empty</h3><p>Add some products to get started.</p><button className="btn-red-lg" onClick={() => setPage("shop")} style={{ marginTop: "16px" }}>Browse Products</button></div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.id} className="cart-card">
                <img src={item.image} alt={item.name} className="cart-img" />
                <div className="cart-info"><h3>{item.name}</h3><p>{item.variantLabel || "Default"}</p><strong>{money(item.price)}</strong></div>
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
            <button className="btn-checkout" onClick={() => setPage("checkout")}>Proceed to Checkout →</button>
            <button className="btn-continue" onClick={() => setPage("shop")}>Continue Shopping</button>
            <div className="secure-row"><span>🔒 Secure</span><span>💵 COD</span></div>
          </div>
        </div>
      )}
    </section></main>
  );
}

// ─── CHECKOUT PAGE ────────────────────────────────────────────────────────────
function CheckoutPage({ cart, subtotal, shipping, total, placeOrder }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", notes: "" });
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
          <div className="co-items">{cart.map(item => (<div key={item.id} className="co-row"><img src={item.image} alt={item.name} className="co-img" /><div className="co-info"><span>{item.name}</span><span className="co-var">{item.variantLabel || "Default"} × {item.qty}</span></div><strong>{money(item.price * item.qty)}</strong></div>))}</div>
          <div className="sum-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="sum-row"><span>Shipping</span><strong>{shipping === 0 ? "FREE" : money(shipping)}</strong></div>
          <div className="sum-divider" />
          <div className="sum-row total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="btn-place" onClick={() => placeOrder(form)}>✓ Place Order — {money(total)}</button>
        </div>
      </div>
    </section></main>
  );
}

// ─── CONFIRMATION PAGE ────────────────────────────────────────────────────────
function ConfirmationPage({ order, setPage }) {
  return (
    <main><section className="sec"><div className="confirm-wrap"><div className="confirm-ico">✓</div><h1>Order Placed!</h1><p>We'll contact you on WhatsApp to confirm delivery details.</p>{order && (<div className="confirm-details"><div className="cd-row-info"><span>Order ID</span><strong>{order.orderId}</strong></div><div className="cd-row-info"><span>Date</span><strong>{formatDate(order.createdAt)}</strong></div><div className="cd-row-info"><span>Total</span><strong>{money(order.total)}</strong></div><div className="cd-row-info"><span>Status</span><strong className="status-badge">{order.status}</strong></div></div>)}<div className="confirm-btns"><button className="btn-red-lg" onClick={() => setPage("home")}>Continue Shopping</button><button className="btn-outline-lg" onClick={() => setPage("shop")}>Browse More</button></div></div></section></main>
  );
}

// ─── ABOUT PAGE ───────────────────────────────────────────────────────────────
function AboutPage() {
  const cards = [{ ico: "🎯", title: "Our Mission", text: "To bring premium quality gadgets and lifestyle products to Pakistani consumers at fair prices with a seamless shopping experience." }, { ico: "🏆", title: "Why Choose Us", text: "100% authentic products, cash on delivery, fast nationwide shipping, and dedicated WhatsApp customer support 7 days a week." }, { ico: "📦", title: "Fast Delivery", text: "We dispatch within 24 hours and deliver across Pakistan in 3–5 business days." }, { ico: "💚", title: "Customer First", text: "Over 10,000 satisfied customers and counting. We prioritize your satisfaction with easy returns." }];
  return (<main><section className="sec"><div className="sec-head sec-centered"><div className="eyebrow">Our Story</div><h1 className="sec-h2">About ISmallOne PK</h1><p className="sec-sub sec-sub-center">Building Pakistan's most trusted gadget store</p></div><div className="about-grid">{cards.map(c => (<div key={c.title} className="about-card"><span className="about-ico">{c.ico}</span><h3>{c.title}</h3><p>{c.text}</p></div>))}</div></section></main>);
}

// ─── CONTACT PAGE ─────────────────────────────────────────────────────────────
function ContactPage({ settings }) {
  return (<main><section className="sec"><div className="sec-head"><div className="eyebrow">Get in Touch</div><h1 className="sec-h2">Contact Us</h1><p className="sec-sub">We're here 7 days a week</p></div><div className="contact-layout"><div className="contact-info"><h3>Support Details</h3>{[{ ico: "📱", title: "WhatsApp", val: `+${settings.whatsappNumber}` }, { ico: "✉️", title: "Email", val: settings.supportEmail }, { ico: "🕐", title: "Hours", val: "Monday to Saturday, 10am – 8pm" }, { ico: "🚚", title: "Delivery", val: "3–5 working days nationwide" }, { ico: "💵", title: "Payment", val: "Cash on Delivery available" }].map(i => (<div key={i.title} className="contact-item"><span className="ci-ico">{i.ico}</span><div><strong>{i.title}</strong><p>{i.val}</p></div></div>))}</div><div className="contact-form"><h3>Send a Message</h3><input className="field" placeholder="Your Name" /><input className="field" placeholder="Phone Number" /><input className="field" placeholder="Email Address" /><textarea className="field field-area" placeholder="Your Message" /><button className="btn-red-lg">Send Message</button></div></div></section></main>);
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

function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  return (
    <main><section className="sec">
      <div className="sec-head sec-centered"><div className="eyebrow">Order Tracking</div><h1 className="sec-h2">Track Your Order</h1><p className="sec-sub sec-sub-center">Enter your order details for live status updates</p></div>
      <div className="track-wrap">
        <div className="track-card">
          <div className="track-icon">📦</div>
          <h3>Enter Your Details</h3>
          <input className="field" placeholder="Order ID (e.g., ISO-123456)" value={orderId} onChange={e => setOrderId(e.target.value)} style={{ marginBottom: "12px" }} />
          <input className="field" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} style={{ marginBottom: "16px" }} />
          <button className="btn-red-lg" style={{ width: "100%" }} onClick={() => setSearched(true)}>Track Order</button>
          {searched && (
            <div className="track-result">
              <div className="track-timeline">
                <div className="track-step done"><div className="track-step-dot" /><div className="track-step-info"><strong>Order Placed</strong><span>Confirmed</span></div></div>
                <div className="track-step done"><div className="track-step-dot" /><div className="track-step-info"><strong>Processing</strong><span>Being prepared</span></div></div>
                <div className="track-step active"><div className="track-step-dot" /><div className="track-step-info"><strong>Dispatched</strong><span>Out for delivery</span></div></div>
                <div className="track-step"><div className="track-step-dot" /><div className="track-step-info"><strong>Delivered</strong><span>Awaiting delivery</span></div></div>
              </div>
              <div className="track-wa"><p>For real-time updates, contact us on WhatsApp:</p><a href="https://wa.me/923008631809" target="_blank" rel="noreferrer" className="pdp-wa-btn" style={{ marginTop: "10px" }}>📱 WhatsApp Support</a></div>
            </div>
          )}
        </div>
      </div>
    </section></main>
  );
}
// ─── ADMIN PRODUCT FORM WITH CLOUDINARY UPLOAD ───────────────────────────────
function AdminProductForm({ onAdd }) {
  const [form, setForm] = useState({
    name: "", category: "", price: "", compareAtPrice: "",
    shortDescription: "", description: ""
  });
  const [images, setImages] = useState([]);      // array of { url, file, preview }
  const [video, setVideo] = useState(null);       // { url, file, preview }
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imageProgress, setImageProgress] = useState([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

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
  function handleSubmit() {
    if (!validate()) return;
    onAdd({
      name: form.name,
      category: form.category || "Uncategorized",
      price: form.price,
      compareAtPrice: form.compareAtPrice,
      shortDescription: form.shortDescription,
      description: form.description,
      images: images.map(i => i.url),
      video: video?.url || null,
    });
    setForm({ name: "", category: "", price: "", compareAtPrice: "", shortDescription: "", description: "" });
    setImages([]);
    setVideo(null);
    setErrors({});
  }

  const categories = ["Hair Care", "Smart Watches", "Home Decor", "Projectors", "Home Essentials", "Summer Deals", "Accessories", "Kitchen", "Gifts"];

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
            if (files.length) handleImageSelect({ target: { files }, target: { files, value: "" } });
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
      <button className="btn-red-lg apf-submit"
        onClick={handleSubmit}
        disabled={uploadingImages || uploadingVideo}
        style={{ width: "100%", justifyContent: "center", opacity: (uploadingImages || uploadingVideo) ? 0.6 : 1 }}>
        {uploadingImages ? "⬆️ Uploading images..." :
          uploadingVideo ? "⬆️ Uploading video..." :
            "✓ Add Product"}
      </button>
    </div>
  );
}
// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
function AdminPage({
  products,
  orders,
  settings,
  setSettings,
  coupons,
  setCoupons,
  faqs,
  setFaqs,
  addProduct,
  deleteProduct,
  updateOrderStatus,
  currentUser,
  onOpenAdminAuth,
  showToast,
}) {
  const [form, setForm] = useState({ name: "", category: "", price: "", compareAtPrice: "", image: "" });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editSettings, setEditSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(settings || {});
  const [couponForm, setCouponForm] = useState({ code: "", type: "percent", value: "" });
  const [faqForm, setFaqForm] = useState({ q: "", a: "" });

  if (!currentUser || currentUser.role !== "admin") {
    return (<main><section className="sec"><div className="admin-locked"><div className="admin-lock-ico">🔐</div><h2>Admin Access Required</h2><p>This area is restricted to authorized administrators only.</p><button className="btn-red-lg" onClick={onOpenAdminAuth} style={{ marginTop: "24px" }}>Admin Login →</button></div></section></main>);
  }

  const rev = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "Pending").length;
  const tabs = [{ id: "dashboard", label: "📊 Dashboard" }, { id: "orders", label: "📦 Orders" }, { id: "products", label: "🛍️ Products" }, { id: "users", label: "👥 Users" }, { id: "coupons", label: "🎫 Coupons" }, { id: "settings", label: "⚙️ Settings" }, { id: "faq", label: "❓ FAQ" }];

  useEffect(() => {
    setSettingsForm(settings || {});
  }, [settings]);

  function saveSettings() { setSettings(prev => ({ ...prev, ...settingsForm })); setEditSettings(false); }
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
    } catch { }
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
    } catch { }
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
              <div><strong>{o.orderId || o.order_id || o.id}</strong><span>{o.customer?.name || o.customer_name} · {o.customer?.city || o.city} · {money(o.total)}</span><span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatDate(o.createdAt || o.created_at)}</span></div>
              <div className="order-acts">
                <span className={`o-status o-${(o.status || "").toLowerCase()}`}>{o.status}</span>
                <button className="o-btn" onClick={() => updateOrderStatus(o.orderId || o.order_id || o.id, "Confirmed")}>Confirm</button>
                <button className="o-btn" onClick={() => updateOrderStatus(o.orderId || o.order_id || o.id, "Shipped")}>Ship</button>
                <button className="o-btn" onClick={() => updateOrderStatus(o.orderId || o.order_id || o.id, "Delivered")} style={{ background: "#16a34a" }}>Deliver</button>
              </div>
            </div>
          )) : <div style={{ padding: "40px", color: "#888", textAlign: "center" }}>No orders yet.</div>}</div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="admin-layout">
          <div className="admin-card">
            <h3>Add New Product</h3>
            <AdminProductForm
              onAdd={(product) => {
                addProduct(product);
                showToast("Product added!");
              }}
            />
          </div>
          <div className="admin-card" style={{ overflowY: "auto", maxHeight: "600px" }}>
            <h3>Products ({products.length})</h3>
            <div className="admin-pgrid">{products.map(p => (
              <div key={p.id} className="admin-pcard">
                {p.video ? (
                  <video src={p.video} className="admin-pimg" muted playsInline />
                ) : (
                  <img src={p.images?.[0]} alt={p.name} className="admin-pimg" />
                )}
                <div className="admin-pinfo">
                  <strong>{p.name}</strong>
                  <span>{p.category}</span>
                  <span className="admin-pprice">{money(p.price)}</span>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {p.images?.length || 0} image{p.images?.length !== 1 ? "s" : ""}
                    {p.video ? " · 🎥 video" : ""}
                  </span>
                </div>
                <button className="admin-del" onClick={() => deleteProduct(p.id)}>Delete</button>
              </div>
            ))}</div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="admin-card">
          <h3>Registered Users ({[].length || 0})</h3>
          <div style={{ padding: "40px", color: "#888", textAlign: "center" }}>No registered users yet.</div>
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
            <button className="btn-red-lg" style={{ height: "40px", padding: "0 20px", fontSize: "14px" }} onClick={editSettings ? saveSettings : () => setEditSettings(true)}>{editSettings ? "💾 Save Changes" : "✏️ Edit Settings"}</button>
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
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  :root{
    --red:#d90429;--red-dark:#b5001d;--red-soft:#fff1f2;--red-border:#ffc9ce;
    --dark:#0a0a0a;--text:#111827;--muted:#6b7280;--light:#9ca3af;
    --bg:#ffffff;--bg-soft:#f9fafb;--bg-gray:#f3f4f6;--border:#e5e7eb;
    --sh:0 4px 16px rgba(0,0,0,.07);--sh-lg:0 12px 40px rgba(0,0,0,.1);--sh-xl:0 24px 60px rgba(0,0,0,.12);
    --r:12px;--r-lg:18px;--r-xl:26px;
    --font-head:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;
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

  .desktop-only{display:flex}
  .mobile-only{display:none}

  /* ── PAGE TRANSITION ── */
  .pt-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;}
  .pt-backdrop{position:absolute;inset:0;background:rgba(10,10,10,0);transition:background 0.15s ease;}
  .pt-enter .pt-backdrop{background:rgba(10,10,10,0.72);}
  .pt-exit .pt-backdrop{background:rgba(10,10,10,0);transition:background 0.3s ease 0.05s;}
  .pt-center{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transform:scale(0.85);transition:opacity 0.25s ease,transform 0.25s cubic-bezier(0.34,1.4,0.64,1);}
  .pt-enter .pt-center{opacity:1;transform:scale(1);}
  .pt-exit .pt-center{opacity:0;transform:scale(1.08);transition:opacity 0.2s ease,transform 0.2s ease;}
  .pt-logo-ring{width:72px;height:72px;background:var(--red);border-radius:20px;display:grid;place-items:center;box-shadow:0 0 0 0 rgba(217,4,41,0.5);}
  .pt-enter .pt-logo-ring{animation:ptRingPulse 0.7s ease forwards;}
  @keyframes ptRingPulse{0%{box-shadow:0 0 0 0 rgba(217,4,41,0.5)}60%{box-shadow:0 0 0 18px rgba(217,4,41,0)}100%{box-shadow:0 0 0 0 rgba(217,4,41,0)}}
  .pt-logo-mark{font-size:22px;font-weight:900;color:white;font-family:var(--font-head);letter-spacing:-1px;}
  .pt-logo-name{font-size:18px;font-weight:800;color:white;font-family:var(--font-head);letter-spacing:-0.5px;}
  .pt-line-wrap{width:160px;height:3px;background:rgba(255,255,255,0.15);border-radius:999px;overflow:hidden;margin-top:4px;}
  .pt-line-bar{height:100%;width:0%;background:white;border-radius:999px;}
  .pt-enter .pt-line-bar{animation:ptLineFill 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s forwards;}
  .pt-exit .pt-line-bar{animation:ptLineFade 0.2s ease forwards;}
  @keyframes ptLineFill{0%{width:0%;opacity:1}85%{width:100%;opacity:1}100%{width:100%;opacity:0.6}}
  @keyframes ptLineFade{from{opacity:0.6}to{opacity:0}}

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
  .admin-pimg{width:54px;height:54px;border-radius:var(--r);object-fit:cover;border:1px solid var(--border);flex-shrink:0}
  .admin-pinfo{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}
  .admin-pinfo strong{font-size:13px;font-weight:700;color:var(--dark);font-family:var(--font-head);}
  .admin-pinfo span{font-size:11px;color:var(--muted)}
  .admin-pprice{color:var(--red) !important;font-weight:700 !important}
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
  .field-err{border-color:var(--red) !important}
  .apf-submit{margin-top:8px}

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
  .pdp-video{width:100%;height:100%;object-fit:contain;border-radius:var(--r-xl);background:#000;}
  .pdp-media-tabs{display:flex;gap:8px;margin-bottom:10px;}
  .pdp-media-tabs button{padding:8px 18px;border-radius:var(--r);border:2px solid var(--border);font-size:13px;font-weight:600;color:var(--muted);background:white;transition:all .2s;cursor:pointer;}
  .pdp-media-tabs button.active{border-color:var(--red);color:var(--red);background:var(--red-soft)}

  @media(max-width:768px){
    .apf-2col{grid-template-columns:1fr}
    .upload-thumb{width:70px;height:70px}
    .upload-add-more{width:70px;height:70px}
  }
`;
// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [coupons, setCoupons] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [transitionTrigger, setTransitionTrigger] = useState(0);
  useEffect(() => {
    async function loadAll() {
      try {
        const [prods, ords, sett, coups, faqItems] = await Promise.all([
          getProducts(),
          getOrders(),
          getSettings(),
          getCoupons(),
          getFaqs(),
        ]);
        setProducts(prods || []);
        setOrders(ords || []);
        if (sett) setSettings(sett);
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

  const navigate = useCallback((p) => {
    setTransitionTrigger(t => t + 1);
    setTimeout(() => setPage(p), 200);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showToast = useCallback((msg) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast({ message: msg, visible: false }), 2500);
  }, []);

  const openProduct = useCallback((product) => {
    setCurrentProduct(product);
    navigate("product");
  }, [navigate]);

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
    navigate("checkout");
  }, [addToCart, navigate]);

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
    const order = {
      order_id: `ISO-${Date.now().toString().slice(-6)}`,
      customer: form,
      items: cart,
      subtotal,
      shipping,
      total,
      status: "Pending",
    };
    try {
      const saved = await apiPlaceOrder(order);
      setOrders(prev => [saved, ...prev]);
      setLastOrder(saved);
      setCart([]);
      navigate("confirmation");
    } catch (err) {
      showToast("Failed to place order. Try again.");
      console.error(err);
    }
  }, [cart, subtotal, shipping, total, showToast, navigate]);



  const addProduct = useCallback(async (form) => {
    if (!form.name) return;
    const newProduct = {
      slug: slugify(form.name),
      name: form.name,
      category: form.category || "Uncategorized",
      short_description: form.shortDescription || "",
      description: form.description || "",
      price: Number(form.price) || 0,
      compare_at_price: Number(form.compareAtPrice) || 0,
      stock_left: 10,
      sold_count: 0,
      featured: false,
      trending: false,
      rating: 5,
      review_count: 0,
      images: form.images || [],
      video: form.video || null,
      short_specs: [],
      variants: [{ label: "Standard", price: Number(form.price) || 0 }],
    };
    try {
      const saved = await apiAddProduct(newProduct);
      setProducts(prev => [saved, ...prev]);
      showToast("Product added!");
    } catch (err) {
      showToast("Failed to add product.");
      console.error(err);
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
      setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status } : o));
    } catch (err) {
      showToast("Failed to update order.");
      console.error(err);
    }
  }, [showToast]);



  const renderPage = () => {
    switch (page) {
      case "home": return <HomePage settings={settings} products={products} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} setPage={navigate} />;
      case "shop": return <ShopPage products={products} search={search} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} />;
      case "product": return currentProduct ? <ProductPage settings={settings} product={currentProduct} addToCart={addToCart} buyNow={buyNow} /> : null;
      case "wishlist": return <WishlistPage items={wishlistItems} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} />;
      case "cart": return <CartPage cart={cart} setPage={navigate} updateCartQty={updateCartQty} removeFromCart={removeFromCart} subtotal={subtotal} shipping={shipping} total={total} />;
      case "checkout": return <CheckoutPage cart={cart} subtotal={subtotal} shipping={shipping} total={total} placeOrder={placeOrder} />;
      case "confirmation": return <ConfirmationPage order={lastOrder} setPage={navigate} />;
      case "about": return <AboutPage />;
      case "contact": return <ContactPage settings={settings} />;
      case "shipping-policy": return <ShippingPolicyPage />;
      case "returns": return <ReturnPolicyPage />;
      case "privacy-policy": return <PrivacyPolicyPage />;
      case "terms": return <TermsPage />;
      case "faq": return <FAQPage faqs={faqs} />;
      case "track-order": return <TrackOrderPage />;
      case "admin": return <AdminPage products={products} orders={orders} settings={settings} setSettings={setSettings} coupons={coupons} setCoupons={setCoupons} faqs={faqs} setFaqs={setFaqs} addProduct={addProduct} deleteProduct={deleteProduct} updateOrderStatus={updateOrderStatus} currentUser={currentUser} onOpenAdminAuth={() => { setIsAdminLogin(true); setShowAuth(true); }} showToast={showToast} />;
      default: return <HomePage settings={settings} products={products} wishlist={wishlist} toggleWishlist={toggleWishlist} openProduct={openProduct} addToCart={addToCart} setPage={navigate} />;
    }
  };
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "16px", fontFamily: "sans-serif" }}>
      <div style={{ width: "48px", height: "48px", background: "#d90429", borderRadius: "12px", display: "grid", placeItems: "center", color: "white", fontWeight: "900", fontSize: "14px" }}>ISO</div>
      <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading store...</p>
    </div>
  );
  return (
    <>
      <style>{CSS}</style>
      <PageTransition trigger={transitionTrigger} />
      <Header settings={settings} page={page} setPage={navigate} search={search} setSearch={setSearch} cartCount={cart.reduce((s, i) => s + i.qty, 0)} wishlistCount={wishlist.length} currentUser={currentUser} onOpenAuth={() => { setIsAdminLogin(false); setShowAuth(true); }} onLogout={async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
      }} />


      {renderPage()}
      <SiteFooter setPage={navigate} />
      <WhatsAppFloat number={settings.whatsappNumber} />
      <LiveActivityFeed products={products} />
      <Toast message={toast.message} visible={toast.visible} />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onLogin={(user) => { setCurrentUser(user); showToast(`Welcome, ${user.name}!`); }} dbUsers={[]} setDbUsers={() => { }} isAdminLogin={isAdminLogin} />}
    </>
  );
}